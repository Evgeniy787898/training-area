import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  ensureTraceId,
  errorResponse,
  handleCors,
  jsonResponse,
} from "../_shared/http.ts";
import { supabase } from "../_shared/supabaseClient.ts";
import {
  GeneratedPlan,
  PlanSession,
  buildFallbackPlan,
  formatDate,
} from "../_shared/plan.ts";

const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

const requestSchema = z.object({
  profileId: z.string().uuid().optional(),
  telegramId: z.union([z.string(), z.number()]).optional(),
  date: z.string().optional(),
  dryRun: z.boolean().optional(),
});

serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) {
    return cors;
  }

  if (req.method !== "POST") {
    return errorResponse(
      crypto.randomUUID(),
      405,
      "method_not_allowed",
      "Only POST is supported",
    );
  }

  const { traceId, headers } = ensureTraceId(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    console.error("notify_daily: invalid JSON", error);
    return errorResponse(traceId, 400, "invalid_json", "Невозможно прочитать тело запроса");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(traceId, 422, "validation_failed", "Некорректные данные", {
      issues: parsed.error.issues,
    });
  }

  const { profileId, telegramId, date, dryRun } = parsed.data;

  if (!profileId && !telegramId) {
    return errorResponse(traceId, 400, "missing_identity", "Передайте profileId или telegramId");
  }

  try {
    const profile = profileId
      ? await fetchProfileById(profileId)
      : await fetchProfileByTelegramId(String(telegramId));

    if (!profile) {
      return errorResponse(traceId, 404, "profile_not_found", "Профиль не найден");
    }

    const targetDate = date ? new Date(date) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return errorResponse(traceId, 400, "invalid_date", "Некорректная дата уведомления");
    }

    const dateStr = formatDate(targetDate);
    const sessionData = await resolveSessionForDate(profile.id, dateStr, targetDate);
    const message = buildNotificationMessage({
      session: sessionData.session,
      date: targetDate,
      source: sessionData.source,
    });

    if (!dryRun) {
      await sendTelegramMessage({
        telegramId: profile.telegram_id,
        message,
      });
    }

    await logNotification({
      profileId: profile.id,
      session: sessionData.session,
      source: sessionData.source,
      traceId,
      date: dateStr,
      dryRun: dryRun ?? false,
    });

    return jsonResponse(
      {
        success: true,
        trace_id: traceId,
        delivered: !dryRun,
        source: sessionData.source,
        date: dateStr,
        preview: dryRun ? message : undefined,
      },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("notify_daily: unexpected error", error);
    return errorResponse(traceId, 500, "notification_failed", "Не удалось отправить уведомление", {
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

async function fetchProfileById(profileId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error) {
    console.error("notify_daily: failed to load profile", error);
    throw error;
  }

  return data;
}

async function fetchProfileByTelegramId(telegramId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error) {
    console.error("notify_daily: failed to load profile by telegram id", error);
    throw error;
  }

  return data;
}

async function resolveSessionForDate(
  profileId: string,
  date: string,
  reference: Date,
): Promise<{ session: PlanSession; source: string }> {
  const { data: dbSession, error: dbError } = await supabase
    .from("training_sessions")
    .select("date, session_type, status, exercises, rpe, notes")
    .eq("profile_id", profileId)
    .eq("date", date)
    .maybeSingle();

  if (dbError) {
    console.error("notify_daily: failed to fetch session", dbError);
    throw dbError;
  }

  if (dbSession) {
    return {
      session: normalizeSession(dbSession),
      source: "database",
    };
  }

  const cached = await loadCachedPlan(profileId, date);
  if (cached) {
    return {
      session: cached,
      source: "cache",
    };
  }

  const fallbackPlan = buildFallbackPlan({}, reference, "notify_fallback");
  const session = fallbackPlan.sessions.find((item) => item.date === date)
    ?? fallbackPlan.sessions[0];

  return {
    session,
    source: "fallback",
  };
}

async function loadCachedPlan(
  profileId: string,
  date: string,
): Promise<PlanSession | null> {
  const { data: dialogState, error: dialogError } = await supabase
    .from("dialog_states")
    .select("state_payload")
    .eq("profile_id", profileId)
    .eq("state_type", "ui_cached_plan")
    .maybeSingle();

  if (dialogError) {
    console.error("notify_daily: failed to load dialog state", dialogError);
  }

  const planFromState = dialogState?.state_payload?.plan as GeneratedPlan | undefined;
  const fromState = planFromState?.sessions?.find((item) => item.date === date);
  if (fromState) {
    return coercePlanSession(fromState as Record<string, unknown>, "cache");
  }

  const { data: planItem, error: planError } = await supabase
    .from("plan_version_items")
    .select("payload, plan_versions!inner(profile_id, is_active, version)")
    .eq("slot_date", date)
    .eq("plan_versions.profile_id", profileId)
    .order("plan_versions.version", { ascending: false })
    .maybeSingle();

  if (planError) {
    console.error("notify_daily: failed to load plan items", planError);
    return null;
  }

  if (planItem?.payload) {
    return coercePlanSession(planItem.payload as Record<string, unknown>, "plan_version");
  }

  return null;
}

function coercePlanSession(data: Record<string, unknown>, fallbackSource: string): PlanSession {
  const exercises = Array.isArray((data as any).exercises)
    ? ((data as any).exercises as Array<Record<string, unknown>>).map((exercise, index) => ({
        exercise_key: String(exercise.exercise_key ?? `exercise_${index + 1}`),
        name: String(exercise.name ?? "Упражнение"),
        target: typeof exercise.target === "object" && exercise.target !== null
          ? normalizeTarget(exercise.target as Record<string, unknown>)
          : undefined,
        cues: Array.isArray(exercise.cues) ? exercise.cues.map((cue) => String(cue)) : undefined,
        notes: exercise.notes ? String(exercise.notes) : undefined,
        rpe: typeof exercise.rpe === "number" ? exercise.rpe : undefined,
      }))
    : [];

  const rpeValue = typeof (data as any).rpe === "number"
    ? (data as any).rpe
    : Number.isFinite(Number((data as any).rpe)) ? Number((data as any).rpe) : undefined;

  return {
    date: String((data as any).date ?? ""),
    session_type: String((data as any).session_type ?? "Тренировка"),
    status: String((data as any).status ?? "planned"),
    focus: (data as any).focus ? String((data as any).focus) : undefined,
    intensity: (data as any).intensity ? String((data as any).intensity) : undefined,
    notes: (data as any).notes ? String((data as any).notes) : undefined,
    rpe: typeof rpeValue === "number" && !Number.isNaN(rpeValue) ? rpeValue : undefined,
    exercises,
    source: String((data as any).source ?? fallbackSource),
  };
}

function normalizeTarget(target: Record<string, unknown>) {
  const normalized: Record<string, number> = {} as Record<string, number>;

  if (typeof target.sets === "number") {
    normalized.sets = target.sets;
  } else if (Number.isFinite(Number(target.sets))) {
    normalized.sets = Number(target.sets);
  }

  if (typeof target.reps === "number") {
    normalized.reps = target.reps;
  } else if (Number.isFinite(Number(target.reps))) {
    normalized.reps = Number(target.reps);
  }

  if (typeof target.duration_seconds === "number") {
    normalized.duration_seconds = target.duration_seconds;
  } else if (Number.isFinite(Number(target.duration_seconds))) {
    normalized.duration_seconds = Number(target.duration_seconds);
  }

  return Object.keys(normalized).length ? normalized : undefined;
}

function buildNotificationMessage({
  session,
  date,
  source,
}: {
  session: PlanSession;
  date: Date;
  source: string;
}): string {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const dateLabel = formatter.format(date);
  const lines: string[] = [];
  lines.push(`🔥 <b>${escapeHtml(session.session_type)}</b>`);
  lines.push(`<i>${escapeHtml(capitalize(dateLabel))}</i>`);

  if (session.focus) {
    lines.push(`🎯 Фокус: ${escapeHtml(session.focus)}`);
  }
  if (session.intensity) {
    lines.push(`⚡ Интенсивность: ${escapeHtml(session.intensity)}`);
  }
  if (session.notes) {
    lines.push(escapeHtml(session.notes));
  }

  if (session.exercises.length) {
    lines.push("\n📝 План:");
    session.exercises.forEach((exercise, index) => {
      const parts: string[] = [];
      if (exercise.target?.sets && exercise.target?.reps) {
        parts.push(`${exercise.target.sets}×${exercise.target.reps}`);
      } else if (exercise.target?.duration_seconds) {
        parts.push(`${Math.round(exercise.target.duration_seconds / 60)} мин`);
      }
      lines.push(
        `${index + 1}. <b>${escapeHtml(exercise.name)}</b>${parts.length ? ` — ${escapeHtml(parts.join(", "))}` : ""}`,
      );
      if (exercise.cues?.length) {
        lines.push(`&nbsp;&nbsp;• ${escapeHtml(exercise.cues.join("; "))}`);
      }
    });
  } else {
    lines.push("\n💤 Сегодня фокус на восстановлении. 20 минут активной прогулки и лёгкая растяжка.");
  }

  if (session.rpe) {
    lines.push(`\n📈 Целевой RPE: ${escapeHtml(String(session.rpe))}`);
  }

  lines.push("\nПосле тренировки напиши /report и расскажи, как прошло. Если планы изменились — скажи \"перенеси тренировку\".");
  lines.push(`\nИсточник: ${escapeHtml(source)}`);

  return lines.join("\n");
}

async function sendTelegramMessage({
  telegramId,
  message,
}: {
  telegramId: number | string;
  message: string;
}) {
  if (!telegramToken) {
    throw new Error("TELEGRAM_BOT_TOKEN не задан");
  }

  const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: telegramId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    console.error("notify_daily: telegram error", response.status, payload);
    throw new Error(`Telegram API error: ${payload?.description ?? response.statusText}`);
  }
}

async function logNotification({
  profileId,
  session,
  source,
  traceId,
  date,
  dryRun,
}: {
  profileId: string;
  session: PlanSession;
  source: string;
  traceId: string;
  date: string;
  dryRun: boolean;
}) {
  await supabase.from("observability_events").insert({
    profile_id: profileId,
    category: "notify_daily",
    severity: "info",
    payload: {
      date,
      source,
      session_type: session.session_type,
      dry_run: dryRun,
    },
    trace_id: traceId,
  });

  await supabase.from("operation_log").insert({
    profile_id: profileId,
    action: "edge:notify_daily",
    status: dryRun ? "dry_run" : "sent",
    payload_hash: `${date}:${source}`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

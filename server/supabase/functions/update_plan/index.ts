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
  buildFallbackPlan,
  formatDate,
  getWeekRange,
  PlanSession,
} from "../_shared/plan.ts";

const requestSchema = z.object({
  profileId: z.string().uuid(),
  reason: z.string().default("manual"),
  referenceDate: z.string().optional(),
  traceId: z.string().optional(),
  forceFallback: z.boolean().optional(),
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
    console.error("update_plan: invalid JSON", error);
    return errorResponse(traceId, 400, "invalid_json", "Невозможно прочитать тело запроса");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(traceId, 422, "validation_failed", "Некорректные данные", {
      issues: parsed.error.issues,
    });
  }

  const { profileId, reason, referenceDate, forceFallback } = parsed.data;

  try {
    const profile = await fetchProfile(profileId);
    if (!profile) {
      return errorResponse(traceId, 404, "profile_not_found", "Профиль не найден");
    }

    const reference = referenceDate ? new Date(referenceDate) : new Date();
    if (Number.isNaN(reference.getTime())) {
      return errorResponse(traceId, 400, "invalid_reference_date", "Некорректная дата обновления");
    }

    const { weekStartStr, weekEndStr } = getWeekRange(reference);
    const recentSessions = await fetchRecentSessions(profileId, weekStartStr);

    const planResult = await generatePlan({
      profile,
      reason,
      recentSessions,
      reference,
      useFallbackOnly: forceFallback ?? false,
      traceId,
    });

    const persistence = await persistPlan({
      profileId,
      plan: planResult.plan,
      weekStartStr,
      weekEndStr,
      traceId,
    });

    await logPlanUpdate({
      profileId,
      reason,
      generator: planResult.generator,
      plan: planResult.plan,
      traceId,
      weekStartStr,
      weekEndStr,
    });

    return jsonResponse(
      {
        success: true,
        trace_id: traceId,
        generator: planResult.generator,
        version: persistence.version,
        plan_version_id: persistence.planVersionId,
        sessions: planResult.plan.sessions.length,
        week_start: weekStartStr,
        week_end: weekEndStr,
      },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("update_plan: unexpected error", error);
    return errorResponse(traceId, 500, "plan_update_failed", "Не удалось обновить план", {
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

async function fetchProfile(profileId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error) {
    console.error("update_plan: failed to load profile", error);
    throw error;
  }

  return data;
}

async function fetchRecentSessions(profileId: string, weekStart: string) {
  const { data, error } = await supabase
    .from("training_sessions")
    .select("date, session_type, status, rpe, exercises")
    .eq("profile_id", profileId)
    .lte("date", weekStart)
    .order("date", { ascending: false })
    .limit(10);

  if (error) {
    console.error("update_plan: failed to load session history", error);
    throw error;
  }

  return data ?? [];
}

async function generatePlan({
  profile,
  reason,
  recentSessions,
  reference,
  useFallbackOnly: _useFallbackOnly,
  traceId,
}: {
  profile: Record<string, unknown>;
  reason: string;
  recentSessions: Array<Record<string, unknown>>;
  reference: Date;
  useFallbackOnly: boolean;
  traceId: string;
}): Promise<{ plan: GeneratedPlan; generator: string }> {
  const internalPlan = buildInternalPlan({
    profile,
    reason,
    recentSessions,
    reference,
    traceId,
  });

  return { plan: internalPlan, generator: "internal" };
}

function buildInternalPlan({
  profile,
  reason,
  recentSessions,
  reference,
  traceId,
}: {
  profile: Record<string, unknown>;
  reason: string;
  recentSessions: Array<Record<string, unknown>>;
  reference: Date;
  traceId: string;
}): GeneratedPlan {
  const base = buildFallbackPlan(profile, reference, reason);

  const recentSummary = recentSessions
    .slice(0, 3)
    .map((session) => {
      const sessionDate = session.date ? new Date(String(session.date)) : null;
      return {
        date: sessionDate ? formatDate(sessionDate) : null,
        session_type: session.session_type ?? "unknown",
        status: session.status ?? "unknown",
        rpe: session.rpe ?? null,
      };
    });

  const sessions = base.sessions.map((session) => {
    const annotated: PlanSession = {
      ...session,
      source: "internal",
      notes: buildSessionNotes(session, { profile, reason }),
      intensity: adjustIntensity(session, { profile, reason }),
    };

    if (session.status === "rest" && reason.includes("injury")) {
      annotated.notes = `${annotated.notes || ""} Дополнительное внимание на мягкой мобилизации и дыхании.`.trim();
    }

    return annotated;
  });

  return {
    sessions,
    summary: {
      ...base.summary,
      generator: "internal",
      reason,
      recent_sessions: recentSummary,
      trace_id: traceId,
    },
    metadata: {
      ...base.metadata,
      generator: "internal",
      generated_at: new Date().toISOString(),
      adjustments: buildAdjustmentHints({ profile, reason }),
    },
  };
}

function buildSessionNotes(session: PlanSession, {
  profile,
  reason,
}: {
  profile: Record<string, unknown>;
  reason: string;
}): string | null {
  const baseNotes = session.notes || "";
  const notes: string[] = baseNotes ? [baseNotes] : [];

  if (reason.includes("recovery") || profile?.flags?.recovery_mode) {
    notes.push("Фокус на восстановлении: держи RPE 6–7, следи за дыханием.");
  }

  if (reason.includes("progress")) {
    notes.push("Добавь контроль техники: видео повторений или заметки помогут точнее адаптировать план.");
  }

  return notes.length ? notes.join(" ") : null;
}

function adjustIntensity(session: PlanSession, {
  profile,
  reason,
}: {
  profile: Record<string, unknown>;
  reason: string;
}): string | undefined {
  if (profile?.flags?.recovery_mode || reason.includes("recovery")) {
    if (session.status === "rest") {
      return "восстановление";
    }
    return "умеренная";
  }

  return session.intensity;
}

function buildAdjustmentHints({
  profile,
  reason,
}: {
  profile: Record<string, unknown>;
  reason: string;
}): Record<string, unknown> {
  const hints: Record<string, unknown> = {
    reason,
  };

  if (profile?.flags?.recovery_mode || reason.includes("recovery")) {
    hints.mode = "recovery";
  }

  if (profile?.preferences?.training_frequency) {
    hints.frequency = profile.preferences.training_frequency;
  }

  return hints;
}

async function persistPlan({
  profileId,
  plan,
  weekStartStr,
  weekEndStr,
  traceId,
}: {
  profileId: string;
  plan: GeneratedPlan;
  weekStartStr: string;
  weekEndStr: string;
  traceId: string;
}): Promise<{ planVersionId: string; version: number }> {
  const nowIso = new Date().toISOString();

  await supabase
    .from("plan_versions")
    .update({ is_active: false, deactivated_at: nowIso })
    .eq("profile_id", profileId)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("plan_versions")
    .insert({
      profile_id: profileId,
      plan,
      is_active: true,
      version_start: weekStartStr,
      version_end: weekEndStr,
      metadata: {
        trace_id: traceId,
      },
    })
    .select("id, version")
    .single();

  if (error) {
    console.error("update_plan: failed to persist plan", error);
    throw error;
  }

  return { planVersionId: data.id, version: data.version };
}

async function logPlanUpdate({
  profileId,
  reason,
  generator,
  plan,
  traceId,
  weekStartStr,
  weekEndStr,
}: {
  profileId: string;
  reason: string;
  generator: string;
  plan: GeneratedPlan;
  traceId: string;
  weekStartStr: string;
  weekEndStr: string;
}) {
  await supabase.from("plan_generation_log").insert({
    profile_id: profileId,
    generator,
    reason,
    trace_id: traceId,
    week_start: weekStartStr,
    week_end: weekEndStr,
    plan_summary: plan.summary,
    sessions: plan.sessions.length,
  });
}

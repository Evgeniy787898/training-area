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

const aiPlanSchema = z.object({
  sessions: z.array(z.object({
    date: z.string(),
    session_type: z.string(),
    status: z.string().optional(),
    focus: z.string().optional(),
    intensity: z.string().optional(),
    notes: z.string().optional(),
    rpe: z.number().min(1).max(10).optional(),
    source: z.string().optional(),
    exercises: z
      .array(
        z.object({
          exercise_key: z.string(),
          name: z.string(),
          target: z
            .object({
              sets: z.number().int().positive().optional(),
              reps: z.number().int().positive().optional(),
              duration_seconds: z.number().int().positive().optional(),
            })
            .partial()
            .optional(),
          cues: z.array(z.string()).optional(),
          notes: z.string().optional(),
          rpe: z.number().min(1).max(10).optional(),
        }),
      )
      .optional(),
  })),
  summary: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const openAiKey = Deno.env.get("OPENAI_API_KEY");
const openAiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

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
  useFallbackOnly,
  traceId,
}: {
  profile: Record<string, unknown>;
  reason: string;
  recentSessions: Array<Record<string, unknown>>;
  reference: Date;
  useFallbackOnly: boolean;
  traceId: string;
}): Promise<{ plan: GeneratedPlan; generator: string }> {
  if (!useFallbackOnly && openAiKey) {
    try {
      const planFromAi = await generatePlanWithOpenAI({
        profile,
        reason,
        recentSessions,
        reference,
        traceId,
      });

      if (planFromAi) {
        return { plan: planFromAi, generator: "openai" };
      }
    } catch (error) {
      console.warn("update_plan: AI generation failed, fallback engaged", error);
    }
  }

  const fallback = buildFallbackPlan(profile, reference, reason);
  return { plan: fallback, generator: "fallback" };
}

async function generatePlanWithOpenAI({
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
}): Promise<GeneratedPlan | null> {
  const prompt = buildPlanPrompt({ profile, reason, recentSessions, reference });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openAiKey}`,
      "x-trace-id": traceId,
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.7,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Ты — виртуальный тренер по функциональному тренингу. Всегда отвечай в формате JSON, соответствуя схеме планирования.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("update_plan: OpenAI API error", response.status, errorBody);
    return null;
  }

  const completion = await response.json();
  const content: string | undefined = completion?.choices?.[0]?.message?.content;
  if (!content) {
    console.warn("update_plan: OpenAI response missing content");
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error("update_plan: failed to parse OpenAI JSON", error, content);
    return null;
  }

  const validated = aiPlanSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("update_plan: OpenAI plan validation failed", validated.error);
    return null;
  }

  const basePlan = buildFallbackPlan(profile, reference, reason);
  const sanitizedSessions: PlanSession[] = validated.data.sessions.map((session) => ({
    date: sanitizeDate(session.date, reference),
    session_type: session.session_type,
    status: session.status ?? "planned",
    focus: session.focus,
    intensity: session.intensity,
    notes: session.notes,
    rpe: session.rpe,
    source: session.source ?? "openai",
    exercises: (session.exercises ?? []).map((exercise) => ({
      exercise_key: exercise.exercise_key,
      name: exercise.name,
      target: exercise.target,
      cues: exercise.cues,
      notes: exercise.notes,
      rpe: exercise.rpe,
    })),
  }));

  const plan: GeneratedPlan = {
    sessions: sanitizedSessions.length ? sanitizedSessions : basePlan.sessions,
    summary: {
      ...(validated.data.summary ?? {}),
      reason,
      generator: "openai",
      source_trace_id: traceId,
    },
    metadata: {
      ...(validated.data.metadata ?? {}),
      generated_at: new Date().toISOString(),
      week_start: getWeekRange(reference).weekStartStr,
      week_end: getWeekRange(reference).weekEndStr,
      generator: "openai",
    },
  };

  return plan;
}

function sanitizeDate(date: string, reference: Date): string {
  if (!date) {
    return formatDate(reference);
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return formatDate(reference);
  }
  return formatDate(parsed);
}

function buildPlanPrompt({
  profile,
  reason,
  recentSessions,
  reference,
}: {
  profile: Record<string, unknown>;
  reason: string;
  recentSessions: Array<Record<string, unknown>>;
  reference: Date;
}): string {
  const goals = profile?.goals ?? {};
  const equipment = Array.isArray(profile?.equipment) ? profile?.equipment : [];
  const frequency = Number(profile?.preferences?.training_frequency ?? 4) || 4;

  const recent = recentSessions
    .slice(0, 4)
    .map((session) =>
      `- ${session.date}: ${session.session_type ?? "Тренировка"} (status: ${session.status ?? "n/a"}, rpe: ${session.rpe ?? "n/a"})`
    )
    .join("\n");

  return `Сформируй план тренировок на неделю, начиная с ${formatDate(reference)}. Ответ в JSON с полями sessions (массив) и summary.
Каждая тренировка:
- поля date (в формате YYYY-MM-DD), session_type, status, focus, intensity, notes, rpe.
- exercises: массив объектов с полями exercise_key, name, target (sets/reps/duration_seconds), cues, notes.

Контекст:
- Цели: ${JSON.stringify(goals)}
- Доступное оборудование: ${equipment.join(", ") || "только вес тела"}
- Частота: ${frequency} тренировок в неделю
- Причина обновления: ${reason}
- История:
${recent || "нет данных"}

Обязательно включай хотя бы один день восстановления с пустым списком упражнений.`;
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

  const { data: lastVersionData, error: lastVersionError } = await supabase
    .from("plan_versions")
    .select("version")
    .eq("profile_id", profileId)
    .order("version", { ascending: false })
    .limit(1);

  if (lastVersionError) {
    console.error("update_plan: failed to load latest version", lastVersionError);
    throw lastVersionError;
  }

  const nextVersion = (lastVersionData?.[0]?.version ?? 0) + 1;

  const summaryPayload = {
    ...plan.summary,
    metadata: plan.metadata,
    week_start: weekStartStr,
    week_end: weekEndStr,
  };

  const { data: insertedPlan, error: insertPlanError } = await supabase
    .from("plan_versions")
    .insert({
      profile_id: profileId,
      version: nextVersion,
      summary: summaryPayload,
      is_active: true,
      activated_at: nowIso,
    })
    .select()
    .single();

  if (insertPlanError) {
    console.error("update_plan: failed to insert plan version", insertPlanError);
    throw insertPlanError;
  }

  const itemsPayload = plan.sessions.map((session) => ({
    plan_version_id: insertedPlan.id,
    slot_date: session.date,
    payload: session,
    slot_status: session.status ?? "planned",
  }));

  if (itemsPayload.length) {
    const { error: insertItemsError } = await supabase
      .from("plan_version_items")
      .insert(itemsPayload);

    if (insertItemsError) {
      console.error("update_plan: failed to insert plan items", insertItemsError);
      throw insertItemsError;
    }
  }

  const { error: deleteSessionsError } = await supabase
    .from("training_sessions")
    .delete()
    .eq("profile_id", profileId)
    .gte("date", weekStartStr)
    .lte("date", weekEndStr);

  if (deleteSessionsError) {
    console.error("update_plan: failed to clean week sessions", deleteSessionsError);
    throw deleteSessionsError;
  }

  const actionableSessions = plan.sessions.filter((session) =>
    session.exercises && session.exercises.length > 0
  );

  if (actionableSessions.length) {
    const { error: insertSessionsError } = await supabase
      .from("training_sessions")
      .insert(
        actionableSessions.map((session) => ({
          profile_id: profileId,
          date: session.date,
          session_type: session.session_type,
          exercises: session.exercises,
          status: session.status === "rest" ? "planned" : session.status ?? "planned",
          rpe: session.rpe ?? null,
          notes: session.notes ?? null,
          trace_id: traceId,
        })),
      );

    if (insertSessionsError) {
      console.error("update_plan: failed to insert week sessions", insertSessionsError);
      throw insertSessionsError;
    }
  }

  const expiresAt = new Date(weekEndStr);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 2);

  await supabase
    .from("dialog_states")
    .upsert(
      {
        profile_id: profileId,
        state_type: "ui_cached_plan",
        state_payload: { plan },
        expires_at: expiresAt.toISOString(),
        updated_at: nowIso,
      },
      { onConflict: "profile_id,state_type" },
    );

  return { planVersionId: insertedPlan.id, version: nextVersion };
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
  await supabase.from("observability_events").insert({
    profile_id: profileId,
    category: "plan_update",
    severity: "info",
    payload: {
      reason,
      generator,
      week_start: weekStartStr,
      week_end: weekEndStr,
      sessions: plan.sessions.length,
    },
    trace_id: traceId,
  });

  await supabase.from("operation_log").insert({
    profile_id: profileId,
    action: "edge:update_plan",
    status: "success",
    payload_hash: reason,
  });
}

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  ensureTraceId,
  errorResponse,
  handleCors,
  jsonResponse,
} from "../_shared/http.ts";
import { supabase } from "../_shared/supabaseClient.ts";

const payloadSchema = z.object({
  profileId: z.string().uuid(),
  notification_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().min(2).optional(),
  notifications_paused: z.boolean().optional(),
  pause_until: z.string().optional(),
  preferences: z.record(z.unknown()).optional(),
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
    console.error("update_settings: invalid JSON", error);
    return errorResponse(traceId, 400, "invalid_json", "Невозможно прочитать тело запроса");
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(traceId, 422, "validation_failed", "Некорректные данные", {
      issues: parsed.error.issues,
    });
  }

  const { profileId, notification_time, timezone, notifications_paused, pause_until, preferences } = parsed.data;

  if (!notification_time && !timezone && notifications_paused === undefined && !preferences && !pause_until) {
    return errorResponse(traceId, 400, "empty_payload", "Нет полей для обновления");
  }

  try {
    const profile = await loadProfile(profileId);
    if (!profile) {
      return errorResponse(traceId, 404, "profile_not_found", "Профиль не найден");
    }

    const updates: Record<string, unknown> = {};
    if (notification_time) {
      updates.notification_time = `${notification_time}:00`;
    }
    if (timezone) {
      updates.timezone = timezone;
    }
    if (notifications_paused !== undefined) {
      updates.notifications_paused = notifications_paused;
    }
    if (preferences) {
      updates.preferences = { ...(profile.preferences ?? {}), ...preferences };
    }

    const updateKeys = Object.keys(updates);
    let updatedProfile = profile;

    if (updateKeys.length) {
      const updatePayload = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", profileId)
        .select()
        .single();

      if (error) {
        console.error("update_settings: failed to update profile", error);
        throw error;
      }
      updatedProfile = data;
    }

    if (pause_until || notifications_paused !== undefined) {
      await handlePauseState({
        profileId,
        pauseUntil: pause_until,
        paused: notifications_paused,
      });
    }

    await logSettingsChange({
      profileId,
      traceId,
      updates,
      pauseUntil: pause_until,
    });

    return jsonResponse(
      {
        success: true,
        trace_id: traceId,
        profile: {
          id: updatedProfile.id,
          notification_time: updatedProfile.notification_time,
          timezone: updatedProfile.timezone,
          notifications_paused: updatedProfile.notifications_paused,
          preferences: updatedProfile.preferences,
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("update_settings: unexpected error", error);
    return errorResponse(traceId, 500, "settings_update_failed", "Не удалось обновить настройки", {
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

async function loadProfile(profileId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error) {
    console.error("update_settings: failed to load profile", error);
    throw error;
  }

  return data;
}

async function handlePauseState({
  profileId,
  pauseUntil,
  paused,
}: {
  profileId: string;
  pauseUntil?: string;
  paused?: boolean;
}) {
  if (!pauseUntil && paused === false) {
    await supabase
      .from("dialog_states")
      .delete()
      .eq("profile_id", profileId)
      .eq("state_type", "notifications_pause");
    return;
  }

  if (!pauseUntil && paused === undefined) {
    return;
  }

  const expires = pauseUntil ? new Date(pauseUntil) : new Date();
  if (Number.isNaN(expires.getTime())) {
    throw new Error("Некорректная дата pause_until");
  }

  if (!pauseUntil) {
    expires.setUTCDate(expires.getUTCDate() + 30);
  }

  await supabase
    .from("dialog_states")
    .upsert(
      {
        profile_id: profileId,
        state_type: "notifications_pause",
        state_payload: { pause_until: pauseUntil ?? null, paused: paused ?? true },
        expires_at: expires.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,state_type" },
    );
}

async function logSettingsChange({
  profileId,
  traceId,
  updates,
  pauseUntil,
}: {
  profileId: string;
  traceId: string;
  updates: Record<string, unknown>;
  pauseUntil?: string;
}) {
  await supabase.from("observability_events").insert({
    profile_id: profileId,
    category: "settings_update",
    severity: "info",
    payload: {
      updates,
      pause_until: pauseUntil,
    },
    trace_id: traceId,
  });

  await supabase.from("operation_log").insert({
    profile_id: profileId,
    action: "edge:update_settings",
    status: "success",
    payload_hash: JSON.stringify({ updates, pause_until: pauseUntil }).slice(0, 255),
  });
}

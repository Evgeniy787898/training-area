import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import type { PlanRecalculationRequest, PlanRecalculationResponse } from "./types.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const pipelineEndpoint = Deno.env.get("PIPELINE_ENDPOINT");
const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing required Supabase environment configuration");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, payload?: Record<string, unknown>) {
  const body = {
    level,
    message,
    payload,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(body));
}

async function sendSlackAlert(message: string, details?: Record<string, unknown>) {
  if (!slackWebhookUrl) return;

  try {
    await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: message,
        attachments: details ? [
          {
            mrkdwn_in: ["text"],
            text: `\n\n\`${JSON.stringify(details, null, 2)}\``,
          },
        ] : undefined,
      }),
    });
  } catch (error) {
    log("warn", "Failed to send Slack alert", { error: `${error}` });
  }
}

async function recordRunMetric(status: "success" | "failure", metadata: Record<string, unknown>) {
  const { error } = await supabase
    .from("plan_recalculation_runs")
    .insert({
      status,
      metadata,
      executed_at: new Date().toISOString(),
    });

  if (error) {
    log("warn", "Unable to record plan recalculation metrics", { error: error.message });
  }
}

async function fetchTrainingData(planId?: string) {
  const query = supabase
    .from("training_events")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(500);

  if (planId) {
    query.eq("plan_id", planId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch training data: ${error.message}`);
  }

  return data ?? [];
}

async function fetchFeedback(planId?: string) {
  const query = supabase
    .from("training_feedback")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(500);

  if (planId) {
    query.eq("plan_id", planId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch feedback data: ${error.message}`);
  }

  return data ?? [];
}

async function invokePipeline(payload: Record<string, unknown>) {
  if (!pipelineEndpoint) {
    log("warn", "PIPELINE_ENDPOINT not configured; skipping downstream invocation");
    return { plans: [] };
  }

  const response = await fetch(pipelineEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Pipeline invocation failed with status ${response.status}`);
  }

  return await response.json();
}

async function upsertPlans(plans: unknown[]) {
  if (!plans?.length) {
    log("info", "No plans returned from pipeline; skipping upsert");
    return;
  }

  const { error } = await supabase
    .from("plans")
    .upsert(plans, { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to write plans: ${error.message}`);
  }
}

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: PlanRecalculationRequest;

  try {
    payload = await request.json();
  } catch (_error) {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const startedAt = new Date().toISOString();
  log("info", "Plan recalculation triggered", { payload, startedAt });

  try {
    const [trainingEvents, feedback] = await Promise.all([
      fetchTrainingData(payload.planId),
      fetchFeedback(payload.planId),
    ]);

    const pipelinePayload = {
      planId: payload.planId,
      trainingEvents,
      feedback,
      trigger: payload.trigger ?? "manual",
    };

    const pipelineResponse = await invokePipeline(pipelinePayload);

    await upsertPlans(pipelineResponse.plans ?? []);

    const response: PlanRecalculationResponse = {
      status: "success",
      plansUpdated: pipelineResponse.plans?.length ?? 0,
      startedAt,
      completedAt: new Date().toISOString(),
    };

    await recordRunMetric("success", {
      ...payload,
      plansUpdated: response.plansUpdated,
    });

    log("info", "Plan recalculation completed", response);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;

    await recordRunMetric("failure", {
      ...payload,
      error: message,
    });

    await sendSlackAlert("Plan recalculation failed", {
      payload,
      error: message,
    });

    log("error", "Plan recalculation failed", { error: message, payload });

    const response: PlanRecalculationResponse = {
      status: "failure",
      plansUpdated: 0,
      startedAt,
      completedAt: new Date().toISOString(),
      error: message,
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        "content-type": "application/json",
      },
    });
  }
});

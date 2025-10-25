export const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,x-trace-id",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
}

export function ensureTraceId(req: Request): { traceId: string; headers: Headers } {
  const traceId = req.headers.get("x-trace-id") ?? crypto.randomUUID();
  const headers = new Headers({
    ...corsHeaders,
    "content-type": "application/json",
    "x-trace-id": traceId,
  });

  return { traceId, headers };
}

export function jsonResponse(
  data: unknown,
  init: ResponseInit & { headers?: Headers } = { status: 200 },
): Response {
  const headers = new Headers(init.headers ?? {});
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(
  traceId: string,
  status: number,
  error: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return jsonResponse(
    { error, message, trace_id: traceId, ...extra },
    { status },
  );
}

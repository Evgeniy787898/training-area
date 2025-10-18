// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

type ModerationRequest = {
  message: string;
};

type ModerationResponse = {
  allowed: boolean;
  reason?: string;
};

const bannedPatterns = [/password/i, /secret/i, /credit\s*card/i];

const moderate = (payload: ModerationRequest): ModerationResponse => {
  if (!payload.message) {
    return { allowed: false, reason: 'EMPTY_MESSAGE' };
  }

  const hasBannedContent = bannedPatterns.some((pattern) => pattern.test(payload.message));
  if (hasBannedContent) {
    return { allowed: false, reason: 'SENSITIVE_CONTENT' };
  }

  return { allowed: true };
};

serve(async (req) => {
  try {
    const input = (await req.json()) as ModerationRequest;
    const decision = moderate(input);

    return new Response(JSON.stringify(decision), {
      headers: {
        'content-type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ allowed: false, reason: 'UNEXPECTED_ERROR', details: String(error) }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
});

import OpenAI from 'openai';
import { z } from 'zod';

const openAiConfigSchema = z.object({
  apiKey: z.string().min(1, 'OPENAI_API_KEY обязателен'),
  organization: z.string().optional(),
  project: z.string().optional()
});

export const createOpenAiClient = (config) => {
  const resolved = openAiConfigSchema.parse(config);
  return new OpenAI({
    apiKey: resolved.apiKey,
    organization: resolved.organization,
    project: resolved.project
  });
};

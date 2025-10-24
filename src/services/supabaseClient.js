import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const credentialsSchema = z.object({
  url: z.string().url('SUPABASE_URL должна быть валидным URL'),
  anonKey: z.string().min(1, 'SUPABASE_ANON_KEY не может быть пустым')
});

export const createSupabaseClient = ({ url, anonKey }) => {
  const credentials = credentialsSchema.parse({ url, anonKey });
  return createClient(credentials.url, credentials.anonKey, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  });
};

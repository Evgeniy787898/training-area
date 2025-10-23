import { z } from 'zod';

const profileSchema = z.object({
  telegramId: z.string(),
  displayName: z.string().min(1),
  goal: z.string().nullable().optional(),
  readiness: z.number().int().min(1).max(5).default(3),
  preferences: z.record(z.any()).default({})
});

const sessionSchema = z.object({
  profileId: z.string().uuid(),
  plannedFor: z.string(),
  status: z.enum(['planned', 'completed', 'skipped']).default('planned'),
  intensity: z.string(),
  blocks: z.array(z.record(z.any())),
  reflection: z.string().nullable().optional()
});

export class ProgressRepository {
  constructor(client) {
    this.client = client;
  }

  async upsertProfile(input) {
    const payload = profileSchema.parse(input);

    const { data, error } = await this.client
      .from('training_profiles')
      .upsert(
        {
          telegram_id: payload.telegramId,
          display_name: payload.displayName,
          goal: payload.goal ?? null,
          readiness: payload.readiness,
          preferences: payload.preferences
        },
        { onConflict: 'telegram_id' }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Не удалось сохранить профиль: ${error.message}`);
    }

    return {
      id: data.id,
      telegramId: data.telegram_id,
      displayName: data.display_name,
      goal: data.goal,
      readiness: data.readiness,
      preferences: data.preferences
    };
  }

  async getProfileByTelegramId(telegramId) {
    const { data, error } = await this.client
      .from('training_profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Не удалось получить профиль: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      telegramId: data.telegram_id,
      displayName: data.display_name,
      goal: data.goal,
      readiness: data.readiness,
      preferences: data.preferences
    };
  }

  async createSession(input) {
    const payload = sessionSchema.parse(input);
    const { data, error } = await this.client
      .from('training_sessions')
      .insert({
        profile_id: payload.profileId,
        planned_for: payload.plannedFor,
        status: payload.status,
        intensity: payload.intensity,
        blocks: payload.blocks,
        reflection: payload.reflection ?? null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Не удалось сохранить сессию: ${error.message}`);
    }

    return data;
  }

  async listRecentSessions(profileId, limit = 5) {
    const { data, error } = await this.client
      .from('training_sessions')
      .select('*')
      .eq('profile_id', profileId)
      .order('planned_for', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Не удалось получить сессии: ${error.message}`);
    }

    return data;
  }
}

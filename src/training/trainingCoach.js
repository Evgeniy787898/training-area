import { buildCoachPrompt } from '../services/promptFactory.js';

const DEFAULT_INTENSITY = 'умеренная нагрузка';

export class TrainingCoach {
  constructor({ openAi, progressRepository }) {
    this.openAi = openAi;
    this.progressRepository = progressRepository;
  }

  async ensureProfile({ telegramId, displayName, goal, readiness, preferences }) {
    const profile = await this.progressRepository.getProfileByTelegramId(telegramId);
    if (profile) {
      return profile;
    }

    return this.progressRepository.upsertProfile({
      telegramId,
      displayName,
      goal: goal ?? null,
      readiness: readiness ?? 3,
      preferences: preferences ?? {}
    });
  }

  async updateProfile(profile, { goal, readiness, preferences }) {
    const currentPreferences = profile.preferences ?? {};
    const nextPreferences = preferences ? { ...currentPreferences, ...preferences } : currentPreferences;
    return this.progressRepository.upsertProfile({
      telegramId: profile.telegramId,
      displayName: profile.displayName,
      goal: goal ?? profile.goal,
      readiness: readiness ?? profile.readiness,
      preferences: nextPreferences
    });
  }

  async generatePlan({ profile, requestText }) {
    const sessions = await this.progressRepository.listRecentSessions(profile.id, 5);
    const prompt = buildCoachPrompt({
      userName: profile.displayName,
      goal: profile.goal,
      readiness: profile.readiness,
      sessions,
      request: requestText
    });

    const response = await this.openAi.responses.create({
      model: 'gpt-4.1-mini',
      input: prompt,
      temperature: 0.7
    });

    const content = response.output_text ?? 'Не удалось получить ответ от модели.';

    await this.progressRepository.createSession({
      profileId: profile.id,
      plannedFor: new Date().toISOString().slice(0, 10),
      intensity: DEFAULT_INTENSITY,
      blocks: [{
        label: 'AI-сессия',
        summary: requestText,
        notes: content
      }]
    });

    return content;
  }
}

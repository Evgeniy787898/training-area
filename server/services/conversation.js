import openai from './openaiClient.js';
import config from '../config/env.js';

const CONVERSATION_PROMPT = `Ты — персональный тренер по функциональному тренингу и калистенике.
Работай по правилам из «Правил ИИ и диалога»: приоритизируй intents, соблюдай протокол безопасности,
используй максимум одно уточнение и держи тон дружелюбным и мотивирующим.

Формат ответа:
1. Одно предложение-резюме.
2. Блоки **Цель**, **Разминка**, **Основная часть**, **Заминка**, **Следующий шаг** — до 5 строк каждый.
3. Эмодзи только как маркеры статуса (✅, 🔁, ⚠️, 🔥, 💤).
4. В конце — один чёткий call-to-action.
5. Если вопрос вне спорта, мягко верни разговор к тренировкам.`;

class ConversationService {
    async generateReply({ profile, message }) {
        const summary = this.buildProfileSummary(profile);

        try {
            const completion = await openai.chat.completions.create({
                model: config.openai.model,
                temperature: 0.7,
                max_tokens: 500,
                messages: [
                    { role: 'system', content: `${CONVERSATION_PROMPT}\n\n${summary}`.trim() },
                    { role: 'user', content: message },
                ],
            });

            const raw = completion.choices?.[0]?.message?.content?.trim();
            return formatStructuredReply(raw);
        } catch (error) {
            console.error('Conversation reply failed:', error);
            return null;
        }
    }

    buildProfileSummary(profile) {
        if (!profile) {
            return '';
        }

        const frequency = profile.preferences?.training_frequency
            ? `${profile.preferences.training_frequency} трен/нед`
            : 'частота по умолчанию';

        const goal = profile.goals?.description || 'цель не указана';

        return `Контекст пользователя: цель — ${goal}, оборудование — ${(profile.equipment || ['только вес тела']).join(', ')}. Частота: ${frequency}.`;
    }
}

const conversationService = new ConversationService();

export default conversationService;

function formatStructuredReply(text) {
    if (!text) {
        return text;
    }

    return text
        .replace(/\*\*(.+?)\*\*/g, (_, heading) => `${heading.toUpperCase()}:`)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

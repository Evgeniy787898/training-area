import openai from './openaiClient.js';
import config from '../config/env.js';

const CONVERSATION_PROMPT = `Ты — персональный тренер по функциональному тренингу и калистенике.
Отвечай коротко, конкретно и дружелюбно. Помогай с тренировками, восстановлением, техникой,
мотивацией и настройками бота. Если вопрос вне спорта, мягко направь пользователя обратно к тренировкам.
Используй русский язык, добавляй 1-2 эмодзи по теме и предлагай следующий шаг.`;

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

            return completion.choices?.[0]?.message?.content?.trim();
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

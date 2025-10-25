import openai from './openaiClient.js';
import config from '../config/env.js';

const KNOWN_INTENTS = new Set([
    'plan_today',
    'plan_week',
    'plan_customize',
    'report_start',
    'stats_show',
    'settings_open',
    'schedule_reschedule',
    'remind_later',
    'recovery_mode',
    'motivation',
    'technique_tip',
    'analytics_graph',
    'explain_recommendation',
    'help',
    'open_webapp',
    'fallback_conversation',
    'unknown',
]);

const SYSTEM_PROMPT = `Ты — ИИ-тренер функционального тренинга и калистеники.
Твоя задача — проанализировать сообщение пользователя и сопоставить его с картой интентов из документа «Правила ИИ и диалога».

Всегда применяй приоритет интентов: health → reschedule → report → plan → variation → analytics → technique → remind_later → notification_time → help → explain.

Формат ответа — JSON со следующими полями:
{
  "intent": string (из списка intents ниже),
  "confidence": number 0..1,
  "slots": object,
  "needs_clarification": boolean,
  "clarification_question": string | null,
  "assistant_reply": string | null,
  "candidate_intents": [{ "intent": string, "confidence": number }],
  "secondary_intent": string | null
}

Дополнительные правила:
- Если уверенность < 0.4 и нет уточняющего вопроса, верни intent "unknown" с candidate_intents (минимум два варианта, если возможно).
- assistant_reply должен следовать структуре: резюме одной строкой → блоки **Цель**, **Разминка**, **Основная часть**, **Заминка**, **Следующий шаг**. Используй эмодзи статуса (✅, 🔁, ⚠️, 🔥, 💤) и русский язык.
- Поддерживай вторичный интент (secondary_intent), если в сообщении есть ещё одна задача, которую нужно запланировать после основной.
- Для remind_later указывай slots.reminder { unit: "hours"|"minutes"|"clock", value?: number, hours?: number, minutes?: number }.
- Для schedule_reschedule указывай slots.target_date, slots.reason (если есть) и slots.preferred_shift_days.
- Если нужно уточнение, сформулируй чёткий вопрос (одна попытка) и оставь intent = intent, но установи needs_clarification = true.
- При fallback_conversation сформируй полноценный assistant_reply по правилам документа, учитывая профиль.
- Используй контекст профиля для персонализации.
- Intent open_webapp используй, когда пользователь просит открыть приложение, панель, WebApp или интерфейс. Для него assistant_reply должен быть коротким приветствием и инструкцией открыть панель.

Доступные intents: plan_today, plan_week, plan_customize, report_start, stats_show, settings_open, schedule_reschedule, remind_later, recovery_mode, motivation, technique_tip, analytics_graph, explain_recommendation, help, open_webapp, fallback_conversation, unknown.`;

function buildProfileContext(profile) {
    if (!profile) {
        return null;
    }

    const frequency = profile.preferences?.training_frequency
        ? `${profile.preferences.training_frequency} раз(а) в неделю`
        : 'частота не задана';

    const goal = profile.goals?.description || 'цель не указана';
    const equipment = Array.isArray(profile.equipment) && profile.equipment.length
        ? profile.equipment.join(', ')
        : 'только вес тела';

    return {
        id: profile.id,
        goal,
        equipment,
        frequency,
        onboarding_status: profile.preferences?.onboarding_status || 'unknown',
        recovery_mode: profile.flags?.recovery_mode || false,
    };
}

function normalizeCandidates(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map(item => ({
            intent: typeof item.intent === 'string' ? item.intent : 'unknown',
            confidence: typeof item.confidence === 'number' ? item.confidence : 0,
        }))
        .filter(item => Number.isFinite(item.confidence));
}

function sanitizeIntent(intent) {
    if (!intent || typeof intent !== 'string') {
        return 'unknown';
    }

    const trimmed = intent.trim();
    return KNOWN_INTENTS.has(trimmed) ? trimmed : 'unknown';
}

class AiCommandRouter {
    async interpret({ profile, message, history = [] }) {
        if (!message || typeof message !== 'string') {
            return {
                intent: 'unknown',
                confidence: 0,
                slots: {},
                candidate_intents: [],
            };
        }

        const payload = {
            message,
            profile: buildProfileContext(profile),
            history: history.slice(-5),
            timestamp: new Date().toISOString(),
        };

        let attempt = 0;
        let lastResult = null;

        while (attempt < 3) {
            attempt += 1;

            try {
                const completion = await openai.chat.completions.create({
                    model: config.openai.model,
                    temperature: attempt === 1 ? 0 : 0.2,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: JSON.stringify(payload) },
                    ],
                });

                const content = completion.choices?.[0]?.message?.content;
                if (!content) {
                    continue;
                }

                const parsed = JSON.parse(content);
                const normalized = {
                    intent: sanitizeIntent(parsed.intent),
                    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
                    slots: typeof parsed.slots === 'object' && parsed.slots ? parsed.slots : {},
                    needs_clarification: Boolean(parsed.needs_clarification),
                    clarification_question: parsed.clarification_question || null,
                    assistant_reply: typeof parsed.assistant_reply === 'string' ? parsed.assistant_reply.trim() : null,
                    candidate_intents: normalizeCandidates(parsed.candidate_intents),
                    secondary_intent: parsed.secondary_intent ? sanitizeIntent(parsed.secondary_intent) : null,
                };

                lastResult = normalized;

                if (normalized.needs_clarification || normalized.confidence >= 0.4 || normalized.intent === 'fallback_conversation') {
                    break;
                }
            } catch (error) {
                console.error('AI command routing failed on attempt', attempt, error);
            }
        }

        if (!lastResult) {
            return {
                intent: 'unknown',
                confidence: 0,
                slots: {},
                candidate_intents: [],
            };
        }

        if (lastResult.confidence < 0.4 && !lastResult.needs_clarification && lastResult.intent !== 'fallback_conversation') {
            return {
                ...lastResult,
                intent: 'unknown',
                clarification_question: null,
                needs_clarification: false,
                assistant_reply: null,
            };
        }

        return lastResult;
    }
}

const aiCommandRouter = new AiCommandRouter();

export default aiCommandRouter;

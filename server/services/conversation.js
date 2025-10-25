import { format } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import config from '../config/env.js';
import { createChatCompletion } from './llmGateway.js';
import { buildDefaultWeekPlan } from './staticPlan.js';
import { detectIntent } from './nlu.js';
import localResponder from './localResponder.js';

const TRAINER_PROMPT = `Ты — персональный тренер по функциональному тренингу и калистенике.
Работай по правилам из «Правил ИИ и диалога»: приоритизируй intents, соблюдай протокол безопасности,
используй максимум одно уточнение и держи тон дружелюбным и мотивирующим.

Формат ответа:
1. Одно предложение-резюме.
2. Блоки **Цель**, **Разминка**, **Основная часть**, **Заминка**, **Следующий шаг** — до 5 строк каждый.
3. Эмодзи только как маркеры статуса (✅, 🔁, ⚠️, 🔥, 💤).
4. В конце — один чёткий call-to-action.
5. Если вопрос вне спорта, мягко верни разговор к тренировкам.
6. Любое действие, которое требует интерфейса (план, отчёт, настройки), предлагай выполнить в WebApp и подсказывай попросить «Открой приложение».`;

const GENERAL_PROMPT = `Ты — интеллектуальный ассистент команды Tzona. Твоя задача — помогать пользователю по любым темам: от тренировок и восстановления до бытовых вопросов, кода и аналитики. Отвечай так же глубоко, как современный ChatGPT: поясняй ход мыслей, давай структурированные ответы, уточняй при необходимости и используй дружелюбный, профессиональный тон. Если вопрос затрагивает тренировки, опирайся на данные профиля и свежий план. Если спрашивают о несвязанном, отвечай полноценно, но сохраняй связь с предыдущей беседой. Используй язык, на котором обращается пользователь (по умолчанию — русский).`;

const TRAINER_PREFIXES = ['тренер', 'trainer', 'coach', 'босс', 'boss'];
const TRAINER_INTENTS = new Set([
    'plan.today',
    'plan.week',
    'plan.setup',
    'report.start',
    'stats.show',
    'settings.open',
    'schedule.reschedule',
    'recovery.mode',
    'remind.later',
    'motivation',
]);

const MAX_HISTORY_MESSAGES = 10;

class ConversationService {
    async generateReply({ profile, message, history = [], mode = 'chat' }) {
        if (!message) {
            return null;
        }

        const trainerTone = this.shouldUseTrainerMode({ message, mode });
        const summary = this.buildProfileSummary(profile, { trainerTone });
        const messages = buildPromptMessages({
            trainerTone,
            summary,
            history,
            message,
        });

        try {
            const completion = await createChatCompletion({
                messages,
                temperature: trainerTone ? 0.7 : 0.6,
                max_tokens: trainerTone ? 600 : 900,
            }, {
                profile,
                allowLocal: false,
            });

            const raw = completion?.choices?.[0]?.message?.content?.trim();
            if (!raw) {
                return this.buildUnavailableReply(null, { profile, message, mode, trainerTone, history });
            }

            return trainerTone ? formatStructuredReply(raw) : raw;
        } catch (error) {
            console.error('Conversation reply failed:', error);
            return this.buildUnavailableReply(error, { profile, message, mode, trainerTone, history });
        }
    }

    shouldUseTrainerMode({ message, mode }) {
        if (mode === 'command') {
            return true;
        }

        const normalized = (message || '').trim().toLowerCase();
        if (!normalized) {
            return false;
        }

        if (TRAINER_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
            return true;
        }

        const detected = detectIntent(normalized);
        return TRAINER_INTENTS.has(detected.intent);
    }

    buildProfileSummary(profile, { trainerTone } = {}) {
        if (!profile) {
            return '';
        }

        const frequencyValue =
            profile.preferences?.training_frequency ??
            profile.profile?.preferences?.training_frequency ??
            profile.training_frequency ??
            null;
        const frequency = frequencyValue ? `${frequencyValue} трен/нед` : 'частота не указана';

        const goal =
            profile.goals?.description ||
            profile.preferences?.training_goal ||
            profile.profile?.goals?.description ||
            'цель не указана';

        const equipmentList = Array.isArray(profile.equipment) && profile.equipment.length
            ? profile.equipment.join(', ')
            : 'только вес тела';

        const adherence =
            profile.adherence?.adherence_percent ??
            profile.metrics?.adherence_percent ??
            null;

        const recoveryMode = profile.flags?.recovery_mode ? 'режим восстановления активирован' : null;
        const timezone = profile.timezone || profile.preferences?.timezone || null;

        const segments = [
            `цель — ${goal}`,
            `оборудование — ${equipmentList}`,
            `частота — ${frequency}`,
            recoveryMode,
            adherence !== null ? `регулярность ${adherence}%` : null,
            timezone ? `часовой пояс ${timezone}` : null,
        ].filter(Boolean);

        const prefix = trainerTone ? 'Контекст пользователя:' : 'Профиль пользователя:';
        return `${prefix} ${segments.join('; ')}.`;
    }

    buildUnavailableReply(error, context = {}) {
        const fallback = this.buildFallbackReply(context);
        if (fallback) {
            return fallback;
        }

        if (config.app?.nodeEnv === 'development') {
            const reason = error?.message ? ` Причина: ${error.message}` : '';
            return `⚠️ AI-сервис временно недоступен. Проверь API-ключ и лимиты OpenAI.${reason}`;
        }

        return '⚠️ AI-сервис временно недоступен. Повтори запрос позже или открой WebApp командой /webapp.';
    }

    buildFallbackReply({ profile, message, mode, trainerTone, history } = {}) {
        if (!message) {
            return trainerTone ? this.buildGenericFallback(profile) : this.buildGeneralFallback(null, profile);
        }

        const { intent } = detectIntent(message);
        const treatAsTrainer = trainerTone || TRAINER_INTENTS.has(intent);

        if (!treatAsTrainer && mode !== 'command') {
            return localResponder.buildLocalReply({ message, profile, history })
                || this.buildGeneralFallback(message, profile);
        }

        switch (intent) {
            case 'plan.today':
            case 'plan.week':
                return this.buildPlanFallback(profile);
            case 'report.start':
                return this.buildReportFallback();
            case 'motivation':
                return this.buildMotivationFallback(profile);
            case 'help':
                return this.buildHelpFallback();
            case 'settings.open':
                return this.buildSettingsFallback();
            default:
                return this.buildGenericFallback(profile);
        }
    }

    buildPlanFallback(profile) {
        const frequency = profile?.preferences?.training_frequency || 4;
        const plan = buildDefaultWeekPlan({ frequency });
        const nextSession = plan.sessions?.[0];
        const dateLabel = nextSession?.date
            ? format(new Date(nextSession.date), 'd MMMM', { locale: ru })
            : null;
        const sessionName = nextSession?.focus || nextSession?.session_type || 'тренировка';

        const summary = nextSession
            ? `План готов — ${dateLabel ? `сессия на ${dateLabel}` : 'следующая тренировка'} «${sessionName}».`
            : 'Базовый план готов, можно заняться техникой и восстановлением.';

        const warmup = nextSession?.warmup?.length
            ? nextSession.warmup.join('; ')
            : '5 минут динамической разминки: круговые движения, легкие прыжки, мобилизация плеч и таза.';

        const main = nextSession?.exercises?.length
            ? nextSession.exercises
                .slice(0, 3)
                .map(ex => `${ex.name || ex.exercise_key}: ${ex.sets || '3'}×${ex.reps || '10'} (${ex.notes || 'контроль дыхания'})`)
                .join('\n')
            : '3 подхода подтягиваний/отжиманий/приседаний по 8–10 повторений с техникой «качество > количество».';

        const cooldown = nextSession?.cooldown?.length
            ? nextSession.cooldown.join('; ')
            : '5 минут растяжки грудного отдела, приводящих мышц и задней поверхности бедра.';

        return formatSections({
            summary,
            goal: 'Закрепить технику и поддержать ритм тренировок на неделе.',
            warmup,
            main,
            cooldown,
            nextStep: 'Открой WebApp и отметь тренировку, чтобы обновить прогрессию.',
        });
    }

    buildReportFallback() {
        return formatSections({
            summary: 'Запишем отчёт вручную, чтобы не терять прогресс.',
            goal: 'Зафиксировать фактический объём и ощущения от тренировки.',
            warmup: 'Освежи в памяти, какие упражнения и объём были выполнены.',
            main: 'Напиши в ответ: дата тренировки, упражнения и объём (подходы × повторы / время), итоговое RPE.',
            cooldown: 'Добавь заметки: что далось легче, где нужна корректировка.',
            nextStep: 'После сообщения я обновлю карточку тренировки и подскажу корректировки.',
        });
    }

    buildMotivationFallback(profile) {
        const adherence = profile?.metrics?.adherence_percent ?? profile?.adherence?.adherence_percent ?? null;
        const adherenceText = typeof adherence === 'number'
            ? `Регулярность держится на уровне ${adherence}% — отличный фундамент.`
            : 'Регулярность всегда важнее максимальной нагрузки — концентрируйся на стабильности.';

        return formatSections({
            summary: 'Ты проделал большую работу — закрепим ритм и сделаем очередной шаг.',
            goal: adherenceText,
            warmup: 'Перед стартом отметь, как себя чувствуешь и какой тренировке отдашь приоритет.',
            main: 'Выбери одну ключевую тренировку недели и сфокусируйся на ней: техничные повторения, умеренное RPE, уверенный темп.',
            cooldown: 'Финишируй растяжкой и дыханием 3–4 минуты — тело быстрее восстановится.',
            nextStep: 'Отметь прогресс в WebApp — так алгоритмы подстроят следующий цикл под твой ритм.',
        });
    }

    buildHelpFallback() {
        return formatSections({
            summary: 'Я помогу с планом, отчётом и настройками прямо здесь.',
            goal: 'Выбери, что хочешь сделать: посмотреть план, отчитаться или обновить цели.',
            warmup: 'Например: «Покажи план на неделю», «Я закончил тренировку», «Измени время напоминания».',
            main: 'Для отчёта пришли дату и тренировки, для плана — скажи «что сегодня» или «дай неделю».',
            cooldown: 'Если нужно больше данных, загляни в раздел «Аналитика» в WebApp.',
            nextStep: 'Напиши, что сделать сейчас, или открой WebApp командой /webapp.',
        });
    }

    buildSettingsFallback() {
        return formatSections({
            summary: 'Настройки напоминаний и целей можно обновить за минуту.',
            goal: 'Определи, что изменить: время уведомления, частоту тренировок или оборудование.',
            warmup: 'Подумай, в какое время тренировки даются легче — утро, день или вечер.',
            main: 'Напиши «Поставь напоминание на 9:00» или «Хочу 4 тренировки в неделю» — я обновлю профиль.',
            cooldown: 'Если нужно сделать паузу, скажи «Поставь режим восстановления» — уберём напоминания на пару дней.',
            nextStep: 'Подтверди изменения в WebApp, чтобы всё синхронизировалось.',
        });
    }

    buildGeneralFallback(message, profile) {
        const frequency = resolveFrequency(profile);
        const header = message
            ? `Запрос зафиксирован: «${truncateText(message, 180)}».`
            : 'Я готов продолжить обсуждение.';

        return [
            header,
            frequency ? `Держим курс на ${frequency}.` : null,
            'Сейчас отвечаю на основе локальных материалов — расскажи, какие детали важны, и предложу структуру действий или прогрессию.',
        ]
            .filter(Boolean)
            .join('\n');
    }

    buildGenericFallback(profile) {
        const frequency = profile?.preferences?.training_frequency
            ? `${profile.preferences.training_frequency} тренировки в неделю`
            : '3 тренировки в неделю';

        return formatSections({
            summary: 'Синхронизируемся и держим тренировки в комфортном ритме.',
            goal: `Основная цель — поддерживать ${frequency} с упором на технику и восстановление.`,
            warmup: 'Начни с лёгкой мобилизации и дыхания: 5 минут плавных круговых движений.',
            main: 'Выбери из плана базовую тренировку, держи RPE 7–8 и чистую технику — качество важнее максимального объёма.',
            cooldown: 'Закрепи растяжкой и фиксацией ощущения прогресса в заметке.',
            nextStep: 'Открой WebApp, отметь текущий статус и запланируй следующую сессию.',
        });
    }
}

const conversationService = new ConversationService();

export default conversationService;

function buildPromptMessages({ trainerTone, summary, history, message }) {
    const messages = [
        { role: 'system', content: trainerTone ? TRAINER_PROMPT : GENERAL_PROMPT },
    ];

    if (summary) {
        messages.push({ role: 'system', content: summary });
    }

    const historyMessages = mapHistoryForModel(history, trainerTone ? MAX_HISTORY_MESSAGES : MAX_HISTORY_MESSAGES + 4);
    if (historyMessages.length) {
        messages.push(...historyMessages);
    }

    messages.push({ role: 'user', content: message });
    return messages;
}

function mapHistoryForModel(history, limit = MAX_HISTORY_MESSAGES) {
    if (!Array.isArray(history) || history.length === 0) {
        return [];
    }

    const trimmed = history.slice(-Math.max(limit, 0));
    return trimmed
        .map(item => {
            if (!item || typeof item.content !== 'string') {
                return null;
            }
            const content = item.content.trim();
            if (!content) {
                return null;
            }
            const role = item.role === 'assistant' ? 'assistant' : 'user';
            return { role, content };
        })
        .filter(Boolean);
}

function formatStructuredReply(text) {
    if (!text) {
        return text;
    }

    return text
        .replace(/\*\*(.+?)\*\*/g, (_, heading) => `${heading.toUpperCase()}:`)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function formatSections({ summary, goal, warmup, main, cooldown, nextStep }) {
    return [
        summary,
        '',
        `ЦЕЛЬ: ${goal}`,
        '',
        `РАЗМИНКА: ${warmup}`,
        '',
        `ОСНОВНАЯ ЧАСТЬ: ${main}`,
        '',
        `ЗАМИНКА: ${cooldown}`,
        '',
        `СЛЕДУЮЩИЙ ШАГ: ${nextStep}`,
    ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function truncateText(text, maxLength = 140) {
    if (!text) {
        return '';
    }

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function resolveFrequency(profile) {
    const value =
        profile?.preferences?.training_frequency ??
        profile?.training_frequency ??
        profile?.profile?.preferences?.training_frequency ??
        null;

    if (!value) {
        return null;
    }

    return `${value} тренировки в неделю`;
}

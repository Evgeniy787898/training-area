import { format } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import { detectIntent } from './nlu.js';
import { buildDefaultWeekPlan } from './staticPlan.js';
import localResponder from './localResponder.js';

const ENGINE_ID = 'internal';
const DEFAULT_SUCCESS_THRESHOLD = 75;
const DEFAULT_RESET_THRESHOLD = 45;

const SUCCESS_KEYWORDS = /(выполн|сделал|закрыл|готово|справил|успел|finish|done)/i;
const MISS_KEYWORDS = /(не сделал|не успел|пропустил|сорвал|провал|fail|не пошло)/i;
const FATIGUE_KEYWORDS = /(устал|разбит|тяжел|тяжёл|не вывез|нет сил|перегорел)/i;

const INTENT_MAP = {
    'plan.today': 'plan_today',
    'plan.week': 'plan_week',
    'plan.setup': 'plan_customize',
    'report.start': 'report_start',
    'stats.show': 'stats_show',
    'settings.open': 'settings_open',
    'schedule.reschedule': 'schedule_reschedule',
    'recovery.mode': 'recovery_mode',
    'remind.later': 'remind_later',
    motivation: 'motivation',
    help: 'help',
};

const CANDIDATE_SUGGESTIONS = [
    { match: /(план|расписан)/i, intent: 'plan_week' },
    { match: /(отч[её]т|сдал)/i, intent: 'report_start' },
    { match: /(напомни|напомин)/i, intent: 'remind_later' },
    { match: /(мотивац|поддерж)/i, intent: 'motivation' },
];

export function getEngineCatalog({
    successThreshold = DEFAULT_SUCCESS_THRESHOLD,
    slumpThreshold = DEFAULT_RESET_THRESHOLD,
} = {}) {
    return [
        {
            id: ENGINE_ID,
            label: 'Встроенный тренер Tzona',
            description: 'Локальный движок ответов с готовыми сценариями тренировок, мотивацией и аналитикой без внешних API.',
            requires_key: false,
            available: true,
            status: 'ready',
            status_message: `Настроен на внутренние правила. Порог похвалы — ${successThreshold}%, поддержка включается ниже ${slumpThreshold}%.`,
            default: true,
        },
    ];
}

export function resolveEngine({ profile } = {}) {
    const preferred = profile?.preferences?.ai_provider;
    if (preferred && preferred !== ENGINE_ID) {
        return ENGINE_ID;
    }
    return ENGINE_ID;
}

export function interpretCommand({ profile, message, history = [] }) {
    if (!message || typeof message !== 'string') {
        return buildUnknownDecision();
    }

    const detection = detectIntent(message);
    const intent = mapIntent(detection.intent);
    const slots = buildSlots(intent, detection.entities);

    if (intent === 'remind_later' && !slots.reminder) {
        return {
            intent,
            confidence: Math.max(detection.confidence || 0.55, 0.55),
            slots,
            needs_clarification: true,
            clarification_question: 'В какое время напомнить? Могу через 30 минут, через час или к конкретному времени.',
            assistant_reply: null,
            candidate_intents: buildCandidateIntents(message, intent),
            secondary_intent: null,
        };
    }

    const assistantReply = buildStructuredReply(intent, {
        profile,
        history,
        message,
        slots,
        detection,
    });

    const confidence = determineConfidence(intent, detection.confidence, message);

    return {
        intent,
        confidence,
        slots,
        needs_clarification: false,
        clarification_question: null,
        assistant_reply: assistantReply,
        candidate_intents: buildCandidateIntents(message, intent),
        secondary_intent: null,
    };
}

export function generateTrainerReply({ profile, message, history = [] }) {
    const decision = interpretCommand({ profile, message, history });
    if (decision.needs_clarification && decision.clarification_question) {
        return decision.clarification_question;
    }
    if (decision.assistant_reply) {
        return decision.assistant_reply;
    }
    return localResponder.buildLocalReply({ profile, message, history });
}

export function generateGeneralReply({ profile, message, history = [] }) {
    const normalized = (message || '').trim();
    if (!normalized) {
        return localResponder.buildLocalReply({ profile, message: normalized, history });
    }

    const greeting = maybeBuildDynamicGreeting({ profile, message: normalized, history });
    if (greeting) {
        return greeting;
    }

    const intent = detectIntent(normalized);
    if (intent.intent === 'motivation') {
        return buildMotivationMessage({ profile, base: intent, message: normalized });
    }

    if (intent.intent === 'plan.today' || intent.intent === 'plan.week') {
        const reply = buildStructuredReply(mapIntent(intent.intent), { profile, history, message: normalized });
        return reply || localResponder.buildLocalReply({ profile, message: normalized, history });
    }

    if (FATIGUE_KEYWORDS.test(normalized)) {
        return buildFatigueReply(profile);
    }

    return localResponder.buildLocalReply({ profile, message: normalized, history });
}

export function generateTrainingPlan({ goals = {}, equipment = [], recentSessions = [], constraints = {}, profile = null } = {}) {
    const plan = buildDefaultWeekPlan({
        frequency: resolveFrequency(profile),
        goals,
        equipment,
        recentSessions,
    });

    const summary = buildPlanSummary({ goals, constraints, profile, recentSessions });

    const sections = plan.sessions?.slice(0, 4).map(formatSessionSummary).join('\n\n');

    const response = [
        summary,
        sections,
        'Следи за RPE: если держится ≥8, в следующем цикле уменьшим объём на 10%.',
        'Все детали и отметки лучше фиксировать в WebApp — так планы адаптируются автоматически.',
    ]
        .filter(Boolean)
        .join('\n\n');

    return {
        rawText: response,
        structured: {
            plan,
            summary,
        },
    };
}

export function analyzeTrainingReport({ session, exercises = [], rpe, notes, history = [], profile = null } = {}) {
    const completion = calculateCompletion(exercises);
    const tone = completion >= 1 ? 'Продолжай набирать обороты — прогресс идёт!' : completion >= 0.85
        ? 'Почти попал в план, давай подчистим детали.'
        : 'Видно, что тренировка далась тяжело — скорректируем нагрузку.';

    const feedback = formatCoachBlocks({
        summary: `${completion >= 1 ? '✅' : completion >= 0.85 ? '🔁' : '⚠️'} ${tone}`,
        goal: session?.description || 'Поддерживаем прогрессию и уверенность в движениях.',
        warmup: 'Перед следующим подходом добавь дыхание 4-4-4 и активацию корпуса резинкой.',
        main: buildMainFeedback(exercises),
        cooldown: buildCooldownAdvice(rpe, notes),
        next: suggestNextStep({ completion, rpe, history, profile }),
    });

    const suggestions = buildSuggestionsFromCompletion({ completion, rpe, notes });

    return { feedback, suggestions };
}

export function buildMotivationMessage({ adherence, progressData, currentStreak, profile } = {}) {
    const adherencePercent = adherence ?? profile?.adherence?.adherence_percent ?? null;
    const streak = currentStreak ?? profile?.adherence?.streak ?? null;

    const intro = adherencePercent !== null
        ? `Регулярность держится на уровне ${adherencePercent}% — это фундамент для прогресса.`
        : 'Ты двигаешься стабильно — это главный козырь.';

    const streakLine = streak
        ? `Серия уже ${streak} трениров${decline(streak, ['ку', 'ки', 'ок'])} подряд — не сбавляй темп!`
        : 'Добавим ещё одну тренировку в копилку и усилим привычку.';

    const progressLine = progressData
        ? `По прогрессу вижу: ${progressData}.`
        : 'Каждая отметка в журнале подтягивает план под твои цели.';

    return [
        `🔥 ${intro}`,
        streakLine,
        progressLine,
        'Следующая точка — качественная разминка и чёткий контроль техники, чтобы план работал на максимум.',
    ]
        .filter(Boolean)
        .join(' ');
}

function buildUnknownDecision() {
    return {
        intent: 'unknown',
        confidence: 0,
        slots: {},
        needs_clarification: false,
        clarification_question: null,
        assistant_reply: null,
        candidate_intents: [],
        secondary_intent: null,
    };
}

function mapIntent(rawIntent) {
    if (!rawIntent) {
        return 'unknown';
    }
    const normalized = rawIntent.trim().toLowerCase();
    return INTENT_MAP[normalized] || 'fallback_conversation';
}

function buildSlots(intent, entities = {}) {
    if (!entities || typeof entities !== 'object') {
        return {};
    }

    if (intent === 'remind_later' && entities.reminder) {
        return { reminder: entities.reminder };
    }

    if (intent === 'schedule_reschedule') {
        const slots = {};
        if (Number.isFinite(entities.preferredShiftDays)) {
            slots.preferred_shift_days = entities.preferredShiftDays;
        }
        if (entities.preferredDay) {
            slots.preferred_day = entities.preferredDay;
        }
        return slots;
    }

    return {};
}

function buildCandidateIntents(message, primaryIntent) {
    const candidates = [];
    for (const suggestion of CANDIDATE_SUGGESTIONS) {
        if (suggestion.intent === primaryIntent) {
            continue;
        }
        if (suggestion.match.test(message)) {
            candidates.push({ intent: suggestion.intent, confidence: 0.45 });
        }
    }
    return candidates.slice(0, 3);
}

function determineConfidence(intent, baseConfidence = 0.5, message = '') {
    if (intent === 'unknown') {
        return Math.min(0.4, baseConfidence);
    }
    if (intent === 'fallback_conversation') {
        return 0.5;
    }

    if (SUCCESS_KEYWORDS.test(message)) {
        return Math.max(baseConfidence, 0.75);
    }
    if (MISS_KEYWORDS.test(message)) {
        return Math.max(baseConfidence, 0.6);
    }

    return Math.max(baseConfidence, 0.55);
}

function buildStructuredReply(intent, context = {}) {
    const { profile, history, message, slots } = context;
    const summaryContext = buildProfileContext(profile);

    switch (intent) {
    case 'plan_today':
        return formatCoachBlocks(buildPlanTodayBlocks({ profile, history, summaryContext }));
    case 'plan_week':
        return formatCoachBlocks(buildPlanWeekBlocks({ profile, summaryContext }));
    case 'plan_customize':
        return formatCoachBlocks(buildPlanCustomizeBlocks({ profile, summaryContext }));
    case 'report_start':
        return formatCoachBlocks(buildReportBlocks({ profile, message }));
    case 'stats_show':
        return formatCoachBlocks(buildStatsBlocks({ profile }));
    case 'settings_open':
        return formatCoachBlocks(buildSettingsBlocks({ profile }));
    case 'schedule_reschedule':
        return formatCoachBlocks(buildRescheduleBlocks({ profile, slots }));
    case 'recovery_mode':
        return formatCoachBlocks(buildRecoveryBlocks({ profile }));
    case 'remind_later':
        return formatCoachBlocks(buildReminderBlocks({ profile, slots }));
    case 'motivation':
        return formatCoachBlocks(buildMotivationBlocks({ profile }));
    case 'technique_tip':
        return formatCoachBlocks(buildTechniqueBlocks({ profile }));
    case 'analytics_graph':
        return formatCoachBlocks(buildAnalyticsBlocks({ profile }));
    case 'help':
        return formatCoachBlocks(buildHelpBlocks({ profile }));
    case 'open_webapp':
        return formatCoachBlocks(buildOpenWebAppBlocks({ profile }));
    case 'fallback_conversation':
        return localResponder.buildLocalReply({ profile, message, history });
    default:
        return null;
    }
}

function buildPlanTodayBlocks({ profile, history, summaryContext }) {
    const plan = buildDefaultWeekPlan({ frequency: resolveFrequency(profile) });
    const session = plan.sessions?.[0];
    const focus = session?.focus || 'контроль техники и базовых паттернов';
    const warmup = session?.warmup?.length
        ? session.warmup.join('; ')
        : '5 минут динамической мобилизации + активация корпуса резинкой';
    const main = session?.exercises?.length
        ? session.exercises.slice(0, 4).map(ex => formatExerciseLine(ex)).join('; ')
        : '3 раунда: подтягивания, отжимания, планка (30 сек пауза между упражнениями)';
    const cooldown = session?.cooldown?.length
        ? session.cooldown.join('; ')
        : 'Дыхание 4-6-4, растяжка грудного отдела, проработка плеч резинкой.';

    const lastAssistant = [...history].reverse().find(item => item.role === 'assistant');
    const summary = lastAssistant?.content?.includes('✅')
        ? 'Продолжаем серию после успешной тренировки — держим темп!'
        : `Готов план на сегодня — фокус на ${focus.toLowerCase()}.`;

    return {
        summary: `${summary} ${summaryContext}`.trim(),
        goal: `Собрать аккуратные повторения и уложиться в целевой RPE 7.`,
        warmup,
        main,
        cooldown,
        next: 'Отметь результат в WebApp — так план автоматически адаптируется к твоему прогрессу.',
    };
}

function buildPlanWeekBlocks({ profile, summaryContext }) {
    const plan = buildDefaultWeekPlan({ frequency: resolveFrequency(profile) });
    const blocks = plan.sessions?.slice(0, 4).map(session => `${session.session_type}: ${session.focus}`).join('; ');
    const warmup = 'Каждую тренировку начинаем с динамической разминки 5 минут и активации корпуса.';
    const cooldown = 'После каждой сессии — дыхание 4-7-8, растяжка плеч и поясницы 5 минут.';

    return {
        summary: `Собрал недельный цикл — ${blocks || 'чергуем силу, мобильность и восстановление'}. ${summaryContext}`.trim(),
        goal: 'Поддержать баланс силы, мобильности и выносливости на неделе.',
        warmup,
        main: 'Блоки: 1) Верх тела, 2) Ноги и баланс, 3) Меткон на выносливость, 4) Восстановление и мобилизация.',
        cooldown,
        next: 'Если хочешь поменять дни или акценты — напиши, и мы пересоберём план.',
    };
}

function buildPlanCustomizeBlocks({ profile, summaryContext }) {
    const equipment = extractEquipment(profile);
    return {
        summary: `Готов уточнить план под новые вводные. ${summaryContext}`.trim(),
        goal: 'Собрать цели, оборудование и предпочтительный график, чтобы обновить микроцикл.',
        warmup: 'Напомни, есть ли ограничения или боль — подстроим разминку и объём.',
        main: `Текущий список снарядов: ${equipment}. Можно добавить новые или оставить только вес тела.`,
        cooldown: 'Если нужно, добавим дополнительные дни восстановления или мобилизации.',
        next: 'Опиши, что именно поменялось (цель, оборудование, время) — и соберу новый план.',
    };
}

function buildReportBlocks({ message }) {
    const positive = SUCCESS_KEYWORDS.test(message || '');
    const summary = positive
        ? 'Отлично, зафиксируем результат и посмотрим, как адаптировать следующий блок.'
        : 'Готов разобрать тренировку и адаптировать следующий шаг.';

    return {
        summary: `${positive ? '✅' : '📝'} ${summary}`,
        goal: 'Уточнить упражнения, объём, RPE и самочувствие, чтобы обновить прогрессию.',
        warmup: 'Напомню, что отмечать разминку не обязательно — главное, как прошла основная часть.',
        main: 'Расскажи по каждому упражнению: сколько подходов/повторов и какие ощущения. Можно тезисно.',
        cooldown: 'Если были проблемы с техникой или боль — укажи, и добавим корректировки.',
        next: 'После отчёта предложу рекомендации и скорректирую план в WebApp.',
    };
}

function buildStatsBlocks({ profile }) {
    const adherence = getAdherence(profile);
    const adherenceText = adherence !== null
        ? `Регулярность за последние недели — ${adherence}%.`
        : 'Отмечай тренировки, и покажу динамику по регулярности.';
    return {
        summary: 'Готов поделиться свежей аналитикой по объёму, RPE и регулярности.',
        goal: 'Понять, как растёт нагрузка и где добавить восстановление.',
        warmup: 'Посмотрим тренды по объёму — сколько подходов и повторов фиксируешь сейчас.',
        main: 'Разберём распределение RPE, частоту тяжёлых тренировок и выполнимость плана.',
        cooldown: adherenceText,
        next: 'Если хочешь конкретную диаграмму — напиши период, и соберу отчёт в WebApp.',
    };
}

function buildSettingsBlocks({ profile }) {
    const timezone = profile?.timezone || profile?.preferences?.timezone || 'Europe/Moscow';
    return {
        summary: 'Открываю настройки, чтобы подстроить напоминания и режим.',
        goal: 'Проверим время уведомлений и включён ли режим паузы.',
        warmup: `Текущий часовой пояс: ${timezone}.`,
        main: 'В WebApp можно задать время уведомления и частоту тренировок — всё синхронизируется с планом.',
        cooldown: 'Если нужно паузу на отпуск — включи её, и напоминания временно остановятся.',
        next: 'Скажи «Открой приложение», и перейдёшь к настройкам в один клик.',
    };
}

function buildRescheduleBlocks({ profile, slots = {} }) {
    const shift = Number(slots.preferred_shift_days) || 0;
    const shiftText = shift > 0
        ? `Сдвигаю тренировки на ${shift} ${decline(shift, ['день', 'дня', 'дней'])}.`
        : 'Зафиксирую перенос и подстрою расписание.';

    return {
        summary: `Принял запрос на перенос. ${shiftText}`,
        goal: 'Сохранить баланс нагрузки и восстановление при смене графика.',
        warmup: 'Проверю ближайшие тренировки — при необходимости заменим тяжёлый блок на технику.',
        main: 'Подберу новые даты так, чтобы между тяжёлыми днями оставалось минимум 48 часов.',
        cooldown: 'После переноса отправлю обновлённый план в WebApp.',
        next: 'Если появятся уточнения по времени или оборудованию — напиши, и сразу скорректирую.',
    };
}

function buildRecoveryBlocks({ profile }) {
    const goalLine = profile?.flags?.recovery_mode
        ? 'Режим восстановления уже активирован — продолжаем поддерживать баланс.'
        : 'Включим восстановительный режим и снизим объём на 25–30%.';
    return {
        summary: 'Переключаюсь на восстановление и мягкий режим нагрузки.',
        goal: goalLine,
        warmup: 'Добавим дыхательные практики и мягкую мобилизацию вместо интенсивной разминки.',
        main: 'Сосредоточимся на лёгких вариациях, работе на гибкость и дыхании 4-6-4.',
        cooldown: 'Контроль сна и hydration — ключ к возвращению в рабочий режим.',
        next: 'Дай знать, когда самочувствие стабилизируется — вернёмся к прогрессии.',
    };
}

function buildReminderBlocks({ slots = {} }) {
    const reminder = slots.reminder;
    let summary = 'Запишу напоминание и пришлю сигнал.';
    if (reminder?.unit === 'hours' && Number.isFinite(reminder.value)) {
        summary = `Напомню через ${reminder.value} ${decline(reminder.value, ['час', 'часа', 'часов'])}.`;
    } else if (reminder?.unit === 'minutes' && Number.isFinite(reminder.value)) {
        summary = `Напомню через ${reminder.value} ${decline(reminder.value, ['минуту', 'минуты', 'минут'])}.`;
    } else if (reminder?.unit === 'clock' && Number.isFinite(reminder.hours) && Number.isFinite(reminder.minutes)) {
        summary = `Настрою напоминание к ${String(reminder.hours).padStart(2, '0')}:${String(reminder.minutes).padStart(2, '0')}.`;
    }

    return {
        summary,
        goal: 'Помочь не забыть про тренировку или отчёт.',
        warmup: 'Пара минут дыхания перед стартом настроят фокус.',
        main: 'По сигналу напомню открыть WebApp и отметиться.',
        cooldown: 'Если планы поменяются — просто уточни новое время.',
        next: 'Напоминание активировано — жду отчёт после выполнения!',
    };
}

function buildMotivationBlocks({ profile }) {
    return {
        summary: buildMotivationMessage({ profile }),
        goal: 'Закрепить привычку тренироваться и держать ритм.',
        warmup: 'Перед следующей тренировкой вспомни, за что благодарен прошлой — так фокус легче держать.',
        main: 'Сделаем упор на ключевые упражнения недели и отметим прогресс в WebApp.',
        cooldown: 'Не забывай про сон 7–8 часов и лёгкую растяжку — это ускорит восстановление.',
        next: 'Готов к следующему шагу? Скажи «Собери план» или открой приложение.',
    };
}

function buildTechniqueBlocks() {
    return {
        summary: 'Разберём технику и контроль движения.',
        goal: 'Уточнить ключевые cues, чтобы повторения были качественными.',
        warmup: 'Перед подходом держи нейтральную спину и активный корпус.',
        main: 'Следи за дыханием: усилие на выдохе, контроль траектории на вдохе.',
        cooldown: 'После выполнения разомни связки: плечи, грудной отдел, таз.',
        next: 'Нужны конкретные подсказки по упражнению — просто назови его, и дам чек-лист.',
    };
}

function buildAnalyticsBlocks({ profile }) {
    const adherence = getAdherence(profile);
    const adherenceLine = adherence !== null
        ? `Регулярность — ${adherence}%, держим цель выше ${DEFAULT_SUCCESS_THRESHOLD}%.`
        : 'Отмечай тренировки, и соберу аналитику по регулярности.';
    return {
        summary: 'Готов сформировать графики и цифры по прогрессу.',
        goal: 'Отследить тренды по объёму и нагрузке, чтобы своевременно корректировать план.',
        warmup: 'Покажу распределение нагрузок по RPE и типам тренировок.',
        main: 'Сравним последние недели: где растёт объём, а где проседает техника.',
        cooldown: adherenceLine,
        next: 'Для подробного отчёта открой WebApp — там больше графиков и деталей.',
    };
}

function buildHelpBlocks({ profile }) {
    const equipment = extractEquipment(profile);
    return {
        summary: 'Я — твой ассистент Tzona. Расскажу, что могу.',
        goal: 'Показать основные функции и как получить нужный сценарий.',
        warmup: 'Могу собрать план на день или неделю, подстроить под оборудование и цели.',
        main: `Работаю с ${equipment}. Принимаю отчёты, анализирую прогрессию и подсказываю технику.`,
        cooldown: 'Если усталость высока — переключу план в режим восстановления.',
        next: 'Готов? Скажи, что хочешь сделать: план, отчёт, перенос или помощь по технике.',
    };
}

function buildOpenWebAppBlocks() {
    return {
        summary: 'Открою WebApp — там все планы, отчёты и аналитика.',
        goal: 'Перейти в приложение одним нажатием.',
        warmup: 'Проверь, что Telegram обновлён — WebApp откроется во встроенном браузере.',
        main: 'В приложении отметишь тренировки, изменишь график и увидишь аналитику.',
        cooldown: 'Не забудь закрыть WebApp, когда закончишь — тогда диалог продолжится здесь.',
        next: 'Нажми кнопку «Открой приложение», и продолжим там.',
    };
}

function formatCoachBlocks(blocks) {
    if (!blocks) {
        return null;
    }

    if (typeof blocks === 'string') {
        return blocks;
    }

    const { summary, goal, warmup, main, cooldown, next } = blocks;
    return [
        summary,
        goal ? `**Цель:** ${goal}` : null,
        warmup ? `**Разминка:** ${warmup}` : null,
        main ? `**Основная часть:** ${main}` : null,
        cooldown ? `**Заминка:** ${cooldown}` : null,
        next ? `**Следующий шаг:** ${next}` : null,
    ]
        .filter(Boolean)
        .join('\n');
}

function buildProfileContext(profile) {
    if (!profile) {
        return '';
    }

    const goal = extractPrimaryGoal(profile);
    const frequency = resolveFrequency(profile);
    const adherence = getAdherence(profile);
    const recovery = profile?.flags?.recovery_mode ? 'режим восстановления активен' : null;

    const parts = [
        goal ? `цель — ${goal}` : null,
        frequency ? `частота ${frequency} трен/нед` : null,
        adherence !== null ? `регулярность ${adherence}%` : null,
        recovery,
    ].filter(Boolean);

    if (!parts.length) {
        return '';
    }

    return `(${parts.join('; ')})`;
}

function extractPrimaryGoal(profile) {
    return (
        profile?.goals?.description
        || profile?.preferences?.training_goal
        || profile?.profile?.goals?.description
        || null
    );
}

function extractEquipment(profile) {
    const equipment = profile?.equipment
        || profile?.profile?.equipment
        || profile?.preferences?.equipment
        || [];

    if (Array.isArray(equipment) && equipment.length > 0) {
        return equipment.join(', ');
    }
    return 'только вес тела';
}

function resolveFrequency(profile) {
    const frequency = profile?.preferences?.training_frequency
        || profile?.profile?.preferences?.training_frequency
        || profile?.training_frequency
        || 4;
    return Number(frequency) || 4;
}

function formatExerciseLine(exercise) {
    if (!exercise) {
        return '';
    }

    const parts = [];
    if (exercise.name) {
        parts.push(exercise.name);
    }

    if (exercise.target?.sets && exercise.target?.reps) {
        parts.push(`${exercise.target.sets}×${exercise.target.reps}`);
    } else if (exercise.target?.duration_seconds) {
        parts.push(`${Math.round(exercise.target.duration_seconds / 60)} мин`);
    }

    if (exercise.cues?.length) {
        parts.push(exercise.cues[0]);
    }

    return parts.join(' — ');
}

function buildPlanSummary({ goals, constraints = {}, profile, recentSessions }) {
    const goalPrimary = goals.primary || extractPrimaryGoal(profile) || 'Поддерживать форму и прогресс';
    const equipment = extractEquipment(profile);
    const constraintParts = [];
    if (constraints.maxDuration) {
        constraintParts.push(`до ${constraints.maxDuration} минут`);
    }
    if (constraints.daysPerWeek) {
        constraintParts.push(`${constraints.daysPerWeek} трениров${decline(constraints.daysPerWeek, ['ка', 'ки', 'ок'])} в неделю`);
    }
    if (constraints.injuries) {
        constraintParts.push(`учитываем ограничения: ${constraints.injuries}`);
    }

    const historyNote = recentSessions?.length
        ? `Учитываю последние ${recentSessions.length} трениров${decline(recentSessions.length, ['ку', 'ки', 'ок'])} для прогрессии.`
        : null;

    return [
        `Цель цикла — ${goalPrimary}.`,
        `Оборудование: ${equipment}.`,
        constraintParts.length ? `Ограничения: ${constraintParts.join(', ')}.` : null,
        historyNote,
    ]
        .filter(Boolean)
        .join(' ');
}

function formatSessionSummary(session) {
    if (!session) {
        return '';
    }

    const date = session.date
        ? format(new Date(session.date), 'd MMMM', { locale: ru })
        : 'В ближайшие дни';
    const main = session.exercises?.slice(0, 3).map(ex => formatExerciseLine(ex)).join('; ');
    return [
        `**${date} — ${session.session_type}:** ${session.focus || 'фокус на технике и контроле.'}`,
        main,
        `Целевой RPE: ${session.rpe || 7}.`,
    ]
        .filter(Boolean)
        .join('\n');
}

function calculateCompletion(exercises = []) {
    if (!Array.isArray(exercises) || exercises.length === 0) {
        return 1;
    }

    let totalTarget = 0;
    let totalActual = 0;

    for (const exercise of exercises) {
        const targetSets = exercise.targetSets || exercise.target?.sets || 0;
        const targetReps = exercise.targetReps || exercise.target?.reps || 0;
        const actualSets = exercise.sets || 0;
        const actualReps = exercise.reps || 0;

        if (targetSets && targetReps) {
            totalTarget += targetSets * targetReps;
        }
        if (actualSets && actualReps) {
            totalActual += actualSets * actualReps;
        }
    }

    if (totalTarget === 0) {
        return 1;
    }
    return Math.min(1.5, totalActual / totalTarget);
}

function buildMainFeedback(exercises = []) {
    if (!Array.isArray(exercises) || !exercises.length) {
        return 'Отметь ключевые упражнения и ощущения — так я точнее подстрою следующий блок.';
    }

    const lines = exercises.slice(0, 3).map((exercise) => {
        const name = exercise.name || exercise.exercise_key || 'упражнение';
        const target = exercise.targetSets && exercise.targetReps
            ? `${exercise.targetSets}×${exercise.targetReps}`
            : exercise.target?.sets && exercise.target?.reps
                ? `${exercise.target.sets}×${exercise.target.reps}`
                : null;
        const actual = exercise.sets && exercise.reps
            ? `${exercise.sets}×${exercise.reps}`
            : null;
        const status = actual && target
            ? actual === target
                ? 'в план'
                : Number(exercise.sets) * Number(exercise.reps) > Number(exercise.targetSets || exercise.target?.sets || 0) * Number(exercise.targetReps || exercise.target?.reps || 0)
                    ? 'выше плана'
                    : 'чуть ниже плана'
            : null;
        const pieces = [name];
        if (actual) {
            pieces.push(actual);
        }
        if (target) {
            pieces.push(`план ${target}`);
        }
        if (status) {
            pieces.push(status);
        }
        return pieces.join(' — ');
    });

    return lines.join('; ');
}

function buildCooldownAdvice(rpe, notes) {
    if (Number(rpe) >= 9) {
        return 'Сделай разгрузку: лёгкая ходьба 5 минут, дыхание коробкой, сон не менее 8 часов.';
    }
    if (notes && FATIGUE_KEYWORDS.test(notes)) {
        return 'Фокус на восстановлении: растяжка спины, баня или контрастный душ, больше воды.';
    }
    return 'Заминка: дыхание 4-6-4, растяжка плеч и бёдер 5 минут, контроль пульса до 110 уд/мин.';
}

function suggestNextStep({ completion, rpe, history, profile }) {
    if (completion >= 1.05 && Number(rpe) <= 7) {
        return 'В следующей тренировке можно увеличить объём на 10% или усложнить вариацию.';
    }
    if (completion < 0.9 || Number(rpe) >= 9) {
        return 'Давай повторим этот уровень с фокусом на технике и снизим объём на 15%. Отметь, как чувствуешь себя завтра.';
    }
    const lastAssistant = [...history].reverse().find(item => item.role === 'assistant');
    if (lastAssistant?.content?.includes('🔁')) {
        return 'Закрепляем прогрессию: повтори план и постарайся сохранить качество движений.';
    }
    return 'Следуй плану из WebApp и фиксируй заметки — буду адаптировать по ощущениям.';
}

function buildSuggestionsFromCompletion({ completion, rpe, notes }) {
    const suggestions = [];
    if (completion >= 1.05 && Number(rpe) <= 7) {
        suggestions.push({ type: 'advance', confidence: 0.9 });
    } else if (completion < 0.9 || Number(rpe) >= 9) {
        suggestions.push({ type: 'regress', confidence: 0.8 });
    } else {
        suggestions.push({ type: 'hold', confidence: 0.75 });
    }

    if (notes && FATIGUE_KEYWORDS.test(notes)) {
        suggestions.push({ type: 'recovery', confidence: 0.8 });
    }

    return suggestions;
}

function maybeBuildDynamicGreeting({ profile, message, history }) {
    const isGreeting = /\b(привет|здравствуй|добрый|доброе|хай|hello|hi)\b/i.test(message);
    if (!isGreeting) {
        return null;
    }

    const status = detectGreetingStatus({ profile, message, history });
    const templates = {
        success: [
            'Привет! Видно, что тренировки заходят — держишь отличный темп. Продолжим так же уверенно?',
            'Здорово видеть! ✅ План закрыт, предлагаю закрепить успех техникой или лёгким метконом.',
            'Эй! Столько галочек в журнале — можно гордиться. Готов обсудить следующий вызов?',
        ],
        slump: [
            'Привет! Бывает, что темп сбивается — давай вместе вернём ритм.',
            'Рад связи. Даже если прошлую сессию не закрыл, это хороший повод начать с лёгкой разминки сегодня.',
            'Привет! Пропуски — часть процесса. Подскажу, как мягко вернуться на маршрут.',
        ],
        fatigue: [
            'Привет! Сначала позаботимся о восстановлении, а потом уже вернёмся к прогрессии.',
            'Рад тебя слышать. Разбитость — сигнал к внимательному режиму. Помогу настроить восстановление.',
            'Привет! Даю поддержку: снижая нагрузку вовремя, мы ускоряем прогресс. Готов перейти в мягкий режим?',
        ],
        neutral: [
            'Привет! Как чувствуешь себя сегодня? Готов подсказать по плану или восстановлению.',
            'Рад видеть! Напомню, что план ждёт тебя — скажи, если нужен апдейт.',
            'Привет! Я здесь, чтобы поддержать тренировки, восстановление и прогрессию. С чего начнём?',
        ],
    };

    const pool = templates[status] || templates.neutral;
    return pool[Math.floor(Math.random() * pool.length)];
}

function detectGreetingStatus({ profile, message, history }) {
    if (FATIGUE_KEYWORDS.test(message)) {
        return 'fatigue';
    }
    if (MISS_KEYWORDS.test(message)) {
        return 'slump';
    }
    if (SUCCESS_KEYWORDS.test(message)) {
        return 'success';
    }

    const adherence = getAdherence(profile);
    if (adherence !== null) {
        if (adherence >= DEFAULT_SUCCESS_THRESHOLD) {
            return 'success';
        }
        if (adherence <= DEFAULT_RESET_THRESHOLD) {
            return 'slump';
        }
    }

    const lastAssistant = [...(history || [])].reverse().find(item => item.role === 'assistant');
    if (lastAssistant?.content?.includes('⚠️')) {
        return 'slump';
    }

    return 'neutral';
}

function buildFatigueReply(profile) {
    const adherence = getAdherence(profile);
    const adherenceLine = adherence !== null
        ? `Регулярность держится на ${adherence}%. Главное — не выгорать.`
        : 'Регулярность не так важна, как восстановление на дистанции.';

    return [
        'Понял, что усталость накопилась. Предлагаю переключиться в режим восстановления на 2–3 дня.',
        'Сделай акцент на сон 8 часов, лёгкую мобилизацию и дыхание 4-6-4 — это сбросит напряжение.',
        adherenceLine,
        'Когда почувствуешь, что ресурсы вернулись, напиши — и постепенно вернёмся к прогрессии.',
    ].join(' ');
}

function buildMotivationMessage({ profile, base, message }) {
    const adherence = getAdherence(profile);
    const streak = profile?.adherence?.streak ?? null;

    const opener = adherence !== null && adherence >= DEFAULT_SUCCESS_THRESHOLD
        ? '🔥 Регулярность в порядке — можно двигаться смелее.'
        : '💪 Даже если темп плавный, каждая тренировка приближает к цели.';

    const streakLine = streak
        ? `Серия ${streak} трениров${decline(streak, ['ки', 'ки', 'ок'])} подряд — это серьёзно.`
        : 'Добавим ещё одну отметку, и привычка закрепится.';

    const contextLine = base?.confidence > 0.6 && SUCCESS_KEYWORDS.test(message)
        ? 'Зафиксировал успешную тренировку — поддержим разогнанный темп.'
        : 'Если что-то не зашло — адаптируем план, главное оставаться в движении.';

    return [
        opener,
        streakLine,
        contextLine,
        'Когда будешь готов, скажи «Собери план» — и продолжим прогрессию.',
    ].join(' ');
}

function getAdherence(profile) {
    const value = profile?.adherence?.adherence_percent
        ?? profile?.metrics?.adherence_percent
        ?? null;
    if (value === null) {
        return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function decline(value, forms) {
    const number = Math.abs(Number(value));
    if (!Number.isFinite(number)) {
        return forms[2];
    }
    const cases = [2, 0, 1, 1, 1, 2];
    const mod100 = number % 100;
    if (mod100 > 10 && mod100 < 20) {
        return forms[2];
    }
    const mod10 = number % 10;
    return forms[cases[Math.min(mod10, 5)]];
}

export default {
    interpretCommand,
    generateTrainerReply,
    generateGeneralReply,
    generateTrainingPlan,
    analyzeTrainingReport,
    buildMotivationMessage,
    getEngineCatalog,
    resolveEngine,
};

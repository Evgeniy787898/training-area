import { format, parseISO } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import { db } from '../infrastructure/supabase.js';
import { buildDefaultWeekPlan } from './staticPlan.js';
import { detectIntent } from './nlu.js';

const RAW_INTENT_MAP = {
    'plan.today': 'plan_today',
    'plan.week': 'plan_week',
    'plan.setup': 'plan_setup',
    'report.start': 'report_start',
    'stats.show': 'stats_show',
    'settings.open': 'settings_open',
    'schedule.reschedule': 'schedule_reschedule',
    'recovery.mode': 'recovery_mode',
    'remind.later': 'remind_later',
    'motivation': 'motivation',
    'help': 'help',
    'note.save': 'note_save',
    'triggers.help': 'triggers_help',
};

const TRAINER_INTENTS = new Set([
    'plan_today',
    'plan_week',
    'plan_setup',
    'report_start',
    'stats_show',
    'settings_open',
    'schedule_reschedule',
    'recovery_mode',
    'remind_later',
    'motivation',
    'help',
]);

const GREETING_REGEX = /(привет|доброе|здравств|hi|hello)/i;
const GRATITUDE_REGEX = /(спасибо|благодар)/i;
const FATIGUE_REGEX = /(слаб|устал|болит|не тяну|тяжел|жестко|жёстко)/i;
const EASY_REGEX = /(легко|даже не вспот|слишком просто|хочу сложнее)/i;
const NOTE_TAG_REGEX = /#([\p{L}\d_]+)/gu;
const NOTE_COMMAND_REGEXES = [
    /сохран(?:и|ить)\s*(?:эту\s+)?(?:заметку|мысль|идею)?[-:]?\s*([\s\S]+)/i,
    /заметк[аи]?\s*[-:]\s*([\s\S]+)/i,
    /запиши\s*(?:что|это|в\s*заметки)?[-:]?\s*([\s\S]+)/i,
];
const CHAT_STATE_KEY = 'ai_chat_history';
const NOTE_PREVIEW_LIMIT = 120;

function toInternalIntent(rawIntent) {
    if (!rawIntent) {
        return 'unknown';
    }
    return RAW_INTENT_MAP[rawIntent] || rawIntent.replace('.', '_') || 'unknown';
}

function randomChoice(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }
    const index = Math.floor(Math.random() * items.length);
    return items[index];
}

function shortenText(text, limit = 120) {
    if (!text) {
        return '';
    }
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= limit) {
        return normalized;
    }
    return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function extractNoteTags(content) {
    if (!content) {
        return [];
    }
    return Array.from(content.matchAll(NOTE_TAG_REGEX)).map(match => match[1].toLowerCase());
}

function parseNoteCommand(text) {
    if (!text) {
        return null;
    }

    const normalized = text.trim();

    for (const pattern of NOTE_COMMAND_REGEXES) {
        const match = normalized.match(pattern);
        if (match && match[1]) {
            const rawContent = match[1].trim();
            if (!rawContent) {
                return { content: '' };
            }

            const tags = extractNoteTags(rawContent);
            const content = rawContent;
            const preview = shortenText(content, NOTE_PREVIEW_LIMIT);
            const sentence = content.split(/[\r\n]+/u)[0]
                .split(/[.!?]/u)[0]
                .trim();

            return {
                content,
                tags,
                preview,
                title: sentence ? shortenText(sentence, 60) : 'Заметка',
            };
        }
    }

    return null;
}

function formatRelativeTimeLabel(dateInput) {
    if (!dateInput) {
        return null;
    }

    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const now = Date.now();
    const diffMs = Math.max(0, now - date.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) {
        return 'только что';
    }
    if (diffMinutes < 60) {
        return `${diffMinutes} мин назад`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours} ч назад`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
        return `${diffDays} дн назад`;
    }

    return format(date, 'd MMMM', { locale: ru });
}

function renderTemplate(template, data = {}) {
    if (!template) {
        return '';
    }
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        const value = data[key];
        return value !== undefined && value !== null ? String(value) : '';
    });
}

async function pickTemplate(category, tags = []) {
    const candidates = Array.isArray(tags) && tags.length ? tags : [null];

    for (const tag of candidates) {
        const templates = await db.getAiTemplates(category, { tag, limit: 30 });
        if (templates.length > 0) {
            return randomChoice(templates);
        }
    }

    const templates = await db.getAiTemplates(category, { limit: 30 });
    return randomChoice(templates);
}

function buildUpcomingSession(plan, referenceDate = new Date()) {
    if (!plan || !Array.isArray(plan.sessions)) {
        return null;
    }
    const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const sessions = plan.sessions
        .map(session => {
            const date = session.date ? parseISO(session.date) : null;
            return { ...session, date };
        })
        .filter(session => session.date)
        .sort((a, b) => a.date - b.date);

    const upcoming = sessions.find(session => session.date >= new Date(today.toDateString()));
    return upcoming || sessions[0] || null;
}

async function loadContext(profile) {
    if (!profile?.id) {
        return {
            completion: null,
            latestSession: null,
            plan: buildDefaultWeekPlan({}),
            adherence: null,
        };
    }

    const [completion, latestSession, adherenceSummary, fallbackPlan, recentNotes] = await Promise.all([
        db.getRecentCompletionStats(profile.id, { days: 14 }).catch((error) => {
            console.error('Failed to load completion stats:', error);
            return null;
        }),
        db.getLatestSessionSummary(profile.id).catch((error) => {
            console.error('Failed to load latest session:', error);
            return null;
        }),
        db.getAdherenceSummary(profile.id).catch((error) => {
            console.error('Failed to load adherence summary:', error);
            return null;
        }),
        db.getOrCreateFallbackWeekPlan(profile, profile.id, new Date()).catch((error) => {
            console.error('Failed to load fallback plan:', error);
            return buildDefaultWeekPlan({});
        }),
        db.getRecentAssistantNotes(profile.id, { limit: 3 }).catch((error) => {
            console.warn('Failed to load assistant notes:', error?.message || error);
            return [];
        }),
    ]);

    return {
        completion,
        latestSession,
        adherence: adherenceSummary,
        plan: fallbackPlan,
        recentNotes: Array.isArray(recentNotes) ? recentNotes : [],
    };
}

function appendMetadata(template, renderedText) {
    if (!template?.metadata) {
        return renderedText;
    }

    const extra = [];
    if (template.metadata.cta) {
        extra.push(`➡️ ${template.metadata.cta}`);
    }
    if (template.metadata.reminder) {
        extra.push(template.metadata.reminder);
    }

    if (extra.length === 0) {
        return renderedText;
    }

    return `${renderedText}\n\n${extra.join('\n')}`;
}

async function buildGreeting({ profile, context }) {
    const tags = [];
    const stats = context.completion || {};
    const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : null;

    if (profile?.flags?.recovery_mode) {
        tags.push('recovery');
    } else if (stats.lastStatus === 'done' || stats.lastStatus === 'completed') {
        tags.push('celebration');
    } else if (stats.streak >= 4) {
        tags.push('celebration');
    } else if (stats.lastStatus === 'skipped' || stats.lastStatus === 'missed') {
        tags.push('motivation');
    } else if (completionRate !== null && completionRate < 50) {
        tags.push('motivation');
    } else {
        tags.push('motivation');
    }

    const template = await pickTemplate('greeting', tags);
    const base = template
        ? appendMetadata(
            template,
            renderTemplate(template.body, {
                current_streak: stats.streak || 0,
                completion_rate: completionRate ?? 0,
            })
        )
        : 'Привет! Готов продолжать тренировки — расскажи, что планируешь сегодня?';

    const dynamicLines = [];
    if (stats.streak >= 3) {
        dynamicLines.push(`🔥 Серия держится уже ${stats.streak} дней — отличный ритм.`);
    }
    if (completionRate !== null) {
        if (completionRate >= 90) {
            dynamicLines.push('👍 Последние тренировки отработаны почти без пропусков.');
        } else if (completionRate < 50) {
            dynamicLines.push('🤝 Давай вернёмся в ритм — начнём с короткой сессии, чтобы разблокировать привычку.');
        }
    }
    if (!dynamicLines.length && context.latestSession?.status === 'done') {
        dynamicLines.push('✅ Вчерашнюю тренировку отметил, можно переходить к следующему шагу.');
    }

    return dynamicLines.length
        ? `${base}\n\n${dynamicLines.join('\n')}`
        : base;
}

async function buildMotivation({ context }) {
    const stats = context.completion || {};
    const tags = [];

    if (stats.streak >= 3) {
        tags.push('streak');
    }
    if ((stats.total && stats.completed / stats.total < 0.4) || stats.skipped >= 2) {
        tags.push('adherence_low');
    }
    if (!tags.length) {
        tags.push('comeback');
    }

    const template = await pickTemplate('motivation', tags);
    if (!template) {
        return 'Продолжай в выбранном темпе — даже маленький шаг сегодня поддержит большой прогресс завтра.';
    }

    const data = {
        current_streak: stats.streak || 0,
    };

    const rendered = renderTemplate(template.body, data);
    const note = Array.isArray(context.recentNotes) ? context.recentNotes[0] : null;

    if (note?.content) {
        const relative = formatRelativeTimeLabel(note.created_at);
        const preview = shortenText(note.content, 70);
        const noteLine = `🗒️ Последняя заметка${relative ? ` (${relative})` : ''}: «${preview}».`;
        return appendMetadata(template, `${rendered}\n\n${noteLine}`);
    }

    return appendMetadata(template, rendered);
}

async function buildPlanToday({ profile, context }) {
    const plan = context.plan || buildDefaultWeekPlan({
        frequency: profile?.preferences?.training_frequency || 4,
    });
    const upcoming = buildUpcomingSession(plan);

    const tags = [];
    if (upcoming) {
        tags.push('upcoming_session');
    } else {
        tags.push('rest_day');
    }

    const template = await pickTemplate('plan_hint', tags);
    if (!template) {
        if (upcoming) {
            const focus = upcoming.focus || upcoming.session_type;
            const dateLabel = upcoming.date ? format(upcoming.date, 'd MMMM', { locale: ru }) : 'скоро';
            return `Следующая тренировка ${dateLabel} — ${focus} (держим RPE около ${upcoming.rpe || 7}).`;
        }
        return 'Сегодня день восстановления. Добавь лёгкую мобилизацию или прогулку.';
    }

    const data = {};
    if (upcoming) {
        data.weekday = upcoming.date
            ? format(upcoming.date, 'EEEE', { locale: ru })
            : '';
        data.date_label = upcoming.date
            ? format(upcoming.date, 'd MMMM', { locale: ru })
            : '';
        data.focus = upcoming.focus || upcoming.session_type || 'Рабочая сессия';
        data.target_rpe = upcoming.rpe || 7;
    }

    const rendered = renderTemplate(template.body, data);
    const note = Array.isArray(context.recentNotes) ? context.recentNotes[0] : null;
    if (note?.content) {
        const relative = formatRelativeTimeLabel(note.created_at);
        const preview = shortenText(note.content, 70);
        const noteLine = `🗒️ Помню заметку${relative ? ` (${relative})` : ''}: «${preview}». Используй её, чтобы зафиксировать действие.`;
        return appendMetadata(template, `${rendered}\n\n${noteLine}`);
    }
    return appendMetadata(template, rendered);
}

async function buildWeekPlan({ context }) {
    const plan = context.plan || buildDefaultWeekPlan({});
    const sessions = plan.sessions || [];

    const summaryLines = sessions.slice(0, 5).map(session => {
        const date = session.date ? parseISO(session.date) : null;
        const label = date ? format(date, 'd MMM (EEEE)', { locale: ru }) : session.date;
        const focus = session.focus || session.session_type || 'Рабочая сессия';
        return `• ${label}: ${focus}`;
    });

    if (sessions.length > 5) {
        summaryLines.push(`… и ещё ${sessions.length - 5} сессий`);
    }

    const adherence = context.adherence?.adherence_percent;
    const adherenceLine = typeof adherence === 'number'
        ? `Регулярность за месяц: ${Math.round(adherence)}%.`
        : null;

    return [
        '📆 План на неделю готов. Вот основные акценты:',
        '',
        ...summaryLines,
        '',
        adherenceLine,
        'Перейди в WebApp, чтобы отметить выполненные блоки или скорректировать нагрузку.',
    ].filter(Boolean).join('\n');
}

async function buildNoteSaveReply({ profile, message, context, slots = {} }) {
    if (!profile?.id) {
        return 'Чтобы сохранять заметки, нужно авторизоваться через бот и WebApp.';
    }

    const parsed = slots?.note?.content ? slots.note : parseNoteCommand(message);

    if (!parsed?.content || !parsed.content.trim()) {
        return 'Сформулируй заметку после ключевого слова, например: «Сохрани: разгрузочная неделя с 5 по 11 мая» или «Заметка: добавить растяжку коленей».';
    }

    let note = null;
    try {
        note = await db.saveAssistantNote(profile.id, {
            title: parsed.title,
            content: parsed.content,
            tags: parsed.tags || [],
            metadata: {
                source: 'chat',
                source_message: message,
                detected_tags: parsed.tags || [],
            },
        });
    } catch (error) {
        console.error('Failed to save assistant note:', error);
        return 'Не удалось сохранить заметку. Попробуй переформулировать или повторить позже.';
    }

    try {
        await db.mergeDialogState(profile.id, CHAT_STATE_KEY, payload => ({
            ...payload,
            notes_saved: (payload?.notes_saved || 0) + 1,
            last_saved_note_id: note.id,
            last_saved_note_at: note.created_at,
            last_note_preview: parsed.preview,
            session_status: 'active',
        }));
    } catch (error) {
        console.error('Failed to update dialog state after note save:', error);
    }

    try {
        await db.logEvent(profile.id, 'assistant_note_saved', 'info', {
            note_id: note.id,
            tags: parsed.tags || [],
            preview: parsed.preview,
        });
    } catch (error) {
        console.error('Failed to log note save event:', error);
    }

    const acknowledgementOptions = [
        `🗒️ Зафиксировал: «${parsed.preview}».`,
        `📌 Записал в журнал: «${parsed.preview}».`,
        `✅ Заметка сохранена: «${parsed.preview}».`,
    ];

    const tagsLine = parsed.tags?.length
        ? `Теги: ${parsed.tags.map(tag => `#${tag}`).join(' ')}`
        : null;

    const totalNotes = Array.isArray(context?.recentNotes)
        ? context.recentNotes.length + 1
        : null;

    const progressLine = totalNotes
        ? `Теперь в журнале ${totalNotes} замет${totalNotes === 1 ? 'ка' : totalNotes < 5 ? 'ки' : 'ок'} — можно вернуться к ним в любое время.`
        : null;

    const followUps = [
        'Чтобы позже найти заметки, загляни в WebApp или попроси меня напомнить.',
        'Можешь помечать заметки хэштегами (#восстановление, #идея) — так легче их группировать.',
        'Если нужно превратить заметку в задачу — добавь «напомни» с временем в следующем сообщении.',
    ];

    return [
        randomChoice(acknowledgementOptions) || '🗒️ Заметку сохранил.',
        tagsLine,
        progressLine,
        randomChoice(followUps),
    ].filter(Boolean).join('\n\n');
}

function buildTriggersHelpReply() {
    const introVariants = [
        'Вот короткая шпаргалка по командам и триггерам:',
        'Рассказываю, что можно попросить и как сформулировать:',
        'Держи подборку команд, на которые я реагирую мгновенно:',
    ];

    const triggerCatalog = [
        { label: 'План на день', description: 'узнать ближайшую тренировку', example: 'Что по плану сегодня?' },
        { label: 'План на неделю', description: 'показать расписание', example: 'Собери план на неделю с акцентом на кор.' },
        { label: 'Отчёт', description: 'зафиксировать выполненную тренировку', example: 'Готов отчитаться за понедельник.' },
        { label: 'Мотивация', description: 'получить поддерживающее сообщение', example: 'Нужна мотивация, сорвался с графика.' },
        { label: 'Напоминание', description: 'поставить сигнал', example: 'Напомни через 30 минут потянуться.' },
        { label: 'Сохрани', description: 'создать заметку в журнале', example: 'Сохрани: растяжка бедра вечером и лёд на колено.' },
    ];

    const lines = triggerCatalog.map(item => `• ${item.label} — ${item.description}. Пример: «${item.example}».`);

    const outroVariants = [
        'Можешь комбинировать команды: например, «Сохрани заметку и напомни вечером».',
        'Если не уверен в формулировке — просто опиши задачу, я уточню детали.',
    ];

    return [
        randomChoice(introVariants) || 'Вот подсказки по триггерам:',
        '',
        ...lines,
        '',
        randomChoice(outroVariants) || 'Если появятся новые идеи — просто напиши, разберёмся.',
    ].join('\n');
}

async function buildFallback({ message }) {
    const clean = message ? shortenText(message, 140) : null;
    const variants = [
        (text) => text
            ? `Понял, о чём речь: «${text}». Скажи, нужна ли помощь с планом, отчётом, заметкой или восстановлением — так смогу ответить точнее.`
            : 'Готов подключиться: подскажи, нужен план, отчёт, заметка или восстановление?'
        ,
        (text) => {
            const intro = text ? `Вопрос «${text}» широкий.` : 'Хочу убедиться, что понял задачу.';
            return `${intro} Выбери направление: тренировка, прогрессия, напоминание или сохранение заметки.`;
        },
        (text) => {
            const intro = text ? `Давайте уточним запрос «${text}».` : 'Чтобы продолжить, мне нужна конкретика.';
            return `${intro} Например: «План на завтра», «Сохрани: цель на неделю», «Напомни в 19:00 растяжку».`;
        },
    ];

    const hint = 'Если не определился, напиши «справка по триггерам» — подскажу все быстрые команды.';

    return [
        randomChoice(variants)?.(clean) || 'Подскажи, нужна ли помощь с планом, отчётом, заметкой или восстановлением — и я разложу по шагам.',
        hint,
    ].filter(Boolean).join('\n\n');
}

function composeTrainerMessage({ intro, goal, warmup, main, cooldown, nextStep, extra }) {
    const lines = [];
    if (intro) {
        lines.push(intro);
    }
    if (goal) {
        lines.push(`**Цель:** ${goal}`);
    }
    if (warmup) {
        lines.push(`**Разминка:** ${warmup}`);
    }
    if (main) {
        lines.push(`**Основная часть:** ${main}`);
    }
    if (cooldown) {
        lines.push(`**Заминка:** ${cooldown}`);
    }
    if (nextStep) {
        lines.push(`**Следующий шаг:** ${nextStep}`);
    }
    if (extra) {
        lines.push(extra);
    }
    return lines.join('\n');
}

function formatExerciseLine(exercise) {
    if (!exercise) {
        return null;
    }
    const name = exercise.name || exercise.exercise_key || 'Упражнение';
    const sets = exercise.sets ?? exercise.target?.sets;
    const reps = exercise.reps ?? exercise.target?.reps;
    const volume = sets && reps ? `${sets}×${reps}` : null;
    const cue = exercise.notes || exercise.cue || null;
    return [name, volume, cue].filter(Boolean).join(' — ');
}

function formatWarmup(session) {
    if (Array.isArray(session?.warmup) && session.warmup.length) {
        return session.warmup.join('; ');
    }
    return '5 минут динамической мобилизации: плечи, таз, лёгкое кардио.';
}

function formatCooldown(session) {
    if (Array.isArray(session?.cooldown) && session.cooldown.length) {
        return session.cooldown.join('; ');
    }
    return 'Дыхание 4-6-4 и растяжка грудного отдела, 3 минуты на расслабление.';
}

async function buildTrainerPlanToday({ profile, context }) {
    const plan = context.plan || buildDefaultWeekPlan({
        frequency: profile?.preferences?.training_frequency || 4,
    });
    const upcoming = buildUpcomingSession(plan);
    const stats = context.completion || {};

    if (!upcoming) {
        return composeTrainerMessage({
            intro: 'Сегодня в цикле день восстановления.',
            goal: 'Провести качественное восстановление и подготовиться к следующей сессии.',
            warmup: '10 минут лёгкой прогулки или кардио дома.',
            main: 'Мобилизация позвоночника, дыхательная практика, мягкое растяжение ног и плеч.',
            cooldown: 'Контроль дыхания и запись ощущений в заметки.',
            nextStep: 'Отметь восстановительный день в WebApp, чтобы план учёл паузу.',
        });
    }

    const dateLabel = upcoming.date
        ? format(upcoming.date, 'd MMMM (EEEE)', { locale: ru })
        : 'сегодня';
    const focus = upcoming.focus || upcoming.session_type || 'Рабочая сессия';
    const goalLine = stats.streak >= 3
        ? 'Сохранить серию и удержать технику на уровне.'
        : stats.lastStatus === 'skipped'
            ? 'Вернуться в ритм через управляемую нагрузку.'
            : 'Отработать ключевые движения и зафиксировать ощущения.';

    const mainBlock = (upcoming.exercises || [])
        .slice(0, 3)
        .map(formatExerciseLine)
        .filter(Boolean)
        .join('; ')
        || '3 круга: подтягивания, отжимания, планка — держим технику и дыхание.';

    return composeTrainerMessage({
        intro: `📋 План на ${dateLabel}: фокус — ${focus}, держим RPE около ${upcoming.rpe || 7}.`,
        goal: goalLine,
        warmup: formatWarmup(upcoming),
        main: mainBlock,
        cooldown: formatCooldown(upcoming),
        nextStep: 'После тренировки отметь результат и RPE, чтобы обновить прогрессию.',
        extra: upcoming.notes || null,
    });
}

async function buildTrainerPlanWeek({ profile, context }) {
    const plan = context.plan || buildDefaultWeekPlan({
        frequency: profile?.preferences?.training_frequency || 4,
    });
    const sessions = plan.sessions || [];

    if (!sessions.length) {
        return 'Не нашёл активных сессий. Скажи «Собери план», и я предложу базовый микроцикл.';
    }

    const lines = sessions.map(session => {
        const date = session.date ? parseISO(session.date) : null;
        const label = date ? format(date, 'd MMMM (EEEE)', { locale: ru }) : session.date;
        const focus = session.focus || session.session_type || 'Рабочая сессия';
        return `• ${label}: ${focus}, RPE ≈ ${session.rpe || 7}`;
    });

    return [
        '📆 План на неделю готов. Раскладываю по дням:',
        ...lines,
        '',
        'Следи за ощущениями: при усталости можно сдвинуть тренировку или попросить облегчённую версию.',
        'Отмечай выполнение в WebApp — по данным обновлю прогрессии.',
    ].join('\n');
}

function buildReportKickoffReply() {
    return [
        '📝 Готов принять отчёт о тренировке.',
        '**Цель:** Зафиксировать объём, RPE и самочувствие, чтобы адаптировать план.',
        '**Разминка:** Расскажи, нужна ли была адаптация перед основным блоком.',
        '**Основная часть:** Перечисли упражнения с подходами и повторами, добавь ощущения.',
        '**Заминка:** Сообщи про восстановление: растяжка, сон, питание.',
        '**Следующий шаг:** После отчёта предложу рекомендации и обновлю план в WebApp.',
    ].join('\n');
}

function buildRescheduleReply({ slots }) {
    const shift = slots?.preferredShiftDays;
    const preferredDay = slots?.preferredDay;
    const lines = ['🔄 Перенесу тренировку.'];

    if (shift) {
        lines.push(`Смещаем на ${shift === 1 ? 'завтра' : `+${shift} дней`}.`);
    }
    if (preferredDay) {
        lines.push(`Учту пожелание тренироваться в день: ${preferredDay}.`);
    }

    lines.push('Если нужно точное время или диапазон — напиши, уточню перед переносом.');
    return lines.join(' ');
}

function buildReminderReply({ slots, needsClarification }) {
    if (needsClarification || !slots?.reminder) {
        return 'Чтобы поставить напоминание, назови время: «через 30 минут» или «в 19:30».';
    }

    const { unit, value, hours, minutes } = slots.reminder;
    let when = null;
    if (unit === 'hours' || unit === 'minutes') {
        const suffix = unit === 'hours' ? 'час' : 'минут';
        when = `через ${value} ${suffix}`;
    } else if (unit === 'clock') {
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        when = `в ${hh}:${mm}`;
    }
    return when
        ? `⏰ Напоминание поставлено ${when}. Сообщу, когда придёт время.`
        : 'Готов поставить напоминание — уточни время, чтобы не промахнуться.';
}

function buildSettingsReply() {
    return [
        '⚙️ Настройки доступны в WebApp.',
        'Могу обновить время уведомлений, включить паузу или изменить частоту тренировок — просто напиши параметры.',
        'Командой «Открой приложение» пришлю кнопку для перехода.',
    ].join('\n');
}

async function buildStatsReply({ profile, context }) {
    const stats = context.completion || {};
    const adherence = context.adherence;
    const latest = context.latestSession;

    const lines = ['📊 Краткий отчёт по прогрессу:'];

    if (typeof adherence?.adherence_percent === 'number') {
        lines.push(`• Регулярность за 4 недели: ${Math.round(adherence.adherence_percent)}%.`);
    }
    if (typeof stats.streak === 'number' && stats.streak > 0) {
        lines.push(`• Серия выполненных тренировок: ${stats.streak}.`);
    }
    if (latest?.date) {
        const dateLabel = format(new Date(latest.date), 'd MMMM', { locale: ru });
        const statusMap = {
            done: 'выполнена',
            completed: 'выполнена',
            skipped: 'пропущена',
            missed: 'пропущена',
        };
        const status = statusMap[latest.status] || latest.status || 'зафиксирована';
        lines.push(`• Последняя тренировка ${dateLabel}: ${status}, RPE ${latest.rpe ?? '—'}.`);
    }
    if (profile?.goals?.description) {
        lines.push(`• Текущий фокус: ${profile.goals.description}.`);
    }

    lines.push('Если нужна детализация по упражнениям или прогрессиям — скажи, подготовлю отчёт.');
    return lines.join('\n');
}

function buildRecoveryReply({ notesFlag }) {
    const lines = [
        '🩺 Переключаемся в режим восстановления.',
        '**Цель:** Снизить нагрузку и помочь телу восстановиться.',
        '**Разминка:** Дыхательные практики и лёгкая мобилизация суставов.',
        '**Основная часть:** Прогулка 20 минут или мягкий комплекс с растяжкой.',
        '**Заминка:** Сон + гидратация, фиксируем самочувствие.',
        '**Следующий шаг:** Сообщи, когда будешь готов вернуться к рабочему циклу.',
    ];
    if (notesFlag === 'injury') {
        lines.push('⚠️ Если дискомфорт не проходит, стоит проконсультироваться с врачом и скорректировать план.');
    }
    return lines.join('\n');
}

function buildHelpReply() {
    return [
        '🤝 Вот чем я могу помочь прямо в чате:',
        '• Составить план на день или неделю и адаптировать его под цели.',
        '• Принять отчёт, оценить RPE и предложить следующий шаг.',
        '• Напомнить о тренировке и поделиться статистикой.',
        '• Подсказать упражнения для восстановления или прогрессии.',
        '• Открыть WebApp, чтобы отредактировать настройки.',
        'С чего начнём?',
    ].join('\n');
}

function buildPlanSetupReply() {
    return [
        '🔧 Обновим план под текущие цели.',
        'Расскажи, что изменилось: частота тренировок, доступное оборудование, целевой акцент.',
        'После этого соберу новую версию плана и синхронизирую её в WebApp.',
    ].join('\n');
}

function buildGenericTrainerFallback(profile) {
    const frequency = profile?.preferences?.training_frequency
        || profile?.training_frequency
        || profile?.profile?.preferences?.training_frequency
        || 4;
    const goal = profile?.goals?.description
        || profile?.preferences?.training_goal
        || profile?.profile?.goals?.description
        || 'укрепить базовые движения';

    return composeTrainerMessage({
        intro: 'Продолжаем держать курс на прогресс.',
        goal: `Работаем над целью: ${goal}.`,
        warmup: '5 минут динамической разминки, чтобы подготовить тело.',
        main: `Фокус на ${frequency} сессий в неделю — готов скорректировать при необходимости.`,
        cooldown: 'Отмечай ощущения и RPE, чтобы адаптировать нагрузку.',
        nextStep: 'Сформулируй задачу: план, отчёт, восстановление или мотивация.',
    });
}

async function generateConversationReply({ profile, message, intent, history: _history }) {
    const context = await loadContext(profile);
    const detectedIntent = intent || toInternalIntent(detectIntent(message).intent);

    switch (detectedIntent) {
    case 'greeting':
        return buildGreeting({ profile, context });
    case 'motivation':
        return buildMotivation({ context });
    case 'plan_today':
        return buildPlanToday({ profile, context });
    case 'plan_week':
        return buildWeekPlan({ context });
    case 'plan_customize':
        return 'Чтобы адаптировать план, напиши цели и доступное оборудование — подготовлю обновлённую программу и синхронизирую её в WebApp.';
    case 'recovery_mode':
        return buildRecoveryReply({});
    case 'help':
        return buildHelpReply();
    case 'note_save':
        return buildNoteSaveReply({ profile, message, context });
    case 'triggers_help':
        return buildTriggersHelpReply();
    default:
        return buildFallback({ message });
    }
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }
    return history.slice(-10).map(item => (typeof item === 'string' ? item : JSON.stringify(item)));
}

export function interpretCommand({ profile, message, history = [] } = {}) {
    const text = (message || '').trim();
    const normalHistory = normalizeHistory(history);

    if (!text) {
        return {
            intent: 'unknown',
            rawIntent: null,
            confidence: 0,
            candidateIntents: [],
            entities: {},
            slots: {},
            needsClarification: true,
            followUp: 'Расскажи, что нужно сделать: план на день, отчёт или помощь с восстановлением.',
            history: normalHistory,
        };
    }

    const detection = detectIntent(text.toLowerCase());
    let intent = toInternalIntent(detection.intent);

    if (intent === 'unknown' && GREETING_REGEX.test(text)) {
        intent = 'greeting';
    } else if (intent === 'unknown' && GRATITUDE_REGEX.test(text)) {
        intent = 'gratitude';
    }

    const slots = {};
    if (detection.entities?.reminder) {
        slots.reminder = detection.entities.reminder;
    }
    if (detection.entities?.preferredShiftDays) {
        slots.preferredShiftDays = detection.entities.preferredShiftDays;
    }
    if (detection.entities?.preferredDay) {
        slots.preferredDay = detection.entities.preferredDay;
    }

    const noteCandidate = parseNoteCommand(text);
    if (noteCandidate) {
        slots.note = noteCandidate;
        if (intent === 'unknown') {
            intent = 'note_save';
        }
    }

    let needsClarification = false;
    let followUp = null;

    if (intent === 'remind_later' && !slots.reminder) {
        needsClarification = true;
        followUp = 'Укажи время напоминания: например, «через 30 минут» или «в 20:00».';
    }

    if (intent === 'note_save' && (!slots.note || !slots.note.content || !slots.note.content.trim())) {
        needsClarification = true;
        followUp = 'Добавь текст заметки после команды «сохрани», например: «Сохрани: идеи для восстановительной недели».';
    }

    if (intent === 'report_start' && normalHistory.slice(-1)[0]?.includes('report_')) {
        needsClarification = false;
    }

    return {
        intent,
        rawIntent: detection.intent,
        confidence: detection.confidence,
        candidateIntents: (detection.candidates || []).map(candidate => ({
            intent: toInternalIntent(candidate.intent),
            confidence: candidate.confidence,
        })),
        entities: detection.entities || {},
        slots,
        needsClarification,
        followUp,
        history: normalHistory,
        profileId: profile?.id || null,
    };
}

export async function generateTrainerReply({ profile, message, history = [] } = {}) {
    const interpretation = interpretCommand({ profile, message, history });
    const context = await loadContext(profile);

    switch (interpretation.intent) {
    case 'plan_today':
        return buildTrainerPlanToday({ profile, context });
    case 'plan_week':
        return buildTrainerPlanWeek({ profile, context });
    case 'report_start':
        return buildReportKickoffReply();
    case 'motivation':
        return buildMotivation({ context });
    case 'schedule_reschedule':
        return buildRescheduleReply({ slots: interpretation.slots });
    case 'remind_later':
        return buildReminderReply({ slots: interpretation.slots, needsClarification: interpretation.needsClarification });
    case 'settings_open':
        return buildSettingsReply();
    case 'stats_show':
        return buildStatsReply({ profile, context });
    case 'recovery_mode':
        return buildRecoveryReply({});
    case 'plan_setup':
        return buildPlanSetupReply();
    case 'help':
        return buildHelpReply();
    case 'note_save':
        return buildNoteSaveReply({ profile, message, context, slots: interpretation.slots });
    case 'triggers_help':
        return buildTriggersHelpReply();
    case 'gratitude':
        return 'Всегда пожалуйста! Если потребуется помощь с планом или мотивацией — скажи.';
    default:
        if (TRAINER_INTENTS.has(interpretation.intent)) {
            return buildGenericTrainerFallback(profile);
        }
        return null;
    }
}

export async function generateGeneralReply({ profile, message, history = [] } = {}) {
    const interpretation = interpretCommand({ profile, message, history });

    if (TRAINER_INTENTS.has(interpretation.intent) && interpretation.intent !== 'motivation') {
        return null;
    }

    return generateConversationReply({
        profile,
        message,
        intent: interpretation.intent,
        history,
    });
}

function computePlanSummary(plan) {
    const sessions = plan.sessions || [];
    return sessions.map(session => {
        const date = session.date ? parseISO(session.date) : null;
        const label = date ? format(date, 'd MMM (EEE)', { locale: ru }) : session.date;
        const focus = session.focus || session.session_type || 'Рабочая сессия';
        return `• ${label}: ${focus} (RPE ≈ ${session.rpe || 7})`;
    }).join('\n');
}

export async function generateTrainingPlan({
    profile = {},
    referenceDate = new Date(),
    history = [],
    reason = 'manual',
} = {}) {
    const frequency = profile?.preferences?.training_frequency
        || profile?.training_frequency
        || 4;

    const plan = buildDefaultWeekPlan({
        startDate: referenceDate,
        frequency,
    });

    const summaryText = computePlanSummary(plan);
    const historySnippet = Array.isArray(history) && history.length
        ? history.slice(-3).map(session => {
            const date = session.date ? format(new Date(session.date), 'd MMM', { locale: ru }) : '—';
            const status = session.status || 'unknown';
            return `• ${date}: ${status}`;
        }).join('\n')
        : null;

    const goal = profile?.goals?.description || 'укрепление базовых движений';

    const rawText = [
        `📆 План на неделю (частота ${frequency}):`,
        summaryText,
        '',
        historySnippet ? `Последние тренировки:\n${historySnippet}` : null,
        `Фокус пользователя: ${goal}.`,
        'Отмечай прогресс и RPE — буду адаптировать нагрузку.',
    ].filter(Boolean).join('\n');

    return {
        rawText,
        structured: {
            plan,
            summary: {
                frequency,
                goal,
                reason,
                generated_at: new Date().toISOString(),
            },
        },
    };
}

function tallyExercises(exercises) {
    if (!Array.isArray(exercises) || !exercises.length) {
        return {
            completed: 0,
            partial: 0,
            skipped: 0,
            total: 0,
            completionRate: 0,
            overperformed: 0,
        };
    }

    let completed = 0;
    let partial = 0;
    let skipped = 0;
    let overperformed = 0;

    for (const exercise of exercises) {
        const state = exercise.state || (exercise.actual ? 'done' : null);
        switch (state) {
        case 'done':
            completed += 1;
            if (exercise.actual && exercise.sets && exercise.reps) {
                const targetSets = exercise.sets ?? exercise.target?.sets ?? 0;
                const targetReps = exercise.reps ?? exercise.target?.reps ?? 0;
                const actualSets = exercise.actual?.sets ?? 0;
                const actualReps = exercise.actual?.reps ?? 0;
                if (targetSets && targetReps && actualSets * actualReps > targetSets * targetReps) {
                    overperformed += 1;
                }
            }
            break;
        case 'in_progress':
            partial += 1;
            break;
        case 'skipped':
        default:
            skipped += 1;
            break;
        }
    }

    const total = exercises.length;
    const completionRate = total
        ? Math.round(((completed + partial * 0.6) / total) * 100)
        : 0;

    return {
        completed,
        partial,
        skipped,
        total,
        completionRate,
        overperformed,
    };
}

function classifyNotes(notes) {
    if (!notes) {
        return null;
    }
    if (FATIGUE_REGEX.test(notes)) {
        return 'fatigue';
    }
    if (EASY_REGEX.test(notes)) {
        return 'easy';
    }
    return null;
}

export async function analyzeTrainingReport({
    session = {},
    exercises = [],
    rpe,
    notes,
    history = [],
} = {}) {
    const stats = tallyExercises(exercises.length ? exercises : session.exercises);
    const rpeValue = Number.isFinite(rpe) ? rpe : session.rpe ?? null;
    const noteFlag = classifyNotes(notes);

    const lines = [];
    const suggestions = [];

    if (stats.total) {
        lines.push(`• Выполнено ${stats.completed} из ${stats.total} упражнений (ещё ${stats.partial} частично).`);
    }
    if (typeof stats.completionRate === 'number') {
        lines.push(`• Итог по объёму: ${stats.completionRate}%.`);
    }
    if (typeof rpeValue === 'number') {
        lines.push(`• Субъективная нагрузка: RPE ${rpeValue}/10.`);
        if (rpeValue >= 9) {
            suggestions.push('recovery');
            lines.push('⚠️ Высокий RPE — добавь восстановление и следи за сном.');
        } else if (rpeValue <= 5) {
            suggestions.push('advance');
            lines.push('Можно постепенно усложнять: нагрузка воспринимается легко.');
        }
    }

    if (stats.overperformed > 0) {
        suggestions.push('advance');
        lines.push(`• ${stats.overperformed} упражн. выполнены с запасом — доступна прогрессия.`);
    } else if (stats.completionRate < 60) {
        suggestions.push('regress');
        lines.push('• Объём просел. Предлагаю облегчённую вариацию или сокращение подходов.');
    } else if (!suggestions.includes('advance') && !suggestions.includes('regress')) {
        suggestions.push('maintain');
    }

    if (noteFlag === 'fatigue') {
        suggestions.push('recovery');
        lines.push('• Отмечена усталость — добавим больше восстановления в ближайшие дни.');
    } else if (noteFlag === 'easy' && !suggestions.includes('advance')) {
        suggestions.push('advance');
        lines.push('• Тренировка зашла легко — можно поднять уровень сложности.');
    }

    const recentMisses = history
        .filter(item => ['skipped', 'missed'].includes(item.status))
        .slice(0, 3);
    if (recentMisses.length >= 2) {
        suggestions.push('recovery');
        lines.push('• В истории есть пропуски — держим фокус на устойчивости графика.');
    }

    const header = stats.completionRate >= 90
        ? '✅ Отличная работа!'
        : stats.completionRate >= 60
            ? '👍 Прогресс фиксируем, есть куда усилиться.'
            : '🔁 Разберём, как сделать комфортнее.';

    const feedback = [
        header,
        ...lines,
        '',
        'Следующий шаг: обновлю план и подсказки в WebApp, опираясь на отчёт.',
    ].join('\n');

    return {
        feedback,
        completionRate: stats.completionRate,
        suggestions: Array.from(new Set(suggestions)),
    };
}

export async function buildMotivationMessage(profileInput) {
    const profile = profileInput?.profile || profileInput;
    const context = await loadContext(profile);
    return buildMotivation({ context });
}

export async function buildPlanHint(profile, { scope = 'day' } = {}) {
    const context = await loadContext(profile);
    if (scope === 'week') {
        return buildWeekPlan({ context });
    }
    return buildPlanToday({ profile, context });
}

export async function buildFeedbackMessage({ completionRate, rpe }) {
    const tags = [];

    const rate = Number.isFinite(completionRate) ? completionRate : null;
    if (rate !== null) {
        if (rate >= 95) {
            tags.push('completed_high');
        } else if (rate >= 60) {
            tags.push('completed_medium');
        } else {
            tags.push('missed');
        }
    }

    const template = await pickTemplate('feedback', tags);
    if (!template) {
        return 'Зафиксировал результат. Сделаем корректировки и продолжим.';
    }

    const data = {
        completion_rate: rate !== null ? Math.round(rate) : '—',
        rpe: rpe !== undefined && rpe !== null ? rpe : '—',
    };

    const rendered = renderTemplate(template.body, data);
    return appendMetadata(template, rendered);
}

export function getEngineCatalog({ successThreshold, slumpThreshold } = {}) {
    return [
        {
            id: 'internal',
            title: 'Локальный тренер',
            description: 'Формирует ответы, планы и мотивацию на основе данных в Supabase без внешних AI-сервисов.',
            capabilities: [
                'диалоговые ответы в стиле тренера',
                'генерация плана на неделю',
                'анализ отчётов и рекомендации',
                'мотивационные сообщения и подсказки',
            ],
            thresholds: {
                success: successThreshold ?? 75,
                slump: slumpThreshold ?? 45,
            },
        },
    ];
}

export function resolveEngine({ profile } = {}) {
    if (!profile) {
        return 'internal';
    }
    const preferred = profile.preferences?.ai_provider;
    if (!preferred || preferred === 'internal') {
        return 'internal';
    }
    return 'internal';
}

export default {
    interpretCommand,
    generateTrainerReply,
    generateGeneralReply,
    generateTrainingPlan,
    analyzeTrainingReport,
    buildMotivationMessage,
    buildPlanHint,
    buildFeedbackMessage,
    getEngineCatalog,
    resolveEngine,
};

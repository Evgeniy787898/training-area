const INTENT_PATTERNS = [
    {
        intent: 'plan.today',
        keywords: [/план/i, /сегодня/i],
        priority: 90,
    },
    {
        intent: 'plan.week',
        keywords: [/план/i, /(недел|распис)/i],
        priority: 80,
    },
    {
        intent: 'report.start',
        keywords: [/(отч[её]т|завершил|закончил)/i],
        priority: 70,
    },
    {
        intent: 'stats.show',
        keywords: [/(прогресс|статистик|аналит)/i],
        priority: 70,
    },
    {
        intent: 'settings.open',
        keywords: [/настройк/i, /(уведомлен|напоминан)/i],
        priority: 60,
    },
    {
        intent: 'plan.setup',
        keywords: [/(настро|обнови|подстрои)/i, /(план|цель|оборуд)/i],
        priority: 65,
    },
    {
        intent: 'schedule.reschedule',
        keywords: [/(перенес|перестав|завтра|позже)/i],
        priority: 90,
    },
    {
        intent: 'recovery.mode',
        keywords: [/(болит|травм|простыл|устал)/i],
        priority: 80,
    },
    {
        intent: 'remind.later',
        keywords: [/напомни/i, /(через|позже)/i],
        priority: 75,
    },
    {
        intent: 'motivation',
        keywords: [/(мотивац|поддерж)/i],
        priority: 40,
    },
    {
        intent: 'help',
        keywords: [/помощь/i, /что ты умеешь/i],
        priority: 30,
    },
];

const REMIND_LATER_PATTERNS = [
    { regex: /(через)\s+(\d{1,2})\s*(?:час|ч)/i, unit: 'hours' },
    { regex: /(через)\s+(\d{1,2})\s*(?:минут|мин)/i, unit: 'minutes' },
    { regex: /(в|к)\s+(\d{1,2})[:.](\d{2})/i, unit: 'clock' },
];

function matchIntent(text) {
    const matches = INTENT_PATTERNS
        .map(pattern => {
            const matched = pattern.keywords.every(regex => regex.test(text));
            return matched ? { intent: pattern.intent, priority: pattern.priority } : null;
        })
        .filter(Boolean);

    if (matches.length === 0) {
        return { intent: 'unknown', confidence: 0 };
    }

    const best = matches.sort((a, b) => b.priority - a.priority)[0];
    const confidence = Math.min(1, best.priority / 100);

    return { intent: best.intent, confidence };
}

function extractRemindLater(text) {
    for (const pattern of REMIND_LATER_PATTERNS) {
        const match = pattern.regex.exec(text);
        if (!match) {
            continue;
        }

        if (pattern.unit === 'clock') {
            const hours = parseInt(match[2], 10);
            const minutes = parseInt(match[3], 10);
            if (Number.isNaN(hours) || Number.isNaN(minutes)) {
                continue;
            }
            return { unit: 'clock', hours, minutes };
        }

        const value = parseInt(match[2], 10);
        if (Number.isNaN(value)) {
            continue;
        }

        return { unit: pattern.unit, value };
    }

    return null;
}

export function detectIntent(text) {
    if (!text || typeof text !== 'string') {
        return { intent: 'unknown', confidence: 0, entities: {} };
    }

    const normalized = text.trim().toLowerCase();
    const base = matchIntent(normalized);
    const entities = {};

    if (base.intent === 'remind.later') {
        const reminder = extractRemindLater(normalized);
        if (reminder) {
            entities.reminder = reminder;
        }
    }

    if (base.intent === 'schedule.reschedule') {
        const tomorrowMatch = /(завтра|tomorrow)/i.test(text);
        if (tomorrowMatch) {
            entities.preferredShiftDays = 1;
        }
        const dayMatch = /(пятниц|суббот|воскресень|будущ)/i.exec(text);
        if (dayMatch) {
            entities.preferredDay = dayMatch[0];
        }
    }

    return { ...base, entities };
}

export default { detectIntent };

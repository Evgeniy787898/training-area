const GREETING_REGEX = /\b(привет|здравствуй|добрый|доброе|хай|hello|hi)\b/i;
const THANKS_REGEX = /\b(спасибо|благодарю|thx|thanks)\b/i;
const SUCCESS_REGEX = /(выполнил|сделал|закрыл|успел|готово|done|finish)/i;
const MISS_REGEX = /(не сделал|не успел|пропустил|сорвал|провал|fail)/i;
const FATIGUE_REGEX = /(устал|разбит|тяжел|тяжёл|не вывез|нет сил|перегорел)/i;
const ABILITY_REGEX = /(что|какие)\s+(ты\s+)?(умеешь|можешь|делаешь|функции|возможности)/i;
const HELP_REGEX = /\b(помощь|help|команд|что ты умеешь|как пользоваться)\b/i;
const CALISTHENICS_REGEX = /калистеник/i;
const FUNCTIONAL_REGEX = /(функциональн(ый|ая)?\s+тренинг|functional training)/i;
const RPE_REGEX = /\bRPE\b/i;
const RECOVERY_REGEX = /(восстановлени|сон|отдых)/i;
const SCHEDULE_REGEX = /(расписан|когда|сколько раз|частота|schedule)/i;

const TOPIC_SNIPPETS = [
    {
        match: CALISTHENICS_REGEX,
        summary: 'Калистеника — система тренировок с собственным весом, где главным снарядом остаётся твое тело.',
        bullets: [
            'Укрепляет связки, суставы и мышцы без тяжёлых отягощений, развивая баланс и контроль.',
            'Продвижение строится через прогрессии: постепенно усложняем упражнение, добавляя амплитуду, рычаг или время под нагрузкой.',
            'Подходит для домашних тренировок: достаточно турника, брусьев или резинок, а техника остаётся в фокусе.',
        ],
        tip: 'Для устойчивого прогресса чередуй силовые дни с мобилизацией и следи за RPE — держи его в диапазоне 7–8.',
    },
    {
        match: FUNCTIONAL_REGEX,
        summary: 'Функциональный тренинг готовит тело к реальным движениям: переносим, тянем, толкаем, стабилизируем.',
        bullets: [
            'Комбинирует многосуставные упражнения, работу корпуса и координацию, чтобы улучшить повседневные паттерны движений.',
            'Использует разные плоскости — фронтальную, сагиттальную, поперечную — чтобы не было перекосов.',
            'Часто строится в формате блоков: активация → основная часть → развивающие финалы или меткон.',
        ],
        tip: 'Выбирая упражнения, смотри, чтобы в неделе были тяга, жим, присед, кор и элемент баланса — это база функционала.',
    },
    {
        match: RPE_REGEX,
        summary: 'RPE (Rate of Perceived Exertion) — субъективная шкала нагрузки от 1 до 10.',
        bullets: [
            '6–7: можно поговорить, остаётся 2–3 повторения «в запасе» — комфортная рабочая зона.',
            '8: тяжело, но техника в порядке, запас 1 повтор — используем, когда хотим стимулировать прогресс.',
            '9–10: предел, техника распадается — сюда заходим редко, когда сознательно тестируем максимум.',
        ],
        tip: 'Если чувствуешь, что RPE ускакал выше 8 подряд несколько тренировок, смести акцент на восстановление и сон.',
    },
    {
        match: RECOVERY_REGEX,
        summary: 'Восстановление — половина прогресса: мышцы растут не на тренировке, а между ними.',
        bullets: [
            'Сон 7–9 часов — главный фактор. Раздели свет и тьму: приглуши экраны за час до сна, держи комнату прохладной.',
            'Питайся с акцентом на белок и микронутриенты. 1.6–2 г белка на кг массы закрывает потребности при плотных тренировках.',
            'Включай активное восстановление: 10–15 минут лёгкой мобилизации, прогулку, дыхание 4-6-4, чтобы снимать стресс.',
        ],
        tip: 'Если HRV падает или пульс в покое растёт, делай разгрузочный блок — это сохранит темп прогресса на дистанции.',
    },
];

export function buildLocalReply({ message, profile, history = [] } = {}) {
    const normalized = (message || '').trim();
    const tone = determineGreetingTone({ message: normalized, profile, history });
    if (!normalized) {
        return genericReply({ profile, message: normalized });
    }

    if (GREETING_REGEX.test(normalized)) {
        return greetingReply({ profile, history, tone });
    }

    if (THANKS_REGEX.test(normalized)) {
        return thanksReply({ profile });
    }

    if (ABILITY_REGEX.test(normalized) || HELP_REGEX.test(normalized)) {
        return capabilityReply({ profile });
    }

    const topicSnippet = TOPIC_SNIPPETS.find(item => item.match.test(normalized));
    if (topicSnippet) {
        return topicReply(topicSnippet, profile);
    }

    if (SCHEDULE_REGEX.test(normalized)) {
        return scheduleReply(profile);
    }

    return genericReply({ profile, message: normalized });
}

function greetingReply({ profile, history, tone }) {
    const lastAssistant = [...history].reverse().find(item => item.role === 'assistant');
    const todaysFocus = extractLastPlanFocus(lastAssistant);
    const frequency = resolveFrequency(profile);

    const templates = {
        success: [
            'Привет! Отлично справился с последними тренировками — видно прогресс.',
            frequency ? `Продолжаем держать ${frequency}, можно добавить акцент на технику.` : 'Если хочешь усилить план — просто скажи.',
            todaysFocus ? `Сегодня по плану «${todaysFocus}». Готов помочь с тонкостями.` : 'Готов подсказать следующий шаг или адаптацию.',
        ],
        slump: [
            'Привет! Бывает, что ритм сбивается — ничего страшного.',
            frequency ? `Вернёмся к ${frequency}, но мягко: начнём с разминки и лёгкого блока.` : 'Давай начнём с короткой сессии, чтобы поймать темп.',
            'Сформулируй, что именно сложно — подберём простое действие на сегодня.',
        ],
        fatigue: [
            'Привет! Чувствуется усталость — сделаем акцент на восстановление.',
            'Предложу дыхание 4-6-4 и лёгкую мобилизацию, чтобы снять напряжение.',
            'Когда силы вернутся, напиши — подстрою план под комфортный темп.',
        ],
        neutral: [
            'Привет! Рад снова видеть твоё сообщение.',
            frequency ? `Держим ${frequency} — хороший ритм.` : 'Готов помочь выбрать частоту и цели.',
            todaysFocus ? `Сегодня в фокусе «${todaysFocus}».` : 'Расскажи, что хочешь обсудить — техника, план или восстановление.',
        ],
    };

    const lines = templates[tone] || templates.neutral;
    return lines.join('\n');
}

function thanksReply({ profile }) {
    const frequency = resolveFrequency(profile);
    return [
        'Всегда пожалуйста! Следи за самочувствием и не забывай отмечать тренировки в WebApp — так я быстрее подстрою план.',
        frequency ? `Напомню: мы ориентируемся на ${frequency}.` : 'Если захочешь изменить частоту — просто скажи.',
    ].join('\n');
}

function capabilityReply({ profile }) {
    const frequency = resolveFrequency(profile);
    const capabilities = [
        '📅 Составить или обновить план на неделю, учитывая цели, оборудование и загрузку.',
        '📝 Принять отчёт о тренировке, разобрать RPE и скорректировать прогрессию.',
        '📊 Поделиться статистикой, напомнить тренировки, предложить восстановления и мобилизацию.',
        '🤖 Ответить на вопросы о технике, калистенике, питании и общем тренинге, опираясь на базу знаний.',
        '🔗 Открыть WebApp (`/webapp` или «Открой приложение») для отметки тренировок и настроек.',
    ];

    return [
        'Я — твой персональный ассистент Tzona. Вот что могу делать прямо здесь в чате:',
        '',
        ...capabilities,
        '',
        frequency ? `Сейчас план строится под ${frequency}. Если хочешь сменить режим — скажи, и пересоберём.` : 'Если ещё не настроили частоту и цели — начнём с этого, чтобы план был точным.',
    ].join('\n');
}

function topicReply(snippet, profile) {
    const frequency = resolveFrequency(profile);
    const header = snippet.summary;
    const bullets = snippet.bullets.map(line => `- ${line}`);
    const frequencyLine = frequency ? `Твой текущий ритм (${frequency}) отлично вписывается в эту концепцию — можно варьировать интенсивность через RPE.` : null;

    return [
        header,
        '',
        ...bullets,
        '',
        snippet.tip ? `Совет тренера: ${snippet.tip}` : null,
        frequencyLine,
        '',
        'Нужна конкретная программа или техника — уточни, и соберём её под твой уровень.',
    ]
        .filter(Boolean)
        .join('\n');
}

function scheduleReply(profile) {
    const frequency = resolveFrequency(profile);
    const base = frequency
        ? `Сейчас план на ${frequency}: распределяем нагрузку так, чтобы чередовались силовые акценты и восстановление.`
        : 'Пока частота не настроена — по умолчанию держим 3 тренировки в неделю с чередованием силовой, техники и мобильности.';

    return [
        base,
        'Если хочешь пересобрать расписание, скажи: «Собери новый план» или назови желаемое число тренировок и доступное оборудование.',
        'Также можно открыть WebApp и в настройках выбрать удобные дни — синхронизирую изменения автоматически.',
    ].join('\n');
}

function genericReply({ profile, message }) {
    const frequency = resolveFrequency(profile);
    const intro = message
        ? `Я зафиксировал вопрос: «${truncate(message, 200)}».`
        : 'Готов продолжить обсуждение — просто напиши, что тебя интересует.';

    return [
        intro,
        'Сейчас я отвечаю на основе локальных заметок, поэтому могу опереться на тренерские рекомендации и данные профиля.',
        frequency ? `Помню, что целимся в ${frequency}.` : null,
        'Сформулируй задачу чуть конкретнее — и предложу тренировку, прогрессию, восстановление или разложу тему по шагам.',
    ]
        .filter(Boolean)
        .join('\n');
}

function determineGreetingTone({ message, profile, history }) {
    if (!message) {
        return 'neutral';
    }
    if (FATIGUE_REGEX.test(message)) {
        return 'fatigue';
    }
    if (MISS_REGEX.test(message)) {
        return 'slump';
    }
    if (SUCCESS_REGEX.test(message)) {
        return 'success';
    }

    const adherence =
        profile?.adherence?.adherence_percent ??
        profile?.metrics?.adherence_percent ??
        null;

    if (adherence !== null) {
        const numeric = Number(adherence);
        if (Number.isFinite(numeric)) {
            if (numeric >= 75) {
                return 'success';
            }
            if (numeric <= 45) {
                return 'slump';
            }
        }
    }

    const lastAssistant = [...(history || [])].reverse().find(item => item.role === 'assistant');
    if (lastAssistant?.content?.includes('⚠️')) {
        return 'slump';
    }

    return 'neutral';
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

function extractLastPlanFocus(assistantMessage) {
    if (!assistantMessage?.content) {
        return null;
    }

    const match = assistantMessage.content.match(/Фокус[:\s]+([^\n]+)/i);
    return match ? match[1].trim() : null;
}

function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export default {
    buildLocalReply,
};

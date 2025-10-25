const GREETING_REGEX = /\b(привет|здравствуй|добрый|доброе|хай|hello|hi)\b/i;
const THANKS_REGEX = /\b(спасибо|благодарю|thx|thanks)\b/i;
const SUCCESS_REGEX = /(выполнил|сделал|закрыл|успел|готово|done|finish)/i;
const MISS_REGEX = /(не сделал|не успел|пропустил|сорвал|провал|fail)/i;
const FATIGUE_REGEX = /(устал|разбит|тяжел|тяжёл|не вывез|нет сил|перегорел)/i;
const ABILITY_REGEX = /(что|какие)\s+(ты\s+)?(умеешь|можешь|делаешь|функции|возможности)/i;
const HELP_REGEX = /\b(помощь|help|команд|что ты умеешь|как пользоваться)\b/i;
const TRIGGERS_HELP_REGEX = /(справк|подсказк|какие).*(триггер|ключев)/i;
const CALISTHENICS_REGEX = /калистеник/i;
const FUNCTIONAL_REGEX = /(функциональн(ый|ая)?\s+тренинг|functional training)/i;
const RPE_REGEX = /\bRPE\b/i;
const RECOVERY_REGEX = /(восстановлени|сон|отдых)/i;
const SCHEDULE_REGEX = /(расписан|когда|сколько раз|частота|schedule)/i;

function randomChoice(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }
    const index = Math.floor(Math.random() * items.length);
    return items[index];
}

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
            'Включай активное восстановление: 10–15 минут лёгкой мобилизации, лёгкая ходьба, дыхательные практики.',
        ],
        tip: 'Следи за самочувствием в отчётах — если усталость копится, план автоматически переключится в режим восстановления.',
    },
    {
        match: SCHEDULE_REGEX,
        summary: 'Расписание тренировок строим вокруг цели и доступного времени.',
        bullets: [
            'Базовый цикл — 4 тренировки: тяга, жим/кор, нижняя часть, техника/мобилити.',
            'Для плотного графика есть формат 3 тренировки с комбинированными сессиями (силовая + меткон).',
            'Возможен режим 5–6 дней, где чередуем силовой и активный восстановительный блок.',
        ],
        tip: 'Если расписание плавает, держи фиксированные «якоря» — 2 обязательные сессии и 1 дополнительная по самочувствию.',
    },
];

function buildLocalReply({ message, profile, history }) {
    if (!message) {
        return null;
    }

    if (THANKS_REGEX.test(message)) {
        return buildThanksReply(profile);
    }

    if (GREETING_REGEX.test(message)) {
        return buildGreetingReply({ profile, history, message });
    }

    if (TRIGGERS_HELP_REGEX.test(message)) {
        return buildTriggersCheatsheet();
    }

    if (HELP_REGEX.test(message) || ABILITY_REGEX.test(message)) {
        return buildCapabilityReply(profile);
    }

    const topicSnippet = TOPIC_SNIPPETS.find(snippet => snippet.match.test(message));
    if (topicSnippet) {
        return topicReply(topicSnippet, profile);
    }

    return null;
}

function buildThanksReply(profile) {
    const frequency = resolveFrequency(profile);
    return [
        'Рад помочь! Продолжаем тренить системно.',
        frequency ? `Напомню, что сейчас держим ${frequency}. Если захочешь изменить частоту — просто напиши.` : null,
        'Если нужно подсказать по плану, технике или восстановлению — скажи, и разложу по шагам.',
    ].filter(Boolean).join(' ');
}

function buildGreetingReply({ profile, history, message }) {
    const tone = determineGreetingTone({ message, profile, history });
    const frequency = resolveFrequency(profile);
    const lastPlanFocus = history ? extractLastPlanFocus(history[history.length - 1]) : null;

    switch (tone) {
    case 'success':
        return [
            '🔥 Круто держишь ритм!',
            frequency ? `По плану ${frequency}, и ты отлично справляешься.` : null,
            lastPlanFocus ? `Фокус прошлой сессии — ${lastPlanFocus}. Готов обсудить следующий шаг?` : 'Могу подсказать, что дальше: план, отчёт или техника.',
        ].filter(Boolean).join(' ');
    case 'slump':
        return [
            'Ничего, бывает. Главное — вернуться в движение без самоедства.',
            'Давай составим короткую версию тренировки или выберем восстановительный блок.',
            'Готов подсказать, как мягко вернуться к плану.',
        ].join(' ');
    case 'fatigue':
        return [
            'Чую усталость. Восстановление — такая же часть прогресса, как и тренировки.',
            'Могу подсказать дыхательные практики, мобилизацию или собрать разгрузочный день.',
            'Если боль не проходит — сигнализируй, адаптируем план.',
        ].join(' ');
    default:
        return [
            'Привет! Что сегодня в фокусе: план, отчёт, восстановление или разбор техники?',
            frequency ? `Помню, что целимся в ${frequency}.` : null,
        ].filter(Boolean).join(' ');
    }
}

function buildCapabilityReply(profile) {
    const frequency = resolveFrequency(profile);
    const introVariants = [
        'Я отвечаю как персональный тренер — вот быстрые команды:',
        'Собрал ключевые действия, которые можно запросить в любой момент:',
        'Работаю по таким направлениям — выбирай, что нужно:',
    ];

    const capabilities = [
        '- «План на сегодня» или «план на неделю» — покажу расписание.',
        '- «Прими отчёт» — зафиксирую тренировку и дам рекомендации.',
        '- «Напомни» + время или «перенеси тренировку» — управляем расписанием.',
        '- «Сохрани: …» — добавлю заметку в журнал (можно с #тегами).',
        '- «Нужна мотивация» или «подскажи по технике» — поддержу и дам советы.',
        '- «Открой приложение» — пришлю кнопку WebApp.',
    ];

    const triggerHints = [
        'Подсказка: попробуй «Сохрани: цель на июль» или «Напомни через 40 минут размяться».',
        'Можно комбинировать триггеры: «Сохрани заметку и напомни завтра утром».',
        'Если хочешь полный список — спроси «справка по триггерам».',
    ];

    return [
        randomChoice(introVariants) || introVariants[0],
        '',
        ...capabilities,
        '',
        randomChoice(triggerHints),
        frequency ? `Сейчас план строится под ${frequency}. Если хочешь сменить режим — скажи, и пересоберём.` : 'Если ещё не настроили частоту и цели — начнём с этого, чтобы план был точным.',
    ].filter(Boolean).join('\n');
}

function buildTriggersCheatsheet() {
    const intro = randomChoice([
        'Мини-шпаргалка по триггерам:',
        'Быстрые команды, которые я понимаю сразу:',
        'Вот запросы, которые срабатывают без уточнений:',
    ]);

    const list = [
        '• «План на сегодня» — покажу ближайшую тренировку.',
        '• «План на неделю» — пришлю расписание на 7 дней.',
        '• «Прими отчёт» или «отчёт за <день>» — зафиксирую тренировку.',
        '• «Напомни <когда>» — поставлю напоминание.',
        '• «Перенеси тренировку на завтра» — сдвину в расписании.',
        '• «Нужна мотивация» — пришлю подбадривающее сообщение.',
        '• «Сохрани: <текст заметки>» — добавлю запись в журнал.',
    ];

    const outro = randomChoice([
        'Если появятся новые триггеры — обновлю шпаргалку автоматически.',
        'Можно комбинировать: «Сохрани заметку и напомни вечером».',
        'Не нашёл нужное? Просто опиши задачу словами, я уточню детали.',
    ]);

    return [intro, '', ...list, '', outro].join('\n');
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

export default {
    buildLocalReply,
};

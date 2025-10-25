import { addDays, differenceInCalendarDays, endOfWeek, format, formatISO, isAfter, isBefore, parseISO, startOfWeek, subDays } from 'date-fns';

const STORAGE_KEY = 'training_app_state_v1';

const PROGRESSIONS = [
    {
        key: 'pullups',
        title: 'Подтягивания',
        focus: 'Спина и бицепсы',
        description: 'Развивает силу верхней части тела и стабилизацию корпуса.',
        cue: 'Держи корпус жёстким, а движение — контролируемым.',
        levels: [
            { id: 'L1', title: 'Горизонтальная тяга', sets: 3, reps: 12 },
            { id: 'L2', title: 'Подтягивания с резинкой', sets: 4, reps: 8 },
            { id: 'L3', title: 'Классические подтягивания', sets: 5, reps: 6 },
            { id: 'L4', title: 'Подтягивания с весом', sets: 5, reps: 5 },
        ],
    },
    {
        key: 'pushups',
        title: 'Отжимания',
        focus: 'Грудь и трицепсы',
        description: 'Базовое упражнение для развития силы толчка и контроля плечевого пояса.',
        cue: 'Следи за положением лопаток, локти держи под 45°.',
        levels: [
            { id: 'L1', title: 'Отжимания от возвышения', sets: 3, reps: 15 },
            { id: 'L2', title: 'Классические отжимания', sets: 4, reps: 12 },
            { id: 'L3', title: 'Алмазные отжимания', sets: 4, reps: 10 },
            { id: 'L4', title: 'Отжимания на брусьях', sets: 5, reps: 8 },
        ],
    },
    {
        key: 'squat',
        title: 'Приседания',
        focus: 'Ноги и корпус',
        description: 'Силовая база для нижней части тела и устойчивости.',
        cue: 'Пятки прижаты к полу, корпус устойчив, колени следуют за носками.',
        levels: [
            { id: 'L1', title: 'Приседания с опорой', sets: 3, reps: 15 },
            { id: 'L2', title: 'Классические приседания', sets: 4, reps: 12 },
            { id: 'L3', title: 'Приседания на одной ноге с поддержкой', sets: 4, reps: 8 },
            { id: 'L4', title: 'Пистолетики', sets: 5, reps: 5 },
        ],
    },
    {
        key: 'core',
        title: 'Кор стабилизация',
        focus: 'Кор и стабилизаторы',
        description: 'Укрепляет пресс и глубокие мышцы корпуса, поддерживает технику в базовых упражнениях.',
        cue: 'Сохраняй ровное дыхание и контроль положения таза.',
        levels: [
            { id: 'L1', title: 'Планка', sets: 3, reps: '40 сек' },
            { id: 'L2', title: 'Планка с подъёмом ноги', sets: 4, reps: '30 сек' },
            { id: 'L3', title: 'Динамическая планка', sets: 4, reps: '25 сек' },
            { id: 'L4', title: 'Колесо', sets: 5, reps: 8 },
        ],
    },
];

const WEEK_TEMPLATE = [
    {
        session_type: 'Силовая — тяга',
        focus: 'Спина и кор',
        recommendedRpe: 7,
        exercises: [
            {
                exercise_key: 'pullups',
                name: 'Подтягивания',
                target: { sets: 4, reps: 8 },
                rest: 90,
                notes: 'Контроль лопаток и полного диапазона.',
                level_target: 'L2',
            },
            {
                exercise_key: 'core',
                name: 'Планка',
                target: { sets: 3, reps: '45 сек' },
                rest: 45,
                notes: 'Таз нейтрален, дыши спокойно.',
                level_target: 'L1',
            },
        ],
    },
    null,
    {
        session_type: 'Силовая — толчок',
        focus: 'Грудь и плечи',
        recommendedRpe: 7,
        exercises: [
            {
                exercise_key: 'pushups',
                name: 'Отжимания',
                target: { sets: 4, reps: 12 },
                rest: 90,
                notes: 'Лопатки сведены, корпус — прямой.',
                level_target: 'L2',
            },
            {
                exercise_key: 'core',
                name: 'Динамическая планка',
                target: { sets: 3, reps: '30 сек' },
                rest: 45,
                notes: 'Движение плавное без провалов корпуса.',
                level_target: 'L2',
            },
        ],
    },
    null,
    {
        session_type: 'Ноги и баланс',
        focus: 'Нижняя часть тела',
        recommendedRpe: 6,
        exercises: [
            {
                exercise_key: 'squat',
                name: 'Приседания',
                target: { sets: 4, reps: 15 },
                rest: 90,
                notes: 'Следи за траекторией коленей.',
                level_target: 'L2',
            },
            {
                exercise_key: 'core',
                name: 'Колено к локтю в планке',
                target: { sets: 3, reps: 12 },
                rest: 45,
                notes: 'Контролируй положение таза.',
                level_target: 'L2',
            },
        ],
    },
    null,
    null,
];

function loadState() {
    if (typeof window === 'undefined') {
        return createDefaultState();
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return createDefaultState();
        }
        const parsed = JSON.parse(raw);
        return {
            ...createDefaultState(),
            ...parsed,
            sessions: (parsed.sessions || []).map((session) => ({
                ...session,
                date: session.date,
            })),
        };
    } catch (error) {
        console.warn('Не удалось загрузить состояние тренировки, используется базовое.', error);
        return createDefaultState();
    }
}

function saveState(nextState) {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function createDefaultState() {
    const today = new Date();
    const sessions = generateSessions(today);
    return {
        profile: {
            name: 'Атлет',
            notification_time: '07:30',
            timezone: 'Europe/Moscow',
            notifications_paused: false,
        },
        sessions,
    };
}

function generateSessions(today) {
    const start = subDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
    const totalDays = WEEK_TEMPLATE.length * 6; // две недели назад, текущая и три вперёд
    let idCounter = 1;

    const sessions = [];
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
        const template = WEEK_TEMPLATE[dayIndex % WEEK_TEMPLATE.length];
        if (!template) {
            continue;
        }

        const date = addDays(start, dayIndex);
        const dateKey = formatISO(date, { representation: 'date' });
        const diff = differenceInCalendarDays(today, date);
        let status = 'planned';
        if (diff > 2) {
            status = (dayIndex % 5 === 0) ? 'skipped' : 'done';
        } else if (diff > 0) {
            status = (dayIndex % 4 === 0) ? 'skipped' : 'done';
        } else if (diff === 0) {
            status = 'planned';
        }

        const exercises = template.exercises.map((exercise) => ({
            ...exercise,
            level_result: status === 'done' ? exercise.level_target : null,
        }));

        sessions.push({
            id: `session-${idCounter}`,
            date: dateKey,
            session_type: template.session_type,
            focus: template.focus,
            status,
            rpe: template.recommendedRpe,
            planned_volume: exercises.reduce((sum, exercise) => sum + computeTargetVolume(exercise.target), 0),
            exercises,
            completed_at: status === 'done' ? new Date(date.getTime() + 20 * 60 * 60 * 1000).toISOString() : null,
            notes: status === 'done' ? 'Выполнено по плану.' : '',
        });
        idCounter += 1;
    }

    return sessions;
}

function computeTargetVolume(target) {
    if (!target) {
        return 0;
    }
    if (typeof target.reps === 'number') {
        return target.sets * target.reps;
    }
    const numeric = parseInt(String(target.reps).replace(/\D+/g, ''), 10);
    return Number.isNaN(numeric) ? target.sets : target.sets * numeric;
}

function computeSessionVolume(session) {
    if (!session?.exercises) {
        return 0;
    }
    return session.exercises.reduce((sum, exercise) => sum + computeTargetVolume(exercise.target), 0);
}

function calculateAdherence(sessions) {
    const pastSessions = sessions.filter((session) => session.status === 'done' || session.status === 'skipped');
    if (pastSessions.length === 0) {
        return { adherence_percent: 100, completed: 0, total: 0 };
    }
    const completed = pastSessions.filter((session) => session.status === 'done').length;
    return {
        adherence_percent: Math.round((completed / pastSessions.length) * 100),
        completed,
        total: pastSessions.length,
    };
}

function calculateStreak(sessions) {
    let streak = 0;
    let cursor = new Date();

    while (true) {
        const dayKey = formatISO(cursor, { representation: 'date' });
        const hasSession = sessions.some(
            (session) => session.status === 'done' && session.date === dayKey,
        );
        if (!hasSession) {
            break;
        }
        streak += 1;
        cursor = subDays(cursor, 1);
    }

    return streak;
}

function getUpcomingSessions(sessions) {
    const todayKey = formatISO(new Date(), { representation: 'date' });
    return sessions
        .filter((session) => session.date >= todayKey && session.status === 'planned')
        .sort((a, b) => (a.date > b.date ? 1 : -1));
}

function getSessionById(state, id) {
    const session = state.sessions.find((item) => item.id === id);
    if (!session) {
        throw new Error('Сессия не найдена');
    }
    return session;
}

function determineDecision(rpe) {
    if (rpe <= 6) {
        return 'advance';
    }
    if (rpe >= 9) {
        return 'regress';
    }
    return 'hold';
}

function resolveLevelResult(progression, levelId, decision) {
    if (!progression) {
        return levelId;
    }
    const index = progression.levels.findIndex((level) => level.id === levelId);
    if (index === -1) {
        return levelId;
    }
    if (decision === 'advance' && index < progression.levels.length - 1) {
        return progression.levels[index + 1].id;
    }
    if (decision === 'regress' && index > 0) {
        return progression.levels[index - 1].id;
    }
    return levelId;
}

function buildHistory(sessions) {
    const history = new Map();
    sessions
        .filter((session) => session.status === 'done')
        .forEach((session) => {
            session.exercises.forEach((exercise) => {
                const progression = PROGRESSIONS.find((item) => item.key === exercise.exercise_key);
                const decision = determineDecision(session.rpe);
                const levelResult = resolveLevelResult(progression, exercise.level_target, decision);
                const item = {
                    session_date: format(parseISO(session.date), 'd MMM'),
                    recorded_at: session.completed_at || new Date().toISOString(),
                    level_target: exercise.level_target,
                    level_result: levelResult,
                    rpe: session.rpe,
                    decision,
                    notes: session.notes,
                };
                const existing = history.get(exercise.exercise_key) || [];
                history.set(exercise.exercise_key, [...existing, item].sort((a, b) => (a.recorded_at > b.recorded_at ? -1 : 1)));
            });
        });
    return history;
}

let state = loadState();

function updateState(mutator) {
    state = mutator(state);
    saveState(state);
    return state;
}

function getProfileSummary() {
    const adherence = calculateAdherence(state.sessions);
    const streak = calculateStreak(state.sessions);
    const upcoming = getUpcomingSessions(state.sessions);
    const nextSession = upcoming.length ? upcoming[0] : null;

    return Promise.resolve({
        data: {
            profile: state.profile,
            adherence: { ...adherence, streak_days: streak },
            next_session: nextSession,
        },
    });
}

function updatePreferences(payload) {
    return Promise.resolve().then(() => {
        updateState((prev) => ({
            ...prev,
            profile: {
                ...prev.profile,
                ...payload,
            },
        }));
        return { data: { success: true } };
    });
}

function getTodaySession() {
    const todayKey = formatISO(new Date(), { representation: 'date' });
    const session = state.sessions.find((item) => item.date === todayKey);
    return Promise.resolve({
        data: {
            session: session || null,
            source: 'local_plan',
        },
    });
}

function getWeekPlan(dateString) {
    const baseDate = dateString ? parseISO(dateString) : new Date();
    const start = startOfWeek(baseDate, { weekStartsOn: 1 });
    const end = endOfWeek(baseDate, { weekStartsOn: 1 });
    const sessions = state.sessions.filter((session) => {
        const sessionDate = parseISO(session.date);
        return !isBefore(sessionDate, start) && !isAfter(sessionDate, end);
    });

    return Promise.resolve({
        data: {
            week_start: formatISO(start, { representation: 'date' }),
            week_end: formatISO(end, { representation: 'date' }),
            sessions,
            source: 'local_plan',
        },
    });
}

function getSession(id) {
    const session = getSessionById(state, id);
    return Promise.resolve({ data: session });
}

function getRecentSessions() {
    const today = new Date();
    const recent = state.sessions
        .filter((session) => differenceInCalendarDays(today, parseISO(session.date)) <= 7)
        .sort((a, b) => (a.date > b.date ? -1 : 1));
    return Promise.resolve({
        data: {
            sessions: recent.map((session) => ({
                id: session.id,
                date: session.date,
                session_type: session.session_type,
                status: session.status,
                focus: session.focus,
                rpe: session.rpe,
            })),
        },
    });
}

function updateSession(id, payload) {
    return Promise.resolve().then(() => {
        const session = getSessionById(state, id);
        const nextState = updateState((prev) => {
            const updatedSessions = prev.sessions.map((item) => {
                if (item.id !== id) {
                    return item;
                }
                return {
                    ...item,
                    status: payload.status || item.status,
                    completed_at: payload.completed_at || item.completed_at || new Date().toISOString(),
                    rpe: payload.rpe ?? item.rpe,
                    notes: payload.notes ?? item.notes,
                    exercises: item.exercises.map((exercise) => {
                        const progression = PROGRESSIONS.find((prog) => prog.key === exercise.exercise_key);
                        const decision = determineDecision(payload.rpe ?? item.rpe);
                        return {
                            ...exercise,
                            level_result: resolveLevelResult(progression, exercise.level_target, decision),
                        };
                    }),
                };
            });
            return { ...prev, sessions: updatedSessions };
        });

        const updatedSession = getSessionById(nextState, id);
        const decision = determineDecision(updatedSession.rpe);
        const nextSteps = {
            advance: 'Можешь усложнить следующий подход — прогресс идёт отлично!',
            hold: 'Сохраняй текущий уровень и концентрацию на технике.',
            regress: 'Дай себе восстановление и вернись на более лёгкий вариант на пару тренировок.',
        }[decision];

        return { data: { session: updatedSession, next_steps: nextSteps } };
    });
}

function rescheduleSession(id, targetDate) {
    return Promise.resolve().then(() => {
        updateState((prev) => ({
            ...prev,
            sessions: prev.sessions.map((session) => {
                if (session.id !== id) {
                    return session;
                }
                return {
                    ...session,
                    date: targetDate,
                    status: 'planned',
                    completed_at: null,
                };
            }),
        }));
        const session = getSessionById(state, id);
        return { data: { session } };
    });
}

function getVolumeTrend(range = '30d') {
    const days = parseInt(range, 10) || 30;
    const start = subDays(new Date(), days - 1);

    const chart = [];
    for (let index = 0; index < days; index += 1) {
        const day = addDays(start, index);
        const dateKey = formatISO(day, { representation: 'date' });
        const volume = state.sessions
            .filter((session) => session.status === 'done' && session.date === dateKey)
            .reduce((sum, session) => sum + computeSessionVolume(session), 0);
        chart.push({ date: dateKey, volume, label: format(day, 'd MMM') });
    }

    const nonZero = chart.filter((item) => item.volume > 0);
    const averageVolume = nonZero.length
        ? Math.round(nonZero.reduce((sum, item) => sum + item.volume, 0) / nonZero.length)
        : 0;

    const periodSessions = state.sessions.filter((session) => {
        const sessionDate = parseISO(session.date);
        return session.status === 'done' && !isBefore(sessionDate, start);
    }).length;

    return {
        chart,
        summary: {
            average_volume: averageVolume,
            period_sessions: periodSessions,
        },
    };
}

function getRpeDistribution(range = '30d') {
    const days = parseInt(range, 10) || 30;
    const start = subDays(new Date(), days - 1);

    const buckets = new Map();
    state.sessions
        .filter((session) => session.status === 'done')
        .forEach((session) => {
            const sessionDate = parseISO(session.date);
            if (isBefore(sessionDate, start)) {
                return;
            }
            const bucketKey = Math.round(session.rpe || 7);
            buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
        });

    const chart = Array.from({ length: 6 }).map((_, index) => {
        const label = String(index + 5);
        return {
            label,
            value: buckets.get(Number(label)) || 0,
        };
    }).filter((item) => item.value > 0);

    const totalSessions = Array.from(buckets.values()).reduce((sum, value) => sum + value, 0);
    const heavySessions = Array.from(buckets.entries())
        .filter(([rpe]) => rpe >= 8)
        .reduce((sum, [, value]) => sum + value, 0);

    return {
        chart,
        summary: {
            heavy_share: totalSessions === 0 ? 0 : Math.round((heavySessions / totalSessions) * 100),
        },
    };
}

function getReport(slug, params = {}) {
    if (slug === 'volume_trend') {
        return Promise.resolve({ data: getVolumeTrend(params.range) });
    }
    if (slug === 'rpe_distribution') {
        return Promise.resolve({ data: getRpeDistribution(params.range) });
    }
    return Promise.resolve({ data: {} });
}

function getAchievements() {
    const adherence = calculateAdherence(state.sessions);
    const streak = calculateStreak(state.sessions);
    const completed = adherence.completed;
    const achievements = [];

    if (completed >= 1) {
        achievements.push({
            id: 'first-completion',
            title: 'Первый шаг',
            description: 'Поздравляем с первой отмеченной тренировкой! Продолжай в том же духе.',
        });
    }

    if (completed >= 8) {
        achievements.push({
            id: 'consistent-eight',
            title: 'Набрал темп',
            description: 'Выполнено 8 тренировок — привычка закрепляется.',
        });
    }

    if (streak >= 3) {
        achievements.push({
            id: 'three-streak',
            title: 'Серия 3+',
            description: 'Более трёх тренировок подряд без пропусков. Отличная концентрация!',
        });
    }

    const volumeTrend = getVolumeTrend('30d');
    if (volumeTrend.summary.average_volume >= 120) {
        achievements.push({
            id: 'volume-master',
            title: 'Повышенная нагрузка',
            description: 'Средний объём за месяц превысил 120 повторений.',
        });
    }

    if (!achievements.length) {
        achievements.push({
            id: 'keep-going',
            title: 'Всё только начинается',
            description: 'Первые шаги сделаны — отмечай тренировки, чтобы открывать награды.',
        });
    }

    return Promise.resolve({ data: { achievements } });
}

function getExerciseCatalog() {
    const history = buildHistory(state.sessions);
    const items = PROGRESSIONS.map((progression) => {
        const progressionHistory = history.get(progression.key) || [];
        const latest = progressionHistory.length ? {
            level: progressionHistory[0].level_result,
            session_date: progressionHistory[0].session_date,
        } : null;
        return {
            ...progression,
            latest_progress: latest,
        };
    });

    return Promise.resolve({ data: { items } });
}

function getExerciseHistory(exerciseKey) {
    const history = buildHistory(state.sessions);
    return Promise.resolve({ data: { items: history.get(exerciseKey) || [] } });
}

export const trainingService = {
    getProfileSummary,
    updatePreferences,
    getTodaySession,
    getWeekPlan,
    getSession,
    getRecentSessions,
    updateSession,
    rescheduleSession,
    getReport,
    getAchievements,
    getExerciseCatalog,
    getExerciseHistory,
};

export default trainingService;

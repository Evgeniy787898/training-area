export const DEMO_PROFILE_SUMMARY = {
    profile: {
        first_name: 'Алексей',
        preferences: {
            training_goal: 'Баланс силы и выносливости',
            training_frequency: 4,
            onboarding_status: 'completed',
        },
        goals: {
            description: 'Баланс силы, мобильности и выносливости',
        },
        notification_time: '07:30:00',
        notifications_paused: false,
        timezone: 'Europe/Moscow',
        equipment: ['турник', 'резинки'],
    },
    equipment: ['турник', 'резинки'],
    adherence: {
        adherence_percent: 86,
        streak: 5,
        updated_at: new Date().toISOString(),
    },
    highlights: {
        focus: 'Функциональная тренировка',
        next_goal: 'Подтягивания 12 раз',
        recovery_tip: 'Лёгкая мобилизация + дыхание 4-6-4',
    },
    upcoming_session: {
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        session_type: 'Сила корпуса',
        focus: 'Подтягивания и стабильность корпуса',
    },
};

export const DEMO_ANALYTICS = {
    volume: {
        chart: [
            { date: '2024-09-28', volume: 32 },
            { date: '2024-10-02', volume: 44 },
            { date: '2024-10-05', volume: 38 },
            { date: '2024-10-09', volume: 52 },
            { date: '2024-10-12', volume: 47 },
            { date: '2024-10-16', volume: 55 },
            { date: '2024-10-19', volume: 49 },
        ],
        summary: {
            average_volume: 45,
            period_sessions: 12,
        },
    },
    rpe: {
        chart: [
            { label: 'RPE 5', value: 3 },
            { label: 'RPE 6', value: 4 },
            { label: 'RPE 7', value: 3 },
            { label: 'RPE 8', value: 2 },
            { label: 'RPE 9', value: 1 },
        ],
        summary: {
            heavy_share: 28,
        },
    },
    achievements: [
        { id: 'streak_4', title: 'Серия 4 недели', description: 'Тренировки без пропусков весь месяц.' },
        { id: 'volume_200', title: '200 повторений', description: 'Совокупный объём за неделю превысил 200 повторений.' },
        { id: 'recovery', title: 'Грамотный отдых', description: 'Соблюдаешь дни восстановления и баланс нагрузок.' },
    ],
};

export const DEMO_REPORT_HINT = `
✅ Сессия: Сила корпуса — подтягивания, пресс, мост.
⚙️ План: 3×8 подтягивания, 3×12 подъём коленей, 2×12 полумост.
🔥 Цель: ровные повторения и контроль корпуса.
🧘 Заминка: дыхание 4-6-4 и лёгкая растяжка плеч.
`;

export default {
    DEMO_PROFILE_SUMMARY,
    DEMO_ANALYTICS,
    DEMO_REPORT_HINT,
};

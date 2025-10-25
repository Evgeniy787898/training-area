import { addDays, format, startOfWeek } from 'date-fns';

const TEMPLATE = [
    {
        dayOffset: 0,
        session_type: 'Верх тела',
        focus: 'Подтягивания и пресс',
        rpe: 6,
        exercises: [
            { name: 'Вертикальные подтягивания', exercise_key: 'pullups', target: { sets: 3, reps: 10 }, notes: 'Держи корпус жёстким' },
            { name: 'Подтягивание коленей лёжа', exercise_key: 'legRaises', target: { sets: 3, reps: 15 }, notes: 'Контроль поясницы' },
        ],
    },
    {
        dayOffset: 2,
        session_type: 'Жимовой день',
        focus: 'Отжимания и стойка',
        rpe: 6,
        exercises: [
            { name: 'Отжимания от стены', exercise_key: 'pushups', target: { sets: 3, reps: 12 }, notes: 'Локти под 45°' },
            { name: 'Стойка у стены', exercise_key: 'handstand', target: { sets: 3, reps: 30 }, notes: 'Толкай пол' },
        ],
    },
    {
        dayOffset: 4,
        session_type: 'Ноги и баланс',
        focus: 'Приседания и мост',
        rpe: 5,
        exercises: [
            { name: 'Приседания с поддержкой', exercise_key: 'squats', target: { sets: 3, reps: 15 }, notes: 'Держи пятки на полу' },
            { name: 'Полумост', exercise_key: 'bridge', target: { sets: 2, reps: 12 }, notes: 'Плавное дыхание' },
        ],
    },
];

export function buildStaticPlan(reference = new Date()) {
    const weekStart = startOfWeek(reference, { weekStartsOn: 1 });

    const sessions = TEMPLATE.map(template => {
        const date = addDays(weekStart, template.dayOffset);
        const dateStr = format(date, 'yyyy-MM-dd');

        return {
            id: `static_${dateStr}`,
            date: dateStr,
            session_type: template.session_type,
            focus: template.focus,
            status: 'planned',
            rpe: template.rpe,
            exercises: template.exercises.map(exercise => ({
                ...exercise,
                sets: exercise.target?.sets ?? null,
                reps: exercise.target?.reps ?? null,
            })),
        };
    });

    return {
        week_start: format(weekStart, 'yyyy-MM-dd'),
        week_end: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
        sessions,
    };
}

export function getStaticSessionForDate(date = new Date()) {
    const plan = buildStaticPlan(date);
    const target = format(date, 'yyyy-MM-dd');
    return plan.sessions.find(session => session.date === target) || null;
}

export default buildStaticPlan;

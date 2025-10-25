export interface PlanExercise {
  exercise_key: string;
  name: string;
  target?: {
    sets?: number;
    reps?: number;
    duration_seconds?: number;
  };
  cues?: string[];
  notes?: string;
  rpe?: number;
}

export interface PlanSession {
  date: string;
  session_type: string;
  status: string;
  focus?: string;
  intensity?: string;
  notes?: string;
  rpe?: number;
  source?: string;
  exercises: PlanExercise[];
}

export interface GeneratedPlan {
  sessions: PlanSession[];
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export function getWeekRange(referenceDate: Date): {
  weekStart: Date;
  weekEnd: Date;
  weekStartStr: string;
  weekEndStr: string;
} {
  const ref = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  ));
  const day = ref.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(ref);
  weekStart.setUTCDate(ref.getUTCDate() + diff);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return {
    weekStart,
    weekEnd,
    weekStartStr: formatDate(weekStart),
    weekEndStr: formatDate(weekEnd),
  };
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildFallbackPlan(
  profile: Record<string, any>,
  referenceDate: Date,
  reason = "fallback",
): GeneratedPlan {
  const { weekStart, weekEnd, weekStartStr, weekEndStr } = getWeekRange(referenceDate);
  const frequency: number =
    Number(profile?.preferences?.training_frequency ?? 4) || 4;
  const templates: Array<Omit<PlanSession, "date" | "status" | "source">> = [
    {
      session_type: "Верх тела — сила",
      focus: "Сила",
      intensity: "умеренная",
      notes: "Акцент на базовых подтягивающих движениях",
      rpe: 7,
      exercises: [
        {
          exercise_key: "pullups",
          name: "Подтягивания широким хватом",
          target: { sets: 4, reps: 6 },
          cues: ["Лопатки вниз", "Корпус жёсткий"],
        },
        {
          exercise_key: "dip_bar",
          name: "Отжимания на брусьях",
          target: { sets: 4, reps: 8 },
          cues: ["Держи локти ближе к корпусу"],
        },
        {
          exercise_key: "plank",
          name: "Планка на предплечьях",
          target: { duration_seconds: 60 },
          cues: ["Вытягивай макушку вперёд"],
        },
      ],
    },
    {
      session_type: "Нижняя часть — устойчивость",
      focus: "Устойчивость",
      intensity: "умеренная",
      notes: "Работаем над силой ног и балансом",
      rpe: 7,
      exercises: [
        {
          exercise_key: "split_squat",
          name: "Болгарские выпады",
          target: { sets: 3, reps: 10 },
          cues: ["Колено над стопой", "Опорная нога активная"],
        },
        {
          exercise_key: "hip_raise",
          name: "Ягодичный мост",
          target: { sets: 3, reps: 12 },
          cues: ["Сжимай ягодицы вверху"],
        },
        {
          exercise_key: "hollow_hold",
          name: "Холлоу-холд",
          target: { duration_seconds: 45 },
          cues: ["Поясница прижата"],
        },
      ],
    },
    {
      session_type: "Функциональная выносливость",
      focus: "Выносливость",
      intensity: "высокая",
      notes: "Циклы на повышение пульса",
      rpe: 8,
      exercises: [
        {
          exercise_key: "burpee",
          name: "Берпи",
          target: { sets: 4, reps: 12 },
          cues: ["Дыши ритмично"],
        },
        {
          exercise_key: "row",
          name: "Гребля на петлях",
          target: { sets: 4, reps: 12 },
          cues: ["Корпус жёсткий"],
        },
        {
          exercise_key: "mountain_climber",
          name: "Альпинист",
          target: { duration_seconds: 45 },
          cues: ["Колени к груди", "Не проваливайся в пояснице"],
        },
      ],
    },
    {
      session_type: "Мобильность и кор",
      focus: "Восстановление",
      intensity: "низкая",
      notes: "Лёгкая работа и растяжка",
      rpe: 5,
      exercises: [
        {
          exercise_key: "cat_cow",
          name: "Кошка-корова",
          target: { duration_seconds: 180 },
          cues: ["Двигайся мягко"],
        },
        {
          exercise_key: "side_plank",
          name: "Боковая планка",
          target: { sets: 3, duration_seconds: 40 },
          cues: ["Таз высоко", "Корпус в одну линию"],
        },
        {
          exercise_key: "deep_squat_hold",
          name: "Статический присед",
          target: { duration_seconds: 60 },
          cues: ["Стопы прижаты", "Колени наружу"],
        },
      ],
    },
  ];

  const sessions: PlanSession[] = [];
  let templateIndex = 0;
  for (let day = 0; day < 7; day += 1) {
    const date = new Date(weekStart);
    date.setUTCDate(weekStart.getUTCDate() + day);
    const formattedDate = formatDate(date);

    if (sessions.length < frequency) {
      const template = templates[templateIndex % templates.length];
      templateIndex += 1;
      sessions.push({
        date: formattedDate,
        session_type: template.session_type,
        focus: template.focus,
        intensity: template.intensity,
        notes: template.notes,
        exercises: template.exercises.map((exercise) => ({ ...exercise })),
        status: "planned",
        rpe: template.rpe,
        source: "fallback",
      });
    } else {
      sessions.push({
        date: formattedDate,
        session_type: "День восстановления",
        focus: "Отдых",
        intensity: "низкая",
        notes: "Прогулка 20 минут, мягкая растяжка",
        exercises: [],
        status: "rest",
        rpe: 2,
        source: "fallback",
      });
    }
  }

  const metadata = {
    generator: "fallback",
    generated_at: new Date().toISOString(),
    week_start: weekStartStr,
    week_end: weekEndStr,
    reason,
  };

  const summary = {
    reason,
    total_sessions: sessions.filter((session) => session.status !== "rest").length,
    recovery_days: sessions.filter((session) => session.status === "rest").length,
    training_frequency: frequency,
    generator: "fallback",
  };

  return { sessions, summary, metadata };
}

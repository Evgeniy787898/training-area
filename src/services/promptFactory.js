import { EXERCISE_CATALOG } from '../training/exerciseCatalog.js';

const formatExercise = (exercise) => `• ${exercise.title} (${exercise.focus}) — ${exercise.description}`;

export const buildCoachPrompt = ({
  userName,
  goal,
  readiness,
  sessions,
  request
}) => {
  const catalogDescription = EXERCISE_CATALOG.map((exercise) => formatExercise(exercise)).join('\n');
  const historySummary = sessions
    .map((session) => `- ${session.planned_for}: ${session.status} (${session.intensity}). Короткие заметки: ${session.reflection ?? 'нет'}`)
    .join('\n');

  return `Ты — персональный тренер для ${userName}. Мы работаем только с ним, никаких других клиентов нет.
Цель: ${goal ?? 'уточняем во время беседы'}.
Текущий уровень готовности по 5-балльной шкале: ${readiness}.

Вот упражнения, которыми ты оперируешь:
${catalogDescription}

История последних сессий:
${historySummary || 'история пока пустая, формируем с нуля'}

Текущее обращение:
"""
${request}
"""

Сформируй ответ в тоне поддерживающего и внимательного тренера. Структурируй текст с подзаголовками, маркерами и эмодзи, чтобы всё выглядело стильно и мотивирующе. Обязательно:
1. Короткое приветствие на «ты».
2. Лаконичный прогрев и основные блоки тренировки с указанием количества подходов/времени.
3. Поясни зачем каждый блок нужен.
4. Добавь подсказку по дыханию и вниманию.
5. Заверши конкретным ритуалом завершения тренировки.
6. Если пользователь просит обновить цель или статус, сначала подтверди изменения, потом переходи к рекомендациям.`;
};

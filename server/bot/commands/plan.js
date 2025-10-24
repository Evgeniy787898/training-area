import { Markup } from 'telegraf';
import { db } from '../../infrastructure/supabase.js';
import { format, addDays, startOfWeek } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';

/**
 * Команда /plan - показать план тренировок
 */
export async function planCommand(ctx) {
    const profileId = ctx.state.profileId;

    try {
        // Получаем тренировки на текущую неделю
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Понедельник
        const weekEnd = addDays(weekStart, 6);

        const sessions = await db.getTrainingSessions(profileId, {
            startDate: format(weekStart, 'yyyy-MM-dd'),
            endDate: format(weekEnd, 'yyyy-MM-dd'),
        });

        if (!sessions || sessions.length === 0) {
            await sendNoPlanMessage(ctx);
            return;
        }

        // Формируем сообщение с планом
        let planMessage = `📅 **План тренировок на неделю**\n\n`;
        planMessage += `Период: ${format(weekStart, 'd MMMM', { locale: ru })} — ${format(weekEnd, 'd MMMM', { locale: ru })}\n\n`;

        // Группируем по дням
        for (let i = 0; i < 7; i++) {
            const currentDate = addDays(weekStart, i);
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const daySession = sessions.find(s => s.date === dateStr);

            const dayName = format(currentDate, 'EEEE', { locale: ru });
            const dateDisplay = format(currentDate, 'd MMM', { locale: ru });
            const isToday = format(currentDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

            if (daySession) {
                const statusEmoji = getStatusEmoji(daySession.status);
                planMessage += `${isToday ? '👉 ' : ''}**${dayName}, ${dateDisplay}** ${statusEmoji}\n`;
                planMessage += formatSessionPreview(daySession);
                planMessage += '\n';
            } else {
                planMessage += `${isToday ? '👉 ' : ''}**${dayName}, ${dateDisplay}** 💤 Отдых\n\n`;
            }
        }

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📋 Сегодня подробнее', 'plan_today')],
            [Markup.button.callback('🔄 Обновить план', 'plan_regenerate')],
        ]);

        await ctx.reply(planMessage, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
        console.error('Error in plan command:', error);
        await ctx.reply(
            '😔 Не удалось загрузить план тренировок. Попробуйте позже.'
        );
    }
}

/**
 * Показать подробный план на сегодня
 */
export async function planTodayCallback(ctx) {
    await ctx.answerCbQuery();

    const profileId = ctx.state.profileId;
    const today = format(new Date(), 'yyyy-MM-dd');

    try {
        const sessions = await db.getTrainingSessions(profileId, {
            startDate: today,
            endDate: today,
        });

        if (!sessions || sessions.length === 0) {
            await ctx.reply('💤 На сегодня тренировка не запланирована. Отдыхай!');
            return;
        }

        const session = sessions[0];
        const detailedMessage = formatDetailedSession(session);

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Начать тренировку', `session_start_${session.id}`)],
            [Markup.button.callback('🔄 Перенести', `session_reschedule_${session.id}`)],
        ]);

        await ctx.reply(detailedMessage, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
        console.error('Error showing today plan:', error);
        await ctx.reply('😔 Не удалось загрузить план на сегодня.');
    }
}

/**
 * Сообщение если плана нет
 */
async function sendNoPlanMessage(ctx) {
    const message =
        `📅 **План тренировок не найден**\n\n` +
        `Похоже, план ещё не создан. Давай составим его!`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Создать план', 'plan_create')],
    ]);

    await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Форматирование краткого превью тренировки
 */
function formatSessionPreview(session) {
    const exercises = session.exercises || [];

    if (exercises.length === 0) {
        return `Тренировка: ${session.session_type || 'Основная'}\n`;
    }

    const preview = exercises.slice(0, 2).map(ex =>
        `• ${ex.name || ex.exercise_key}`
    ).join('\n');

    const more = exercises.length > 2 ? `\n• ... и ещё ${exercises.length - 2}` : '';

    return preview + more + '\n';
}

/**
 * Форматирование детальной тренировки
 */
function formatDetailedSession(session) {
    let message = `🏋️ **Тренировка на ${format(new Date(session.date), 'd MMMM', { locale: ru })}**\n\n`;

    if (session.session_type) {
        message += `**Тип:** ${session.session_type}\n\n`;
    }

    const exercises = session.exercises || [];

    if (exercises.length > 0) {
        message += `**Упражнения:**\n\n`;

        exercises.forEach((ex, index) => {
            message += `${index + 1}. **${ex.name || ex.exercise_key}**\n`;

            if (ex.sets && ex.reps) {
                message += `   Подходы: ${ex.sets} × ${ex.reps}\n`;
            }

            if (ex.tempo) {
                message += `   Темп: ${ex.tempo}\n`;
            }

            if (ex.rest) {
                message += `   Отдых: ${ex.rest} сек\n`;
            }

            if (ex.notes) {
                message += `   💡 ${ex.notes}\n`;
            }

            message += '\n';
        });
    }

    if (session.notes) {
        message += `**Заметки:**\n${session.notes}\n\n`;
    }

    const targetRpe = session.rpe || 7;
    message += `🎯 Целевое RPE: ${targetRpe}/10\n`;

    return message;
}

/**
 * Получить эмодзи статуса
 */
function getStatusEmoji(status) {
    const statusMap = {
        'planned': '📋',
        'in_progress': '🏃',
        'done': '✅',
        'skipped': '⏭️',
        'rescheduled': '🔄',
    };
    return statusMap[status] || '📋';
}

export default {
    planCommand,
    planTodayCallback,
};


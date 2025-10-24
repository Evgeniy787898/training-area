import { Markup } from 'telegraf';
import { db } from '../../infrastructure/supabase.js';
import { format, addDays, startOfWeek } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';
import { buildDefaultWeekPlan } from '../../services/staticPlan.js';

const PLAN_CACHE_STATE = 'ui_cached_plan';

/**
 * Команда /plan - показать план тренировок
 */
export async function planCommand(ctx) {
    const profileId = ctx.state.profileId;
    const profile = ctx.state.profile;
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    try {
        await beginChatResponse(ctx);

        const sessions = await db.getTrainingSessions(profileId, {
            startDate: format(weekStart, 'yyyy-MM-dd'),
            endDate: format(weekEnd, 'yyyy-MM-dd'),
        });

        if (!sessions || sessions.length === 0) {
            await sendFallbackPlan(ctx, profile, weekStart, weekEnd, today);
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
        ]);

        await replyWithTracking(ctx, planMessage, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
        console.error('Error in plan command:', error);

        try {
            await sendFallbackPlan(ctx, profile, weekStart, weekEnd, today);
        } catch (fallbackError) {
            console.error('Fallback plan failed:', fallbackError);
            await replyWithTracking(ctx,
                '😔 Не удалось загрузить план тренировок. Попробуйте позже.'
            );
        }
    }
}

/**
 * Показать подробный план на сегодня
 */
export async function planTodayCallback(ctx) {
    if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery();
    }

    const profileId = ctx.state.profileId;
    const profile = ctx.state.profile;
    const today = format(new Date(), 'yyyy-MM-dd');

    if (ctx.updateType === 'callback_query') {
        try {
            await ctx.deleteMessage();
        } catch (error) {
            // Сообщение уже могло быть удалено
        }
    }

    try {
        const sessions = await db.getTrainingSessions(profileId, {
            startDate: today,
            endDate: today,
        });

        if (!sessions || sessions.length === 0) {
            await serveFallbackToday(ctx, profile, today);
            return;
        }

        const session = sessions[0];
        const detailedMessage = formatDetailedSession(session);

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Начать тренировку', `session_start_${session.id}`)],
            [Markup.button.callback('🔄 Перенести', `session_reschedule_${session.id}`)],
        ]);

        await beginChatResponse(ctx);
        await replyWithTracking(ctx, detailedMessage, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
        console.error('Error showing today plan:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Не удалось загрузить план на сегодня.');
    }
}

/**
 * Сообщение если плана нет
 */
async function sendFallbackPlan(ctx, profile, weekStart, weekEnd, today) {
    const profileId = ctx.state.profileId;
    const plan = await loadFallbackPlan(profile, profileId, weekStart, weekEnd);

    const sessionsByDate = new Map((plan.sessions || []).map(session => [session.date, session]));

    let message = `📅 **План тренировок на неделю**\n\n`;
    message += `Период: ${format(weekStart, 'd MMMM', { locale: ru })} — ${format(weekEnd, 'd MMMM', { locale: ru })}\n\n`;

    for (let i = 0; i < 7; i++) {
        const currentDate = addDays(weekStart, i);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const session = sessionsByDate.get(dateStr);
        const dayName = format(currentDate, 'EEEE', { locale: ru });
        const dateDisplay = format(currentDate, 'd MMM', { locale: ru });
        const isToday = format(currentDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

        if (session) {
            message += `${isToday ? '👉 ' : ''}**${dayName}, ${dateDisplay}** 📋\n`;
            message += formatSessionPreview(session);
            message += '\n';
        } else {
            message += `${isToday ? '👉 ' : ''}**${dayName}, ${dateDisplay}** 💤 Отдых\n\n`;
        }
    }

    message += `План построен по базовой программе прогрессий и адаптируется под доступное оборудование.\n`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Сегодня подробнее', 'plan_today')],
    ]);

    await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...keyboard });
}

async function loadFallbackPlan(profile, profileId, weekStart, weekEnd) {
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');

    try {
        const cached = await db.getDialogState(profileId, PLAN_CACHE_STATE);
        if (cached?.state_payload?.plan?.metadata?.week_start === weekStartStr) {
            return cached.state_payload.plan;
        }
    } catch (error) {
        console.error('Failed to load cached plan:', error);
    }

    const frequency = profile?.preferences?.training_frequency || 4;
    const plan = buildDefaultWeekPlan({ startDate: weekStart, frequency });

    try {
        await db.saveDialogState(
            profileId,
            PLAN_CACHE_STATE,
            {
                plan,
                generated_at: new Date().toISOString(),
            },
            addDays(weekEnd, 1)
        );
    } catch (error) {
        console.error('Failed to store fallback plan:', error);
    }

    return plan;
}

async function serveFallbackToday(ctx, profile, todayIso) {
    const todayDate = new Date(todayIso);
    const weekStart = startOfWeek(todayDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const plan = await loadFallbackPlan(profile, ctx.state.profileId, weekStart, weekEnd);
    const session = (plan.sessions || []).find(item => item.date === todayIso);

    await beginChatResponse(ctx);

    if (!session) {
        await replyWithTracking(
            ctx,
            '💤 На сегодня тренировка не запланирована. Используй день для восстановления и лёгкой мобилизации.'
        );
        return;
    }

    const message = formatDetailedSession(session) + '\n\nОткрой WebApp, чтобы отметить выполнение и обновить прогрессию.';
    await replyWithTracking(ctx, message, { parse_mode: 'Markdown' });
}

/**
 * Форматирование краткого превью тренировки
 */
function formatSessionPreview(session) {
    const exercises = session.exercises || [];

    if (exercises.length === 0) {
        return `Тренировка: ${session.session_type || 'Основная'}\n`;
    }

    const preview = exercises.slice(0, 2).map(ex => {
        const name = ex.name || ex.exercise_key;
        const level = ex.level ? ` (${ex.level})` : '';
        const volume = ex.sets && ex.reps ? ` — ${ex.sets}×${ex.reps}` : '';
        return `• ${name}${level}${volume}`;
    }).join('\n');

    const more = exercises.length > 2 ? `\n• ... и ещё ${exercises.length - 2}` : '';

    return preview + more + '\n';
}

/**
 * Форматирование детальной тренировки
 */
function formatDetailedSession(session) {
    let message = `🏋️ **Тренировка на ${format(new Date(session.date), 'd MMMM', { locale: ru })}**\n\n`;

    if (session.focus) {
        message += `**Фокус:** ${session.focus}\n\n`;
    }

    if (session.session_type) {
        message += `**Тип:** ${session.session_type}\n\n`;
    }

    if (session.warmup && session.warmup.length > 0) {
        message += `**Разминка:**\n`;
        message += session.warmup.map(item => `• ${item}`).join('\n');
        message += '\n\n';
    }

    const exercises = session.exercises || [];

    if (exercises.length > 0) {
        message += `**Упражнения:**\n\n`;

        exercises.forEach((ex, index) => {
            message += `${index + 1}. **${ex.name || ex.exercise_key}**\n`;

            if (ex.level) {
                message += `   Уровень: ${ex.level}\n`;
            }

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

    if (session.cooldown && session.cooldown.length > 0) {
        message += `**Заминка:**\n`;
        message += session.cooldown.map(item => `• ${item}`).join('\n');
        message += '\n\n';
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


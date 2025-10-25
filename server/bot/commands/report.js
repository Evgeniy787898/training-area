import { Markup } from 'telegraf';
import { db } from '../../infrastructure/supabase.js';
import { format } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import plannerService from '../../services/planner.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';
import { buildMainMenuKeyboard, withMainMenuButton } from '../utils/menu.js';

/**
 * Команда /report - отчёт о тренировке
 */
export async function reportCommand(ctx) {
    const profileId = ctx.state.profileId;

    try {
        await beginChatResponse(ctx);

        // Получаем последние 3 тренировки для выбора
        const sessions = await db.getTrainingSessions(profileId, {
            status: 'planned',
        });

        if (!sessions || sessions.length === 0) {
            await replyWithTracking(ctx,
                '📋 Нет запланированных тренировок для отчёта.\n\n' +
                'Сначала создай план командой /plan',
                buildMainMenuKeyboard()
            );
            return;
        }

        // Показываем кнопки для выбора тренировки
        const buttons = sessions.slice(0, 5).map(session => {
            const dateStr = format(new Date(session.date), 'd MMMM', { locale: ru });
            return [Markup.button.callback(
                `${dateStr} - ${session.session_type || 'Тренировка'}`,
                `report_session_${session.id}`
            )];
        });

        const keyboard = withMainMenuButton(buttons);

        await replyWithTracking(ctx,
            '📝 **Отчёт о тренировке**\n\n' +
            'Выбери тренировку, о которой хочешь отчитаться:',
            { parse_mode: 'Markdown', ...keyboard }
        );

    } catch (error) {
        console.error('Error in report command:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Не удалось загрузить список тренировок.');
    }
}

/**
 * Обработчик выбора тренировки для отчёта
 */
export async function reportSessionCallback(ctx) {
    await ctx.answerCbQuery();

    const sessionId = ctx.callbackQuery.data.replace('report_session_', '');

    try {
        const session = await db.getTrainingSession(sessionId);

        if (!session) {
            await ctx.reply('😔 Тренировка не найдена.');
            return;
        }

        // Сохраняем состояние для сбора отчёта
        await db.saveDialogState(
            ctx.state.profileId,
            'report',
            {
                sessionId: session.id,
                step: 'rpe',
            },
            new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
        );

        await ctx.deleteMessage();

        await beginChatResponse(ctx);

        const message =
            `📝 **Отчёт о тренировке**\n\n` +
            `Тренировка: ${format(new Date(session.date), 'd MMMM', { locale: ru })}\n\n` +
            `**Шаг 1/3: Оцени нагрузку**\n\n` +
            `Насколько тяжёлой была тренировка? (RPE по шкале 1-10)\n\n` +
            `1-3 — Очень легко\n` +
            `4-6 — Умеренно\n` +
            `7-8 — Тяжело\n` +
            `9-10 — Очень тяжело`;

        const keyboard = withMainMenuButton([
            [
                Markup.button.callback('1-3 😌', 'rpe_2'),
                Markup.button.callback('4-6 😊', 'rpe_5'),
                Markup.button.callback('7-8 💪', 'rpe_7'),
                Markup.button.callback('9-10 🔥', 'rpe_9'),
            ],
        ]);

        await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
        console.error('Error in report session callback:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Произошла ошибка при создании отчёта.');
    }
}

/**
 * Обработчик выбора RPE
 */
export async function rpeCallback(ctx) {
    await ctx.answerCbQuery();

    const rpeMap = {
        'rpe_2': 2,
        'rpe_5': 5,
        'rpe_7': 7.5,
        'rpe_9': 9,
    };

    const rpe = rpeMap[ctx.callbackQuery.data];

    // Обновляем состояние
    const currentState = await db.getDialogState(ctx.state.profileId, 'report');
    const newPayload = {
        ...currentState.state_payload,
        rpe,
        step: 'completion',
    };

    await db.saveDialogState(
        ctx.state.profileId,
        'report',
        newPayload,
        new Date(Date.now() + 2 * 60 * 60 * 1000)
    );

    await ctx.deleteMessage();

    await beginChatResponse(ctx);

    const message =
        `📝 **Отчёт о тренировке**\n\n` +
        `✅ RPE: ${rpe}/10\n\n` +
        `**Шаг 2/3: Как выполнил?**\n\n` +
        `Удалось ли выполнить план полностью?`;

    const keyboard = withMainMenuButton([
        [Markup.button.callback('✅ Да, полностью', 'completion_full')],
        [Markup.button.callback('🔸 Частично', 'completion_partial')],
        [Markup.button.callback('❌ Не получилось', 'completion_none')],
    ]);

    await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Обработчик степени выполнения
 */
export async function completionCallback(ctx) {
    await ctx.answerCbQuery();

    const completionMap = {
        'completion_full': { rate: 100, label: 'Полностью' },
        'completion_partial': { rate: 70, label: 'Частично' },
        'completion_none': { rate: 0, label: 'Не выполнено' },
    };

    const completion = completionMap[ctx.callbackQuery.data];

    // Обновляем состояние
    const currentState = await db.getDialogState(ctx.state.profileId, 'report');
    const newPayload = {
        ...currentState.state_payload,
        completionRate: completion.rate,
        step: 'notes',
    };

    await db.saveDialogState(
        ctx.state.profileId,
        'report',
        newPayload,
        new Date(Date.now() + 2 * 60 * 60 * 1000)
    );

    await ctx.deleteMessage();

    await beginChatResponse(ctx);

    const message =
        `📝 **Отчёт о тренировке**\n\n` +
        `✅ RPE: ${newPayload.rpe}/10\n` +
        `✅ Выполнение: ${completion.label}\n\n` +
        `**Шаг 3/3: Есть заметки?**\n\n` +
        `Напиши, если хочешь добавить комментарий о самочувствии, технике или боли.\n\n` +
        `Или нажми "Пропустить", чтобы завершить отчёт.`;

    const keyboard = withMainMenuButton([
        [Markup.button.callback('⏭️ Пропустить', 'notes_skip')],
    ]);

    await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Обработчик пропуска заметок
 */
export async function notesSkipCallback(ctx) {
    await ctx.answerCbQuery();
    await finalizeReport(ctx, null);
}

/**
 * Обработчик текстовых заметок
 */
export async function notesTextHandler(ctx) {
    const currentState = await db.getDialogState(ctx.state.profileId, 'report');

    if (!currentState || currentState.state_payload.step !== 'notes') {
        return; // Не в режиме ввода заметок
    }

    const notes = ctx.message.text;
    await finalizeReport(ctx, notes);
}

/**
 * Финализация отчёта
 */
async function finalizeReport(ctx, notes) {
    const currentState = await db.getDialogState(ctx.state.profileId, 'report');
    const { sessionId, rpe, completionRate } = currentState.state_payload;

    try {
        // Обновляем сессию
        await db.updateTrainingSession(sessionId, {
            status: completionRate > 50 ? 'done' : 'skipped',
            rpe,
            notes: notes || '',
            updated_at: new Date().toISOString(),
        });

        // Очищаем состояние
        await db.clearDialogState(ctx.state.profileId, 'report');

        // Анализируем с помощью AI
        const session = await db.getTrainingSession(sessionId);

        let feedbackMessage =
            `✅ **Отчёт принят!**\n\n` +
            `Тренировка: ${format(new Date(session.date), 'd MMMM', { locale: ru })}\n` +
            `RPE: ${rpe}/10\n` +
            `Выполнение: ${completionRate}%\n`;

        if (notes) {
            feedbackMessage += `\nТвои заметки: ${notes}\n`;
        }

        await beginChatResponse(ctx);

        const placeholderMessage = `${feedbackMessage}\n\n⏳ Готовлю рекомендации...`;
        const summaryMessage = await replyWithTracking(ctx, placeholderMessage, { parse_mode: 'Markdown' });

        // Получаем AI-анализ (в фоне)
        setTimeout(async () => {
            try {
                const analysis = await plannerService.analyzeTrainingReport({
                    session,
                    exercises: session.exercises || [],
                    rpe,
                    notes,
                    history: await db.getTrainingSessions(ctx.state.profileId, {
                        endDate: session.date,
                    }),
                });

                if (analysis.feedback) {
                    const finalText = `${feedbackMessage}\n\n💭 **Мой анализ:**\n\n${analysis.feedback}`;
                    try {
                        await ctx.telegram.editMessageText(
                            ctx.chat.id,
                            summaryMessage.message_id,
                            undefined,
                            finalText,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (editError) {
                        console.error('Failed to edit summary message:', editError);
                        await replyWithTracking(ctx, `💭 **Мой анализ:**\n\n${analysis.feedback}`, { parse_mode: 'Markdown' });
                    }
                } else {
                    try {
                        await ctx.telegram.editMessageText(
                            ctx.chat.id,
                            summaryMessage.message_id,
                            undefined,
                            feedbackMessage,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (editError) {
                        console.error('Failed to finalize summary message:', editError);
                    }
                }
            } catch (error) {
                console.error('Error getting AI analysis:', error);
                try {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        summaryMessage.message_id,
                        undefined,
                        `${feedbackMessage}\n\n⚠️ Не удалось получить рекомендации — повторю анализ позже.`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (editError) {
                    console.error('Failed to update summary after analysis error:', editError);
                }
            }
        }, 1000);

        // Записываем метрику
        await db.recordMetric(
            ctx.state.profileId,
            'training_completed',
            1,
            'count'
        );

        // Логируем событие
        await db.logEvent(
            ctx.state.profileId,
            'training_report_submitted',
            'info',
            { session_id: sessionId, rpe, completion_rate: completionRate }
        );

    } catch (error) {
        console.error('Error finalizing report:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Не удалось сохранить отчёт. Попробуй позже.');
    }
}

export default {
    reportCommand,
    reportSessionCallback,
    rpeCallback,
    completionCallback,
    notesSkipCallback,
    notesTextHandler,
};


import { Markup } from 'telegraf';
import { addDays, format } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import { db } from '../../infrastructure/supabase.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';

const RESCHEDULE_STATE = 'reschedule_draft';
const DATE_FORMAT = 'yyyy-MM-dd';

export async function sessionRescheduleCallback(ctx) {
    await ctx.answerCbQuery();
    const sessionId = ctx.callbackQuery.data.replace('session_reschedule_', '');
    const session = await db.getTrainingSession(sessionId);

    if (!session) {
        await ctx.reply('Не нашёл эту тренировку. Попробуй обновить план.');
        return;
    }

    try {
        await ctx.deleteMessage();
    } catch (error) {
        // ignore
    }

    await presentRescheduleOptions(ctx, session);
}

export async function rescheduleOptionCallback(ctx) {
    await ctx.answerCbQuery();
    const [, sessionId, dateIso] = ctx.callbackQuery.data.split(':');
    const profileId = ctx.state.profileId;

    const draft = await db.getDialogState(profileId, RESCHEDULE_STATE);
    const session = await db.getTrainingSession(sessionId);

    if (!session) {
        await ctx.reply('Не удалось найти тренировку. Попробуй ещё раз.');
        return;
    }

    try {
        await db.updateTrainingSession(sessionId, {
            date: dateIso,
            status: 'rescheduled',
            updated_at: new Date().toISOString(),
        });

        await db.logEvent(
            profileId,
            'training_rescheduled',
            'info',
            { session_id: sessionId, new_date: dateIso }
        );

        if (draft) {
            await db.clearDialogState(profileId, RESCHEDULE_STATE);
        }

        const formatted = format(new Date(dateIso), 'd MMMM', { locale: ru });
        await ctx.editMessageText(
            `Готово! 🔁 Тренировку перенёс на ${formatted}. Расписание обновлено.`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Failed to reschedule session:', error);
        await ctx.reply('Не удалось перенести тренировку. Попробуй позже или сделай это через WebApp.');
    }
}

export async function rescheduleCancelCallback(ctx) {
    if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery();
    }

    const profileId = ctx.state.profileId;
    await db.clearDialogState(profileId, RESCHEDULE_STATE).catch(() => {});
    await ctx.reply('Хорошо, оставляем расписание без изменений.');
}

export async function startNaturalRescheduleFlow(ctx, entities = {}) {
    const profileId = ctx.state.profileId;

    const todayIso = new Date().toISOString().slice(0, 10);
    const upcoming = await db.getTrainingSessions(profileId, {
        startDate: todayIso,
    });

    const nextSession = upcoming.find(session => session.status === 'planned' || session.status === 'rescheduled');

    if (!nextSession) {
        await ctx.reply('В расписании нет тренировок, которые можно перенести. Сначала создай план командой /plan.');
        return;
    }

    if (entities?.preferredShiftDays) {
        const targetDate = format(addDays(new Date(nextSession.date), entities.preferredShiftDays), DATE_FORMAT);
        await applyQuickReschedule(ctx, nextSession, targetDate);
        return;
    }

    await presentRescheduleOptions(ctx, nextSession, entities);
}

async function presentRescheduleOptions(ctx, session, entities = {}) {
    const profileId = ctx.state.profileId;
    const baseDate = new Date(session.date);

    const options = await buildOptions(profileId, session.id, baseDate, entities);

    await db.saveDialogState(
        profileId,
        RESCHEDULE_STATE,
        {
            session_id: session.id,
            options,
        },
        addDays(new Date(), 1)
    );

    await beginChatResponse(ctx);

    const header =
        `🔄 **Перенос тренировки**\n\n` +
        `Текущая дата: ${format(baseDate, 'd MMMM', { locale: ru })}.\n` +
        `Выбери новый день:`;

    const buttons = options.map(option => [
        Markup.button.callback(option.label, `reschedule_to:${session.id}:${option.date}`),
    ]);

    buttons.push([Markup.button.callback('◀️ Оставить как есть', 'reschedule_cancel')]);

    await replyWithTracking(ctx, header, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
    });
}

async function buildOptions(profileId, sessionId, baseDate, entities) {
    const collected = [];
    const upcoming = await db.getTrainingSessions(profileId, {
        startDate: format(addDays(baseDate, 1), DATE_FORMAT),
        endDate: format(addDays(baseDate, 10), DATE_FORMAT),
    });

    const busyDates = new Set(
        upcoming
            .filter(item => item.id !== sessionId)
            .map(item => item.date)
    );

    for (let offset = 1; collected.length < 4 && offset <= 7; offset++) {
        const date = addDays(baseDate, offset);
        const dateIso = format(date, DATE_FORMAT);
        const weekday = format(date, 'EEEE', { locale: ru });
        const isBusy = busyDates.has(dateIso);

        if (entities?.preferredDay && !weekday.toLowerCase().includes(entities.preferredDay.toLowerCase())) {
            continue;
        }

        const label = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${format(date, 'd MMM', { locale: ru })}${isBusy ? ' • занят' : ''}`;
        collected.push({ date: dateIso, label });
    }

    if (collected.length === 0) {
        const fallback = addDays(baseDate, 1);
        collected.push({
            date: format(fallback, DATE_FORMAT),
            label: `Завтра, ${format(fallback, 'd MMM', { locale: ru })}`,
        });
    }

    return collected;
}

async function applyQuickReschedule(ctx, session, targetDate) {
    try {
        await db.updateTrainingSession(session.id, {
            date: targetDate,
            status: 'rescheduled',
            updated_at: new Date().toISOString(),
        });

        await db.logEvent(
            ctx.state.profileId,
            'training_rescheduled',
            'info',
            { session_id: session.id, new_date: targetDate }
        );

        const formatted = format(new Date(targetDate), 'd MMMM', { locale: ru });
        await ctx.reply(`Готово! Тренировку перенёс на ${formatted}. План обновлён.`);
    } catch (error) {
        console.error('Failed to quick reschedule:', error);
        await ctx.reply('Не удалось перенести тренировку автоматически. Попробуй выбрать дату вручную.');
    }
}

export default {
    sessionRescheduleCallback,
    rescheduleOptionCallback,
    rescheduleCancelCallback,
    startNaturalRescheduleFlow,
};

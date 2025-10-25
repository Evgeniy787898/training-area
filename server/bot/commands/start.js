import { addDays, format, startOfWeek } from 'date-fns';
import { db } from '../../infrastructure/supabase.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';
import { buildDefaultWeekPlan } from '../../services/staticPlan.js';
import { buildMainMenuKeyboard } from '../utils/menu.js';

const PLAN_CACHE_STATE = 'ui_cached_plan';

/**
 * Команда /start — сразу показывает доступный функционал без онбординга.
 */
export async function startCommand(ctx) {
    const profile = ctx.state.profile;
    const profileId = ctx.state.profileId;
    const firstName = ctx.from?.first_name || 'друг';

    await beginChatResponse(ctx);

    await ensureWeeklyPlan(profile, profileId);

    const frequency = profile?.preferences?.training_frequency || 4;
    const message =
        `Привет, ${firstName}! 👟 Я уже готов помочь.\n\n` +
        `📅 План на неделю собран по базовой программе и учитывает ${frequency} тренировки.\n` +
        `📝 Можешь сразу отправить отчёт — подскажу, как скорректировать нагрузку.\n` +
        `📊 Отслеживаю прогрессию упражнений и серию тренировок.\n\n` +
        `Выбирай действие на клавиатуре или открывай WebApp, если нужны детали.`;

    await replyWithTracking(ctx, message, {
        parse_mode: 'Markdown',
        ...buildMainMenuKeyboard(),
    });
}

async function ensureWeeklyPlan(profile, profileId) {
    if (!profileId) {
        return;
    }

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const startDate = format(weekStart, 'yyyy-MM-dd');
    const endDate = format(weekEnd, 'yyyy-MM-dd');

    try {
        const sessions = await db.getTrainingSessions(profileId, {
            startDate,
            endDate,
        });

        if (sessions && sessions.length > 0) {
            await db.clearDialogState(profileId, PLAN_CACHE_STATE);
            return;
        }
    } catch (error) {
        console.error('Failed to check existing plan:', error);
    }

    const frequency = profile?.preferences?.training_frequency || 4;
    const fallbackPlan = buildDefaultWeekPlan({ startDate: weekStart, frequency });

    try {
        await db.saveDialogState(
            profileId,
            PLAN_CACHE_STATE,
            {
                plan: fallbackPlan,
                generated_at: new Date().toISOString(),
            },
            addDays(weekEnd, 1)
        );
    } catch (error) {
        console.error('Failed to cache fallback plan:', error);
    }

    try {
        await db.logEvent(profileId, 'plan_cached', 'info', {
            source: 'static_plan',
            week_start: startDate,
            week_end: endDate,
        });
    } catch (error) {
        console.error('Failed to log cached plan event:', error);
    }
}

export default { startCommand };

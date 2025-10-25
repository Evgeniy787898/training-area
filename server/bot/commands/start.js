import { Markup } from 'telegraf';
import { addDays, format, startOfWeek } from 'date-fns';
import { db } from '../../infrastructure/supabase.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';
import { buildDefaultWeekPlan } from '../../services/staticPlan.js';
import { buildMainMenuKeyboard, mainMenuCallbackId } from '../utils/menu.js';
import config from '../../config/env.js';

const PLAN_CACHE_STATE = 'ui_cached_plan';

/**
 * Команда /start — сразу показывает доступный функционал без онбординга.
 */
export async function startCommand(ctx, options = {}) {
    const profile = ctx.state.profile;
    const profileId = ctx.state.profileId;

    const onboardingCompleted = profile?.preferences?.onboarding_status === 'completed';

    await beginChatResponse(ctx);

    await ensureWeeklyPlan(profile, profileId);

    const introSummary = options.introSummary
        ? `${options.introSummary.trim()}\n\n`
        : '';

    const frequency = profile?.preferences?.training_frequency || 4;
    const messageParts = [
        introSummary,
        'Главное меню готово 👇',
        `• 📅 План на неделю — команда /plan или кнопка «План на сегодня» (учитываю ${frequency} тренировки).`,
        '• 📝 Отправь отчёт — /report или кнопка «Отчёт о тренировке».',
        '• 📊 Прогресс и уровни упражнений — смотри в разделе «Прогресс» и «Упражнения».',
    ].filter(Boolean);

    if (!onboardingCompleted) {
        messageParts.push(
            'ℹ️ Сейчас использую базовый план. Захочешь подстроить цели и оборудование — вызови /setup или напиши «Настроить план».'
        );
    }

    if (config.app.webAppUrl) {
        messageParts.push('🚀 Нужна детализация? Жми «Открыть панель» и работай прямо внутри Telegram.');
    } else {
        messageParts.push('Выбирай действие на клавиатуре — /menu вернёт кнопки, если они спрячутся.');
    }

    const message = messageParts.join('\n\n');

    await replyWithTracking(ctx, message, {
        parse_mode: 'Markdown',
        ...buildMainMenuKeyboard(),
    });

    if (config.app.webAppUrl) {
        await replyWithTracking(
            ctx,
            '🚀 Открыть WebApp прямо в Telegram',
            Markup.inlineKeyboard([
                [Markup.button.webApp('Открыть панель', config.app.webAppUrl)],
                [Markup.button.callback('↩️ Главное меню', mainMenuCallbackId())],
            ])
        );
    }
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

        await db.triggerPlanUpdate(profileId, {
            reason: 'start_command',
            referenceDate: today,
        });

        const refreshed = await db.getTrainingSessions(profileId, {
            startDate,
            endDate,
        });

        if (refreshed && refreshed.length > 0) {
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

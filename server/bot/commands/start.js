import { Markup } from 'telegraf';
import { addDays, format, startOfWeek } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import { db } from '../../infrastructure/supabase.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';
import { buildDefaultWeekPlan } from '../../services/staticPlan.js';
import { buildMainMenuKeyboard, mainMenuCallbackId } from '../utils/menu.js';
import config from '../../config/env.js';

const PLAN_CACHE_STATE = 'ui_cached_plan';
const CONFETTI_ANIMATION = 'https://media.tenor.com/xVJ5C9a14pAAAAAC/confetti-celebration.gif';
const MOTIVATION_TAGLINES = [
    'Маленькие шаги складываются в большую победу 💪',
    'Ты уже ближе к цели, чем вчера. Держи темп! 🔥',
    'Сделаем тренировку точкой опоры для всего дня ⚡️',
    'Скорость не важна — важно, что ты в движении 🚀',
];

/**
 * Команда /start — приветствие, план и быстрые действия в виде геро-секции.
 */
export async function startCommand(ctx, options = {}) {
    const profile = ctx.state.profile;
    const profileId = ctx.state.profileId;

    const onboardingCompleted = profile?.preferences?.onboarding_status === 'completed';

    await beginChatResponse(ctx);
    await ensureWeeklyPlan(profile, profileId);
    await removeOriginalCommand(ctx);
    await dropConfetti(ctx);

    const hero = await buildHeroSection({
        profile,
        profileId,
        introSummary: options.introSummary,
        onboardingCompleted,
    });

    const heroMessage = await replyWithTracking(ctx, hero.text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...hero.keyboard,
    });

    try {
        await ctx.pinChatMessage(heroMessage.message_id, { disable_notification: true });
    } catch (error) {
        console.warn('Failed to pin hero message:', error.message);
    }

    if (hero.followUp) {
        await replyWithTracking(ctx, hero.followUp, {
            disable_web_page_preview: true,
            ...buildMainMenuKeyboard(),
        });
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

async function removeOriginalCommand(ctx) {
    if (!ctx.message?.message_id) {
        return;
    }

    try {
        await ctx.deleteMessage(ctx.message.message_id);
    } catch (error) {
        if (error?.response?.error_code !== 400) {
            console.warn('Failed to delete /start message:', error.message);
        }
    }
}

async function dropConfetti(ctx) {
    try {
        const confettiMessage = await ctx.replyWithAnimation(CONFETTI_ANIMATION, {
            caption: 'Запускаем тренировочный день! 🎉',
        });

        setTimeout(() => {
            ctx.telegram.deleteMessage(confettiMessage.chat.id, confettiMessage.message_id).catch(() => {});
        }, 8000);
    } catch (error) {
        console.warn('Confetti animation failed:', error.message);
    }
}

async function buildHeroSection({ profile, profileId, introSummary, onboardingCompleted }) {
    const frequency = profile?.preferences?.training_frequency || 4;
    const today = new Date();
    const todayIso = format(today, 'yyyy-MM-dd');

    const session = await fetchTodaySession(profile, profileId, todayIso);
    const sessionTitle = session?.session_type || 'Функциональная тренировка';
    const focus = session?.focus || 'Баланс силы и выносливости';
    const exercises = Array.isArray(session?.exercises) ? session.exercises.slice(0, 3) : [];

    const exercisesList = exercises.map((exercise, index) => {
        const name = escapeHtml(exercise.name || exercise.exercise_key || `Упражнение ${index + 1}`);
        const sets = exercise.target?.sets ? `${exercise.target.sets}×${exercise.target.reps || 'повт.'}` : 'свободный формат';
        return `• ${name} — ${sets}`;
    }).join('\n');

    const formattedDate = format(today, 'd MMMM', { locale: ru });
    const tagline = introSummary?.trim() || pickTagline();

    const textParts = [
        `<b>🔥 План на ${escapeHtml(formattedDate)}</b>`,
        `<b>${escapeHtml(sessionTitle)}</b> · ${escapeHtml(focus)}`,
    ];

    if (exercisesList) {
        textParts.push(exercisesList);
    }

    textParts.push(`<b>Мотивация</b>: ${escapeHtml(tagline)}`);
    textParts.push(`Тренировок в расписании: ${frequency} в неделю. Кнопки ниже — быстрые действия.`);

    if (!onboardingCompleted) {
        textParts.push('Подстрой цели и оборудование — нажми «Настроить план» или скажи «Настроить план».');
    }

    const keyboard = buildHeroKeyboard();

    return {
        text: textParts.join('\n\n'),
        keyboard,
        followUp: config.app.webAppUrl
            ? '🔗 Хочешь детали? Жми «Открыть панель» или скажи, что именно нужно — я помогу.'
            : null,
    };
}

function buildHeroKeyboard() {
    const rows = [];

    if (config.app.webAppUrl) {
        rows.push([Markup.button.webApp('🚀 Открыть панель', config.app.webAppUrl)]);
    }

    rows.push([
        Markup.button.callback('📅 Сегодня', 'plan_today'),
        Markup.button.callback('📆 Неделя', 'open_week_plan'),
    ]);

    rows.push([
        Markup.button.callback('📝 Отчёт', 'open_report'),
        Markup.button.callback('📊 Прогресс', 'open_stats'),
    ]);

    rows.push([
        Markup.button.callback('⚙️ Настройки', 'open_settings'),
        Markup.button.callback('❓ Возможности', 'open_help'),
    ]);

    rows.push([Markup.button.callback('↩️ Главное меню', mainMenuCallbackId())]);

    return Markup.inlineKeyboard(rows);
}

async function fetchTodaySession(profile, profileId, todayIso) {
    if (!profileId) {
        return null;
    }

    try {
        const sessions = await db.getTrainingSessions(profileId, {
            startDate: todayIso,
            endDate: todayIso,
        });

        if (sessions?.length) {
            return sessions[0];
        }

        const fallbackPlan = await db.getOrCreateFallbackWeekPlan(profile, profileId, new Date());
        return fallbackPlan.sessions.find(item => item.date === todayIso) || null;
    } catch (error) {
        console.error('Failed to fetch today session for hero section:', error);
        return null;
    }
}

function pickTagline() {
    const index = Math.floor(Math.random() * MOTIVATION_TAGLINES.length);
    return MOTIVATION_TAGLINES[index];
}

function escapeHtml(text) {
    if (!text) {
        return '';
    }

    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export default { startCommand };

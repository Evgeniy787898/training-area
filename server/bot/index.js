import { Telegraf } from 'telegraf';
import config from '../config/env.js';
import { startHttpServer } from '../api/index.js';
import {
    authMiddleware,
    loggingMiddleware,
    errorMiddleware,
    dialogStateMiddleware
} from './middleware/auth.js';
import aiCommandRouter from '../services/aiCommandRouter.js';
import plannerService from '../services/planner.js';
import conversationService from '../services/conversation.js';
import { db } from '../infrastructure/supabase.js';

// Import commands
import { startCommand } from './commands/start.js';
import { helpCommand } from './commands/help.js';
import { planCommand, planTodayCallback } from './commands/plan.js';
import {
    reportCommand,
    reportSessionCallback,
    performanceSkipCallback,
    handlePerformanceText,
    rpeCallback,
    completionCallback,
    notesSkipCallback,
    notesTextHandler
} from './commands/report.js';
import { statsCommand, statsDetailedCallback, statsAchievementsCallback } from './commands/stats.js';
import {
    settingsCommand,
    settingsNotificationTimeCallback,
    setTimeCallback,
    settingsPauseNotificationsCallback,
    settingsBackCallback,
} from './commands/settings.js';
import {
    sessionRescheduleCallback,
    rescheduleOptionCallback,
    rescheduleCancelCallback,
    startNaturalRescheduleFlow
} from './commands/reschedule.js';
import { replyWithTracking } from './utils/chat.js';
import { mainMenuCallbackId, withMainMenuButton } from './utils/menu.js';
import {
    handleGoalSelection,
    handleEquipmentToggle,
    handleEquipmentComplete,
    handleFrequencySelection,
    startOnboarding,
    completeOnboarding,
} from './commands/onboarding.js';

console.log('🤖 Initializing Training Bot...');

// Create bot instance
const bot = new Telegraf(config.telegram.botToken);

// Apply global middleware
bot.use(errorMiddleware);
bot.use(loggingMiddleware);
bot.use(authMiddleware);
bot.use(dialogStateMiddleware);

// Register commands
bot.command('start', startCommand);
bot.command('help', helpCommand);
bot.command('plan', planCommand);
bot.command('report', reportCommand);
bot.command('stats', statsCommand);
bot.command('settings', settingsCommand);
bot.command('menu', startCommand);
bot.command('setup', startOnboarding);

// Register callback queries (inline buttons)

// Plan callbacks
bot.action('plan_today', planTodayCallback);
bot.action('open_week_plan', async (ctx) => {
    await ctx.answerCbQuery('План на неделю');
    await planCommand(ctx);
});

bot.action('open_report', async (ctx) => {
    await ctx.answerCbQuery('Отчёт о тренировке');
    await reportCommand(ctx);
});

bot.action('open_stats', async (ctx) => {
    await ctx.answerCbQuery('Прогресс');
    await statsCommand(ctx);
});

bot.action('open_settings', async (ctx) => {
    await ctx.answerCbQuery('Настройки');
    await settingsCommand(ctx);
});

bot.action('open_help', async (ctx) => {
    await ctx.answerCbQuery('Что умею');
    await helpCommand(ctx);
});

// Report callbacks
bot.action(/^report_session_/, reportSessionCallback);
bot.action('report_performance_skip', performanceSkipCallback);
bot.action(/^rpe_/, rpeCallback);
bot.action(/^completion_/, completionCallback);
bot.action('notes_skip', notesSkipCallback);

// Stats callbacks
bot.action('stats_detailed', statsDetailedCallback);
bot.action('stats_achievements', statsAchievementsCallback);

// Settings callbacks
bot.action('settings_notification_time', settingsNotificationTimeCallback);
bot.action(/^set_time_/, setTimeCallback);
bot.action('settings_pause_notifications', settingsPauseNotificationsCallback);
bot.action('settings_back', settingsBackCallback);

bot.action(mainMenuCallbackId(), async (ctx) => {
    if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('Главное меню');
    }
    await startCommand(ctx);
});

// Onboarding callbacks
bot.action(/^onboard_goal_/, handleGoalSelection);
bot.action(/^onboard_equipment_/, handleEquipmentToggle);
bot.action('onboard_next_step', handleEquipmentComplete);
bot.action(/^onboard_frequency_/, async (ctx) => {
    await handleFrequencySelection(ctx, {
        onComplete: async (context, payload) => {
            const result = await completeOnboarding(context, payload);
            if (result?.profile) {
                context.state.profile = result.profile;
                await startCommand(context, {
                    skipOnboarding: true,
                    introSummary: result.summary,
                });
            }
        },
    });
});

// Reschedule callbacks
bot.action(/^session_reschedule_/, sessionRescheduleCallback);
bot.action(/^reschedule_to:/, rescheduleOptionCallback);
bot.action('reschedule_cancel', rescheduleCancelCallback);

// Handle text messages (for notes and free-form input)
bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;

    // Check if user is in report notes mode
    const reportState = await ctx.state.profile &&
        await import('../infrastructure/supabase.js').then(m =>
            m.db.getDialogState(ctx.state.profileId, 'report')
        );

    if (reportState?.state_payload?.step === 'performance') {
        const handled = await handlePerformanceText(ctx);
        if (handled) {
            return;
        }
    } else if (reportState && reportState.state_payload?.step === 'notes') {
        const handled = await notesTextHandler(ctx);
        if (handled) {
            return;
        }
        return;
    }

    // Handle keyboard buttons
    if (text === '📅 План на сегодня') {
        await planCommand(ctx);
    } else if (text === '📊 Мой прогресс') {
        await statsCommand(ctx);
    } else if (text === '📝 Отчёт о тренировке') {
        await reportCommand(ctx);
    } else if (text === '⚙️ Настройки') {
        await settingsCommand(ctx);
    } else if (text === '❓ Помощь') {
        await helpCommand(ctx);
    } else {
        const aiDecision = await aiCommandRouter.interpret({
            profile: ctx.state.profile,
            message: text,
            history: ctx.state.dialogState?.history || [],
        });

        if (aiDecision.needs_clarification && aiDecision.clarification_question) {
            const keyboard = withMainMenuButton();
            await replyWithTracking(
                ctx,
                aiDecision.clarification_question,
                {
                    ...keyboard,
                }
            );
            return;
        }

        const handled = await handleAiDecision(ctx, aiDecision, text);

        if (!handled) {
            try {
                const aiReply = await conversationService.generateReply({
                    profile: ctx.state.profile,
                    message: text,
                });

                if (aiReply) {
                    await replyWithTracking(ctx, aiReply, {
                        disable_web_page_preview: true,
                    });
                } else {
                    await sendUnknownIntentMessage(ctx, aiDecision.candidate_intents);
                }
            } catch (error) {
                console.error('Fallback AI reply failed:', error);
                await sendUnknownIntentMessage(ctx, aiDecision.candidate_intents);
            }
        }
    }

    await next();
});

// Handle errors
bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    console.error('Context:', {
        updateType: ctx.updateType,
        userId: ctx.from?.id,
    });
});

// Start bot
async function startBot() {
    try {
        // Remove webhook if exists
        await bot.telegram.deleteWebhook();

        console.log('✅ Bot configuration:');
        console.log('   - Polling mode: enabled');
        console.log('   - Commands registered: start, help, plan, report, stats, settings');

        // Get bot info
        const botInfo = await bot.telegram.getMe();
        console.log(`✅ Bot started as @${botInfo.username}`);
        console.log(`   Bot ID: ${botInfo.id}`);
        console.log(`   First name: ${botInfo.first_name}`);

        // Start polling
        await bot.launch();
        console.log('🚀 Bot is running and listening for messages...');

        // Enable graceful stop
        process.once('SIGINT', () => {
            console.log('\n🛑 Stopping bot (SIGINT)...');
            bot.stop('SIGINT');
        });

        process.once('SIGTERM', () => {
            console.log('\n🛑 Stopping bot (SIGTERM)...');
            bot.stop('SIGTERM');
        });

    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

async function bootstrap() {
    await startHttpServer();
    await startBot();
}

bootstrap().catch(error => {
    console.error('Fatal startup error:', error);
    process.exit(1);
});

export default bot;

const INTENT_LABELS = {
    plan_today: 'Показать план на сегодня',
    plan_week: 'Открыть план на неделю',
    plan_customize: 'Настроить план',
    report_start: 'Отправить отчёт',
    stats_show: 'Показать прогресс',
    settings_open: 'Изменить настройки',
    schedule_reschedule: 'Перенести тренировку',
    remind_later: 'Напомнить позже',
    recovery_mode: 'Включить режим восстановления',
    motivation: 'Получить мотивацию',
    technique_tip: 'Совет по технике',
    analytics_graph: 'Аналитика',
    explain_recommendation: 'Пояснение рекомендаций',
    help: 'Справка по возможностям',
};

async function handleAiDecision(ctx, decision, originalText) {
    const { intent, slots, assistant_reply: assistantReply, secondary_intent: secondaryIntent } = decision;
    let assistantHandled = false;

    switch (intent) {
        case 'plan_today':
            await planTodayCallback(ctx);
            break;
        case 'plan_week':
            await planCommand(ctx);
            break;
        case 'plan_customize':
            await startOnboarding(ctx);
            break;
        case 'report_start':
            await reportCommand(ctx);
            break;
        case 'stats_show':
            await statsCommand(ctx);
            break;
        case 'settings_open':
            await settingsCommand(ctx);
            break;
        case 'schedule_reschedule': {
            const entities = buildRescheduleEntities(slots);
            await startNaturalRescheduleFlow(ctx, entities);
            break;
        }
        case 'remind_later':
            await handleReminderIntent(ctx, slots?.reminder || null);
            break;
        case 'recovery_mode':
            await handleRecoveryIntent(ctx, originalText, slots || {});
            break;
        case 'motivation':
            await handleMotivationIntent(ctx);
            break;
        case 'help':
            await helpCommand(ctx);
            break;
        case 'technique_tip':
        case 'analytics_graph':
        case 'explain_recommendation':
        case 'fallback_conversation':
            if (assistantReply) {
                await sendAssistantReply(ctx, assistantReply);
                assistantHandled = true;
            }
            break;
        case 'unknown':
            await sendUnknownIntentMessage(ctx, decision.candidate_intents);
            return true;
        default:
            return false;
    }

    if (assistantReply && !assistantHandled && !['unknown', 'help'].includes(intent)) {
        await sendAssistantReply(ctx, assistantReply);
    }

    if (secondaryIntent && secondaryIntent !== 'unknown') {
        const keyboard = withMainMenuButton();
        await replyWithTracking(
            ctx,
            `📝 После этого могу также: ${INTENT_LABELS[secondaryIntent] || secondaryIntent}. Просто напиши, если актуально.`,
            { ...keyboard }
        );
    }

    return true;
}

async function sendAssistantReply(ctx, text) {
    const formatted = formatAssistantReply(text);
    await replyWithTracking(ctx, formatted, {
        disable_web_page_preview: true,
    });
}

async function sendUnknownIntentMessage(ctx, candidates = []) {
    const candidateLines = candidates
        .filter(item => item.intent && item.intent !== 'unknown')
        .slice(0, 3)
        .map(item => `• ${INTENT_LABELS[item.intent] || item.intent}`);

    const baseMessage =
        '🤔 Нужна точность, чтобы помочь. Уточни задачу или выбери действие из вариантов ниже.';

    const message = candidateLines.length
        ? `${baseMessage}\n\nВозможные варианты:\n${candidateLines.join('\n')}`
        : `${baseMessage}\n\nДоступны команды: /plan, /report, /stats, /settings.`;

    const keyboard = withMainMenuButton();
    await replyWithTracking(ctx, message, { ...keyboard });
}

function buildRescheduleEntities(slots = {}) {
    const entities = {};
    if (typeof slots.preferred_shift_days === 'number') {
        entities.preferredShiftDays = slots.preferred_shift_days;
    }
    if (typeof slots.preferred_day === 'string') {
        entities.preferredDay = slots.preferred_day;
    }
    if (typeof slots.target_date === 'string') {
        entities.targetDate = slots.target_date;
    }
    if (typeof slots.reason === 'string') {
        entities.reason = slots.reason;
    }
    return entities;
}

function formatAssistantReply(text) {
    if (!text) {
        return text;
    }

    return text
        .replace(/\*\*(.+?)\*\*/g, (_, heading) => `${heading.toUpperCase()}:`)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function handleReminderIntent(ctx, reminderEntity) {
    const profileId = ctx.state.profileId;

    if (!profileId) {
        return;
    }

    const now = new Date();
    let remindAt = null;

    if (!reminderEntity) {
        remindAt = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (reminderEntity.unit === 'hours') {
        remindAt = new Date(now.getTime() + reminderEntity.value * 60 * 60 * 1000);
    } else if (reminderEntity.unit === 'minutes') {
        remindAt = new Date(now.getTime() + reminderEntity.value * 60 * 1000);
    } else if (reminderEntity.unit === 'clock') {
        remindAt = new Date(now);
        remindAt.setHours(reminderEntity.hours, reminderEntity.minutes, 0, 0);
        if (remindAt <= now) {
            remindAt.setDate(remindAt.getDate() + 1);
        }
    }

    if (!remindAt) {
        await replyWithTracking(ctx, 'Хорошо! Напомню чуть позже.');
        return;
    }

    await db.saveDialogState(
        profileId,
        'reminder_followup',
        {
            remind_at: remindAt.toISOString(),
            requested_at: now.toISOString(),
        },
        remindAt
    );

    const formattedTime = remindAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    await replyWithTracking(
        ctx,
        `Окей! Напомню примерно в ${formattedTime}. Если планы изменятся — просто скажи.`,
        { disable_web_page_preview: true }
    );
}

async function handleRecoveryIntent(ctx, originalText, slots = {}) {
    const profileId = ctx.state.profileId;
    if (!profileId) {
        return;
    }

    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await db.saveDialogState(
        profileId,
        'recovery_mode',
        {
            status: 'active',
            trigger: originalText,
            symptom: slots.symptom || null,
            severity: slots.severity || null,
            activated_at: new Date().toISOString(),
        },
        expiresAt
    );

    const summaryParts = [
        'Понял. Переключаемся в мягкий режим восстановления.',
    ];

    if (slots.symptom) {
        summaryParts.push(`Отмечаю симптом: ${slots.symptom}.`);
    }

    summaryParts.push('Я облегчу ближайшие тренировки и через пару недель уточню самочувствие. Если нужно отменить — напиши «Я в порядке».');

    await replyWithTracking(ctx, summaryParts.join(' '));
}

async function handleMotivationIntent(ctx) {
    const profileId = ctx.state.profileId;
    if (!profileId) {
        return;
    }

    try {
        const adherence = await db.getAdherenceSummary(profileId);
        const sessions = await db.getTrainingSessions(profileId, {
            startDate: '1900-01-01',
            endDate: new Date().toISOString().slice(0, 10),
        });

        const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
        let currentStreak = 0;
        for (const session of sorted) {
            if (session.status === 'done') {
                currentStreak += 1;
            } else {
                break;
            }
        }

        const progressData = sorted.slice(0, 3)
            .map(session => `${session.date}: ${session.status}`)
            .join(', ');

        const message = await plannerService.generateMotivationalMessage({
            adherence: adherence.adherence_percent,
            progressData: progressData || 'данные собираются',
            currentStreak,
        });

        await replyWithTracking(ctx, message, { disable_web_page_preview: true });
    } catch (error) {
        console.error('Failed to generate motivational message:', error);
        await replyWithTracking(ctx, 'Ты уже сделал большой шаг! Продолжай, и всё получится 💪');
    }
}

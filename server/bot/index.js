import { Telegraf } from 'telegraf';
import config from '../config/env.js';
import { startHttpServer } from '../api/index.js';
import {
    authMiddleware,
    loggingMiddleware,
    errorMiddleware,
    dialogStateMiddleware
} from './middleware/auth.js';
import { detectIntent } from '../services/nlu.js';
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
        const { intent, entities } = detectIntent(text);

        switch (intent) {
            case 'plan.today':
                await planTodayCallback(ctx);
                break;
            case 'plan.week':
                await planCommand(ctx);
                break;
            case 'plan.setup':
                await startOnboarding(ctx);
                break;
            case 'report.start':
                await reportCommand(ctx);
                break;
            case 'stats.show':
                await statsCommand(ctx);
                break;
            case 'settings.open':
                await settingsCommand(ctx);
                break;
            case 'schedule.reschedule':
                await startNaturalRescheduleFlow(ctx, entities);
                break;
            case 'remind.later':
                await handleReminderIntent(ctx, entities?.reminder);
                break;
            case 'recovery.mode':
                await handleRecoveryIntent(ctx, text);
                break;
            case 'motivation':
                await handleMotivationIntent(ctx);
                break;
            case 'help':
                await helpCommand(ctx);
                break;
            default:
                try {
                    const aiReply = await conversationService.generateReply({
                        profile: ctx.state.profile,
                        message: text,
                    });

                    if (aiReply) {
                        await ctx.reply(aiReply);
                    } else {
                        await replyWithTracking(
                            ctx,
                            '🤔 Пока не распознал запрос.\n\n' +
                            'Выбери действие на клавиатуре или открой WebApp кнопкой ниже — там всегда доступен план, прогресс и отчёты.',
                            withMainMenuButton()
                        );
                    }
                } catch (error) {
                    console.error('Fallback AI reply failed:', error);
                    await replyWithTracking(
                        ctx,
                        '🤔 Пока не распознал запрос.\n\n' +
                        'Выбери действие на клавиатуре или открой WebApp кнопкой ниже — там всегда доступен план, прогресс и отчёты.',
                        withMainMenuButton()
                    );
                }
                break;
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
        await ctx.reply('Хорошо! Напомню чуть позже.');
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
    await ctx.reply(`Окей! Напомню примерно в ${formattedTime}. Если планы изменятся — просто скажи.`);
}

async function handleRecoveryIntent(ctx, originalText) {
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
            activated_at: new Date().toISOString(),
        },
        expiresAt
    );

    await ctx.reply(
        'Понял. Переключаемся в мягкий режим восстановления. Я облегчу ближайшие тренировки, а через пару недель спрошу, готов ли ты вернуться к обычной нагрузке. Если нужно отменить — напиши «Я в порядке». '
    );
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

        await ctx.reply(message);
    } catch (error) {
        console.error('Failed to generate motivational message:', error);
        await ctx.reply('Ты уже сделал большой шаг! Продолжай, и всё получится 💪');
    }
}

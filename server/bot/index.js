import { Telegraf } from 'telegraf';
import config from '../config/env.js';
import {
    authMiddleware,
    loggingMiddleware,
    errorMiddleware,
    dialogStateMiddleware
} from './middleware/auth.js';

// Import commands
import { startCommand, onboardingStartCallback, goalCallback, equipmentCallback, scheduleCallback, timeCallback } from './commands/start.js';
import { helpCommand } from './commands/help.js';
import { planCommand, planTodayCallback } from './commands/plan.js';
import {
    reportCommand,
    reportSessionCallback,
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
    settingsTimezoneCallback,
    setTimezoneCallback,
    settingsPauseNotificationsCallback,
    settingsBackCallback
} from './commands/settings.js';

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

// Register callback queries (inline buttons)

// Onboarding callbacks
bot.action('onboarding_start', onboardingStartCallback);
bot.action(/^goal_/, goalCallback);
bot.action(/^equip_/, equipmentCallback);
bot.action(/^schedule_/, scheduleCallback);
bot.action(/^time_/, timeCallback);

// Plan callbacks
bot.action('plan_today', planTodayCallback);

// Report callbacks
bot.action(/^report_session_/, reportSessionCallback);
bot.action(/^rpe_/, rpeCallback);
bot.action(/^completion_/, completionCallback);
bot.action('notes_skip', notesSkipCallback);

// Stats callbacks
bot.action('stats_detailed', statsDetailedCallback);
bot.action('stats_achievements', statsAchievementsCallback);

// Settings callbacks
bot.action('settings_notification_time', settingsNotificationTimeCallback);
bot.action(/^set_time_/, setTimeCallback);
bot.action('settings_timezone', settingsTimezoneCallback);
bot.action(/^set_tz_/, setTimezoneCallback);
bot.action('settings_pause_notifications', settingsPauseNotificationsCallback);
bot.action('settings_back', settingsBackCallback);

// Handle text messages (for notes and free-form input)
bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;

    // Check if user is in report notes mode
    const reportState = await ctx.state.profile &&
        await import('../infrastructure/supabase.js').then(m =>
            m.db.getDialogState(ctx.state.profileId, 'report')
        );

    if (reportState && reportState.state_payload?.step === 'notes') {
        await notesTextHandler(ctx);
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
        // Free-form text - будет обработано NLU позже
        await ctx.reply(
            '🤔 Я пока учусь понимать свободный текст.\n\n' +
            'Используй команды или кнопки меню для навигации.\n\n' +
            'Команда /help покажет все доступные возможности.'
        );
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

// Start the bot
startBot();

export default bot;


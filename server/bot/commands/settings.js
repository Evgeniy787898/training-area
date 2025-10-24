import { Markup } from 'telegraf';
import { db } from '../../infrastructure/supabase.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';

/**
 * Команда /settings - настройки бота
 */
export async function settingsCommand(ctx) {
    const profile = ctx.state.profile;

    const settingsMessage = formatSettingsMessage(profile);

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⏰ Изменить время уведомлений', 'settings_notification_time')],
        [Markup.button.callback('🌍 Изменить часовой пояс', 'settings_timezone')],
        [Markup.button.callback('🎯 Изменить цели', 'settings_goals')],
        [Markup.button.callback('🏋️ Изменить оборудование', 'settings_equipment')],
        [Markup.button.callback('🔕 Пауза уведомлений', 'settings_pause_notifications')],
    ]);

    await beginChatResponse(ctx);
    await replyWithTracking(ctx, settingsMessage, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Форматирование текущих настроек
 */
function formatSettingsMessage(profile) {
    let message = `⚙️ **Текущие настройки**\n\n`;

    // Цель
    const goalLabel = profile.goals?.description || 'Не указана';
    message += `🎯 **Цель:** ${goalLabel}\n\n`;

    // Оборудование
    const equipment = profile.equipment?.length > 0
        ? profile.equipment.join(', ')
        : 'Только вес тела';
    message += `🏋️ **Оборудование:** ${equipment}\n\n`;

    // Время уведомлений
    const notificationTime = profile.notification_time || '06:00';
    message += `⏰ **Время уведомлений:** ${notificationTime}\n`;

    // Часовой пояс
    const timezone = profile.timezone || 'Europe/Moscow';
    message += `🌍 **Часовой пояс:** ${timezone}\n\n`;

    // Статус уведомлений
    const notificationStatus = profile.notifications_paused
        ? '🔕 Приостановлены'
        : '✅ Активны';
    message += `**Уведомления:** ${notificationStatus}\n`;

    return message;
}

/**
 * Изменение времени уведомлений
 */
export async function settingsNotificationTimeCallback(ctx) {
    await ctx.answerCbQuery();

    const message =
        `⏰ **Время уведомлений**\n\n` +
        `Выбери удобное время для ежедневных уведомлений:`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🌅 06:00', 'set_time_06:00')],
        [Markup.button.callback('🌅 07:00', 'set_time_07:00')],
        [Markup.button.callback('☀️ 08:00', 'set_time_08:00')],
        [Markup.button.callback('☀️ 09:00', 'set_time_09:00')],
        [Markup.button.callback('🌆 18:00', 'set_time_18:00')],
        [Markup.button.callback('🌆 19:00', 'set_time_19:00')],
        [Markup.button.callback('🌙 20:00', 'set_time_20:00')],
        [Markup.button.callback('◀️ Назад', 'settings_back')],
    ]);

    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Установка времени уведомлений
 */
export async function setTimeCallback(ctx) {
    await ctx.answerCbQuery();

    const time = ctx.callbackQuery.data.replace('set_time_', '');

    try {
        await db.updateProfile(ctx.state.profileId, {
            notification_time: time,
        });

        await ctx.editMessageText(
            `✅ Время уведомлений изменено на ${time}\n\n` +
            `Теперь я буду напоминать о тренировках в это время.`,
            { parse_mode: 'Markdown' }
        );

        // Логируем изменение
        await db.logEvent(
            ctx.state.profileId,
            'settings_updated',
            'info',
            { setting: 'notification_time', value: time }
        );

        // Возвращаемся к настройкам
        setTimeout(() => {
            settingsCommand(ctx);
        }, 2000);

    } catch (error) {
        console.error('Error updating notification time:', error);
        await ctx.answerCbQuery('Не удалось обновить настройки');
    }
}

/**
 * Изменение часового пояса
 */
export async function settingsTimezoneCallback(ctx) {
    await ctx.answerCbQuery();

    const message =
        `🌍 **Часовой пояс**\n\n` +
        `Выбери свой часовой пояс:`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🇷🇺 Москва (MSK, UTC+3)', 'set_tz_Europe/Moscow')],
        [Markup.button.callback('🇷🇺 Екатеринбург (UTC+5)', 'set_tz_Asia/Yekaterinburg')],
        [Markup.button.callback('🇷🇺 Новосибирск (UTC+7)', 'set_tz_Asia/Novosibirsk')],
        [Markup.button.callback('🇷🇺 Владивосток (UTC+10)', 'set_tz_Asia/Vladivostok')],
        [Markup.button.callback('🇺🇦 Киев (UTC+2)', 'set_tz_Europe/Kiev')],
        [Markup.button.callback('◀️ Назад', 'settings_back')],
    ]);

    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Установка часового пояса
 */
export async function setTimezoneCallback(ctx) {
    await ctx.answerCbQuery();

    const timezone = ctx.callbackQuery.data.replace('set_tz_', '');

    try {
        await db.updateProfile(ctx.state.profileId, {
            timezone,
        });

        await ctx.editMessageText(
            `✅ Часовой пояс изменён на ${timezone}`,
            { parse_mode: 'Markdown' }
        );

        // Логируем изменение
        await db.logEvent(
            ctx.state.profileId,
            'settings_updated',
            'info',
            { setting: 'timezone', value: timezone }
        );

        setTimeout(() => {
            settingsCommand(ctx);
        }, 2000);

    } catch (error) {
        console.error('Error updating timezone:', error);
        await ctx.answerCbQuery('Не удалось обновить настройки');
    }
}

/**
 * Пауза уведомлений
 */
export async function settingsPauseNotificationsCallback(ctx) {
    await ctx.answerCbQuery();

    const profile = ctx.state.profile;
    const isPaused = profile.notifications_paused;

    try {
        await db.updateProfile(ctx.state.profileId, {
            notifications_paused: !isPaused,
        });

        const message = !isPaused
            ? '🔕 Уведомления приостановлены\n\nВключи их снова, когда будешь готов продолжить.'
            : '✅ Уведомления возобновлены\n\nТеперь я снова буду напоминать о тренировках.';

        await ctx.editMessageText(message, { parse_mode: 'Markdown' });

        // Логируем изменение
        await db.logEvent(
            ctx.state.profileId,
            'settings_updated',
            'info',
            { setting: 'notifications_paused', value: !isPaused }
        );

        setTimeout(() => {
            settingsCommand(ctx);
        }, 2000);

    } catch (error) {
        console.error('Error toggling notifications:', error);
        await ctx.answerCbQuery('Не удалось обновить настройки');
    }
}

/**
 * Возврат к настройкам
 */
export async function settingsBackCallback(ctx) {
    await ctx.answerCbQuery();
    await settingsCommand(ctx);
}

export default {
    settingsCommand,
    settingsNotificationTimeCallback,
    setTimeCallback,
    settingsTimezoneCallback,
    setTimezoneCallback,
    settingsPauseNotificationsCallback,
    settingsBackCallback,
};


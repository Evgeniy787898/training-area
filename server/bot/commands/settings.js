import { Markup } from 'telegraf';
import { db } from '../../infrastructure/supabase.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';
import { buildMainMenuKeyboard, withMainMenuButton } from '../utils/menu.js';

const EQUIPMENT_OPTIONS = [
    { key: 'bodyweight', label: 'Только вес тела', icon: '🧘' },
    { key: 'pullup_bar', label: 'Турник', icon: '🏗️' },
    { key: 'parallel_bars', label: 'Брусья', icon: '🤸' },
    { key: 'rings', label: 'Кольца', icon: '⭕' },
    { key: 'dumbbells', label: 'Гантели/гири', icon: '🏋️' },
    { key: 'resistance_bands', label: 'Резинки', icon: '🪢' },
];

/**
 * Команда /settings - настройки бота
 */
export async function settingsCommand(ctx) {
    const profile = ctx.state.profile;
    const settingsMessage = formatSettingsMessage(profile);

    const keyboard = withMainMenuButton([
        [Markup.button.callback('⏰ Изменить время уведомлений', 'settings_notification_time')],
        [Markup.button.callback('🔕 Пауза уведомлений', 'settings_pause_notifications')],
    ]);

    await beginChatResponse(ctx);
    await replyWithTracking(ctx, settingsMessage, { parse_mode: 'Markdown', ...keyboard });
}

function formatSettingsMessage(profile) {
    let message = `⚙️ **Текущие настройки**\n\n`;

    const goalLabel = profile.goals?.description || 'Не указана';
    message += `🎯 **Цель:** ${goalLabel}\n\n`;

    const equipment = profile.equipment?.length > 0
        ? profile.equipment.map(resolveEquipmentLabel).join(', ')
        : 'Только вес тела';
    message += `🏋️ **Оборудование:** ${equipment}\n\n`;

    const notificationTime = profile.notification_time || '06:00';
    message += `⏰ **Время уведомлений:** ${notificationTime}\n`;

    const timezone = profile.timezone || 'Europe/Moscow';
    message += `🌍 **Часовой пояс:** ${timezone}\n\n`;

    const notificationStatus = profile.notifications_paused
        ? '🔕 Приостановлены'
        : '✅ Активны';
    message += `**Уведомления:** ${notificationStatus}\n`;

    message += '\n📲 Цели и оборудование отображаются как справочная информация, изменить их можно по запросу тренеру.';

    return message;
}

export async function settingsNotificationTimeCallback(ctx) {
    await ctx.answerCbQuery();

    const message =
        `⏰ **Время уведомлений**\n\n` +
        `Выбери удобное время для ежедневных уведомлений:`;

    const keyboard = withMainMenuButton([
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

export async function setTimeCallback(ctx) {
    await ctx.answerCbQuery();

    const time = ctx.callbackQuery.data.replace('set_time_', '');

    try {
        const updated = await db.updateProfile(ctx.state.profileId, {
            notification_time: time,
        });
        ctx.state.profile = updated;

        await ctx.editMessageText(
            `✅ Время уведомлений изменено на ${time}\n\n` +
            `Теперь я буду напоминать о тренировках в это время.`,
            { parse_mode: 'Markdown' }
        );

        await db.logEvent(
            ctx.state.profileId,
            'settings_updated',
            'info',
            { setting: 'notification_time', value: time }
        );

        setTimeout(() => {
            settingsCommand(ctx);
        }, 2000);
    } catch (error) {
        console.error('Error updating notification time:', error);
        await ctx.answerCbQuery('Не удалось обновить настройки');
    }
}

export async function settingsPauseNotificationsCallback(ctx) {
    await ctx.answerCbQuery();

    const profile = ctx.state.profile;
    const isPaused = profile.notifications_paused;

    try {
        const updated = await db.updateProfile(ctx.state.profileId, {
            notifications_paused: !isPaused,
        });
        ctx.state.profile = updated;

        const message = !isPaused
            ? '🔕 Уведомления приостановлены\n\nВключи их снова, когда будешь готов продолжить.'
            : '✅ Уведомления возобновлены\n\nТеперь я снова буду напоминать о тренировках.';

        await ctx.editMessageText(message, { parse_mode: 'Markdown' });

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

export async function settingsBackCallback(ctx) {
    await ctx.answerCbQuery();
    await settingsCommand(ctx);
}
function resolveEquipmentLabel(key) {
    const option = EQUIPMENT_OPTIONS.find(item => item.key === key);
    return option ? option.label : key;
}
export default {
    settingsCommand,
    settingsNotificationTimeCallback,
    setTimeCallback,
    settingsPauseNotificationsCallback,
    settingsBackCallback,
};

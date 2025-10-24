import { Markup } from 'telegraf';
import { db } from '../../infrastructure/supabase.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';

const EQUIPMENT_STATE_KEY = 'settings_equipment_draft';
const EQUIPMENT_OPTIONS = [
    { key: 'bodyweight', label: 'Только вес тела', icon: '🧘' },
    { key: 'pullup_bar', label: 'Турник', icon: '🏗️' },
    { key: 'parallel_bars', label: 'Брусья', icon: '🤸' },
    { key: 'rings', label: 'Кольца', icon: '⭕' },
    { key: 'dumbbells', label: 'Гантели/гири', icon: '🏋️' },
    { key: 'resistance_bands', label: 'Резинки', icon: '🪢' },
];

const GOAL_OPTIONS = [
    { key: 'strength_endurance', label: 'Силовая выносливость', icon: '💪' },
    { key: 'body_recomposition', label: 'Рельеф и композиция', icon: '🔥' },
    { key: 'wellness', label: 'Здоровье и самочувствие', icon: '🌿' },
];

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

    return message;
}

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

export async function setTimezoneCallback(ctx) {
    await ctx.answerCbQuery();

    const timezone = ctx.callbackQuery.data.replace('set_tz_', '');

    try {
        const updated = await db.updateProfile(ctx.state.profileId, {
            timezone,
        });
        ctx.state.profile = updated;

        await ctx.editMessageText(
            `✅ Часовой пояс изменён на ${timezone}`,
            { parse_mode: 'Markdown' }
        );

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

export async function settingsGoalsCallback(ctx) {
    await ctx.answerCbQuery();

    const keyboard = Markup.inlineKeyboard([
        ...GOAL_OPTIONS.map(option => [
            Markup.button.callback(`${option.icon} ${option.label}`, `set_goal_${option.key}`),
        ]),
        [Markup.button.callback('◀️ Назад', 'settings_back')],
    ]);

    const message =
        '🎯 **Выбор цели**\n\n' +
        'Расскажи, что сейчас важнее всего — я адаптирую план и акценты в тренировках.';

    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
}

export async function setGoalCallback(ctx) {
    await ctx.answerCbQuery();
    const goalKey = ctx.callbackQuery.data.replace('set_goal_', '');
    const option = GOAL_OPTIONS.find(item => item.key === goalKey);

    if (!option) {
        await ctx.answerCbQuery('Неизвестная цель');
        return;
    }

    try {
        const updated = await db.updateProfile(ctx.state.profileId, {
            goals: {
                key: option.key,
                description: option.label,
            },
        });
        ctx.state.profile = updated;

        await ctx.editMessageText(
            `🎯 Цель обновлена: ${option.label}\n\n` +
            'Я скорректирую прогрессии и рекомендации под эту задачу.',
            { parse_mode: 'Markdown' }
        );

        setTimeout(() => {
            settingsCommand(ctx);
        }, 2000);
    } catch (error) {
        console.error('Failed to update goal:', error);
        await ctx.answerCbQuery('Не удалось обновить цель');
    }
}

export async function settingsEquipmentCallback(ctx) {
    await ctx.answerCbQuery();

    const profile = ctx.state.profile;
    const current = Array.isArray(profile.equipment) && profile.equipment.length > 0
        ? profile.equipment
        : ['bodyweight'];

    await db.saveDialogState(
        ctx.state.profileId,
        EQUIPMENT_STATE_KEY,
        { selected: current },
        new Date(Date.now() + 15 * 60 * 1000)
    );

    await renderEquipmentEditor(ctx, current);
}

export async function toggleEquipmentCallback(ctx) {
    await ctx.answerCbQuery();

    const optionKey = ctx.callbackQuery.data.replace('equip_toggle_', '');
    const option = EQUIPMENT_OPTIONS.find(item => item.key === optionKey);

    if (!option) {
        await ctx.answerCbQuery('Неизвестное оборудование');
        return;
    }

    const state = await db.getDialogState(ctx.state.profileId, EQUIPMENT_STATE_KEY);
    const selected = new Set(state?.state_payload?.selected || []);

    if (option.key === 'bodyweight') {
        selected.clear();
        selected.add('bodyweight');
    } else {
        if (selected.has(option.key)) {
            selected.delete(option.key);
        } else {
            selected.add(option.key);
        }
        selected.delete('bodyweight');
        if (selected.size === 0) {
            selected.add('bodyweight');
        }
    }

    const newSelection = Array.from(selected);

    await db.saveDialogState(
        ctx.state.profileId,
        EQUIPMENT_STATE_KEY,
        { selected: newSelection },
        new Date(Date.now() + 15 * 60 * 1000)
    );

    await renderEquipmentEditor(ctx, newSelection);
}

export async function settingsEquipmentSaveCallback(ctx) {
    await ctx.answerCbQuery();

    const state = await db.getDialogState(ctx.state.profileId, EQUIPMENT_STATE_KEY);
    const selected = state?.state_payload?.selected || ['bodyweight'];

    try {
        const updated = await db.updateProfile(ctx.state.profileId, {
            equipment: selected,
        });
        ctx.state.profile = updated;
        await db.clearDialogState(ctx.state.profileId, EQUIPMENT_STATE_KEY);

        await ctx.editMessageText(
            '🏋️ Оборудование обновлено! Я учту его при составлении плана.',
            { parse_mode: 'Markdown' }
        );

        setTimeout(() => {
            settingsCommand(ctx);
        }, 2000);
    } catch (error) {
        console.error('Failed to update equipment:', error);
        await ctx.answerCbQuery('Не удалось сохранить оборудование');
    }
}

function resolveEquipmentLabel(key) {
    const option = EQUIPMENT_OPTIONS.find(item => item.key === key);
    return option ? option.label : key;
}

async function renderEquipmentEditor(ctx, selected) {
    const keyboard = Markup.inlineKeyboard([
        ...EQUIPMENT_OPTIONS.map(option => [
            Markup.button.callback(
                `${selected.includes(option.key) ? '✅' : '▫️'} ${option.icon} ${option.label}`,
                `equip_toggle_${option.key}`
            ),
        ]),
        [Markup.button.callback('💾 Сохранить', 'equip_save')],
        [Markup.button.callback('◀️ Назад', 'settings_back')],
    ]);

    const activeList = selected.map(resolveEquipmentLabel).join(', ');

    const message =
        '🏋️ **Доступное оборудование**\n\n' +
        'Отметь, что есть под рукой — и тренировки будут точнее.\n\n' +
        `Сейчас выбрано: ${activeList}`;

    await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
}

export default {
    settingsCommand,
    settingsNotificationTimeCallback,
    setTimeCallback,
    settingsTimezoneCallback,
    setTimezoneCallback,
    settingsPauseNotificationsCallback,
    settingsBackCallback,
    settingsGoalsCallback,
    setGoalCallback,
    settingsEquipmentCallback,
    toggleEquipmentCallback,
    settingsEquipmentSaveCallback,
};

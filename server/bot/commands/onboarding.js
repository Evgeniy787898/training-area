import { Markup } from 'telegraf';
import { db } from '../../infrastructure/supabase.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';

export const ONBOARDING_STATE_KEY = 'onboarding_flow';
const STATE_TTL_MS = 60 * 60 * 1000; // 1 hour

export const GOAL_OPTIONS = [
    { key: 'strength_endurance', label: 'Сила и выносливость', emoji: '💪' },
    { key: 'body_recomposition', label: 'Рельеф и композиция', emoji: '🔥' },
    { key: 'wellness', label: 'Самочувствие и осанка', emoji: '🌿' },
];

export const EQUIPMENT_OPTIONS = [
    { key: 'bodyweight', label: 'Только вес тела', emoji: '🧘' },
    { key: 'pullup_bar', label: 'Турник', emoji: '🏗️' },
    { key: 'parallel_bars', label: 'Брусья', emoji: '🤸' },
    { key: 'rings', label: 'Кольца', emoji: '⭕' },
    { key: 'dumbbells', label: 'Гантели/гири', emoji: '🏋️' },
    { key: 'resistance_bands', label: 'Резинки', emoji: '🪢' },
];

const FREQUENCY_OPTIONS = [
    { value: 3, label: '3 тренировки' },
    { value: 4, label: '4 тренировки' },
    { value: 5, label: '5 тренировок' },
    { value: 6, label: '6 тренировок' },
];

function buildStatePayload(overrides = {}) {
    return {
        step: 'goal',
        goal: null,
        equipment: ['bodyweight'],
        frequency: 4,
        ...overrides,
    };
}

function stateExpiry() {
    return new Date(Date.now() + STATE_TTL_MS);
}

export async function startOnboarding(ctx) {
    const profileId = ctx.state.profileId;
    await db.saveDialogState(profileId, ONBOARDING_STATE_KEY, buildStatePayload(), stateExpiry());

    await beginChatResponse(ctx);

    await replyWithTracking(ctx,
        '🚀 **Познакомимся!**\n\n' +
        'Я соберу пару деталей, чтобы адаптировать план тренировки под тебя.\n\n' +
        'С чего начнём?',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(
                GOAL_OPTIONS.map(option => [
                    Markup.button.callback(`${option.emoji} ${option.label}`, `onboard_goal_${option.key}`),
                ])
            ),
        }
    );
}

export async function handleGoalSelection(ctx) {
    await ctx.answerCbQuery();

    const goalKey = ctx.callbackQuery.data.replace('onboard_goal_', '');
    const goalOption = GOAL_OPTIONS.find(option => option.key === goalKey);

    if (!goalOption) {
        await ctx.answerCbQuery('Неизвестная цель');
        return;
    }

    const profileId = ctx.state.profileId;
    const state = await db.getDialogState(profileId, ONBOARDING_STATE_KEY);
    const payload = buildStatePayload({
        ...state?.state_payload,
        goal: goalOption,
        step: 'equipment',
    });

    await db.saveDialogState(profileId, ONBOARDING_STATE_KEY, payload, stateExpiry());

    await ctx.editMessageText(
        `🎯 **Цель зафиксирована:** ${goalOption.label}\n\n` +
        'Выбери, что есть под рукой. Можно отмечать несколько пунктов:',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                ...EQUIPMENT_OPTIONS.map(option => [
                    Markup.button.callback(
                        `${payload.equipment.includes(option.key) ? '✅' : '▫️'} ${option.emoji} ${option.label}`,
                        `onboard_equipment_${option.key}`
                    ),
                ]),
                [Markup.button.callback('➡️ Продолжить', 'onboard_next_step')],
            ]),
        }
    );
}

export async function handleEquipmentToggle(ctx) {
    await ctx.answerCbQuery();

    const equipmentKey = ctx.callbackQuery.data.replace('onboard_equipment_', '');
    const option = EQUIPMENT_OPTIONS.find(item => item.key === equipmentKey);

    if (!option) {
        await ctx.answerCbQuery('Неизвестное оборудование');
        return;
    }

    const profileId = ctx.state.profileId;
    const state = await db.getDialogState(profileId, ONBOARDING_STATE_KEY);
    const selected = new Set(state?.state_payload?.equipment || ['bodyweight']);

    if (equipmentKey === 'bodyweight') {
        selected.clear();
        selected.add('bodyweight');
    } else {
        if (selected.has(equipmentKey)) {
            selected.delete(equipmentKey);
        } else {
            selected.add(equipmentKey);
            selected.delete('bodyweight');
        }
        if (selected.size === 0) {
            selected.add('bodyweight');
        }
    }

    const payload = {
        ...state?.state_payload,
        equipment: Array.from(selected),
        step: 'equipment',
    };

    await db.saveDialogState(profileId, ONBOARDING_STATE_KEY, payload, stateExpiry());

    await ctx.editMessageReplyMarkup(
        Markup.inlineKeyboard([
            ...EQUIPMENT_OPTIONS.map(item => [
                Markup.button.callback(
                    `${payload.equipment.includes(item.key) ? '✅' : '▫️'} ${item.emoji} ${item.label}`,
                    `onboard_equipment_${item.key}`
                ),
            ]),
            [Markup.button.callback('➡️ Продолжить', 'onboard_next_step')],
        ])
    );
}

export async function handleEquipmentComplete(ctx) {
    await ctx.answerCbQuery();

    const profileId = ctx.state.profileId;
    const state = await db.getDialogState(profileId, ONBOARDING_STATE_KEY);

    const payload = {
        ...state?.state_payload,
        step: 'frequency',
    };

    await db.saveDialogState(profileId, ONBOARDING_STATE_KEY, payload, stateExpiry());

    const selectedEquipment = (payload.equipment || []).map(key => {
        const option = EQUIPMENT_OPTIONS.find(item => item.key === key);
        return option ? option.label : key;
    }).join(', ');

    await ctx.editMessageText(
        `🏋️ **Учту оборудование:** ${selectedEquipment}\n\n` +
        'Сколько тренировок в неделю комфортно проводить?',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                ...FREQUENCY_OPTIONS.map(option => [
                    Markup.button.callback(
                        option.label,
                        `onboard_frequency_${option.value}`
                    ),
                ]),
            ]),
        }
    );
}

export async function handleFrequencySelection(ctx, { onComplete }) {
    await ctx.answerCbQuery();

    const frequency = Number(ctx.callbackQuery.data.replace('onboard_frequency_', ''));
    if (!Number.isInteger(frequency) || frequency < 3 || frequency > 6) {
        await ctx.answerCbQuery('Выбери один из вариантов 3–6');
        return;
    }

    const profileId = ctx.state.profileId;
    const state = await db.getDialogState(profileId, ONBOARDING_STATE_KEY);

    const payload = {
        ...state?.state_payload,
        step: 'summary',
        frequency,
    };

    await db.saveDialogState(profileId, ONBOARDING_STATE_KEY, payload, stateExpiry());

    if (typeof onComplete === 'function') {
        return onComplete(ctx, payload);
    }

    return null;
}

export async function completeOnboarding(ctx, payload) {
    const profileId = ctx.state.profileId;
    const profile = ctx.state.profile;

    const goals = payload.goal
        ? { key: payload.goal.key, description: payload.goal.label }
        : profile.goals || {};

    const equipment = payload.equipment?.length ? payload.equipment : ['bodyweight'];
    const preferences = {
        ...(profile.preferences || {}),
        training_frequency: payload.frequency || 4,
        onboarding_status: 'completed',
        onboarding_completed_at: new Date().toISOString(),
    };

    let updatedProfile = profile;

    try {
        updatedProfile = await db.updateProfile(profileId, {
            goals,
            equipment,
            preferences,
        });
        ctx.state.profile = updatedProfile;

        await db.clearDialogState(profileId, ONBOARDING_STATE_KEY);
        await db.logEvent(profileId, 'onboarding_completed', 'info', {
            goal: goals.key,
            equipment,
            training_frequency: preferences.training_frequency,
        });
        await db.logDialogEvent(profileId, 'onboarding_completed', {
            goal: goals.key,
            equipment,
            training_frequency: preferences.training_frequency,
        });
    } catch (error) {
        console.error('Failed to apply onboarding preferences:', error);
        await replyWithTracking(ctx,
            '😔 Не удалось сохранить ответы. Попробуй ещё раз через /start.',
            { parse_mode: 'Markdown' }
        );
        return null;
    }

    try {
        await db.triggerPlanUpdate(profileId, {
            reason: 'onboarding_complete',
        });
    } catch (error) {
        console.warn('Plan generation after onboarding failed, fallback will be used:', error?.message);
    }

    const summary =
        '✅ **Отлично!** Я записал твои цели и подготовил план.\n\n' +
        'Вот что зафиксировал:\n' +
        `• Цель: ${goals.description || 'базовая прогрессия'}\n` +
        `• Оборудование: ${equipment.map(resolveEquipmentLabel).join(', ')}\n` +
        `• Частота: ${preferences.training_frequency} тренировки в неделю\n\n`;

    return {
        profile: updatedProfile,
        summary,
    };
}

function resolveEquipmentLabel(key) {
    const option = EQUIPMENT_OPTIONS.find(item => item.key === key);
    return option ? option.label : key;
}

import { Markup } from 'telegraf';
import { db } from '../../infrastructure/supabase.js';
import plannerService from '../../services/planner.js';

/**
 * Команда /start - приветствие и онбординг
 */
export async function startCommand(ctx) {
    const profile = ctx.state.profile;
    const firstName = ctx.from.first_name || 'друг';

    // Проверяем, первый ли это запуск
    const isFirstTime = !profile.goals || Object.keys(profile.goals).length === 0;

    if (isFirstTime) {
        // Первый запуск - онбординг
        await sendOnboardingWelcome(ctx, firstName);
    } else {
        // Повторный запуск - главное меню
        await sendMainMenu(ctx, firstName);
    }
}

/**
 * Приветственное сообщение для нового пользователя
 */
async function sendOnboardingWelcome(ctx, firstName) {
    const welcomeMessage =
        `👋 Привет, ${firstName}!\n\n` +
        `Я твой персональный тренировочный помощник. Помогу тренироваться последовательно и без боли.\n\n` +
        `🎯 **Что я умею:**\n` +
        `• Составлять персональные планы тренировок\n` +
        `• Адаптировать нагрузку под твоё состояние\n` +
        `• Отслеживать прогресс и мотивировать\n` +
        `• Давать советы по технике упражнений\n\n` +
        `Давай начнём с короткого опроса, чтобы я мог подобрать программу под тебя.`;

    await ctx.reply(welcomeMessage, Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Поехали!', 'onboarding_start')],
    ]));

    // Сохраняем состояние онбординга
    await db.saveDialogState(
        ctx.state.profileId,
        'onboarding',
        { step: 'welcome', started_at: new Date().toISOString() },
        new Date(Date.now() + 24 * 60 * 60 * 1000) // expires in 24 hours
    );
}

/**
 * Главное меню для существующего пользователя
 */
async function sendMainMenu(ctx, firstName) {
    const menuMessage =
        `👋 С возвращением, ${firstName}!\n\n` +
        `Выбери действие:`;

    await ctx.reply(menuMessage, Markup.keyboard([
        ['📅 План на сегодня', '📊 Мой прогресс'],
        ['📝 Отчёт о тренировке', '⚙️ Настройки'],
        ['❓ Помощь'],
    ]).resize());
}

/**
 * Обработчик начала онбординга
 */
export async function onboardingStartCallback(ctx) {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();

    const goalMessage =
        `🎯 **Шаг 1 из 4: Твоя цель**\n\n` +
        `Выбери основную цель тренировок:`;

    await ctx.reply(goalMessage, Markup.inlineKeyboard([
        [Markup.button.callback('💪 Силовая выносливость', 'goal_strength_endurance')],
        [Markup.button.callback('🔥 Рельеф', 'goal_definition')],
        [Markup.button.callback('❤️ Здоровье и мобильность', 'goal_health')],
        [Markup.button.callback('🎯 Всё понемногу', 'goal_balanced')],
    ]));

    // Обновляем состояние
    await db.saveDialogState(
        ctx.state.profileId,
        'onboarding',
        { step: 'goal' },
        new Date(Date.now() + 24 * 60 * 60 * 1000)
    );
}

/**
 * Обработчик выбора цели
 */
export async function goalCallback(ctx) {
    await ctx.answerCbQuery();

    const goalMap = {
        'goal_strength_endurance': { primary: 'Силовая выносливость', key: 'strength_endurance' },
        'goal_definition': { primary: 'Рельеф', key: 'definition' },
        'goal_health': { primary: 'Здоровье и мобильность', key: 'health' },
        'goal_balanced': { primary: 'Сбалансированное развитие', key: 'balanced' },
    };

    const selectedGoal = goalMap[ctx.callbackQuery.data];

    // Сохраняем выбранную цель в состоянии
    const currentState = await db.getDialogState(ctx.state.profileId, 'onboarding');
    const newPayload = {
        ...currentState.state_payload,
        goal: selectedGoal,
        step: 'equipment',
    };

    await db.saveDialogState(
        ctx.state.profileId,
        'onboarding',
        newPayload,
        new Date(Date.now() + 24 * 60 * 60 * 1000)
    );

    await ctx.deleteMessage();

    const equipmentMessage =
        `🏋️ **Шаг 2 из 4: Оборудование**\n\n` +
        `Выбери доступное оборудование (можно несколько):`;

    await ctx.reply(equipmentMessage, Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Только вес тела', 'equip_bodyweight')],
        [Markup.button.callback('🏃 Турник', 'equip_pullup_bar')],
        [Markup.button.callback('💪 Брусья', 'equip_parallel_bars')],
        [Markup.button.callback('🎾 Резинки/TRX', 'equip_resistance')],
        [Markup.button.callback('🏋️ Гантели/гири', 'equip_weights')],
        [Markup.button.callback('✅ Готово, продолжить', 'equip_done')],
    ]));
}

/**
 * Обработчик выбора оборудования
 */
export async function equipmentCallback(ctx) {
    await ctx.answerCbQuery();

    const currentState = await db.getDialogState(ctx.state.profileId, 'onboarding');
    let equipment = currentState.state_payload.equipment || [];

    const equipmentMap = {
        'equip_bodyweight': 'Вес тела',
        'equip_pullup_bar': 'Турник',
        'equip_parallel_bars': 'Брусья',
        'equip_resistance': 'Резинки/TRX',
        'equip_weights': 'Гантели/гири',
    };

    if (ctx.callbackQuery.data === 'equip_done') {
        // Переходим к следующему шагу
        await askSchedule(ctx, currentState);
        return;
    }

    const selectedEquipment = equipmentMap[ctx.callbackQuery.data];

    if (selectedEquipment) {
        if (!equipment.includes(selectedEquipment)) {
            equipment.push(selectedEquipment);
        }

        const newPayload = {
            ...currentState.state_payload,
            equipment,
        };

        await db.saveDialogState(
            ctx.state.profileId,
            'onboarding',
            newPayload,
            new Date(Date.now() + 24 * 60 * 60 * 1000)
        );

        // Показываем обратную связь
        await ctx.answerCbQuery(`✅ Добавлено: ${selectedEquipment}`);
    }
}

/**
 * Вопрос о расписании
 */
async function askSchedule(ctx, currentState) {
    await ctx.deleteMessage();

    const scheduleMessage =
        `📅 **Шаг 3 из 4: Расписание**\n\n` +
        `Сколько раз в неделю планируешь тренироваться?`;

    await ctx.reply(scheduleMessage, Markup.inlineKeyboard([
        [
            Markup.button.callback('3 раза', 'schedule_3'),
            Markup.button.callback('4 раза', 'schedule_4'),
        ],
        [
            Markup.button.callback('5 раз', 'schedule_5'),
            Markup.button.callback('6 раз', 'schedule_6'),
        ],
    ]));

    const newPayload = {
        ...currentState.state_payload,
        step: 'schedule',
    };

    await db.saveDialogState(
        ctx.state.profileId,
        'onboarding',
        newPayload,
        new Date(Date.now() + 24 * 60 * 60 * 1000)
    );
}

/**
 * Обработчик выбора расписания
 */
export async function scheduleCallback(ctx) {
    await ctx.answerCbQuery();

    const scheduleMap = {
        'schedule_3': 3,
        'schedule_4': 4,
        'schedule_5': 5,
        'schedule_6': 6,
    };

    const frequency = scheduleMap[ctx.callbackQuery.data];
    const currentState = await db.getDialogState(ctx.state.profileId, 'onboarding');

    const newPayload = {
        ...currentState.state_payload,
        frequency,
        step: 'time',
    };

    await db.saveDialogState(
        ctx.state.profileId,
        'onboarding',
        newPayload,
        new Date(Date.now() + 24 * 60 * 60 * 1000)
    );

    await ctx.deleteMessage();

    const timeMessage =
        `⏰ **Шаг 4 из 4: Время тренировок**\n\n` +
        `Когда тебе удобнее всего тренироваться?`;

    await ctx.reply(timeMessage, Markup.inlineKeyboard([
        [Markup.button.callback('🌅 Утром (6:00-9:00)', 'time_morning')],
        [Markup.button.callback('☀️ Днём (12:00-15:00)', 'time_afternoon')],
        [Markup.button.callback('🌆 Вечером (18:00-21:00)', 'time_evening')],
    ]));
}

/**
 * Завершение онбординга
 */
export async function timeCallback(ctx) {
    await ctx.answerCbQuery();

    const timeMap = {
        'time_morning': { time: '06:00:00', label: 'утро' },
        'time_afternoon': { time: '12:00:00', label: 'день' },
        'time_evening': { time: '18:00:00', label: 'вечер' },
    };

    const selectedTime = timeMap[ctx.callbackQuery.data];
    const currentState = await db.getDialogState(ctx.state.profileId, 'onboarding');

    // Обновляем профиль с собранными данными
    await db.updateProfile(ctx.state.profileId, {
        goals: {
            primary: currentState.state_payload.goal.key,
            description: currentState.state_payload.goal.primary,
        },
        equipment: currentState.state_payload.equipment || [],
        preferences: {
            ...ctx.state.profile.preferences,
            training_frequency: currentState.state_payload.frequency,
            preferred_time: selectedTime.label,
        },
        notification_time: selectedTime.time,
    });

    // Очищаем состояние онбординга
    await db.clearDialogState(ctx.state.profileId, 'onboarding');

    await ctx.deleteMessage();

    const summaryMessage =
        `🎉 **Отлично! Профиль настроен**\n\n` +
        `✅ Цель: ${currentState.state_payload.goal.primary}\n` +
        `✅ Оборудование: ${currentState.state_payload.equipment.join(', ') || 'Вес тела'}\n` +
        `✅ Тренировок в неделю: ${currentState.state_payload.frequency}\n` +
        `✅ Время: ${selectedTime.label}\n\n` +
        `Сейчас я составлю для тебя персональный план тренировок. Это займёт несколько секунд...`;

    await ctx.reply(summaryMessage);

    // Запускаем генерацию плана
    await generateInitialPlan(ctx);
}

/**
 * Генерация начального плана тренировок
 */
async function generateInitialPlan(ctx) {
    try {
        await ctx.reply('⏳ Генерирую план...');

        // Здесь будет вызов к планировщику с ChatGPT
        // Пока просто отправляем сообщение о готовности

        const completionMessage =
            `✅ **План готов!**\n\n` +
            `Используй команды:\n` +
            `📅 /plan — посмотреть план на неделю\n` +
            `📝 /report — отчитаться о тренировке\n` +
            `📊 /stats — посмотреть прогресс\n` +
            `⚙️ /settings — изменить настройки\n\n` +
            `Или просто напиши мне, что тебе нужно!`;

        await ctx.reply(completionMessage, Markup.keyboard([
            ['📅 План на сегодня', '📊 Мой прогресс'],
            ['📝 Отчёт о тренировке', '⚙️ Настройки'],
            ['❓ Помощь'],
        ]).resize());

        // Логируем завершение онбординга
        await db.logEvent(
            ctx.state.profileId,
            'onboarding_completed',
            'info',
            { timestamp: new Date().toISOString() }
        );

    } catch (error) {
        console.error('Error generating initial plan:', error);
        await ctx.reply(
            '😔 Не удалось создать план. Попробуй команду /plan чуть позже.'
        );
    }
}

export default {
    startCommand,
    onboardingStartCallback,
    goalCallback,
    equipmentCallback,
    scheduleCallback,
    timeCallback,
};


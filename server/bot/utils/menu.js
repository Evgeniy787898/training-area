import { Markup } from 'telegraf';
import config from '../../config/env.js';

const MAIN_MENU_BUTTON_ID = 'main_menu';

export function buildMainMenuKeyboard() {
    const rows = [];

    if (config.app.webAppUrl) {
        rows.push([
            Markup.button.webApp('🚀 Открыть панель', config.app.webAppUrl),
        ]);
    }

    rows.push([
        Markup.button.text('📅 План на сегодня'),
        Markup.button.text('📊 Мой прогресс'),
    ]);

    rows.push([
        Markup.button.text('📝 Отчёт о тренировке'),
        Markup.button.text('⚙️ Настройки'),
    ]);

    rows.push([
        Markup.button.text('❓ Помощь'),
    ]);

    return Markup.keyboard(rows)
        .resize()
        .persistent()
        .placeholder('Открой WebApp или выбери действие');
}

export function withMainMenuButton(rows = []) {
    const keyboardRows = Array.isArray(rows)
        ? rows.map(row => [...row])
        : [];

    if (config.app.webAppUrl) {
        keyboardRows.unshift([
            Markup.button.webApp('🚀 Открыть WebApp', config.app.webAppUrl),
        ]);
    }

    keyboardRows.push([
        Markup.button.callback('↩️ Главное меню', MAIN_MENU_BUTTON_ID),
    ]);

    return Markup.inlineKeyboard(keyboardRows);
}

export function mainMenuCallbackId() {
    return MAIN_MENU_BUTTON_ID;
}

export default {
    buildMainMenuKeyboard,
    withMainMenuButton,
    mainMenuCallbackId,
};

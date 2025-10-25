import { Markup } from 'telegraf';
import config from '../../config/env.js';

const MAIN_MENU_BUTTON_ID = 'main_menu';

export function buildMainMenuKeyboard() {
    const rows = [
        ['📅 План на сегодня', '📊 Мой прогресс'],
        ['📝 Отчёт о тренировке', '⚙️ Настройки'],
    ];

    if (config.app.webAppUrl) {
        rows.unshift([
            Markup.button.webApp('🚀 Открыть WebApp', config.app.webAppUrl),
        ]);
    }

    rows.push(['❓ Помощь']);

    return Markup.keyboard(rows).resize();
}

export function withMainMenuButton(rows = []) {
    return Markup.inlineKeyboard([
        ...rows,
        [Markup.button.callback('↩️ Главное меню', MAIN_MENU_BUTTON_ID)],
    ]);
}

export function mainMenuCallbackId() {
    return MAIN_MENU_BUTTON_ID;
}

export default {
    buildMainMenuKeyboard,
    withMainMenuButton,
    mainMenuCallbackId,
};

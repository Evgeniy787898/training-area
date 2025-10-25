import { db } from '../../infrastructure/supabase.js';

const BUFFER_STATE_KEY = 'ui_message_buffer';
const BUFFER_TTL_MS = 12 * 60 * 60 * 1000; // 12 часов хранения идентификаторов

/**
 * Удаляет предыдущие сообщения бота и очищает буфер идентификаторов.
 */
export async function beginChatResponse(ctx) {
    const profileId = ctx.state.profileId;

    if (!profileId || !ctx.chat) {
        return;
    }

    try {
        const state = await db.getDialogState(profileId, BUFFER_STATE_KEY);
        const messageIds = state?.state_payload?.message_ids || [];

        for (const messageId of messageIds) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
            } catch (error) {
                // Сообщение уже могло быть удалено вручную или истечь по времени
                if (error?.response?.error_code !== 400) {
                    console.warn('Failed to delete message', {
                        chatId: ctx.chat.id,
                        messageId,
                        error: error.message,
                    });
                }
            }
        }

        await db.saveDialogState(
            profileId,
            BUFFER_STATE_KEY,
            { message_ids: [] },
            new Date(Date.now() + BUFFER_TTL_MS)
        );
    } catch (error) {
        console.error('Failed to prepare chat cleanup:', error);
    }
}

/**
 * Отправляет сообщение и регистрирует его в буфере и логах.
 */
export async function replyWithTracking(ctx, text, options = {}) {
    const message = await ctx.reply(text, options);
    await trackBotMessage(ctx, message, text);
    return message;
}

/**
 * Записывает информацию о сообщении бота в Supabase.
 */
async function trackBotMessage(ctx, message, text) {
    const profileId = ctx.state.profileId;

    if (!profileId) {
        return;
    }

    try {
        const state = await db.getDialogState(profileId, BUFFER_STATE_KEY);
        const previousIds = state?.state_payload?.message_ids || [];
        const updatedIds = [...previousIds, message.message_id].slice(-10);

        await db.saveDialogState(
            profileId,
            BUFFER_STATE_KEY,
            { message_ids: updatedIds },
            new Date(Date.now() + BUFFER_TTL_MS)
        );
    } catch (error) {
        console.error('Failed to update message buffer:', error);
    }

    try {
        await db.logEvent(
            profileId,
            'bot_message',
            'info',
            {
                direction: 'out',
                message_id: message.message_id,
                chat_id: message.chat.id,
                text,
                timestamp: new Date().toISOString(),
            }
        );
    } catch (error) {
        console.error('Failed to log bot message:', error);
    }
}

/**
 * Фиксирует пользовательское сообщение в истории диалога.
 */
export async function recordUserMessage(profileId, payload) {
    if (!profileId) {
        return;
    }

    try {
        await db.logEvent(profileId, 'user_message', 'info', payload);
    } catch (error) {
        console.error('Failed to log user message:', error);
    }
}

export default {
    beginChatResponse,
    replyWithTracking,
    recordUserMessage,
};

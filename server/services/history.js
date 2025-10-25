import { db } from '../infrastructure/supabase.js';

export const CONVERSATION_STATE_KEY = 'ai_chat_history';
export const HISTORY_LIMIT = 12;
export const HISTORY_TTL_MS = 48 * 60 * 60 * 1000;

export async function loadAssistantHistory(profileId) {
    if (!profileId) {
        return { messages: [], payload: {} };
    }

    try {
        const state = await db.getDialogState(profileId, CONVERSATION_STATE_KEY);
        const payload = state?.state_payload || {};
        const messages = Array.isArray(payload.messages) ? payload.messages : [];

        return {
            messages,
            payload,
        };
    } catch (error) {
        console.error('Failed to load assistant history:', error);
        return { messages: [], payload: {} };
    }
}

export async function persistAssistantTurn({
    profileId,
    previousState = { messages: [], payload: {} },
    userMessage,
    assistantMessage,
    intent,
    mode = 'chat',
    extraMeta = {},
}) {
    if (!profileId) {
        return;
    }

    try {
        const now = new Date().toISOString();
        const history = Array.isArray(previousState?.messages) ? [...previousState.messages] : [];
        const previousMeta = previousState?.payload || {};

        if (userMessage) {
            history.push({
                role: 'user',
                content: userMessage,
                intent: intent || 'unknown',
                at: now,
            });
        }

        if (assistantMessage) {
            history.push({
                role: 'assistant',
                content: assistantMessage,
                intent: intent || 'unknown',
                at: now,
            });
        }

        const trimmed = history.slice(-HISTORY_LIMIT);
        const expiresAt = new Date(Date.now() + HISTORY_TTL_MS);

        const userMessagesCount = (previousMeta.total_user_messages || 0) + (userMessage ? 1 : 0);
        const assistantMessagesCount = (previousMeta.total_assistant_messages || 0) + (assistantMessage ? 1 : 0);
        const totalTurns = assistantMessagesCount;

        const payload = {
            ...previousMeta,
            ...extraMeta,
            messages: trimmed,
            session_status: 'active',
            last_user_message_at: userMessage ? now : previousMeta.last_user_message_at || null,
            last_assistant_message_at: assistantMessage ? now : previousMeta.last_assistant_message_at || null,
            last_intent: intent || previousMeta.last_intent || null,
            last_mode: mode,
            last_updated_at: now,
            total_user_messages: userMessagesCount,
            total_assistant_messages: assistantMessagesCount,
            total_turns: totalTurns,
        };

        if (payload.closed_at) {
            delete payload.closed_at;
        }
        if (payload.closed_reason) {
            delete payload.closed_reason;
        }

        await db.saveDialogState(
            profileId,
            CONVERSATION_STATE_KEY,
            payload,
            expiresAt,
        );
    } catch (error) {
        console.error('Failed to persist assistant turn:', error);
    }
}

export default {
    loadAssistantHistory,
    persistAssistantTurn,
    CONVERSATION_STATE_KEY,
    HISTORY_LIMIT,
    HISTORY_TTL_MS,
};

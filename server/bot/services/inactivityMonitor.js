import { db } from '../../infrastructure/supabase.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_THRESHOLD_MINUTES = 60;
const DEFAULT_BATCH_LIMIT = 20;

function shortenSnippet(text, limit = 120) {
    if (!text) {
        return '';
    }
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= limit) {
        return normalized;
    }
    return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

export function startInactivityMonitor(bot, {
    thresholdMinutes = DEFAULT_THRESHOLD_MINUTES,
    intervalMs = DEFAULT_INTERVAL_MS,
    batchLimit = DEFAULT_BATCH_LIMIT,
} = {}) {
    let timer = null;
    let ticking = false;

    async function tick() {
        if (ticking) {
            return;
        }
        ticking = true;

        try {
            const inactiveChats = await db.findInactiveAssistantChats({
                thresholdMinutes,
                limit: batchLimit,
            });

            for (const chat of inactiveChats) {
                const payload = chat?.state_payload || {};
                if (payload.session_status === 'closed') {
                    continue;
                }

                const profileId = chat.profile_id;

                let profile = null;
                try {
                    profile = await db.getProfileById(profileId);
                } catch (error) {
                    console.error('Failed to load profile for inactivity monitor:', error);
                    continue;
                }

                if (!profile?.telegram_id) {
                    continue;
                }

                const messages = Array.isArray(payload.messages) ? payload.messages : [];
                const lastUserMessage = [...messages].reverse().find(item => item.role === 'user');
                const lastAssistantMessage = [...messages].reverse().find(item => item.role === 'assistant');

                const lastLine = lastUserMessage
                    ? `Последний запрос был: «${shortenSnippet(lastUserMessage.content)}».`
                    : lastAssistantMessage
                        ? `Последнее, что я отправил: «${shortenSnippet(lastAssistantMessage.content)}».`
                        : null;

                const closingMessage = [
                    '⏱️ Больше часа не было активности, очищаю сессию, чтобы начать с чистого листа.',
                    lastLine,
                    'Когда захочешь продолжить, просто напиши — подстроюсь под новый запрос.',
                ].filter(Boolean).join('\n\n');

                try {
                    await bot.telegram.sendMessage(
                        profile.telegram_id,
                        closingMessage,
                        { disable_notification: true },
                    );
                } catch (error) {
                    console.error('Failed to send inactivity notification:', error);
                }

                try {
                    await db.markAssistantSessionClosed(profileId, {
                        reason: 'inactivity',
                        summary: lastUserMessage
                            ? {
                                last_user_message: lastUserMessage.content,
                                closed_within_minutes: thresholdMinutes,
                            }
                            : null,
                    });
                } catch (error) {
                    console.error('Failed to mark assistant session closed:', error);
                }

                try {
                    await db.logEvent(profileId, 'assistant_session_closed', 'info', {
                        reason: 'inactivity',
                        threshold_minutes: thresholdMinutes,
                        last_user_message: lastUserMessage?.content || null,
                    });
                } catch (error) {
                    console.error('Failed to log assistant session closure event:', error);
                }
            }
        } catch (error) {
            console.error('Inactivity monitor tick failed:', error);
        } finally {
            ticking = false;
        }
    }

    timer = setInterval(tick, intervalMs);
    if (timer.unref) {
        timer.unref();
    }

    // Run once on startup without awaiting, avoid blocking launch
    tick().catch(error => {
        console.error('Initial inactivity monitor tick failed:', error);
    });

    return () => {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    };
}

export default {
    startInactivityMonitor,
};

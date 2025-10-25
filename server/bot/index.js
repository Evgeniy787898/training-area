import { Telegraf, Markup } from 'telegraf';
import config from '../config/env.js';
import { startHttpServer } from '../api/index.js';
import {
    authMiddleware,
    loggingMiddleware,
    errorMiddleware,
    dialogStateMiddleware,
} from './middleware/auth.js';
import aiCommandRouter from '../services/aiCommandRouter.js';
import conversationService from '../services/conversation.js';
import { replyWithTracking } from './utils/chat.js';
import { db } from '../infrastructure/supabase.js';

const CONVERSATION_STATE_KEY = 'ai_chat_history';
const HISTORY_LIMIT = 12;
const HISTORY_TTL_MS = 48 * 60 * 60 * 1000; // 48 часов

const COMMAND_PREFIXES = ['тренер', 'босс', 'trainer', 'boss', 'coach'];
const COMMAND_PREFIX_SET = new Set(COMMAND_PREFIXES.map(prefix => prefix.toLowerCase()));
const LEADING_MARKERS_REGEX = /^[\s\-–—]+/u;
const POST_PREFIX_TRIM_REGEX = /^[\s,!:;?.-]+/u;
const DEFAULT_FALLBACK_MESSAGE =
    '⚠️ Не удалось обработать запрос. Используй /webapp, чтобы продолжить работу в приложении.';
const CHAT_PROGRESS_MESSAGES = [
    'Думаю, что вам ответить… 🤔',
    'Складываю факты и шутки в единый ответ… 🧩',
    'Подмешиваю иронию к фактчекингу… ☕️',
    'Прокручиваю базу знаний в поисках идеальной реплики… 📚',
];

console.log('🤖 Initializing Training Bot...');

const bot = new Telegraf(config.telegram.botToken);

bot.use(errorMiddleware);
bot.use(loggingMiddleware);
bot.use(authMiddleware);
bot.use(dialogStateMiddleware);

bot.start(async (ctx) => {
    const greeting = [
        'Привет! Я тренер Training Bot.',
        'Пиши вопросы про тренировки, прогрессию и восстановление — я отвечу и подскажу, что открыть в приложении.',
        config.app.webAppUrl ? 'Чтобы открыть панель, просто скажи «Открой приложение».' : null,
    ]
        .filter(Boolean)
        .join(' ');

    await replyWithTracking(ctx, greeting, { disable_web_page_preview: true });
});

bot.command('webapp', async ctx => {
    const profileId = ctx.state.profileId;
    const progressMessage = await sendProgressStatus(ctx, 'command');
    const history = await loadHistory(profileId);
    const { message, options } = buildOpenWebAppResponse(null);

    await sendFinalReply(ctx, progressMessage, message, options);
    await saveHistory(profileId, history, '/webapp', message, 'open_webapp');
});

bot.on('text', async (ctx, next) => {
    const text = ctx.message?.text?.trim();

    if (!text) {
        await next();
        return;
    }

    const { mode, payload } = detectInteractionMode(text);
    const profileId = ctx.state.profileId;
    const profile = ctx.state.profile;

    const progressMessage = await sendProgressStatus(ctx, mode);
    const history = await loadHistory(profileId);

    if (mode === 'command') {
        const messageForRouter = payload || text;

        let decision = null;
        try {
            decision = await aiCommandRouter.interpret({
                profile,
                message: messageForRouter,
                history,
            });
        } catch (error) {
            console.error('AI command router failed:', error);
        }

        if (decision?.needs_clarification && decision.clarification_question) {
            await sendFinalReply(ctx, progressMessage, decision.clarification_question, {
                disable_web_page_preview: true,
            });
            await saveHistory(profileId, history, text, decision.clarification_question, decision.intent);
            await next();
            return;
        }

        if (decision?.intent === 'open_webapp') {
            const { message, options } = buildOpenWebAppResponse(decision?.assistant_reply);
            await sendFinalReply(ctx, progressMessage, message, options);
            await saveHistory(profileId, history, text, message, decision.intent);
            await next();
            return;
        }

        const assistantReply = await resolveAssistantReply(decision, {
            profile,
            message: messageForRouter,
        });

        const finalMessage = assistantReply || DEFAULT_FALLBACK_MESSAGE;
        await sendFinalReply(ctx, progressMessage, finalMessage, { disable_web_page_preview: true });
        await saveHistory(profileId, history, text, finalMessage, decision?.intent || 'fallback');
        await next();
        return;
    }

    const assistantReply =
        (await resolveAssistantReply(null, { profile, message: text })) || DEFAULT_FALLBACK_MESSAGE;
    await sendFinalReply(ctx, progressMessage, assistantReply, { disable_web_page_preview: true });
    await saveHistory(profileId, history, text, assistantReply, 'conversation');

    await next();
});

bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    console.error('Context:', {
        updateType: ctx.updateType,
        userId: ctx.from?.id,
    });
});

async function resolveAssistantReply(decision, { profile, message }) {
    const formatted = formatAssistantReply(decision?.assistant_reply);
    if (formatted) {
        return formatted;
    }

    try {
        const aiReply = await conversationService.generateReply({ profile, message });
        if (aiReply) {
            return formatAssistantReply(aiReply) || aiReply;
        }
    } catch (error) {
        console.error('Conversation reply failed:', error);
    }

    return 'Поймал запрос, но пока не понял контекст. Расскажи подробнее, что хочешь сделать, или воспользуйся /webapp, чтобы продолжить в приложении.';
}

function buildOpenWebAppResponse(aiMessage) {
    const message =
        formatAssistantReply(aiMessage) || 'Готов открыть панель. Нажми на кнопку ниже, чтобы запустить приложение.';

    if (config.app.webAppUrl) {
        const keyboard = Markup.inlineKeyboard([
            Markup.button.webApp('🚀 Открыть приложение', config.app.webAppUrl),
        ]);

        return {
            message,
            options: {
                ...keyboard,
                disable_web_page_preview: true,
            },
        };
    }

    return {
        message: `${message}\n\nURL WebApp не настроен. Добавь переменную окружения WEBAPP_URL.`,
        options: { disable_web_page_preview: true },
    };
}

function formatAssistantReply(text) {
    if (!text) {
        return null;
    }

    return text
        .replace(/\*\*(.+?)\*\*/g, (_, heading) => `${heading.toUpperCase()}:`)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function loadHistory(profileId) {
    if (!profileId) {
        return [];
    }

    try {
        const state = await db.getDialogState(profileId, CONVERSATION_STATE_KEY);
        const messages = state?.state_payload?.messages;
        return Array.isArray(messages) ? messages : [];
    } catch (error) {
        console.error('Failed to load conversation history:', error);
        return [];
    }
}

function detectInteractionMode(text) {
    const trimmed = text.trim();
    const sanitized = trimmed.replace(LEADING_MARKERS_REGEX, '');

    const prefixMatch = sanitized.match(/^[^\s,!:;?.-]+/u);
    if (!prefixMatch) {
        return { mode: 'chat', payload: trimmed };
    }

    const normalized = prefixMatch[0].toLowerCase();
    if (!COMMAND_PREFIX_SET.has(normalized)) {
        return { mode: 'chat', payload: trimmed };
    }

    const remainder = sanitized.slice(prefixMatch[0].length);
    const payload = remainder.replace(POST_PREFIX_TRIM_REGEX, '').trim();

    return { mode: 'command', payload };
}

async function sendProgressStatus(ctx, mode) {
    const statusText =
        mode === 'command'
            ? 'Выполняю команды ⏳'
            : CHAT_PROGRESS_MESSAGES[Math.floor(Math.random() * CHAT_PROGRESS_MESSAGES.length)];

    try {
        return await ctx.reply(statusText, { disable_notification: true });
    } catch (error) {
        console.error('Failed to send progress status:', error);
        return null;
    }
}

async function sendFinalReply(ctx, progressMessage, text, options = {}) {
    await replyWithTracking(ctx, text, options);

    if (progressMessage && ctx.chat) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, progressMessage.message_id);
        } catch (error) {
            if (error?.response?.error_code !== 400) {
                console.warn('Failed to delete progress message:', error);
            }
        }
    }
}

async function saveHistory(profileId, previousHistory, userMessage, assistantMessage, intent) {
    if (!profileId) {
        return;
    }

    try {
        const now = new Date().toISOString();
        const history = Array.isArray(previousHistory) ? [...previousHistory] : [];

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

        await db.saveDialogState(
            profileId,
            CONVERSATION_STATE_KEY,
            { messages: trimmed },
            expiresAt
        );
    } catch (error) {
        console.error('Failed to save conversation history:', error);
    }
}

async function startBot() {
    try {
        await bot.telegram.deleteWebhook();
        await bot.telegram.setMyCommands([
            { command: 'webapp', description: 'Открыть приложение' },
        ]);

        console.log('✅ Bot configuration:');
        console.log('   - Polling mode: enabled');
        console.log('   - Interaction mode: AI conversation only');

        const botInfo = await bot.telegram.getMe();
        console.log(`✅ Bot started as @${botInfo.username}`);
        console.log(`   Bot ID: ${botInfo.id}`);
        console.log(`   First name: ${botInfo.first_name}`);

        await bot.launch();
        console.log('🚀 Bot is running and listening for messages...');

        process.once('SIGINT', () => {
            console.log('\n🛑 Stopping bot (SIGINT)...');
            bot.stop('SIGINT');
        });

        process.once('SIGTERM', () => {
            console.log('\n🛑 Stopping bot (SIGTERM)...');
            bot.stop('SIGTERM');
        });
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

async function bootstrap() {
    await startHttpServer();
    await startBot();
}

bootstrap().catch(error => {
    console.error('Fatal startup error:', error);
    process.exit(1);
});

export default bot;

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

bot.on('text', async (ctx, next) => {
    const text = ctx.message?.text?.trim();

    if (!text) {
        await next();
        return;
    }

    const profileId = ctx.state.profileId;
    const profile = ctx.state.profile;

    const history = await loadHistory(profileId);

    let decision = null;
    try {
        decision = await aiCommandRouter.interpret({
            profile,
            message: text,
            history,
        });
    } catch (error) {
        console.error('AI command router failed:', error);
    }

    if (decision?.needs_clarification && decision.clarification_question) {
        await replyWithTracking(ctx, decision.clarification_question, { disable_web_page_preview: true });
        await saveHistory(profileId, history, text, null, decision.intent);
        return;
    }

    if (decision?.intent === 'open_webapp') {
        const assistantMessage = await handleOpenWebApp(ctx, decision?.assistant_reply);
        await saveHistory(profileId, history, text, assistantMessage, decision.intent);
        return;
    }

    const assistantReply = await resolveAssistantReply(decision, { profile, message: text });
    await replyWithTracking(ctx, assistantReply, { disable_web_page_preview: true });
    await saveHistory(profileId, history, text, assistantReply, decision?.intent || 'fallback');

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

    return 'Поймал запрос, но пока не понял контекст. Расскажи подробнее, что хочешь сделать, или попроси открыть приложение.';
}

async function handleOpenWebApp(ctx, aiMessage) {
    const message =
        formatAssistantReply(aiMessage) || 'Готов открыть панель. Нажми на кнопку ниже, чтобы запустить приложение.';

    if (config.app.webAppUrl) {
        const keyboard = Markup.inlineKeyboard([
            Markup.button.webApp('🚀 Открыть приложение', config.app.webAppUrl),
        ]);

        await replyWithTracking(ctx, message, {
            ...keyboard,
            disable_web_page_preview: true,
        });
    } else {
        await replyWithTracking(
            ctx,
            `${message}\n\nURL WebApp не настроен. Добавь переменную окружения WEBAPP_URL.`,
            { disable_web_page_preview: true }
        );
    }

    return message;
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

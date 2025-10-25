import config from '../../config/env.js';
import { db } from '../../infrastructure/supabase.js';
import { recordUserMessage } from '../utils/chat.js';

/**
 * Middleware для аутентификации пользователя
 * Проверяет и создаёт профиль в базе данных
 */
export async function authMiddleware(ctx, next) {
    try {
        const telegramId = ctx.from?.id;

        if (!telegramId) {
            console.error('No telegram ID in context');
            return;
        }

        if (config.telegram.allowedUserIds?.length &&
            !config.telegram.allowedUserIds.includes(String(telegramId))) {
            console.warn(`Rejected unauthorized Telegram ID ${telegramId}`);
            await ctx.reply('Доступ к этому боту ограничен. Если нужен доступ — свяжись с разработчиком.');
            return;
        }

        // Проверяем существование профиля
        let profile = await db.getProfileByTelegramId(telegramId);

        // Если профиля нет, создаём новый
        if (!profile) {
            console.log(`Creating new profile for telegram_id: ${telegramId}`);

            profile = await db.createProfile(telegramId, {
                goals: {},
                equipment: [],
                preferences: {
                    language: ctx.from.language_code || 'ru',
                    username: ctx.from.username,
                    first_name: ctx.from.first_name,
                },
            });

            // Логируем событие создания профиля
            await db.logEvent(
                profile.id,
                'user_registration',
                'info',
                {
                    telegram_username: ctx.from.username,
                    first_name: ctx.from.first_name,
                    language_code: ctx.from.language_code,
                }
            );
        }

        // Сохраняем профиль в контекст
        ctx.state.profile = profile;
        ctx.state.profileId = profile.id;

        // Логируем активность пользователя
        await db.logOperation(
            profile.id,
            ctx.updateType || 'message',
            'success'
        );

        await next();
    } catch (error) {
        console.error('Auth middleware error:', error);

        // Логируем ошибку
        if (ctx.state.profileId) {
            await db.logEvent(
                ctx.state.profileId,
                'auth_error',
                'critical',
                { error: error.message }
            );
        }

        await ctx.reply('Произошла ошибка при аутентификации. Попробуйте позже.');
    }
}

/**
 * Middleware для логирования всех действий
 */
export async function loggingMiddleware(ctx, next) {
    const start = Date.now();

    try {
        await next();
    } finally {
        const duration = Date.now() - start;

        console.log({
            type: ctx.updateType,
            userId: ctx.from?.id,
            username: ctx.from?.username,
            text: ctx.message?.text?.substring(0, 100),
            duration: `${duration}ms`,
        });

        // Логируем в observability_events если есть профиль
        if (ctx.state.profileId) {
            await db.logEvent(
                ctx.state.profileId,
                'user_action',
                'info',
                {
                    action_type: ctx.updateType,
                    duration_ms: duration,
                    command: ctx.message?.text?.split(' ')[0],
                }
            );

            if (ctx.updateType === 'message' && ctx.message?.text) {
                await recordUserMessage(ctx.state.profileId, {
                    direction: 'in',
                    message_id: ctx.message.message_id,
                    chat_id: ctx.chat?.id,
                    text: ctx.message.text,
                    timestamp: new Date().toISOString(),
                });
            } else if (ctx.updateType === 'callback_query' && ctx.callbackQuery?.data) {
                await recordUserMessage(ctx.state.profileId, {
                    direction: 'in',
                    type: 'callback',
                    data: ctx.callbackQuery.data,
                    message_id: ctx.callbackQuery.message?.message_id,
                    chat_id: ctx.chat?.id,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    }
}

/**
 * Middleware для обработки ошибок
 */
export async function errorMiddleware(ctx, next) {
    try {
        await next();
    } catch (error) {
        console.error('Bot error:', error);

        // Логируем ошибку в базу
        if (ctx.state.profileId) {
            await db.logEvent(
                ctx.state.profileId,
                'bot_error',
                'critical',
                {
                    error: error.message,
                    stack: error.stack,
                    update_type: ctx.updateType,
                }
            );
        }

        // Отправляем пользователю дружелюбное сообщение
        const errorMessage =
            '😔 Произошла ошибка при обработке запроса.\n\n' +
            'Попробуйте повторить позже или воспользуйтесь командой /help для справки.';

        try {
            await ctx.reply(errorMessage);
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    }
}

/**
 * Middleware для проверки состояния диалога
 */
export async function dialogStateMiddleware(ctx, next) {
  if (!ctx.state.profileId) {
    return next();
  }

  try {
    // Проверяем активные состояния диалога
    const activeState = await db.getDialogState(ctx.state.profileId, 'active');
    
    if (activeState && activeState.expires_at) {
      const expiresAt = new Date(activeState.expires_at);
      const now = new Date();
      
      if (expiresAt < now) {
        // Состояние истекло, очищаем его
        await db.clearDialogState(ctx.state.profileId, 'active');
      } else {
        // Сохраняем активное состояние в контекст
        ctx.state.dialogState = activeState.state_payload;
      }
    }
  } catch (error) {
    console.error('Dialog state middleware error:', error);
  }
  
  return next();
}

export default {
    authMiddleware,
    loggingMiddleware,
    errorMiddleware,
    dialogStateMiddleware,
};

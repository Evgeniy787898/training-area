import { Bot, InlineKeyboard } from 'grammy';
import { BotEngine } from './botEngine.js';
import { loadEnv } from '../config/env.js';
import { MetricsTracker, ErrorTracker } from '../monitoring/index.js';
import { createSupabaseClient } from '../services/supabaseClient.js';
import { createOpenAiClient } from '../services/openaiClient.js';
import { ProgressRepository } from '../training/progressRepository.js';
import { TrainingCoach } from '../training/trainingCoach.js';

const config = loadEnv(process.env);

if (!config.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN не задан. Создай .env и пропиши токен бота.');
}

if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
  throw new Error('Не заданы параметры SUPABASE_URL и SUPABASE_ANON_KEY.');
}

if (!config.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY обязателен для генерации тренировок.');
}

const supabase = createSupabaseClient({
  url: config.SUPABASE_URL,
  anonKey: config.SUPABASE_ANON_KEY
});

const openAi = createOpenAiClient({
  apiKey: config.OPENAI_API_KEY,
  organization: config.OPENAI_ORGANIZATION ?? undefined,
  project: config.OPENAI_PROJECT ?? undefined
});

const progressRepository = new ProgressRepository(supabase);
const trainingCoach = new TrainingCoach({ openAi, progressRepository });

const botEngine = new BotEngine({
  metrics: new MetricsTracker({ prefix: 'telegram_bot' }),
  errorTracker: new ErrorTracker({ dsn: config.ERROR_TRACKING_DSN ?? null }),
  config,
  trainingCoach
});

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

bot.api.setMyCommands([
  { command: 'start', description: 'Начать тренировочный диалог' },
  { command: 'sync', description: 'Напомнить правила взаимодействия' }
]);

const quickActionsKeyboard = new InlineKeyboard()
  .text('Обновить цель', 'action:update_goal')
  .row()
  .text('Готовность 3', 'action:readiness:3')
  .text('Готовность 4', 'action:readiness:4');

const buildEngineMessage = (ctx, text) => ({
  userId: String(ctx.from.id),
  channel: 'telegram',
  content: text,
  metadata: {
    displayName: ctx.from.first_name ?? 'друг',
    username: ctx.from.username ?? null
  }
});

const sendEngineResponse = async (ctx, text) => {
  await ctx.reply(text, {
    reply_markup: quickActionsKeyboard
  });
};

bot.command('start', async (ctx) => {
  const response = await botEngine.handleMessage(buildEngineMessage(ctx, '/start'));
  await sendEngineResponse(ctx, response.reply);
});

bot.command('sync', async (ctx) => {
  const response = await botEngine.handleMessage(
    buildEngineMessage(
      ctx,
      'цель: укрепить тело без перегруза\nготовность: 3\nХочу напомнить правила.'
    )
  );
  await sendEngineResponse(ctx, response.reply);
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (data === 'action:update_goal') {
    await ctx.answerCallbackQuery({ text: 'Напиши сообщение вида «цель: подтянуть спину»' });
    return;
  }

  if (data.startsWith('action:readiness:')) {
    const readiness = data.split(':')[2];
    const response = await botEngine.handleMessage(
      buildEngineMessage(ctx, `готовность: ${readiness}. Чувствую себя стабильно.`)
    );
    await ctx.answerCallbackQuery({ text: `Готовность обновлена: ${readiness}` });
    await sendEngineResponse(ctx, response.reply);
    return;
  }

  await ctx.answerCallbackQuery();
});

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  const response = await botEngine.handleMessage(buildEngineMessage(ctx, text));
  await sendEngineResponse(ctx, response.reply);
});

bot.catch(async (error) => {
  console.error('Telegram polling error', error);
});

bot.start({ drop_pending_updates: true });

// eslint-disable-next-line no-console
console.log('🚀 Тренировочный Telegram-бот запущен.');

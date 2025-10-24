# 🏋️ Training Area — Личный тренировочный помощник

Персональный AI-тренер в Telegram для калистеники и функционального тренинга. Помогает составлять планы тренировок, отслеживать прогресс и адаптировать нагрузку на основе обратной связи.

## 📋 Возможности

- 🤖 **AI-планирование** — генерация персональных тренировочных планов с помощью ChatGPT
- 📊 **Отслеживание прогресса** — автоматический расчёт прогрессий упражнений
- 📅 **Умное расписание** — адаптация плана под изменения в жизни
- 💬 **Дружелюбный диалог** — понимает свободный текст и даёт мотивацию
- 📱 **WebApp** — визуализация статистики и аналитики
- 🔔 **Уведомления** — напоминания о тренировках
- 🏆 **Достижения** — система мотивации и наград

## 🏗️ Архитектура

```
training-area/
├── server/                  # Backend приложение
│   ├── bot/                # Telegram бот
│   │   ├── commands/       # Команды бота
│   │   ├── middleware/     # Middleware
│   │   └── index.js        # Точка входа
│   ├── services/           # Сервисы (AI, прогрессии)
│   ├── infrastructure/     # Supabase клиент
│   ├── config/             # Конфигурация
│   └── supabase/           # Миграции и Edge Functions
│       ├── migrations/     # SQL миграции
│       └── functions/      # Edge Functions
├── webapp/                 # Telegram WebApp (React)
│   └── src/
│       ├── components/     # Компоненты
│       ├── pages/          # Страницы
│       └── styles/         # Стили
└── docs/                   # Документация
```

## 🚀 Быстрый старт

### Предварительные требования

- **Node.js** 18+ и npm/pnpm
- **Supabase** проект (бесплатный tier подходит)
- **Telegram Bot Token** (получить у [@BotFather](https://t.me/botfather))
- **OpenAI API Key** (для ChatGPT)

### Установка

1. **Клонируйте репозиторий**
   ```bash
   git clone https://github.com/your-username/training-area.git
   cd training-area
   ```

2. **Настройте переменные окружения**
   
   Создайте файл `server/.env` (используйте `.env.example` как шаблон):
   ```bash
   # Telegram
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   
   # OpenAI
   OPENAI_API_KEY=your_openai_key_here
   
   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your_service_key_here
   ```

3. **Установите зависимости**
   ```bash
   cd server
   npm install
   ```

4. **Создайте базу данных**
   
   Выполните миграцию в Supabase:
   - Откройте [Supabase Dashboard](https://supabase.com/dashboard)
   - SQL Editor → New Query
   - Скопируйте содержимое `server/supabase/migrations/20240101000000_initial_schema.sql`
   - Выполните запрос

5. **Запустите бота и HTTP API**
   ```bash
   npm run dev
   ```

Бот и HTTP API (порт `3000`) готовы! Найдите его в Telegram и отправьте `/start`. REST-эндпоинты доступны по адресу `http://localhost:3000/v1/*`.

## 📱 Запуск WebApp

```bash
cd webapp
npm install
VITE_API_BASE_URL="http://localhost:3000"
npm run dev
```

WebApp будет доступен на `http://localhost:3001`

Для интеграции с Telegram:
1. Разместите WebApp на хостинге (Vercel, Netlify, и т.д.)
2. Добавьте URL в настройки бота через [@BotFather](https://t.me/botfather)

## 🗄️ База данных

### Основные таблицы

- **profiles** — профили пользователей
- **training_sessions** — тренировочные сессии
- **exercise_progress** — прогресс по упражнениям
- **metrics** — метрики (adherence, RPE, и т.д.)
- **plan_versions** — версии тренировочных планов

См. полную схему в `server/supabase/migrations/`

## 🤖 Команды бота

- `/start` — Начать работу / онбординг
- `/plan` — Показать план тренировок
- `/report` — Отчитаться о тренировке
- `/stats` — Посмотреть прогресс
- `/settings` — Настройки
- `/help` — Справка

## 📝 API ключи

### Telegram Bot Token

1. Откройте [@BotFather](https://t.me/botfather)
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен

### OpenAI API Key

1. Зарегистрируйтесь на [platform.openai.com](https://platform.openai.com)
2. API Keys → Create new secret key
3. Скопируйте ключ (он показывается только один раз!)

### Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Settings → API
3. Скопируйте:
   - Project URL (`SUPABASE_URL`)
   - `service_role` key (`SUPABASE_SERVICE_KEY`)

## 🔧 Конфигурация

### Настройка уведомлений

Используйте команду `/settings` в боте для:
- Изменения времени уведомлений
- Выбора часового пояса
- Паузы уведомлений

### Персонализация промптов

Системные промпты для ChatGPT находятся в `server/services/planner.js`:
```javascript
const SYSTEM_PROMPT = `...`;
```

## 📚 Документация

Полная документация проекта находится в папке `docs/`:

- `kontseptsiya-i-rabota-bota.md` — Концепция и цели
- `arhitektura-i-tekhnicheskie-resheniya.md` — Архитектура
- `pravila-ii-i-dialoga.md` — Правила поведения AI
- `logika-progressii-i-ii.md` — Система прогрессий
- `trenirovochnye-programmy-i-progressii.md` — Тренировочные программы
- `telegram-webapp-ui-ux-specifikatsiya.md` — UI/UX гайд для WebApp
- `api-schema.md` — Контракты HTTP API

## 🐛 Отладка

### Логи бота

```bash
cd server
npm run dev
# Логи будут выводиться в консоль
```

### Проверка базы данных

Используйте Supabase Table Editor для проверки данных:
```
https://supabase.com/dashboard/project/YOUR_PROJECT/editor
```

### Тестирование команд

Отправьте команды боту в Telegram и проверьте логи на наличие ошибок.

## 🚢 Деплой

### Бот (сервер)

Рекомендуемые платформы:
- **Railway** — простой деплой Node.js приложений
- **Render** — бесплатный tier с автодеплоем
- **Vercel** — для serverless функций

Пример для Railway:
1. Подключите GitHub репозиторий
2. Выберите `server/` как root directory
3. Добавьте переменные окружения
4. Deploy!

### WebApp

Рекомендуемые платформы:
- **Vercel** — оптимален для React
- **Netlify** — простая настройка
- **GitHub Pages** — бесплатный вариант

Пример для Vercel:
```bash
cd webapp
npm run build
vercel --prod
```

### Edge Functions

Deploy через Supabase CLI:
```bash
supabase functions deploy update_plan
supabase functions deploy notify_daily
```

## 📊 Мониторинг

- **Логи бота**: смотрите в консоли или настройте логирование в файл
- **Supabase Logs**: Dashboard → Logs
- **OpenAI Usage**: [platform.openai.com/usage](https://platform.openai.com/usage)

## 🤝 Участие в разработке

Проект открыт для улучшений! Если вы хотите добавить функциональность:

1. Fork репозитория
2. Создайте ветку (`git checkout -b feature/amazing-feature`)
3. Commit изменений (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 💬 Поддержка

Если возникли вопросы:
- Создайте [Issue](https://github.com/your-username/training-area/issues)
- Напишите в Telegram: [@your_username](https://t.me/your_username)

## 🙏 Благодарности

- [Telegraf](https://telegraf.js.org/) — фреймворк для Telegram ботов
- [OpenAI](https://openai.com/) — ChatGPT API
- [Supabase](https://supabase.com/) — Backend as a Service
- Документация основана на методике [Convict Conditioning](https://www.dragondoor.com/convict-conditioning/)

---

**Сделано с ❤️ для любителей калистеники**

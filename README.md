# 🏋️ Training Area — Личный тренировочный помощник

Персональный AI-тренер в Telegram для калистеники и функционального тренинга. Помогает составлять планы тренировок, отслеживать прогресс и адаптировать нагрузку на основе обратной связи.

## 📋 Возможности

- 🤖 **Встроенный тренер** — генерация персональных планов и анализ отчётов силами внутреннего движка
- 🧠 **NLU-диалоги** — бот понимает естественные фразы («Перенеси тренировку на завтра», «Напомни через час»)
- 🔄 **Управление расписанием** — перенос тренировок, режим восстановления, напоминания «позже»
- 📊 **Подробная аналитика** — динамика объёма, распределение RPE и достижения прямо в Telegram
- 📱 **Обновлённый WebApp** — стеклянные карточки, лайв-метрики, адаптивная навигация
- ⚙️ **Гибкие настройки** — управление напоминаниями и быстрый доступ к WebApp прямо из чата
- 🗒️ **Личные заметки** — команда «Сохрани: …» и REST API `/v1/assistant/notes` позволяют вести журнал идей и задач в базе
- 🔒 **Защищённый доступ** — проверка подписи Telegram WebApp и allowlist по Telegram ID
- 🏆 **Достижения и мотивация** — автоматическая фиксация прогресса и персональные сообщения поддержки
- 📚 **Каталог прогрессий** — проработанные уровни упражнений и связанная история тренировок
- 🧾 **Умный отчёт** — ввод фактических подходов, автоматический расчёт выполнения и обновление прогрессий
- 🚀 **Онбординг** — бот собирает цели и оборудование, запускает генерацию плана через Edge Function `update_plan`

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

### Установка

1. **Клонируйте репозиторий**
   ```bash
   git clone https://github.com/your-username/training-area.git
   cd training-area
   ```

2. **Настройте переменные окружения**

   Создайте файл `server/.env` (используйте `server/.env.example` как шаблон):
   ```bash
   # Telegram
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   # (optional) ограничьте доступ конкретными аккаунтами
   TELEGRAM_ALLOWED_IDS=123456789,987654321
   
   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your_service_key_here

   # WebApp (необязательно)
   WEBAPP_URL=https://your-webapp-hosting.example

   # Настройки ассистента (опционально)
   ASSISTANT_SUCCESS_THRESHOLD=75
   ASSISTANT_SLUMP_THRESHOLD=45
  ```

3. **Установите зависимости**
   ```bash
   cd server
   npm install
   ```

4. **Создайте базу данных**

   Выполните миграции в Supabase:
   - Откройте [Supabase Dashboard](https://supabase.com/dashboard)
   - SQL Editor → New Query
   - Последовательно выполните файлы из `server/supabase/migrations/` (начните с `20240101000000_initial_schema.sql`)

5. **Запустите бота и HTTP API**
   ```bash
   npm run dev
   ```

Бот и HTTP API (порт `3000`) готовы! Найдите его в Telegram и отправьте `/start`. REST-эндпоинты доступны по адресу `http://localhost:3000/v1/*`.

## 📱 Запуск WebApp

```bash
cd webapp
npm install
cp .env.example .env.local
npm run dev
```

По умолчанию dev-сервер Vite поднимается на `http://localhost:5173`. При необходимости можно задать порт вручную: `npm run dev -- --port 3001`.

> Если API временно недоступно, WebApp покажет локальный пример плана и прогрессий с предупреждением в toast.

Для интеграции с Telegram:
1. Разместите WebApp на хостинге (Vercel, Netlify, и т.д.)
2. Добавьте URL в настройки бота через [@BotFather](https://t.me/botfather)

WebApp теперь включает семь экранов: «Сегодня», «Неделя», «Отчёт», «Прогресс», «Упражнения», «Справка» и «Настройки». Раздел «Справка» работает как информационный стенд с советами по калистенике, а «Упражнения» остаётся каталогом прогрессий с историей. Все экраны синхронизированы с API (`/v1/sessions`, `/v1/reports`, `/v1/achievements`, `/v1/exercises`).

### Быстрый запуск c ngrok

Чтобы протестировать связку «бот + WebApp» на мобильном устройстве или внутри Telegram, используйте скрипт из корня проекта:

```bash
./dev-with-ngrok.sh
```

Скрипт проверит наличие `ngrok`, запустит Vite на `0.0.0.0`, поднимет туннель и стартует backend (`npm run dev:tunnel`). Адрес туннеля автоматически пробрасывается в `WEBAPP_URL`, поэтому команда `/webapp` в боте сразу откроет правильную ссылку.

## 🗄️ База данных

### Основные таблицы

- **profiles** — профили пользователей
- **training_sessions** — тренировочные сессии
- **exercise_progress** — прогресс по упражнениям
- **metrics** — метрики (adherence, RPE, и т.д.)
- **plan_versions** — версии тренировочных планов

См. полную схему в `server/supabase/migrations/`

## ⚙️ Supabase Edge Functions

| Функция | Назначение |
| --- | --- |
| `update_plan` | Анализирует прогресс, собирает план недели внутренним движком и создаёт новую активную версию плана в базе. |
| `notify_daily` | Формирует сообщение о тренировке на текущий день и отправляет его пользователю в Telegram или возвращает превью для dry-run. |
| `update_settings` | Применяет изменения настроек профиля (время напоминаний, часовой пояс, пауза уведомлений) с валидацией и логированием. |

Запуск локально:
```bash
cd server
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... TELEGRAM_BOT_TOKEN=... npx supabase functions serve update_plan
```

Деплой в облако Supabase:
```bash
cd server
supabase functions deploy update_plan
supabase functions deploy notify_daily
supabase functions deploy update_settings
```

Не забудьте задать переменные окружения (`SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`) в настройках проекта Supabase.

## 🤖 Команды бота

- `/start` — Начать работу / онбординг
- `/plan` — Показать план тренировок
- `/report` — Отчитаться о тренировке
- `/stats` — Посмотреть прогресс и детальную аналитику
- `/settings` — Настройки
- `/help` — Справка
- `/menu` — Вернуться к клавиатуре и WebApp-кнопке

## 📝 API ключи

### Telegram Bot Token

1. Откройте [@BotFather](https://t.me/botfather)
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен

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
- Паузы уведомлений

Цели, оборудование и часовой пояс можно обновить в WebApp через кнопку `/menu` → «Открыть WebApp».

### Персонализация промптов и NLU

- Правила движка описаны в `server/services/internalAssistantEngine.js` — можно дополнять шаблоны ответов, мотивацию и поведение.
- Обработчик естественного языка — `server/services/nlu.js`. Добавляйте новые intents и словари, чтобы бот понимал больше запросов.

## 📚 Документация

Полная документация проекта находится в папке `docs/`:

- `kontseptsiya-i-rabota-bota.md` — Концепция и цели
- `arhitektura-i-tekhnicheskie-resheniya.md` — Архитектура
- `pravila-trenera-i-dialoga.md` — Правила поведения тренера и диалогов
- `dvizhok-trenera.md` — Внутренний движок тренера
- `trenirovochnye-programmy-i-progressii.md` — Тренировочные программы
- `telegram-webapp-ui-ux-specifikatsiya.md` — UI/UX гайд для WebApp
- `dialogovaya-logika-i-ux-chata.md` — описание сценариев NLU и состояния диалога
- `api-schema.md` — Контракты HTTP API
- `webapp/README.md` — отдельный гайд по WebApp и окружению

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
- [Supabase](https://supabase.com/) — Backend as a Service
- Документация основана на методике [Convict Conditioning](https://www.dragondoor.com/convict-conditioning/)

---

**Сделано с ❤️ для любителей калистеники**

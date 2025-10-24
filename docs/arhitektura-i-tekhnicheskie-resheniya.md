# Архитектура и технические решения

## Обзор платформы
- **Язык и фреймворк бота**: Node.js 18+, библиотека `telegraf` для взаимодействия с Telegram API.
- **Интеграция с ChatGPT**: использование ключа `sk-proj-...` через REST API OpenAI для генерации ответов и планов.
- **Supabase**: база данных PostgreSQL, аутентификация (анонимный ключ) и edge functions для фоновой логики.
- **Хостинг**: Vercel или Render для бота (если требуется постоянное подключение — выделенный сервер/railway). Cron-задачи через Supabase Edge Functions.

## Логическая схема
1. **Telegram Bot**
   - Обработчики команд `/start`, `/plan`, `/report`, `/stats`, `/settings`.
   - Middleware для авторизации твоего единственного Telegram ID.
   - Сервис форматирования сообщений (Markdown, эмодзи, таблицы).
2. **Сервис планирования (ChatGPT)**
   - Модуль генерации тренировок: prompt-инженерия с контекстом цели, доступного оборудования и истории прогресса.
   - Модуль анализа обратной связи: пересчет нагрузки при высоком RPE.
3. **Supabase Backend**
   - Таблицы: `profiles`, `training_sessions`, `metrics`, `achievements`, `weekly_reviews`.
   - Edge Function `update_plan` — анализирует свежие данные, вызывает ChatGPT и обновляет расписание.
   - Edge Function `notify_daily` — пушит план на день в Telegram через webhook.
4. **Система уведомлений**
   - Cron-триггер в Supabase вызывает `notify_daily` каждое утро.
   - При пропуске тренировки Edge Function отправляет мотивационное сообщение.

## Структура проекта
```
root
└─ server/
   ├─ bot/
   │  ├─ index.ts         // точка входа бота
   │  ├─ middleware/
   │  │  └─ auth.ts      // проверка Telegram ID
   │  ├─ services/
   │  │  ├─ planner.ts   // запросы к ChatGPT
   │  │  └─ formatter.ts // сборка сообщений
   │  └─ scenes/         // wizard-сценарии опросов
   ├─ supabase/
   │  ├─ schemas.sql     // миграции таблиц
   │  └─ functions/
   │     ├─ update_plan/index.ts
   │     └─ notify_daily/index.ts
   └─ config/
      └─ env.ts          // работа с ключами и конфигом
```

## Хранение и модели данных
- `profiles`: `id`, `telegram_id`, `goals`, `equipment`, `preferences`, `created_at`.
- `training_sessions`: `id`, `profile_id`, `date`, `session_type`, `exercises`, `rpe`, `notes`.
- `metrics`: `id`, `profile_id`, `metric_type`, `value`, `recorded_at`.
- `achievements`: `id`, `profile_id`, `title`, `description`, `awarded_at`.
- `weekly_reviews`: `id`, `profile_id`, `week_start`, `summary`, `adjustments`.

## Поток данных
1. Ты запускаешь `/start` — бот создает запись в `profiles` (если нет) и запускает опрос.
2. Ответы сохраняются, формируется начальный план через ChatGPT, результат пишется в `training_sessions` на ближайшие 14 дней.
3. Каждое утро Edge Function `notify_daily` читает план на день, форматирует сообщение и отправляет через Telegram.
4. После тренировки ты отправляешь отчет `/report`, бот сохраняет RPE, заметки, обновляет статистику и триггерит `update_plan` при необходимости.
5. По воскресеньям бот собирает данные недели, формирует обзор и отправляет в Telegram.

## Безопасность и секреты
- Переменные окружения: `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`.
- Хранить ключи в `.env` и не коммитить в репозиторий.
- Доступ к боту ограничен проверкой Telegram ID.
- Запросы к OpenAI идут через HTTPS, Supabase подключение — по SSL.

## Мониторинг и журналы
- Логи бота отправляются в Supabase Logflare или Papertrail.
- Edge Functions пишут структурированные логи (время вызова, результат, ошибки).
- Telegram webhook настроен на ручной перезапуск при ошибках.

## План внедрения
1. Настроить репозиторий с описанной структурой.
2. Создать Supabase проект и применить `schemas.sql`.
3. Подготовить ChatGPT промпты и протестировать ответы.
4. Реализовать бота и edge functions.
5. Провести интеграционное тестирование на тестовом чате.
6. Перенести бота на постоянный хостинг и включить ежедневные задачи.

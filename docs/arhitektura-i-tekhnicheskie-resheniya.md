# Архитектура и технические решения

## Обзор платформы
- **Язык и фреймворк бота**: Node.js 18+, библиотека `telegraf` для взаимодействия с Telegram API.
- **Интеграция с ChatGPT**: использование ключа `sk-proj-...` через REST API OpenAI для генерации ответов и планов.
- **Supabase**: база данных PostgreSQL, аутентификация (анонимный ключ) и edge functions для фоновой логики.
- **Хостинг**: Vercel или Render для бота (если требуется постоянное подключение — выделенный сервер/railway). Cron-задачи через Supabase Edge Functions.

## Логическая схема
1. **Telegram Bot**
   - Обработчики команд `/start`, `/plan`, `/report`, `/stats`, `/settings`.
   - Middleware для авторизации твоего единственного Telegram ID и валидации подписанного payload из WebApp.
   - Сервис форматирования сообщений (Markdown, эмодзи, таблицы) и нормализации единиц измерения.
2. **Сервис планирования (ChatGPT)**
   - Модуль генерации тренировок: prompt-инженерия с контекстом цели, доступного оборудования и истории прогресса.
   - Модуль анализа обратной связи: пересчет нагрузки при высоком RPE.
   - Очередь запросов с троттлингом 1 запрос/сек и глобальным лимитом 60 запросов/минуту (подстроить под тариф OpenAI).
3. **Supabase Backend**
   - Таблицы: `profiles`, `training_sessions`, `metrics`, `achievements`, `weekly_reviews`, `exercise_progress`, `operation_log`, `capabilities`, `plan_versions`.
   - Edge Function `update_plan` — анализирует свежие данные, вызывает ChatGPT и обновляет расписание.
   - Edge Function `notify_daily` — пушит план на день в Telegram через webhook и фиксирует факт отправки в `operation_log`.
   - Edge Function `update_settings` — применяет изменения уведомлений и таймзон, валидирует конфликты.
4. **Система уведомлений**
   - Cron-триггер в Supabase вызывает `notify_daily` каждое утро в 06:00 пользовательской таймзоны (SLA отправки ≤ 2 мин).
   - При пропуске тренировки Edge Function отправляет мотивационное сообщение и устанавливает напоминание follow-up через 6 часов.
5. **Наблюдаемость**
   - Стрим логов Supabase → Logflare → Grafana Cloud для дешбордов latency и ошибок.
   - Webhook-интеграция с Telegram при критических ошибках (категория `external_api_failure`).

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

| Таблица | Поля | Типы | Ключи/индексы | Связи |
| --- | --- | --- | --- | --- |
| `profiles` | `id`, `telegram_id`, `goals`, `equipment`, `preferences`, `notification_time`, `timezone`, `notifications_paused`, `created_at` | `uuid`, `bigint`, `jsonb`, `text[]`, `jsonb`, `time`, `text`, `boolean`, `timestamptz` | PK `profiles_pkey`, уникальный индекс `profiles_telegram_id_key` | 1:M с `training_sessions`, `metrics`, `achievements`, `weekly_reviews`, `plan_versions` |
| `training_sessions` | `id`, `profile_id`, `date`, `session_type`, `exercises`, `rpe`, `notes`, `status`, `trace_id`, `created_at` | `uuid`, `uuid`, `date`, `text`, `jsonb`, `numeric(3,1)`, `text`, `text`, `uuid`, `timestamptz` | PK `training_sessions_pkey`, индекс по (`profile_id`, `date`) | FK `profile_id` → `profiles.id`; 1:M с `exercise_progress` |
| `exercise_progress` | `id`, `session_id`, `exercise_key`, `level_target`, `level_result`, `volume_target`, `volume_actual`, `rpe`, `notes`, `decision`, `streak_success`, `created_at` | `uuid`, `uuid`, `text`, `text`, `text`, `integer`, `integer`, `numeric(3,1)`, `text`, `text`, `integer`, `timestamptz` | PK `exercise_progress_pkey`, индекс `exercise_progress_session_id_key` | FK `session_id` → `training_sessions.id` |
| `metrics` | `id`, `profile_id`, `metric_type`, `value`, `recorded_at`, `source` | `uuid`, `uuid`, `text`, `numeric`, `timestamptz`, `text` | PK `metrics_pkey`, индекс `metrics_profile_id_recorded_at_idx` | FK `profile_id` → `profiles.id` |
| `achievements` | `id`, `profile_id`, `title`, `description`, `awarded_at` | `uuid`, `uuid`, `text`, `text`, `timestamptz` | PK `achievements_pkey` | FK `profile_id` → `profiles.id` |
| `weekly_reviews` | `id`, `profile_id`, `week_start`, `summary`, `adjustments`, `created_at` | `uuid`, `uuid`, `date`, `jsonb`, `jsonb`, `timestamptz` | PK `weekly_reviews_pkey`, индекс `weekly_reviews_profile_id_week_start_idx` | FK `profile_id` → `profiles.id` |
| `plan_versions` | `id`, `profile_id`, `version`, `summary`, `is_active`, `created_at` | `uuid`, `uuid`, `integer`, `jsonb`, `boolean`, `timestamptz` | Уникальный составной индекс (`profile_id`, `version`) | FK `profile_id` → `profiles.id`; 1:M c `plan_version_items` |
| `plan_version_items` | `id`, `plan_version_id`, `slot_date`, `payload`, `created_at` | `uuid`, `uuid`, `date`, `jsonb`, `timestamptz` | Индекс `plan_version_items_plan_version_id_idx` | FK `plan_version_id` → `plan_versions.id` |
| `capabilities` | `id`, `name`, `intent`, `required_slots`, `optional_slots`, `webapp_screen`, `description` | `uuid`, `text`, `text`, `jsonb`, `jsonb`, `text`, `text` | Индекс `capabilities_intent_idx` | Используется NLU роутером |
| `operation_log` | `id`, `profile_id`, `action`, `payload_hash`, `status`, `created_at` | `uuid`, `uuid`, `text`, `text`, `text`, `timestamptz` | Индекс `operation_log_profile_id_action_idx` | FK `profile_id` → `profiles.id` |

*Индексы по полям дат обязательны для построения аналитики и поддержания SLA ответов ≤ 500 мс на запрос статистики.*

## NLU и командный роутер
- **Роль**: принимает произвольный текст пользователя, сопоставляет с каталогом поддерживаемых возможностей и трансформирует запрос во внутренние команды.
- **Справочник возможностей (Capability Registry)**: структура данных в Supabase (`capabilities`) с описанием операции, допустимых параметров, ссылок на таблицы/поля и привязанных WebApp экранов.
- **Маппинг**: каждая capability содержит шаблон или intent, набор обязательных и опциональных слотов, а также fallback-текст.
- **Обработка ошибок**: при отсутствии соответствия intent или недостающих параметрах бот возвращает явный ответ «Такой возможности пока нет» либо предлагает доступные альтернативы.
- **Поддержка help/справки**: команда `/help` и быстрые кнопки перечисляют ключевые capabilities, чтобы пользователь видел набор доступных действий даже при наличии NLU.

## Аналитика как изображения
- **Каталог запросов**: предопределённые отчёты (тренды объёма, динамика RPE, прогресс уровней, пропуски тренингов), хранится в таблице `analytics_reports` с полями `id`, `slug`, `display_name`, `default_range`, `query_template`, `visual_type`.
- **Пайплайн**:
  1. Свободный текст → NLU нормализует название отчёта и диапазон дат.
  2. Планировщик параметров заполняет недостающие значения (например, текущая неделя).
  3. Серверная функция строит график (например, через `chart.js` headless) и сохраняет изображение в Supabase Storage (папка `analytics/{profile_id}/{slug}/{date}`) вместе с JSON-данными.
  4. Бот отправляет изображение в чат и кэширует ссылку в Redis/Supabase `analytics_cache`.
- **Кэширование**: ключ кэша = `report_type:date_range`. TTL 24 часа, инвалидация при обновлении исходных данных через триггер на `training_sessions`/`metrics`.
- **Отказоустойчивость**: при ошибке генерации картинка заменяется текстовым summary и ссылкой на WebApp, а инцидент логируется в `observability_events` с категорией `analytics_render_failure`.

## Версионирование плана
- **Сущность `plan_versions`**: `id`, `profile_id`, `version`, `created_at`, `summary`, `is_active`.
- **Частичный откат**: таблица `plan_version_items` хранит привязку версий к упражнениям/дням. Операция отката принимает уровень (день/упражнение) и создаёт новую версию с нужным подмножеством данных.
- **Политика доступа**: откат разрешён только владельцу (тебе) и сервисным функциям. Все операции логируются в `plan_version_audit`.
- **Интеграция с ботом**: запрос «откатить понедельник» создаёт команду `PLAN_REVERT` с указанием даты/слота, после чего Edge Function обновляет `is_active` и синхронизирует план.

## Настройки пользователя
- **Модель данных**: поле `notification_time` и `timezone` в `profiles`.
- **Поток изменения**:
  1. Свободный текст («поставь напоминание на 7:30») → NLU нормализует время и валидирует таймзону.
  2. Edge Function `update_settings` обновляет Supabase и логирует событие.
  3. Бот подтверждает изменение и показывает, как отменить/изменить.
- **Правила**: таймзона по умолчанию `Europe/Moscow`. В выходные уведомления отправляются сдвинутыми на +1 час; поддерживаются исключения (например, отпуск) через флаг `notifications_paused`.

## Надёжность и идемпотентность
- **Очередь**: все вызовы ChatGPT и отправки сообщений помещаются в Supabase Edge Queue или аналогичный механизм с ретраями (экспоненциальная задержка, до 3 попыток).
- **Идемпотентность**: ключ операции = комбинация пользователя и действия (`user_id + action + date`). Edge Functions проверяют наличие записей в `operation_log` перед выполнением, предотвращая дублирование уведомлений или двойные обновления плана.
- **Хранение состояния**: результаты успешных операций сохраняются вместе с хэшем payload, что позволяет безопасно повторять запросы после сбоев.

## Наблюдаемость и трассировка
- **Структурированный лог**: события `user_action`, `ai_decision`, `plan_change`, `analytics_rendered`, `error` записываются в Supabase `observability_events`.
- **Trace ID**: для каждого пользовательского запроса генерируется `trace_id`, который прокидывается через NLU, Edge Functions и Telegram ответы.
- **Метрики**: latency NLU, время генерации отчётов, количество откатов плана, доля ошибок.
- **Карта ошибок**: категории `external_api_failure`, `validation_error`, `timeout`, `rate_limit`. Каждой категории соответствует реакция: повтор, фолбэк на текст, уведомление пользователя.

## Поток данных
1. Ты запускаешь `/start` — бот создает запись в `profiles` (если нет) и запускает опрос.
2. Ответы сохраняются, формируется начальный план через ChatGPT, результат пишется в `training_sessions` на ближайшие 14 дней.
3. Каждое утро Edge Function `notify_daily` читает план на день, форматирует сообщение и отправляет через Telegram.
4. После тренировки ты отправляешь отчет `/report`, бот сохраняет RPE, заметки, обновляет статистику и триггерит `update_plan` при необходимости.
5. По воскресеньям бот собирает данные недели, формирует обзор и отправляет в Telegram.

## Безопасность и секреты
- Переменные окружения: `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `LOGFLARE_API_KEY`, `ENCRYPTION_SECRET` (для шифрования локальных кэшей).
- Хранить ключи в `.env` и не коммитить в репозиторий. Для CI использовать секреты GitHub Actions (`Settings → Secrets → Actions`).
- Доступ к боту ограничен проверкой Telegram ID + проверкой подписи `hash` в стартовом payload.
- Edge Functions выполняют роль-based access policies: только `service_role` может обновлять `profiles`, все публичные запросы идут через row level security.
- Запросы к OpenAI идут через HTTPS, Supabase подключение — по SSL. Межсервисные вызовы подписываются JWT с коротким TTL (15 мин).
- Регламент ротации ключей: раз в 90 дней менять OpenAI и Supabase сервисный ключ, в документации фиксировать дату следующей ротации.

## Мониторинг и журналы
- Логи бота отправляются в Supabase Logflare или Papertrail. Структура: `timestamp`, `trace_id`, `intent`, `decision`, `latency_ms`, `status`.
- Edge Functions пишут структурированные логи (время вызова, результат, ошибки) и метрики (`duration_ms`, `retries`, `payload_size`).
- Раз в сутки выполняется задача `log_shipper`, которая архивирует логи старше 30 дней в S3-хранилище.
- Telegram webhook настроен на ручной перезапуск при ошибках; при трёх сбоях подряд срабатывает оповещение в Telegram и Slack.
- SLA: 99% запросов должны обрабатываться менее чем за 2 секунды; в Grafana настроены алерты при превышении.

## План тестирования и CI/CD
1. **Локальная подготовка**:
   - `cp .env.example .env` и заполнить секреты.
   - `npm install` в `server/bot`, `supabase functions secrets set` для Edge Functions.
   - `supabase start` для локальной БД, выполнение миграций `supabase db push`.
2. **Автотесты**:
   - Линтер: `npm run lint`.
   - Юнит-тесты: `npm test` для бота, `supabase functions serve` + `npm run test:functions`.
   - Контрактные тесты NLU: YAML-файл с примерами интентов, прогон через `npm run test:nlu`.
3. **CI/CD пайплайн** (GitHub Actions):
   - Шаги: install → lint → test → deploy-preview (Supabase migrations) → deploy-prod по manual approve.
   - Secrets: `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `TELEGRAM_WEBHOOK_URL`.
4. **Деплой**:
   - Бот: Vercel/Render. Перезапуск при каждом мерже в `main`.
   - Edge Functions: `supabase functions deploy` с версионированием.
   - Cron: проверка расписания через `supabase cron list` после деплоя.

## План внедрения
1. Настроить репозиторий с описанной структурой и подключить GitHub Actions.
2. Создать Supabase проект и применить `schemas.sql`, затем включить RLS для таблиц.
3. Подготовить ChatGPT промпты и протестировать ответы (ротация ключа задокументирована в Notion/README).
4. Реализовать бота и edge functions с учётом политики идемпотентности.
5. Провести интеграционное тестирование на тестовом чате и WebApp (прогнать сценарии «перенос», «отчёт», «аналитика»).
6. Перенести бота на постоянный хостинг, включить ежедневные задачи и настроить оповещения Grafana/Telegram.


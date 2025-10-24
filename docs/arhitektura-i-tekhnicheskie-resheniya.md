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
| `training_sessions` | `id`, `profile_id`, `date`, `session_type`, `exercises`, `rpe`, `notes`, `status`, `trace_id`, `created_at`, `updated_at` | `uuid`, `uuid`, `date`, `text`, `jsonb`, `numeric(3,1)`, `text`, `text`, `uuid`, `timestamptz`, `timestamptz` | PK `training_sessions_pkey`, индекс по (`profile_id`, `date`) | FK `profile_id` → `profiles.id`; 1:M с `exercise_progress`, триггер обновляет `updated_at` |
| `exercise_progress` | `id`, `session_id`, `exercise_key`, `level_target`, `level_result`, `volume_target`, `volume_actual`, `rpe`, `notes`, `decision`, `streak_success`, `created_at` | `uuid`, `uuid`, `text`, `text`, `text`, `integer`, `integer`, `numeric(3,1)`, `text`, `text`, `integer`, `timestamptz` | PK `exercise_progress_pkey`, индекс `exercise_progress_session_id_key` | FK `session_id` → `training_sessions.id` |
| `metrics` | `id`, `profile_id`, `metric_type`, `value`, `recorded_at`, `source`, `unit` | `uuid`, `uuid`, `text`, `numeric`, `timestamptz`, `text`, `text` | PK `metrics_pkey`, индекс `metrics_profile_id_recorded_at_idx` | FK `profile_id` → `profiles.id` |
| `achievements` | `id`, `profile_id`, `title`, `description`, `awarded_at`, `trigger_source` | `uuid`, `uuid`, `text`, `text`, `timestamptz`, `text` | PK `achievements_pkey` | FK `profile_id` → `profiles.id` |
| `weekly_reviews` | `id`, `profile_id`, `week_start`, `summary`, `adjustments`, `created_at`, `review_score` | `uuid`, `uuid`, `date`, `jsonb`, `jsonb`, `timestamptz`, `integer` | PK `weekly_reviews_pkey`, индекс `weekly_reviews_profile_id_week_start_idx` | FK `profile_id` → `profiles.id` |
| `plan_versions` | `id`, `profile_id`, `version`, `summary`, `is_active`, `created_at`, `activated_at`, `deactivated_at` | `uuid`, `uuid`, `integer`, `jsonb`, `boolean`, `timestamptz`, `timestamptz`, `timestamptz` | Уникальный составной индекс (`profile_id`, `version`) | FK `profile_id` → `profiles.id`; 1:M c `plan_version_items` |
| `plan_version_items` | `id`, `plan_version_id`, `slot_date`, `payload`, `created_at`, `slot_status` | `uuid`, `uuid`, `date`, `jsonb`, `timestamptz`, `text` | Индекс `plan_version_items_plan_version_id_idx`, индекс по (`slot_date`, `slot_status`) | FK `plan_version_id` → `plan_versions.id` |
| `analytics_reports` | `id`, `slug`, `display_name`, `description`, `default_range`, `query_template`, `visual_type`, `category`, `created_at` | `uuid`, `text`, `text`, `text`, `daterange`, `text`, `text`, `text`, `timestamptz` | Уникальный индекс `analytics_reports_slug_key` | Используется ботом и WebApp, только чтение для `anon` |
| `analytics_cache` | `id`, `profile_id`, `report_slug`, `params_hash`, `image_url`, `payload`, `generated_at`, `expires_at` | `uuid`, `uuid`, `text`, `text`, `text`, `jsonb`, `timestamptz`, `timestamptz` | Уникальный индекс (`profile_id`, `report_slug`, `params_hash`) | FK `profile_id` → `profiles.id`; триггер удаляет протухшие записи |
| `observability_events` | `id`, `profile_id`, `category`, `severity`, `payload`, `trace_id`, `recorded_at`, `handled` | `uuid`, `uuid`, `text`, `text`, `jsonb`, `uuid`, `timestamptz`, `boolean` | Индекс `observability_events_profile_id_recorded_at_idx`, партиционирование по месяцу | FK `profile_id` → `profiles.id` (nullable) |
| `plan_version_audit` | `id`, `plan_version_id`, `actor`, `action`, `diff`, `created_at` | `uuid`, `uuid`, `text`, `text`, `jsonb`, `timestamptz` | Индекс `plan_version_audit_plan_version_id_idx` | FK `plan_version_id` → `plan_versions.id` |
| `security_events` | `id`, `profile_id`, `event_type`, `severity`, `context`, `notified_at`, `resolved_at`, `resolution_comment` | `uuid`, `uuid`, `text`, `text`, `jsonb`, `timestamptz`, `timestamptz`, `text` | Индекс `security_events_profile_id_event_type_idx` | FK `profile_id` → `profiles.id` (nullable); используется в процессе поддержки |
| `dialog_states` | `id`, `profile_id`, `state_type`, `state_payload`, `expires_at`, `updated_at` | `uuid`, `uuid`, `text`, `jsonb`, `timestamptz`, `timestamptz` | Индекс `dialog_states_profile_id_state_type_idx`, TTL контролируется job-очисткой | FK `profile_id` → `profiles.id` |
| `operation_log` | `id`, `profile_id`, `action`, `payload_hash`, `status`, `error_code`, `created_at` | `uuid`, `uuid`, `text`, `text`, `text`, `text`, `timestamptz` | Индекс `operation_log_profile_id_action_idx` | FK `profile_id` → `profiles.id` |

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
- **Миграции**: каждая новая метрика или отчёт добавляется отдельным скриптом, который сперва регистрирует запись в `analytics_reports`, затем создаёт соответствующие индексы/материализованные представления. Для `analytics_cache` используется дедупликационный уникальный индекс и job очистки, описанный в `supabase/functions/cleanup_analytics_cache.sql`.
- **RLS**: пользователи читают только свои кэши (`profile_id = auth.uid()` через маппинг в `profiles`), сервисная роль `service_role` имеет права на `insert`/`delete` для актуализации. `analytics_reports` доступен на чтение анонимному ключу, но изменение разрешено только роли `dashboard_admin`.

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
- **Параметры очереди**: допустимая глубина — 200 сообщений, обработчик извлекает максимум 10 задач за тик. Поля очереди: `id`, `task_type`, `payload`, `dedupe_key`, `attempt`, `scheduled_for`. Дедупликация — по `dedupe_key`. Retention обработанных задач — 7 дней. Метрики `pending_tasks`, `oldest_task_age` отгружаются в Grafana; при `oldest_task_age > 5 мин` включается алерт и ручной перевод задач в деградационный режим.

## Наблюдаемость и трассировка
- **Структурированный лог**: события `user_action`, `ai_decision`, `plan_change`, `analytics_rendered`, `error` записываются в Supabase `observability_events`.
- **Trace ID**: для каждого пользовательского запроса генерируется `trace_id`, который прокидывается через NLU, Edge Functions и Telegram ответы.
- **Метрики**: latency NLU, время генерации отчётов, количество откатов плана, доля ошибок.
- **Карта ошибок**: категории `external_api_failure`, `validation_error`, `timeout`, `rate_limit`. Каждой категории соответствует реакция: повтор, фолбэк на текст, уведомление пользователя.
- **Структура событий**: `observability_events` хранит `category`, `severity`, `payload`, `trace_id`, `handled`. Обязательные severity: `info`, `warning`, `critical`. Для audit-трассировок используется `plan_version_audit` (diff в формате JSON Patch) и `security_events` (описание инцидента, время уведомления, ответственный).
- **Retention**: `observability_events` партиционируется по месяцу и автоматически архивируется в S3 после 90 дней. `security_events` не очищается автоматически; закрытие инцидента требует заполнения `resolved_at` и `resolution_comment`.

## Supabase миграции, RLS и бэкапы
- **Миграции**: все изменения схемы фиксируются в `supabase/schemas.sql` и сопровождаются версионированными миграциями (`YYYYMMDDHHMM_<name>.sql`). В каждом файле перечисляются DDL-операции и связанные индексы; при необходимости создаются функции `up`/`down` для роллбэка.
- **Политики RLS**: таблицы пользовательских данных (`profiles`, `training_sessions`, `exercise_progress`, `metrics`, `weekly_reviews`, `plan_versions`, `plan_version_items`, `operation_log`, `observability_events`, `dialog_states`, `analytics_cache`, `security_events`) защищены политикой `using (auth.uid() = profile_id)` или через джойны на `profiles`. Для Edge Functions создаётся сервисная роль `service_role` с политикой `with check (true)` и ограничением на тип операции (например, только `insert` для логов и записей аудита). Анонимные ключи получают только права чтения агрегированных справочников (`capabilities`, `analytics_reports`), доступ к `plan_version_audit` и `security_events` открыт только роли `support_operator`.
- **Аудит**: триггеры `SET updated_at = now()` и логирование в `plan_version_audit` / `security_events` позволяют расследовать изменения и подозрительные действия.
- **Резервное копирование**: ежедневно в 03:00 UTC выполняется экспорт базы через `supabase db dump` в S3-бакет `supabase-backups/{env}/{date}`. Хранение — 35 дней, еженедельные снапшоты сохраняются 6 месяцев. Для критичных таблиц включается точка восстановления (PITR) с периодом удержания 7 дней. План восстановления: развернуть новый инстанс, выполнить импорт дампа, перепривязать переменные окружения.

## Промпты и контроль ChatGPT
- **Системный промпт планировщика**:
  ```
  Ты — виртуальный тренер по функциональному тренингу. Соблюдай стиль дружелюбного наставника, используй метрику RPE и структуру «разминка — основная часть — заминка». Следи за темпом (TUT) и временем отдыха. Все ответы на русском языке.
  ```
- **Шаблон пользовательского промпта**:
  ```json
  {
    "goal": "${goal}",
    "available_equipment": ["петли TRX", "турник"],
    "recent_sessions": ${history_json},
    "feedback": "${rpe_notes}",
    "constraints": {
      "max_duration_min": 45,
      "focus": "силовая выносливость"
    }
  }
  ```
- **Анализ отчетов**: системный промпт подчёркивает, что при RPE ≥ 8 необходимо снизить объём на 10–15%, при пропуске двух сессий подряд — предложить облегчённый вход и ментальное подкрепление.
- **Защита от злоупотреблений**: все промпты логируются в `observability_events` с хэшированием персональных данных. Перед отправкой запросы проходят цензуру (фильтрация оскорблений, PII) и проверку длины ≤ 4k токенов.

## Масштабирование и отказоустойчивость
- **Инфраструктурный профиль**: 2 реплики бота (актив/пассив) за балансировщиком, health-check `/healthz` каждые 30 секунд. При недоступности webhook Telegram переключается на long polling резервного инстанса.
- **Очереди**: для обработки пиковых нагрузок запросы ChatGPT кладутся в очередь Supabase Edge Functions. Максимальная длина очереди — 200 задач, метрики отслеживаются через Grafana; при превышении лимита включается деградационный режим (отправка статического плана без AI).
- **Кэширование**: Redis (или Supabase Realtime) удерживает сессии и метаданные, время ответа сокращается до < 300 мс на повторные запросы.
- **Катастрофоустойчивость**: конфигурация разворачивается через Terraform, инфраструктурные секреты хранятся в SSM/1Password. Регламент восстановления — 30 минут: поднять резервную БД из PITR, переключить бота на резервный webhook, проверить целостность очередей и повторить неуспешные операции по логам `operation_log`.

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


# Server - Training Bot Backend

Backend для персонального тренировочного помощника в Telegram.

## Структура проекта

```
server/
├── bot/                    # Telegram бот
│   ├── commands/          # Обработчики команд
│   │   ├── start.js      # /start и онбординг
│   │   ├── help.js       # /help
│   │   ├── plan.js       # /plan - планы тренировок
│   │   ├── report.js     # /report - отчёты
│   │   ├── stats.js      # /stats - статистика
│   │   └── settings.js   # /settings - настройки
│   ├── middleware/        # Middleware для бота
│   │   └── auth.js       # Аутентификация и логирование
│   └── index.js          # Главный файл бота
├── services/              # Бизнес-логика
│   ├── planner.js        # AI-планирование (OpenAI)
│   └── progression.js    # Система прогрессий
├── infrastructure/        # Внешние сервисы
│   └── supabase.js       # Клиент Supabase
├── config/                # Конфигурация
│   └── env.js            # Переменные окружения
├── supabase/              # Supabase ресурсы
│   ├── migrations/       # SQL миграции (инициализация + обновления)
│   └── functions/        # Edge Functions
│       ├── update_plan/      # Обновление плана
│       ├── notify_daily/     # Ежедневные уведомления
│       └── update_settings/  # Применение настроек
├── package.json
└── .env                  # Переменные окружения (не в git)
```

## Установка

```bash
cd server
npm install
```

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
```

Затем укажите значения переменных:

```bash
# Telegram Bot Token (от @BotFather)
TELEGRAM_BOT_TOKEN=your_token

# AI Providers
AI_ALLOWED_PROVIDERS=openai,deepseek,local
AI_DEFAULT_PROVIDER=openai

# OpenAI API Key
OPENAI_API_KEY=sk-proj-your_key
# (optional) модель OpenAI, по умолчанию gpt-5
OPENAI_MODEL=gpt-5
# (optional) несколько ключей для ротации через запятую
OPENAI_API_KEYS=sk-proj-another_key,sk-svcacct-backup_key
# (optional) базовый URL или прокси (например, OpenRouter)
OPENAI_API_BASE_URL=https://api.openai.com/v1
# (optional) организация и проект для сервис-аккаунтов
OPENAI_ORG=org-abc123
OPENAI_PROJECT=proj_xyz # значение должно совпадать с идентификатором вида proj_*
# (optional) кеширование ответов (миллисекунды)
OPENAI_CACHE_TTL_MS=120000
# (optional) ограничение параллелизма и повторов OpenAI-запросов
OPENAI_MAX_CONCURRENCY=1
OPENAI_MIN_INTERVAL_MS=800
OPENAI_MAX_RETRIES=3
OPENAI_RETRY_INITIAL_DELAY_MS=1000

# DeepSeek (альтернативный провайдер)
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1
# (optional) ограничьте доступ конкретными аккаунтами
TELEGRAM_ALLOWED_IDS=123456789,987654321

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# App settings
NODE_ENV=development
PORT=3000
WEBAPP_URL=https://your-webapp-hosting.example
```

## Запуск

### Разработка (с hot-reload)
```bash
npm run dev
```

### Разработка с туннелем для WebApp

Скрипт запустит WebApp, поднимет ngrok-туннель и пробросит адрес в переменную `WEBAPP_URL`, чтобы кнопка `/webapp` открывала панель.

```bash
npm run dev:tunnel
```

Требуется установленный CLI ngrok и авторизация (`ngrok config add-authtoken <TOKEN>`).

### Продакшн
```bash
npm start
```

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Начало работы и онбординг |
| `/help` | Справка по возможностям |
| `/plan` | Показать план тренировок |
| `/setup` | Перезапустить настройки целей и оборудования |
| `/report` | Отчитаться о тренировке |
| `/stats` | Посмотреть прогресс |
| `/settings` | Настройки уведомлений |
| `/menu` | Вернуться в главное меню |

## Архитектура

### Поток обработки сообщения

```
Telegram → Bot → Middleware → Command Handler → Service → Supabase
                      ↓
                 [auth, logging, error handling]
```

### Middleware

1. **errorMiddleware** — глобальная обработка ошибок
2. **loggingMiddleware** — логирование всех действий
3. **authMiddleware** — создание/проверка профиля и фильтр по `TELEGRAM_ALLOWED_IDS`
4. **dialogStateMiddleware** — управление состоянием диалога

### Сервисы

#### PlannerService (`services/planner.js`)
- Генерация тренировочных планов через OpenAI (по умолчанию gpt-4o-mini)
- Анализ отчётов о тренировках
- Мотивационные сообщения

#### ConversationService (`services/conversation.js`)
- Ответы на свободный текст с помощью OpenAI
- Используется как fallback, когда правило-интент не найден

#### ProgressionService (`services/progression.js`)
- Расчёт прогрессий упражнений
- Принятие решений: advance/hold/regress
- Анализ трендов прогресса

#### Static plan helpers (`services/staticPlan.js`)
- Статические прогрессии и советы по технике
- Каталог упражнений для WebApp и fallback-планов

HTTP API дополняется маршрутом `/v1/exercises/*`, который отдаёт каталог прогрессий и историю выполнения.
Для запросов из WebApp необходимо передавать заголовок `X-Telegram-Init-Data` — подпись проверяется в middleware.

### База данных

#### Основные таблицы

- `profiles` — профили пользователей
- `training_sessions` — тренировки
- `exercise_progress` — прогресс по упражнениям
- `metrics` — метрики (adherence, RPE)
- `plan_versions` — версии планов
- `dialog_states` — состояния диалогов
- `operation_log` — логи операций
- `observability_events` — события для мониторинга

#### Миграции

Применить миграции:
1. Откройте Supabase Dashboard → SQL Editor
2. Выполните `server/supabase/migrations/20240101000000_initial_schema.sql`

## Edge Functions

### update_plan
Обновляет тренировочный план на основе прогресса.

Deploy:
```bash
supabase functions deploy update_plan
```

### notify_daily
Отправляет ежедневные уведомления о тренировках.

Deploy:
```bash
supabase functions deploy notify_daily
```

### update_settings
Применяет изменения настроек профиля и управляет паузой уведомлений.

Deploy:
```bash
supabase functions deploy update_settings
```

Запуск локально (пример для update_plan):
```bash
supabase functions serve update_plan --env-file ../.env.local
```

Настройка cron:
```sql
SELECT cron.schedule(
  'daily-notifications',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    'https://your-project.supabase.co/functions/v1/notify_daily',
    '{}',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}'
  );
  $$
);
```

## Логирование

Все события логируются в:
- Консоль (для разработки)
- `operation_log` (действия пользователя)
- `observability_events` (системные события)

Уровни severity:
- `info` — обычные события
- `warning` — предупреждения
- `critical` — критические ошибки

## Тестирование

```bash
npm test
```

## Деплой

### Railway
1. Подключите GitHub репозиторий
2. Root directory: `server/`
3. Build command: `npm install`
4. Start command: `npm start`
5. Добавьте environment variables

### Render
1. New Web Service → GitHub repo
2. Root directory: `server`
3. Build: `npm install`
4. Start: `npm start`
5. Environment variables → Add from .env

### Vercel (Serverless)
```bash
vercel --prod
```

## Мониторинг

### Логи

```bash
# Вывод логов в реальном времени
npm run dev

# Логи в Supabase
# Dashboard → Logs → Edge Functions
```

### Метрики

Отслеживайте в Supabase:
- `operation_log` — действия пользователей
- `observability_events` — системные события
- `metrics` — бизнес-метрики

## Отладка

### Проверка подключения к Supabase

```javascript
import { supabase } from './infrastructure/supabase.js';

const { data, error } = await supabase.from('profiles').select('count');
console.log('Profiles count:', data);
```

### Проверка OpenAI

```javascript
import { PlannerService } from './services/planner.js';

const result = await plannerService.generateTrainingPlan({
  goals: { primary: 'strength' },
  equipment: ['pullup bar'],
  recentSessions: [],
  constraints: { maxDuration: 45 }
});

console.log('Generated plan:', result);
```

## Конфигурация OpenAI

### Модели
- **По умолчанию**: `gpt-4o-mini` — баланс качества и стоимости, поддерживает быстрые ответы
- **Альтернативы**: `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo` и другие совместимые модели (переопределите через `OPENAI_MODEL`)

### Лимиты
- Троттлинг: 1 запрос/сек
- Timeout: 30 сек
- Retry: 3 попытки с экспоненциальной задержкой

### Стоимость (примерная)
- gpt-4o-mini: ≈$0.0006 за генерацию плана (~4K токенов)
- Месячный расчёт: 30 планов × $0.0006 ≈ $0.02 на пользователя

## Безопасность

- ✅ Все секреты в переменных окружения
- ✅ Row Level Security в Supabase
- ✅ Аутентификация через Telegram ID
- ✅ Валидация всех входных данных
- ✅ Rate limiting на API

## Производительность

- Среднее время ответа: < 2 сек
- OpenAI запросы: 5-15 сек
- Database queries: < 500 мс

## Troubleshooting

### Бот не отвечает

1. Проверьте логи: `npm run dev`
2. Проверьте TELEGRAM_BOT_TOKEN
3. Проверьте подключение к интернету

### Ошибки Supabase

1. Проверьте SUPABASE_URL и SUPABASE_SERVICE_KEY
2. Проверьте миграции: применены ли все таблицы?
3. Проверьте RLS policies

### Ошибки OpenAI

1. Проверьте OPENAI_API_KEY
2. Проверьте баланс: [platform.openai.com/usage](https://platform.openai.com/usage)
3. Проверьте лимиты rate limit

## Поддержка

Вопросы и проблемы: [GitHub Issues](https://github.com/your-repo/issues)

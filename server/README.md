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
│   ├── migrations/       # SQL миграции
│   │   └── 20240101000000_initial_schema.sql
│   └── functions/        # Edge Functions
│       ├── update_plan/  # Обновление плана
│       └── notify_daily/ # Ежедневные уведомления
├── package.json
└── .env                  # Переменные окружения (не в git)
```

## Установка

```bash
npm install
```

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

```bash
# Telegram Bot Token (от @BotFather)
TELEGRAM_BOT_TOKEN=your_token

# OpenAI API Key
OPENAI_API_KEY=sk-proj-your_key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# App settings
NODE_ENV=development
PORT=3000
```

## Запуск

### Разработка (с hot-reload)
```bash
npm run dev
```

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
| `/report` | Отчитаться о тренировке |
| `/stats` | Посмотреть прогресс |
| `/settings` | Настройки уведомлений |

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
3. **authMiddleware** — создание/проверка профиля
4. **dialogStateMiddleware** — управление состоянием диалога

### Сервисы

#### PlannerService (`services/planner.js`)
- Генерация тренировочных планов через OpenAI GPT-4
- Анализ отчётов о тренировках
- Мотивационные сообщения

#### ProgressionService (`services/progression.js`)
- Расчёт прогрессий упражнений
- Принятие решений: advance/hold/regress
- Анализ трендов прогресса

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
- **Рекомендуется**: `gpt-4` (лучшее качество)
- **Альтернатива**: `gpt-3.5-turbo` (дешевле, но ниже качество)

### Лимиты
- Троттлинг: 1 запрос/сек
- Timeout: 30 сек
- Retry: 3 попытки с экспоненциальной задержкой

### Стоимость (примерная)
- GPT-4: ~$0.03 за запрос (генерация плана)
- Месячный расчёт: 30 планов × $0.03 = ~$1/месяц на пользователя

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


# Server - Training Bot Backend

Backend для персонального тренировочного помощника в Telegram.

## Структура проекта

```
server/
├── bot/                    # Telegram бот
│   ├── commands/          # Обработчики команд (/start, /plan, /report, ...)
│   ├── middleware/        # Аутентификация, логирование, состояние диалога
│   ├── services/          # Фоновые задачи бота
│   │   └── inactivityMonitor.js
│   └── index.js           # Точка входа бота
├── services/              # Бизнес-логика
│   ├── internalAssistantEngine.js  # Встроенный движок ответов и планов
│   ├── planner.js         # Публичный API планировщика (обёртка над движком)
│   ├── conversation.js    # Генерация ответов в чате (движок + fallback)
│   ├── localResponder.js  # Шаблоны быстрых ответов без сложной логики
│   ├── nlu.js             # Простая NLU-матрица (интенты и словари)
│   └── history.js         # Унифицированное хранилище истории диалога
├── infrastructure/        # Интеграции и клиенты внешних сервисов
│   └── supabase.js        # Клиент Supabase
├── config/                # Конфигурация окружения
│   └── env.js             # Парсинг .env и проверка обязательных переменных
├── supabase/              # Supabase ресурсы (SQL, Edge Functions)
│   ├── migrations/        # Миграции базы данных
│   └── functions/         # Edge Functions (`update_plan`, `notify_daily`, `update_settings`)
├── package.json
└── .env                   # Переменные окружения (не коммитится)
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

Минимально необходимый набор:

```bash
# Telegram Bot Token (от @BotFather)
TELEGRAM_BOT_TOKEN=your_token
# (опционально) ограничьте доступ конкретными аккаунтами
TELEGRAM_ALLOWED_IDS=123456789,987654321

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# Приложение
NODE_ENV=development
PORT=3000
WEBAPP_URL=https://your-webapp-hosting.example

# Настройка внутренних порогов мотивации (опционально)
ASSISTANT_SUCCESS_THRESHOLD=75
ASSISTANT_SLUMP_THRESHOLD=45
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

| Команда   | Описание                             |
|-----------|--------------------------------------|
| `/start`  | Начало работы и онбординг            |
| `/help`   | Справка по возможностям              |
| `/plan`   | Показать план тренировок             |
| `/setup`  | Перезапустить настройки целей        |
| `/report` | Отчитаться о тренировке              |
| `/stats`  | Посмотреть прогресс                  |
| `/settings` | Настройки уведомлений              |
| `/menu`   | Вернуться в главное меню             |

## Архитектура

### Поток обработки сообщения

```
Telegram → Bot → Middleware → Command Handler → Services → Supabase
                      ↓
                 [auth, logging, state]
```

### Middleware

1. **errorMiddleware** — глобальная обработка ошибок
2. **loggingMiddleware** — логирование всех действий
3. **authMiddleware** — создание/проверка профиля и фильтр по `TELEGRAM_ALLOWED_IDS`
4. **dialogStateMiddleware** — управление историей диалога (макс. 12 сообщений, TTL 48 ч.)

### Фоновые задачи

- `inactivityMonitor` (`bot/services/inactivityMonitor.js`) каждые 5 минут проверяет неактивные диалоги, отправляет прощальное сообщение и очищает историю спустя 60 минут простоя.

### Сервисы

#### internalAssistantEngine (`services/internalAssistantEngine.js`)
- Интерпретация команд и построение structured-ответов
- Генерация планов, анализ отчётов, мотивационные сообщения
- Правила приветствий, восстановление, напоминания и fallback-тон

#### PlannerService (`services/planner.js`)
- Публичный API для бота и WebApp
- Возвращает текстовые и структурированные планы без внешних API

#### ConversationService (`services/conversation.js`)
- Определяет, нужен ли тренерский тон или свободный ответ
- Использует движок, а при необходимости обращается к `localResponder`

#### HistoryService (`services/history.js`)
- Унифицированные функции загрузки и сохранения истории (`loadAssistantHistory`, `persistAssistantTurn`)
- Наполняет метаданные (`last_user_message_at`, счётчики сообщений), которые используют bot и HTTP API

#### Assistant API (`api/routes/assistant.js`)
- `POST /v1/assistant/reply` — получить ответ движка (без Telegram) и при необходимости записать его в историю
- `GET /v1/assistant/notes`, `POST /v1/assistant/notes` — работа с заметками (`assistant_notes`) через WebApp/интеграции

#### Supabase Edge Function `update_plan`
- Получает профиль, свежие сессии и причину обновления
- Собирает план неделя/по умолчанию тем же движком и сохраняет версию в БД

## Логирование и отладка

- Все запросы получают `traceId` (передаётся в Supabase и Edge Functions)
- `observability_events` фиксирует ключевые действия (обновление настроек, генерация планов)
- Для отладки запустите `npm run dev` и смотрите консольные логи

## Полезные команды

```bash
# Линтинг
npm run lint

# Тесты (Node.js test runner)
npm test

# Edge Function локально
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... TELEGRAM_BOT_TOKEN=... \
  npx supabase functions serve update_plan
```

## Заметки по безопасности

- Переменные `SUPABASE_SERVICE_KEY` и `TELEGRAM_BOT_TOKEN` обязательны и не должны попадать в git
- `authMiddleware` проверяет allowlist и создаёт профиль в Supabase при первом запуске
- `dialogStateMiddleware` обнуляет историю при ошибках, чтобы не утекали личные данные

## Документация

- [Внутренний движок тренера](../docs/dvizhok-trenera.md)
- [Правила диалогов](../docs/pravila-trenera-i-dialoga.md)
- [Архитектура и технические решения](../docs/arhitektura-i-tekhnicheskie-resheniya.md)
- [Схема API](../docs/api-schema.md)

---

**Сервер не требует внешних ключей AI — все ответы строятся локально.**

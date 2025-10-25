# API Training Area — Справочник эндпоинтов

Документ описывает публичные REST-эндпоинты, которые использует Telegram WebApp и внешние интеграции. Все запросы выполняются к `https://<your-host>/v1/*` и требуют передачи заголовка `X-Telegram-Id` со значением `telegram_id` пользователя (или `X-Profile-Id` с UUID профиля).

## Общие требования

- `Content-Type: application/json`
- Аутентификация: заголовок `Authorization: Bearer <jwt>` (опционально) + идентификатор пользователя (`X-Telegram-Id` или `X-Profile-Id`).
- В ответах всегда возвращается `x-trace-id` — идентификатор запроса для трассировки в Supabase.
- Ошибки имеют структуру:

```json
{
  "error": "validation_failed",
  "message": "Некорректные данные",
  "issues": [ ... ],
  "trace_id": "..."
}
```

## Endpoints

### `GET /v1/profile/summary`

Возвращает базовую информацию о профиле и агрегированные метрики.

**Response 200**

```json
{
  "profile": {
    "id": "uuid",
    "notification_time": "06:30:00",
    "timezone": "Europe/Moscow",
    "preferences": {"training_frequency": 4},
    "notifications_paused": false
  },
  "adherence": {
    "window": "30d",
    "total_sessions": 12,
    "completed_sessions": 9,
    "adherence_percent": 75
  },
  "metrics": [
    {
      "id": "uuid",
      "metric_type": "training_completed",
      "value": 1,
      "recorded_at": "2024-03-30T18:01:00+00:00"
    }
  ]
}
```

### `PATCH /v1/profile/preferences`

Обновляет время уведомлений и часовой пояс. Все поля опциональны.

**Request**

```json
{
  "notification_time": "07:30",
  "timezone": "Europe/Moscow",
  "notifications_paused": false
}
```

**Responses**

- `200 OK` — изменения применены.
- `400 invalid_payload` — тело пустое.
- `409 conflict_with_existing_pause` — дата паузы уже истекла.

### `GET /v1/sessions/today`

Возвращает подробный план текущей тренировки. Если в базе данных нет записей, используется статический план по умолчанию.

**Response 200**

```json
{
  "session": {
    "id": "uuid",
    "date": "2024-03-31",
    "session_type": "Верх тела",
    "exercises": [
      {
        "exercise_key": "pullups",
        "name": "Подтягивания",
        "target": {"sets": 4, "reps": 6},
        "notes": "Локти направлены вниз"
      }
    ],
    "status": "planned",
    "rpe": 7
  },
  "source": "database"
}
```

### `GET /v1/sessions/week?date=2024-03-31`

Возвращает все тренировки недели (понедельник–воскресенье) относительно переданной даты.

### `GET /v1/sessions/{id}`

Подробная информация по конкретной тренировке. Ошибки: `404 session_not_found`, `403 forbidden`.

### `PUT /v1/sessions/{id}`

Обновляет статус тренировки и фактические показатели. Поля `status`, `rpe`, `notes` и `exercises` опциональны.

**Request**

```json
{
  "status": "done",
  "completed_at": "2024-03-31T18:34:00+03:00",
  "rpe": 7.5,
  "exercises": [
    {
      "exercise_key": "pullups",
      "actual": {"sets": 4, "reps": 7},
      "notes": "Последний подход дался тяжело"
    }
  ]
}
```

**Response 200**

```json
{
  "success": true,
  "session": { ...updated session... },
  "decision": "advance|hold|regress|adjust_focus",
  "next_steps": "Текстовая рекомендация"
}
```

Ошибки: `422 validation_failed`, `404 session_not_found`, `403 forbidden`.

### `GET /v1/reports/volume_trend?range=30d`

Возвращает динамику объёма тренировок в заданном диапазоне. Диапазон — `7d`, `30d`, `12w` и т.п.

**Response 200**

```json
{
  "report": "volume_trend",
  "range": "30d",
  "chart": [
    {"date": "2024-03-20", "volume": 180, "status": "done"}
  ],
  "summary": {
    "total_volume": 1240,
    "average_volume": 177,
    "period_sessions": 7
  },
  "generated_at": "2024-03-31T18:05:00.000Z"
}
```

### `GET /v1/reports/rpe_distribution?range=30d`

Распределение тренировок по субъективной нагрузке. Возвращает массив сегментов и краткое summary.

### `GET /v1/achievements`

Список последних достижений пользователя (до 10 записей).

**Response 200**

```json
{
  "achievements": [
    {
      "id": "uuid",
      "title": "Первая неделя",
      "description": "Выполнено 3 тренировки подряд",
      "awarded_at": "2024-03-28T10:00:00+00:00"
    }
  ]
}
```

### `GET /v1/exercises/catalog`

Каталог прогрессий упражнений с последней отметкой пользователя (если есть данные).

**Response 200**

```json
{
  "items": [
    {
      "key": "pullups",
      "title": "Подтягивания",
      "focus": "Спина и хват",
      "description": "10-ступенчатая прогрессия от вертикальной тяги до подтягиваний на одной руке.",
      "cue": "Локти направлены вниз, корпус жёсткий.",
      "levels": [
        { "id": "1.1", "title": "Вертикальные подтягивания", "sets": 1, "reps": 10 },
        { "id": "1.2", "title": "Вертикальные подтягивания", "sets": 2, "reps": 20 }
      ],
      "latest_progress": {
        "level": "3.2",
        "decision": "advance",
        "session_date": "2024-03-28",
        "updated_at": "2024-03-28T19:32:04.125Z"
      }
    }
  ],
  "generated_at": "2024-03-31T20:00:00.000Z"
}
```

### `GET /v1/exercises/{exerciseKey}/history`

История прогрессии конкретного упражнения (до 20 записей).

**Response 200**

```json
{
  "exercise": "pullups",
  "items": [
    {
      "session_date": "2024-03-28",
      "level_target": "3.2",
      "level_result": "3.3",
      "volume_target": 30,
      "volume_actual": 36,
      "rpe": 7,
      "decision": "advance",
      "notes": "Готов перейти на усложнение",
      "recorded_at": "2024-03-28T19:32:04.125Z"
    }
  ]
}
```

---

Все перечисленные эндпоинты покрываются логированием в таблицу `observability_events` (категории: `plan_viewed`, `session_marked_done`, `preferences_updated`, `report_requested`, `achievements_viewed`). Ошибки следует инспектировать по `trace_id`.

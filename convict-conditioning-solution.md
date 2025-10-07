# Дневник прогрессии по системе Пола Уэйда — Полное решение

## 1) Схема листов и таблиц (подробно, с примерами строк)

### 1.1 Справочник_Уровней
- **Назначение:** единый реестр прогрессии для всех 6 движений.
- **Диапазон:** `A:E`, строки начиная со 2-й зарезервированы под данные.
- **Настройки:**
  - Колонки `Уровень`, `Подходы_план`, `Повторы_план` — защитить от редактирования пользователями без прав администратора.
  - Формат колонки `Уровень` — *Plain text*. Вводить уровни как `'1.1` (апостроф подавляет автопревращение в дату).
  - Data validation для `Упражнение`: выпадающий список `{"Подтягивания";"Приседания";"Отжимания";"Подъёмы ног";"Мостик";"Отжимания в стойке"}`.
- **Структура колонок:**
  1. `Упражнение` (список из 6 движений).
  2. `Уровень` (Plain text `X.Y`).
  3. `Название уровня` (строка).
  4. `Подходы_план` (целое число ≥1).
  5. `Повторы_план` (целое число ≥1).
- **Пример данных:**

| Упражнение | Уровень | Название уровня | Подходы_план | Повторы_план |
|------------|---------|-----------------|--------------|--------------|
| Подтягивания | 1.1 | Вис на турнике | 3 | 10 |
| Подтягивания | 2.1 | Горизонтальные подтягивания | 2 | 15 |
| Подтягивания | 3.2 | Австралийские подтягивания | 3 | 8 |
| Приседания | 1.1 | Стульчик у стены | 3 | 10 |
| Приседания | 2.2 | Полуприсед | 3 | 12 |
| Приседания | 3.1 | Полупистолет | 2 | 8 |
| Отжимания | 1.1 | Отжимания от стены | 3 | 20 |
| Отжимания | 2.1 | Отжимания от колен | 3 | 15 |
| Отжимания | 3.2 | Наклонные отжимания | 3 | 12 |
| Подъёмы ног | 1.1 | Скручивания лёжа | 3 | 20 |
| Подъёмы ног | 2.2 | Подъёмы колен сидя | 3 | 15 |
| Подъёмы ног | 3.1 | Висящие подъёмы колен | 3 | 10 |
| Мостик | 1.1 | Мостик на полу | 3 | 5 |
| Мостик | 2.2 | Полумостик | 3 | 8 |
| Мостик | 3.1 | Мостик с опорой | 2 | 10 |
| Отжимания в стойке | 1.1 | Лягушка | 3 | 30 |
| Отжимания в стойке | 2.1 | Лягушка с подъёмом | 3 | 20 |
| Отжимания в стойке | 3.2 | Отжимания у стены | 2 | 8 |

*(Добавьте остальные уровни до 10.3 по мере необходимости; структура едина.)*

### 1.2 Программа_Недели
- **Назначение:** ручной шаблон «идеальной» недели (6 тренировочных дней × 2 движения/день).
- **Диапазон:** `A:I`.
- **Колонки и типы:**
  1. `День` (текст: Пн, Вт, Ср, Чт, Пт, Сб; можно добавить Вс для активного восстановления).
  2. `Упр1` (список 6 движений — валидация).
  3. `Уровень1` (Plain text `X.Y`).
  4. `Упр2`.
  5. `Уровень2`.
  6. `Название уровня1` (формула, авто).
  7. `Подходы1` (формула, авто).
  8. `Повторы1` (формула, авто).
  9. `Название уровня2` (формула, авто).
  10. `Подходы2` (формула, авто).
  11. `Повторы2` (формула, авто).
- **Пример строк:**

| День | Упр1 | Уровень1 | Упр2 | Уровень2 | Название уровня1 | Подходы1 | Повторы1 | Название уровня2 | Подходы2 | Повторы2 |
|------|------|----------|------|----------|-------------------|----------|----------|-------------------|----------|----------|
| Пн | Подтягивания | 2.1 | Приседания | 2.2 | (формула) | (формула) | (формула) | (формула) | (формула) | (формула) |
| Вт | Отжимания | 2.1 | Подъёмы ног | 2.2 | ... | ... | ... | ... | ... | ... |
| Ср | Мостик | 2.2 | Отжимания в стойке | 1.1 | ... | ... | ... | ... | ... | ... |

### 1.3 План_Недели
- **Назначение:** конкретные даты и задания, генерируемые скриптом.
- **Диапазон:** `A:H`.
- **Колонки:**
  1. `Дата` (формат дата).
  2. `ДеньНедели` (формула `=TEXT(A2;"ДДДД")`).
  3. `Упражнение` (текст, из программы).
  4. `Уровень` (Plain text `X.Y`).
  5. `Название уровня` (формула/скрипт).
  6. `Подходы_план` (число).
  7. `Повторы_план` (число).
  8. `Статус` (data validation: `запланировано`, `выполнено`, `пропущено`).
  9. `ID_Плана` (формула/скрипт, уникальный текст).
- **ID_Плана:** формат `yyyymmdd-<код>`, где `<код>` — первые 3 буквы упражнения (латиницей) + номер в дне (1/2). Например: `20240101-Pod1`.
- **Защита:** колонки `Дата`, `ДеньНедели`, `Упражнение`, `Уровень`, `Название уровня`, `Подходы_план`, `Повторы_план`, `ID_Плана` — защищённые; пользователи редактируют только `Статус`.

### 1.4 Журнал
- **Назначение:** фактические записи тренировок.
- **Диапазон:** `A:N`.
- **Колонки:**
  1. `Дата` (дата).
  2. `Время` (время, опционально).
  3. `ID_Плана` (Plain text, опц.).
  4. `Упражнение` (валидация).
  5. `Уровень` (Plain text `X.Y`).
  6. `Название уровня` (формула).
  7. `Подходы_план` (формула).
  8. `Повторы_план` (формула).
  9. `Сеты` (текст, формат «10,10,8»).
  10. `Объём_факт` (формула суммирования сетов).
  11. `RPE` (целое 1–10) либо `Сложность` (альтернативный список: `легко`, `норма`, `тяжело`).
  12. `Отдых_сек` (число, опц.).
  13. `Примечание` (текст).
  14. `Итог` (валидация: `выполнено`, `перевыполнено`, `не выполнено`).
  15. `Решение_прогрессии` (заполняется скриптом или формулой; значения: `держать`, `вверх`, `делоад`).
- **Пример строк:**

| Дата | Время | ID_Плана | Упражнение | Уровень | Название уровня | Подходы_план | Повторы_план | Сеты | Объём_факт | RPE | Отдых_сек | Примечание | Итог | Решение_прогрессии |
|------|-------|----------|------------|---------|-----------------|--------------|--------------|------|------------|-----|-----------|------------|------|---------------------|
| 2024-01-01 | 07:30 | 20240101-Pod1 | Подтягивания | 2.1 | Горизонтальные подтягивания | 2 | 15 | 15,14 | 29 | 7 | 90 | Чисто | выполнено | держать |

### 1.5 Тесты_Прогрессии
- **Диапазон:** `A:E`.
- **Колонки:**
  1. `Дата` (дата теста).
  2. `Упражнение`.
  3. `Пытался_уровень` (Plain text `X.Y`).
  4. `Результат` (валидация: `сдал`, `не сдал`).
  5. `Следующий_уровень_рекоменд` (Plain text `X.Y`).
- **Пример:** `2024-01-05 | Подтягивания | 3.1 | сдал | 3.2`.

### 1.6 Профиль
- **Назначение:** текущие уровни по каждому движению.
- **Диапазон:** `A:E`.
- **Колонки:**
  1. `Упражнение` (валидация).
  2. `Текущий_уровень` (Plain text `X.Y`).
  3. `Дата_последней_сессии` (дата).
  4. `Срывов_подряд` (число ≥0).
  5. `Рекомендация` (валидация: `держать`, `вверх`, `делоад`).
- **Пример:** `Подтягивания | 2.1 | 2024-01-01 | 0 | держать`.

### 1.7 Метрики / Дашборды
- **Рекомендуемые вкладки:**
  1. `Метрики_Текущие`: сводная таблица по `Профиль` (уровень, рекомендация).
  2. `Метрики_Прогресс`: график изменения `Уровень` во времени (см. формулы далее).
  3. `Метрики_Объём`: сводка `SUM(Объём_факт)` по неделям.
  4. `Метрики_Комплаенс`: показатель `выполнено / запланировано`.
  5. `Heatmap_Пропуски`: сводная по `План_Недели` с цветовым форматированием по `Статус`.

## 2) Формулы для вычисляемых полей

### 2.1 Программа_Недели
Используйте `INDEX(FILTER(...))` (совместимо с русской локалью):
```
=IFERROR(INDEX(FILTER(Справочник_Уровней!$C:$C;Справочник_Уровней!$A:$A=$B2;Справочник_Уровней!$B:$B=$C2));"")
```
- Для `Подходы1`: замените диапазон на `Справочник_Уровней!$D:$D`.
- Для `Повторы1`: на `Справочник_Уровней!$E:$E`.
- Для второй пары (`Упр2`/`Уровень2`) аналогично с соответствующими ячейками (`D2`, `E2`, `H2`, `I2`).

Если доступен `XLOOKUP` (англ. локаль):
```
=XLOOKUP(1;(Справочник_Уровней!$A:$A=$B2)*(Справочник_Уровней!$B:$B=$C2);Справочник_Уровней!$C:$C;"")
```

### 2.2 План_Недели
- `ДеньНедели` (русская локаль):
```
=TEXT(A2;"ДДДД")
```
- `ID_Плана` (формула, если не через скрипт):
```
=TEXT(A2;"yyyymmdd")&"-"&LEFT(TRANSLIT(C2);3)&ROW(A2)-ROW($A$1)
```
Если используете Apps Script, ID создаётся там (см. код).

### 2.3 Журнал
- `Название уровня`:
```
=IF($E2="";"";IFERROR(INDEX(FILTER(Справочник_Уровней!$C:$C;Справочник_Уровней!$A:$A=$D2;Справочник_Уровней!$B:$B=$E2));""))
```
- `Подходы_план` и `Повторы_план`: замените результатный диапазон на `Справочник_Уровней!$D:$D` и `$E:$E`.
- `Объём_факт` (русская локаль с `;`):
```
=IF($I2="";"";SUM(ARRAYFORMULA(VALUE(SPLIT($I2;",")))))
```
Англ. локаль (`,`): `=IF($I2="","",SUM(ARRAYFORMULA(VALUE(SPLIT($I2,",")))))`.
- `Решение_прогрессии` (формула-черновик, если без скрипта):
```
=IF($L2="перевыполнено";"вверх";IF($L2="не выполнено";"делоад";"держать"))
```
(В проде замените на поле, заполняемое скриптом.)

### 2.4 Метрики
- **Скорость прогресса:** используйте вспомогательный столбец, разбивая `X.Y` на Major/Minor:
```
=VALUE(LEFT($E2;FIND(".";$E2)-1)) + VALUE(RIGHT($E2;LEN($E2)-FIND(".";$E2))) / 10
```
- Затем создайте сводную таблицу по `Журналу`, группируя по неделе (`=ISOWeekNum(Дата)`) и вычисляя `MAX(конвертированное значение)` — разница между неделями даёт Δ подуровней.
- **Комплаенс:**
```
=COUNTIF(План_Недели!$H:$H;"выполнено") / COUNTIF(План_Недели!$H:$H;"<>""")
```
- **Объём по неделям:** создайте сводную `Rows: Неделя`, `Values: SUM Объём_факт`.
- **Тепловая карта:** условное форматирование: если `Статус="пропущено"` → красный; `выполнено` → зелёный.

### 2.5 Валидация уровней
- Для зависимых списков (чистый Sheets): создайте именованный диапазон для каждого упражнения (например, `Уровни_Подтягивания`) и используйте `INDIRECT`.
- Через Apps Script: см. раздел FAQ (функция `setDependentValidation`).

## 3) Полный код Google Apps Script
```javascript
/**
 * Convict Conditioning Progression Tracker
 * Web App (REST API) for Google Sheets backend.
 */

// ====== Константы ======
const CONFIG = {
  SPREADSHEET_ID: SpreadsheetApp.getActive().getId(),
  SHEETS: {
    LEVELS: 'Справочник_Уровней',
    WEEK_TEMPLATE: 'Программа_Недели',
    WEEK_PLAN: 'План_Недели',
    LOG: 'Журнал',
    TESTS: 'Тесты_Прогрессии',
    PROFILE: 'Профиль'
  },
  API_KEY: PropertiesService.getScriptProperties().getProperty('API_KEY'),
  HEADER_API_KEY: 'X-API-Key',
  STATUS_VALUES: ['запланировано', 'выполнено', 'пропущено'],
  PROGRESSION_DECISIONS: ['держать', 'вверх', 'делоад']
};

const EXERCISE_CODES = {
  'Подтягивания': 'Pod',
  'Приседания': 'Pri',
  'Отжимания': 'Otg',
  'Подъёмы ног': 'Nog',
  'Мостик': 'Mos',
  'Отжимания в стойке': 'Stk'
};

// ====== Утилиты ======
function respond(status, payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON)
    .setResponseCode(status);
}

function parseJson(body) {
  try {
    return JSON.parse(body || '{}');
  } catch (e) {
    throw createError(400, 'Invalid JSON payload', e.message, 'Проверьте синтаксис JSON.');
  }
}

function createError(code, message, details, hint) {
  return { code, message, details, hint };
}

function ensureApiKey(e) {
  const key = e?.parameter?.key || e?.parameter?.apiKey || e?.headers?.[CONFIG.HEADER_API_KEY] || e?.postData?.headers?.[CONFIG.HEADER_API_KEY];
  if (!CONFIG.API_KEY) {
    return; // режим A (OAuth) — проверка не нужна, доступ через авторизацию владельца.
  }
  if (!key || key !== CONFIG.API_KEY) {
    throw createError(401, 'Unauthorized', 'Missing or invalid API key', `Передайте заголовок ${CONFIG.HEADER_API_KEY}`);
  }
}

function getSheet(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) {
    throw createError(500, 'Sheet not found', name, 'Проверьте наличие листа');
  }
  return sheet;
}

function readTable(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.filter(row => row.some(v => v !== '')).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
}

function appendRow(sheetName, rowObj) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => rowObj[h] ?? '');
  sheet.appendRow(row);
}

function getLevelMap() {
  const rows = readTable(CONFIG.SHEETS.LEVELS);
  const map = {};
  rows.forEach(r => {
    const key = `${r['Упражнение']}|${String(r['Уровень'])}`;
    map[key] = r;
  });
  return map;
}

function sanitizeLevel(level) {
  if (typeof level !== 'string') level = String(level);
  const trimmed = level.trim();
  if (!/^\d+\.\d+$/.test(trimmed)) {
    throw createError(400, 'Invalid level format', level, 'Используйте X.Y (например, 4.2)');
  }
  return trimmed;
}

function nextSublevel(level) {
  const [major, minor] = level.split('.').map(Number);
  if (minor < 3) {
    return `${major}.${minor + 1}`;
  }
  return `${major + 1}.1`;
}

function previousSublevel(level) {
  const [major, minor] = level.split('.').map(Number);
  if (minor > 1) {
    return `${major}.${minor - 1}`;
  }
  return `${Math.max(major - 1, 1)}.3`;
}

function getPlanId(date, exercise, index) {
  const code = EXERCISE_CODES[exercise] || exercise.substring(0, 3);
  return `${Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyyMMdd')}-${code}${index}`;
}

function updatePlanStatusById(id, status) {
  if (!id) return;
  const sheet = getSheet(CONFIG.SHEETS.WEEK_PLAN);
  const range = sheet.getDataRange();
  const values = range.getValues();
  const statusCol = values[0].indexOf('Статус');
  const idCol = values[0].indexOf('ID_Плана');
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === id) {
      sheet.getRange(i + 1, statusCol + 1).setValue(status);
      break;
    }
  }
}

function updateProfileFromLog(entry) {
  const sheet = getSheet(CONFIG.SHEETS.PROFILE);
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  const exerciseCol = headers.indexOf('Упражнение');
  const levelCol = headers.indexOf('Текущий_уровень');
  const lastDateCol = headers.indexOf('Дата_последней_сессии');
  const streakCol = headers.indexOf('Срывов_подряд');
  const recCol = headers.indexOf('Рекомендация');
  const decision = entry['Решение_прогрессии'];

  for (let i = 1; i < values.length; i++) {
    if (values[i][exerciseCol] === entry['Упражнение']) {
      const newValues = [];
      const row = i + 1;
      if (decision === 'вверх') {
        const next = nextSublevel(entry['Уровень']);
        newValues.push({ col: levelCol + 1, value: next });
        newValues.push({ col: streakCol + 1, value: 0 });
        newValues.push({ col: recCol + 1, value: 'держать' });
      } else if (decision === 'делоад') {
        const prev = previousSublevel(entry['Уровень']);
        newValues.push({ col: levelCol + 1, value: prev });
        newValues.push({ col: streakCol + 1, value: 0 });
        newValues.push({ col: recCol + 1, value: 'держать' });
      } else {
        const streak = decision === 'не выполнено' ? (Number(values[i][streakCol]) || 0) + 1 : 0;
        newValues.push({ col: streakCol + 1, value: streak });
        newValues.push({ col: recCol + 1, value: decision });
      }
      newValues.push({ col: lastDateCol + 1, value: entry['Дата'] });
      newValues.forEach(({ col, value }) => sheet.getRange(row, col).setValue(value));
      return;
    }
  }
  // Если упражнения нет — добавляем
  appendRow(CONFIG.SHEETS.PROFILE, {
    'Упражнение': entry['Упражнение'],
    'Текущий_уровень': entry['Уровень'],
    'Дата_последней_сессии': entry['Дата'],
    'Срывов_подряд': entry['Итог'] === 'не выполнено' ? 1 : 0,
    'Рекомендация': entry['Решение_прогрессии'] || 'держать'
  });
}

function computeDecision(logEntry) {
  const outcome = logEntry['Итог'];
  const rpe = Number(logEntry['RPE']);
  if (outcome === 'перевыполнено' || (rpe && rpe <= 7)) {
    return 'вверх';
  }
  if (outcome === 'не выполнено') {
    return 'делоад';
  }
  if (outcome === 'выполнено' && logEntry['Повтор'] && Number(logEntry['Повтор']) >= 2) {
    return 'вверх';
  }
  return 'держать';
}

function inferDecision(history, currentEntry) {
  const outcome = currentEntry['Итог'];
  const rpe = Number(currentEntry['RPE']);
  if (outcome === 'перевыполнено' || (rpe && rpe <= 7)) {
    return 'вверх';
  }
  if (outcome === 'не выполнено') {
    const lastTwo = history.slice(-1).filter(e => e['Итог'] === 'не выполнено');
    return lastTwo.length >= 1 ? 'делоад' : 'держать';
  }
  const lastTwoCompleted = history.slice(-1).filter(e => e['Итог'] === 'выполнено');
  if (outcome === 'выполнено' && lastTwoCompleted.length >= 1) {
    return 'вверх';
  }
  return 'держать';
}

// ====== Обработчики ======
function doGet(e) {
  try {
    ensureApiKey(e);
    const path = e?.parameter?.path || (e?.pathInfo ? e.pathInfo.replace(/^\//, '') : '');
    switch (path || (e?.parameter?.levels !== undefined ? 'levels' : e?.parameter?.plan !== undefined ? 'plan' : '')) {
      case 'levels':
      case 'levels?':
        return handleGetLevels(e);
      case 'plan':
        return handleGetPlan(e);
      default:
        const action = (e?.parameter?.action || '').toLowerCase();
        if (action === 'levels') return handleGetLevels(e);
        if (action === 'plan') return handleGetPlan(e);
        return respond(200, { status: 'ok', message: 'Convict Conditioning API' });
    }
  } catch (err) {
    const error = err.code ? err : createError(500, 'Internal error', err.message, 'Проверьте логи');
    return respond(error.code, { error: error.message, details: error.details, hint: error.hint });
  }
}

function doPost(e) {
  try {
    ensureApiKey(e);
    const path = e?.parameter?.path || (e?.pathInfo ? e.pathInfo.replace(/^\//, '') : '');
    const body = parseJson(e?.postData?.contents);
    switch (path) {
      case 'log':
        return handlePostLog(body);
      case 'test':
        return handlePostTest(body);
      case 'advance':
        return handlePostAdvance(body);
      case 'generate-week':
        return handlePostGenerateWeek(body);
      default:
        throw createError(404, 'Unknown endpoint', path, 'Используйте /log, /test, /advance, /generate-week');
    }
  } catch (err) {
    const error = err.code ? err : createError(500, 'Internal error', err.message, 'Проверьте логи');
    return respond(error.code, { error: error.message, details: error.details, hint: error.hint });
  }
}

// ====== Эндпойнты ======
function handleGetLevels(e) {
  const exercise = e.parameter.exercise;
  if (!exercise) {
    throw createError(400, 'Missing exercise parameter', null, 'Пример: ?exercise=Подтягивания');
  }
  const levels = readTable(CONFIG.SHEETS.LEVELS)
    .filter(r => r['Упражнение'] === exercise)
    .map(r => ({
      level: String(r['Уровень']),
      name: r['Название уровня'],
      sets: Number(r['Подходы_план']),
      reps: Number(r['Повторы_план'])
    }));
  if (!levels.length) {
    throw createError(404, 'Levels not found', exercise, 'Проверьте название упражнения');
  }
  return respond(200, { exercise, levels });
}

function handleGetPlan(e) {
  const from = e.parameter.from;
  const to = e.parameter.to;
  if (!from || !to) {
    throw createError(400, 'Missing date range', { from, to }, 'Добавьте from=YYYY-MM-DD&to=YYYY-MM-DD');
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate) || isNaN(toDate)) {
    throw createError(400, 'Invalid date format', { from, to }, 'Используйте ISO-формат YYYY-MM-DD');
  }
  const rows = readTable(CONFIG.SHEETS.WEEK_PLAN);
  const result = rows.filter(r => {
    const date = new Date(r['Дата']);
    return date >= fromDate && date <= toDate;
  });
  return respond(200, { from, to, items: result });
}

function handlePostLog(body) {
  const required = ['Дата', 'Упражнение', 'Уровень', 'Сеты', 'Итог'];
  required.forEach(field => {
    if (!body[field]) {
      throw createError(400, 'Missing field', field, `Заполните ${field}`);
    }
  });
  body['Уровень'] = sanitizeLevel(body['Уровень']);
  const levelMap = getLevelMap();
  const key = `${body['Упражнение']}|${body['Уровень']}`;
  const levelInfo = levelMap[key];
  if (!levelInfo) {
    throw createError(404, 'Level not found', key, 'Добавьте уровень в Справочник');
  }
  body['Название уровня'] = levelInfo['Название уровня'];
  body['Подходы_план'] = levelInfo['Подходы_план'];
  body['Повторы_план'] = levelInfo['Повторы_план'];
  const sets = String(body['Сеты']).split(',').map(s => Number(s.trim()) || 0);
  body['Объём_факт'] = sets.reduce((acc, cur) => acc + cur, 0);

  const sheet = getSheet(CONFIG.SHEETS.LOG);
  appendRow(CONFIG.SHEETS.LOG, body);

  if (body['ID_Плана']) {
    updatePlanStatusById(body['ID_Плана'], 'выполнено');
  }

  // Прогрессия
  const logHistory = readTable(CONFIG.SHEETS.LOG).filter(r => r['Упражнение'] === body['Упражнение'] && r['Уровень'] === body['Уровень']);
  const decision = inferDecision(logHistory.slice(0, -1), body);
  body['Решение_прогрессии'] = decision;

  updateProfileFromLog(body);
  return respond(201, { status: 'ok', decision, volume: body['Объём_факт'] });
}

function handlePostTest(body) {
  const required = ['Дата', 'Упражнение', 'Пытался_уровень', 'Результат'];
  required.forEach(field => {
    if (!body[field]) {
      throw createError(400, 'Missing field', field, `Заполните ${field}`);
    }
  });
  body['Пытался_уровень'] = sanitizeLevel(body['Пытался_уровень']);
  if (body['Следующий_уровень_рекоменд']) {
    body['Следующий_уровень_рекоменд'] = sanitizeLevel(body['Следующий_уровень_рекоменд']);
  }
  appendRow(CONFIG.SHEETS.TESTS, body);
  return respond(201, { status: 'ok' });
}

function handlePostAdvance(body) {
  const required = ['Упражнение', 'Текущий_уровень', 'Решение'];
  required.forEach(field => {
    if (!body[field]) {
      throw createError(400, 'Missing field', field, `Заполните ${field}`);
    }
  });
  const exercise = body['Упражнение'];
  const level = sanitizeLevel(body['Текущий_уровень']);
  const decision = body['Решение'];
  const sheet = getSheet(CONFIG.SHEETS.PROFILE);
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  const idxExercise = headers.indexOf('Упражнение');
  const idxLevel = headers.indexOf('Текущий_уровень');
  const idxRec = headers.indexOf('Рекомендация');
  let updated = false;
  for (let i = 1; i < values.length; i++) {
    if (values[i][idxExercise] === exercise) {
      let newLevel = level;
      if (decision === 'вверх') newLevel = nextSublevel(level);
      if (decision === 'делоад') newLevel = previousSublevel(level);
      sheet.getRange(i + 1, idxLevel + 1).setValue(newLevel);
      sheet.getRange(i + 1, idxRec + 1).setValue('держать');
      updated = true;
      break;
    }
  }
  if (!updated) {
    appendRow(CONFIG.SHEETS.PROFILE, {
      'Упражнение': exercise,
      'Текущий_уровень': decision === 'вверх' ? nextSublevel(level) : decision === 'делоад' ? previousSublevel(level) : level,
      'Дата_последней_сессии': new Date(),
      'Срывов_подряд': 0,
      'Рекомендация': 'держать'
    });
  }
  return respond(200, { status: 'ok' });
}

function handlePostGenerateWeek(body) {
  const required = ['from', 'to'];
  required.forEach(field => {
    if (!body[field]) {
      throw createError(400, 'Missing field', field, `Укажите ${field}`);
    }
  });
  const fromDate = new Date(body.from);
  const toDate = new Date(body.to);
  if (isNaN(fromDate) || isNaN(toDate)) {
    throw createError(400, 'Invalid date format', body, 'Используйте YYYY-MM-DD');
  }
  const template = readTable(CONFIG.SHEETS.WEEK_TEMPLATE);
  const planSheet = getSheet(CONFIG.SHEETS.WEEK_PLAN);
  const existing = readTable(CONFIG.SHEETS.WEEK_PLAN);
  const levelMap = getLevelMap();

  const entries = [];
  let current = new Date(fromDate);
  while (current <= toDate) {
    const weekday = current.getDay(); // 0=Sunday
    const dayNameRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][weekday];
    const templateRows = template.filter(r => r['День'] === dayNameRu);
    templateRows.forEach((row, idx) => {
      [1, 2].forEach(slot => {
        const exercise = row[`Упр${slot}`];
        const level = sanitizeLevel(String(row[`Уровень${slot}`] || ''));
        if (!exercise || !level) return;
        const key = `${exercise}|${level}`;
        const info = levelMap[key];
        if (!info) {
          throw createError(400, 'Level missing in template', key, 'Добавьте уровень в справочник');
        }
        const id = getPlanId(current, exercise, slot);
        if (existing.some(r => r['ID_Плана'] === id)) {
          return; // избегаем дублей
        }
        entries.push([
          new Date(current),
          '',
          exercise,
          level,
          info['Название уровня'],
          info['Подходы_план'],
          info['Повторы_план'],
          'запланировано',
          id
        ]);
      });
    });
    current = new Date(current.getTime() + 86400000);
  }

  if (!entries.length) {
    return respond(200, { status: 'ok', message: 'Новых записей нет' });
  }

  const startRow = planSheet.getLastRow() + 1;
  planSheet.getRange(startRow, 1, entries.length, entries[0].length).setValues(entries);
  return respond(201, { status: 'ok', inserted: entries.length });
}
```

## 4) Примеры API-запросов и ответов

### 4.1 Получение уровней
```bash
curl -H "X-API-Key: YOUR_KEY" "https://script.google.com/macros/s/WEBAPP_ID/exec?path=levels&exercise=%D0%9F%D0%BE%D0%B4%D1%82%D1%8F%D0%B3%D0%B8%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F"
```
**Ответ:**
```json
{
  "exercise": "Подтягивания",
  "levels": [
    { "level": "1.1", "name": "Вис на турнике", "sets": 3, "reps": 10 },
    { "level": "2.1", "name": "Горизонтальные подтягивания", "sets": 2, "reps": 15 }
  ]
}
```

### 4.2 План по датам
```bash
curl -H "X-API-Key: YOUR_KEY" "https://script.google.com/macros/s/WEBAPP_ID/exec?path=plan&from=2024-01-01&to=2024-01-07"
```

### 4.3 Лог тренировки
```bash
curl -X POST -H "Content-Type: application/json" -H "X-API-Key: YOUR_KEY" \
  -d '{
    "Дата": "2024-01-01",
    "ID_Плана": "20240101-Pod1",
    "Упражнение": "Подтягивания",
    "Уровень": "2.1",
    "Сеты": "15,14",
    "RPE": 7,
    "Итог": "выполнено"
  }' \
  "https://script.google.com/macros/s/WEBAPP_ID/exec?path=log"
```

### 4.4 Тест уровня
```bash
curl -X POST -H "Content-Type: application/json" -H "X-API-Key: YOUR_KEY" \
  -d '{
    "Дата": "2024-01-05",
    "Упражнение": "Подтягивания",
    "Пытался_уровень": "3.1",
    "Результат": "сдал",
    "Следующий_уровень_рекоменд": "3.2"
  }' \
  "https://script.google.com/macros/s/WEBAPP_ID/exec?path=test"
```

### 4.5 Обновление прогрессии
```bash
curl -X POST -H "Content-Type: application/json" -H "X-API-Key: YOUR_KEY" \
  -d '{
    "Упражнение": "Подтягивания",
    "Текущий_уровень": "2.3",
    "Решение": "вверх"
  }' \
  "https://script.google.com/macros/s/WEBAPP_ID/exec?path=advance"
```

### 4.6 Генерация недели
```bash
curl -X POST -H "Content-Type: application/json" -H "X-API-Key: YOUR_KEY" \
  -d '{ "from": "2024-01-01", "to": "2024-01-07" }' \
  "https://script.google.com/macros/s/WEBAPP_ID/exec?path=generate-week"
```

**JS Fetch (универсальный шаблон):**
```javascript
fetch(`${WEBAPP_URL}?path=plan&from=2024-01-01&to=2024-01-07`, {
  headers: { 'X-API-Key': API_KEY }
}).then(r => r.json()).then(console.log);
```

## 5) Мини-фронт HTML+JS
```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Convict Conditioning Planner</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    section { margin-bottom: 2rem; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    label { display: block; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>Convict Conditioning Demo</h1>
  <section>
    <h2>План на сегодня</h2>
    <button id="refresh-plan">Обновить</button>
    <table id="plan-table">
      <thead><tr><th>Упражнение</th><th>Уровень</th><th>Сеты×Повторы</th><th>Status</th></tr></thead>
      <tbody></tbody>
    </table>
  </section>

  <section>
    <h2>Лог тренировки</h2>
    <form id="log-form">
      <label>Дата: <input type="date" name="Дата" required /></label>
      <label>Упражнение: <select name="Упражнение" required>
        <option value="Подтягивания">Подтягивания</option>
        <option value="Приседания">Приседания</option>
        <option value="Отжимания">Отжимания</option>
        <option value="Подъёмы ног">Подъёмы ног</option>
        <option value="Мостик">Мостик</option>
        <option value="Отжимания в стойке">Отжимания в стойке</option>
      </select></label>
      <label>Уровень: <input type="text" name="Уровень" placeholder="2.1" required /></label>
      <label>Сеты (через запятую): <input type="text" name="Сеты" placeholder="15,14" required /></label>
      <label>RPE: <input type="number" name="RPE" min="1" max="10" /></label>
      <label>Итог:
        <select name="Итог" required>
          <option value="выполнено">выполнено</option>
          <option value="перевыполнено">перевыполнено</option>
          <option value="не выполнено">не выполнено</option>
        </select>
      </label>
      <button type="submit">Отправить</button>
    </form>
    <pre id="log-result"></pre>
  </section>

  <section>
    <h2>Список уровней по упражнению</h2>
    <select id="levels-exercise">
      <option value="Подтягивания">Подтягивания</option>
      <option value="Приседания">Приседания</option>
      <option value="Отжимания">Отжимания</option>
      <option value="Подъёмы ног">Подъёмы ног</option>
      <option value="Мостик">Мостик</option>
      <option value="Отжимания в стойке">Отжимания в стойке</option>
    </select>
    <button id="load-levels">Показать</button>
    <pre id="levels-output"></pre>
  </section>

  <script>
    const WEBAPP_URL = 'PASTE_WEBAPP_URL_HERE';
    const API_KEY = 'PASTE_API_KEY_HERE';

    function apiGet(path) {
      return fetch(`${WEBAPP_URL}?${path}`, {
        headers: { 'X-API-Key': API_KEY }
      }).then(r => r.json());
    }

    function apiPost(path, payload) {
      return fetch(`${WEBAPP_URL}?path=${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(payload)
      }).then(r => r.json());
    }

    document.getElementById('refresh-plan').addEventListener('click', () => {
      const today = new Date().toISOString().slice(0, 10);
      apiGet(`path=plan&from=${today}&to=${today}`).then(data => {
        const tbody = document.querySelector('#plan-table tbody');
        tbody.innerHTML = '';
        (data.items || []).forEach(item => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${item['Упражнение']}</td>`+
            `<td>${item['Уровень']}</td>`+
            `<td>${item['Подходы_план']}×${item['Повторы_план']}</td>`+
            `<td>${item['Статус']}</td>`;
          tbody.appendChild(tr);
        });
      });
    });

    document.getElementById('log-form').addEventListener('submit', e => {
      e.preventDefault();
      const form = e.target;
      const payload = Object.fromEntries(new FormData(form).entries());
      apiPost('log', payload).then(data => {
        document.getElementById('log-result').textContent = JSON.stringify(data, null, 2);
        form.reset();
      }).catch(err => {
        document.getElementById('log-result').textContent = err;
      });
    });

    document.getElementById('load-levels').addEventListener('click', () => {
      const exercise = document.getElementById('levels-exercise').value;
      apiGet(`path=levels&exercise=${encodeURIComponent(exercise)}`).then(data => {
        document.getElementById('levels-output').textContent = JSON.stringify(data.levels, null, 2);
      });
    });

    // Автозагрузка
    document.getElementById('refresh-plan').click();
  </script>
</body>
</html>
```

## 6) Пошаговый деплой и настройка
1. **Создание таблицы:** создайте Google Таблицу, добавьте листы с названиями из раздела 1. Перед вводом уровней выделите столбцы `Уровень` → `Формат` → `Число` → `Проверка данных` → Установите *Преобразование текста в числа* = «отключено» или выберите формат *Plain text* (через `Format → Number → Plain text`).
2. **Заполнение справочника:** скопируйте демонстрационные строки из раздела 1.1. Используйте апостроф `'` перед значениями `1.1`, `2.2`.
3. **Валидации:**
   - `Справочник_Уровней!A:A` → Data validation (список 6 движений).
   - `Программа_Недели!B:C` и `D:E` → списки (упражнение) и Plain text (уровень).
   - `Журнал`, `План_Недели`, `Профиль` → настройка списков значений (`Итог`, `Статус`, `Рекомендация`).
   - Настройте зависимые списки через именованные диапазоны или скрипт.
4. **Защита диапазонов:** `Справочник_Уровней!A:E`, `План_Недели!A:G,I`, формульные столбцы `Программа_Недели` и `Журнал` → `Данные → Защита диапазона`.
5. **Apps Script:** `Extensions → Apps Script`, вставьте код из раздела 3. Сохраните.
6. **API-ключ:** в Apps Script → `Project Settings` → `Script properties` → добавьте `API_KEY` (по желанию; если пусто, включается режим A только для владельца).
7. **Публикация:** `Deploy → New deployment → Web app` → выберите `Execute as: Me`, `Who has access: Anyone` (для режима B) или `Only myself` (режим A). Сохраните `WEBAPP_URL`.
8. **Проверка:** выполните запросы из раздела 4 (curl или Postman). Убедитесь, что `GET /plan` возвращает пустой массив до генерации недели.
9. **Кнопка генерации:** в таблице вставьте рисунок/кнопку → назначьте макрос `generateWeekUi`, предварительно создав в Apps Script:
```javascript
function generateWeekUi() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Генерация плана', 'Введите дату начала (YYYY-MM-DD):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const from = response.getResponseText();
  const to = new Date(new Date(from).getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const res = handlePostGenerateWeek({ from, to });
  ui.alert('Готово', JSON.stringify(res, null, 2), ui.ButtonSet.OK);
}
```
Назначьте этот макрос на кнопку.
10. **Дашборды:** создайте новые листы, используйте сводные таблицы и диаграммы по формулам раздела 2.4.

## 7) Тест-кейсы и чек-лист
1. **Уровень как текст:** введите `'1.1` — убедитесь, что колонка не форматируется как дата.
2. **POST /log без ID:** отправьте лог — запись появляется в `Журнал`, `Статус` в плане не меняется, профиль обновляется (дата, рекомендация).
3. **Два срыва подряд:** внесите два лога с `Итог = не выполнено` — в профиле должен сработать `делоад` (уровень понижается).
4. **Функции прогрессии:** проверьте `nextSublevel("4.3")` → `5.1`, `previousSublevel("5.1")` → `4.3` (через консоль скрипта).
5. **Генерация недели:** вызовите `/generate-week` на диапазон — убедитесь, что `ID_Плана` уникальны и дубли не создаются при повторном запуске.
6. **Ошибки API:** запросите несуществующее упражнение → получите JSON с ошибкой 404.
7. **Объём сетов:** отправьте `"20,20,20"` — `Объём_факт` = 60.
8. **Комплаенс:** отметьте статусы `выполнено/пропущено` — сводка показывает корректные проценты.

## 8) FAQ и типовые ошибки
- **Почему `1.1` превращается в `01.янв`?** Убедитесь, что колонки с уровнями форматированы как *Plain text* и вводите значения с апострофом (`'1.1`).
- **Получаю 401 / 403:** проверьте режим доступа. Для режима B установите `API_KEY` в свойствах скрипта и передавайте его в заголовке `X-API-Key`. Для режима A доступ только авторизованному владельцу.
- **Ошибки квот:** минимизируйте обращение к SpreadsheetApp (см. батч-чтение). При больших объёмах данных используйте кеширование и разделение журналов по годам.
- **Формулы стираются пользователями:** защитите диапазоны с формулами (`Данные → Защитить диапазон`).
- **Данные не обновляются в дашбордах:** обновите сводные таблицы (`Данные → Обновить`), убедитесь в корректных диапазонах.
- **Не генерируется план:** убедитесь, что `Программа_Недели` заполнена на все дни, даты заданы в ISO-формате, уровни присутствуют в `Справочник_Уровней`.
- **Проблемы с зависимыми списками:** используйте именованные диапазоны (`Данные → Именованные диапазоны`) и `INDIRECT`, либо напишите Apps Script для динамических списков.

---

> **Режим аутентификации:**
> - **A (Only me + OAuth):** при деплое выберите «Only myself». Все запросы выполняются от имени владельца; внешним пользователям недоступно.
> - **B (Anyone with link + API key):** выберите «Anyone». Храните `API_KEY` в script properties, передавайте в заголовке `X-API-Key`. Раздавайте ключ только доверенным клиентам.

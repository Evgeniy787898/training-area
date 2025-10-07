/**
 * Convict Conditioning Progression Tracker
 * Google Apps Script Web App backend for Google Sheets.
 */

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
  'Отжимания в стойке на руках': 'Hsp'
};

const DAY_NAME_MAP = {
  'Пн': 'Пн',
  'Понедельник': 'Пн',
  'Вт': 'Вт',
  'Вторник': 'Вт',
  'Ср': 'Ср',
  'Среда': 'Ср',
  'Чт': 'Чт',
  'Четверг': 'Чт',
  'Пт': 'Пт',
  'Пятница': 'Пт',
  'Сб': 'Сб',
  'Суббота': 'Сб',
  'Вс': 'Вс',
  'Воскресенье': 'Вс'
};

function respond(status, payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON)
    .setResponseCode(status);
}

function parseJson(body) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    throw createError(400, 'Invalid JSON payload', err.message, 'Проверьте синтаксис JSON.');
  }
}

function createError(code, message, details, hint) {
  return { code, message, details, hint };
}

function getPathFromEvent(e) {
  if (e?.pathInfo) {
    return String(e.pathInfo).replace(/^\/+/, '');
  }
  if (e?.parameter?.path) {
    return String(e.parameter.path).replace(/^\/+/, '');
  }
  return '';
}

function ensureApiKey(e) {
  if (!CONFIG.API_KEY) {
    return; // режим A — OAuth, проверка API ключа не требуется
  }
  const headerKey = e?.headers?.[CONFIG.HEADER_API_KEY];
  const postHeaderKey = e?.postData?.headers?.[CONFIG.HEADER_API_KEY];
  const paramKey = e?.parameter?.key || e?.parameter?.apiKey;
  const provided = headerKey || postHeaderKey || paramKey;
  if (!provided || provided !== CONFIG.API_KEY) {
    throw createError(401, 'Unauthorized', 'Missing or invalid API key', `Передайте заголовок ${CONFIG.HEADER_API_KEY}`);
  }
}

function getSheet(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) {
    throw createError(500, 'Sheet not found', name, 'Проверьте, что лист существует.');
  }
  return sheet;
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function readTable(sheetName) {
  const sheet = getSheet(sheetName);
  if (sheet.getLastRow() < 2) {
    return [];
  }
  const range = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn());
  const values = range.getValues();
  const headers = values.shift();
  return values
    .map(row => Object.fromEntries(headers.map((h, idx) => [h, row[idx]])))
    .filter(row => Object.values(row).some(value => value !== '' && value !== null));
}

function appendRow(sheetName, rowObj) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);
  const row = headers.map(header => rowObj.hasOwnProperty(header) ? rowObj[header] : '');
  sheet.appendRow(row);
}

function sanitizeLevel(level) {
  if (typeof level !== 'string') {
    level = String(level);
  }
  const trimmed = level.trim();
  if (!/^\d+\.\d+$/.test(trimmed)) {
    throw createError(400, 'Invalid level format', level, 'Используйте формат X.Y (например, 4.2).');
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

function normalizeDayName(day) {
  if (!day && day !== 0) {
    return '';
  }
  const normalized = DAY_NAME_MAP[String(day).trim()] || String(day).trim();
  return normalized;
}

function parseIsoDate(input) {
  if (!input) {
    throw createError(400, 'Missing date value', input, 'Передайте дату в формате YYYY-MM-DD.');
  }
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    throw createError(400, 'Invalid date format', input, 'Используйте ISO формат YYYY-MM-DD.');
  }
  return date;
}

function getLevelMap() {
  const rows = readTable(CONFIG.SHEETS.LEVELS);
  const map = {};
  rows.forEach(row => {
    const key = `${row['Упражнение']}|${sanitizeLevel(row['Уровень'])}`;
    map[key] = row;
  });
  return map;
}

function getPlanId(date, exercise, index) {
  const code = EXERCISE_CODES[exercise] || exercise.substring(0, 3);
  return `${Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyyMMdd')}-${code}${index}`;
}

function updatePlanStatusById(id, status) {
  if (!id) {
    return;
  }
  const sheet = getSheet(CONFIG.SHEETS.WEEK_PLAN);
  const headers = getHeaders(sheet);
  const idCol = headers.indexOf('ID_Плана');
  const statusCol = headers.indexOf('Статус');
  if (idCol === -1 || statusCol === -1) {
    return;
  }
  const rows = sheet.getLastRow();
  if (rows < 2) {
    return;
  }
  const values = sheet.getRange(2, 1, rows - 1, sheet.getLastColumn()).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][idCol] === id) {
      sheet.getRange(i + 2, statusCol + 1).setValue(status);
      break;
    }
  }
}

function inferDecision(history, entry) {
  const outcome = entry['Итог'];
  const rpe = Number(entry['RPE']);
  if (outcome === 'перевыполнено' || (!isNaN(rpe) && rpe > 0 && rpe <= 7)) {
    return 'вверх';
  }
  if (outcome === 'не выполнено') {
    const last = history.slice(-1)[0];
    if (last && last['Итог'] === 'не выполнено') {
      return 'делоад';
    }
    return 'держать';
  }
  if (outcome === 'выполнено') {
    const last = history.slice(-1)[0];
    if (last && last['Итог'] === 'выполнено') {
      return 'вверх';
    }
  }
  return 'держать';
}

function updateProfileFromLog(entry) {
  const sheet = getSheet(CONFIG.SHEETS.PROFILE);
  const headers = getHeaders(sheet);
  const exerciseCol = headers.indexOf('Упражнение');
  const levelCol = headers.indexOf('Текущий_уровень');
  const lastDateCol = headers.indexOf('Дата_последней_сессии');
  const streakCol = headers.indexOf('Срывов_подряд');
  const recCol = headers.indexOf('Рекомендация');
  const rows = sheet.getLastRow();
  const values = rows >= 2 ? sheet.getRange(2, 1, rows - 1, sheet.getLastColumn()).getValues() : [];
  const exercise = entry['Упражнение'];
  const currentLevel = sanitizeLevel(entry['Уровень']);
  const decision = entry['Решение_прогрессии'];
  const outcome = entry['Итог'];
  const workoutDate = parseIsoDate(entry['Дата']);

  for (let i = 0; i < values.length; i++) {
    if (values[i][exerciseCol] === exercise) {
      let nextLevel = values[i][levelCol] || currentLevel;
      let streak = Number(values[i][streakCol]) || 0;
      if (decision === 'вверх') {
        nextLevel = nextSublevel(currentLevel);
        streak = 0;
      } else if (decision === 'делоад') {
        nextLevel = previousSublevel(currentLevel);
        streak = 0;
      } else if (outcome === 'не выполнено') {
        streak += 1;
      } else {
        streak = 0;
      }
      sheet.getRange(i + 2, levelCol + 1).setValue(nextLevel);
      sheet.getRange(i + 2, streakCol + 1).setValue(streak);
      sheet.getRange(i + 2, recCol + 1).setValue(decision);
      sheet.getRange(i + 2, lastDateCol + 1).setValue(workoutDate);
      return;
    }
  }

  appendRow(CONFIG.SHEETS.PROFILE, {
    'Упражнение': exercise,
    'Текущий_уровень': decision === 'вверх' ? nextSublevel(currentLevel) : (decision === 'делоад' ? previousSublevel(currentLevel) : currentLevel),
    'Дата_последней_сессии': workoutDate,
    'Срывов_подряд': outcome === 'не выполнено' ? 1 : 0,
    'Рекомендация': decision
  });
}

function doGet(e) {
  try {
    ensureApiKey(e);
    const path = getPathFromEvent(e);
    if (path === 'levels' || e?.parameter?.levels !== undefined) {
      return handleGetLevels(e);
    }
    if (path === 'plan' || e?.parameter?.plan !== undefined) {
      return handleGetPlan(e);
    }
    return respond(200, { status: 'ok', message: 'Convict Conditioning API' });
  } catch (err) {
    const error = err.code ? err : createError(500, 'Internal error', err.message, 'Проверьте логи.');
    return respond(error.code, { error: error.message, details: error.details, hint: error.hint });
  }
}

function doPost(e) {
  try {
    ensureApiKey(e);
    const path = getPathFromEvent(e);
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
        throw createError(404, 'Unknown endpoint', path, 'Доступные пути: levels, plan, log, test, advance, generate-week.');
    }
  } catch (err) {
    const error = err.code ? err : createError(500, 'Internal error', err.message, 'Проверьте логи.');
    return respond(error.code, { error: error.message, details: error.details, hint: error.hint });
  }
}

function handleGetLevels(e) {
  const exercise = e?.parameter?.exercise;
  if (!exercise) {
    throw createError(400, 'Missing exercise parameter', null, 'Пример: ?exercise=Подтягивания');
  }
  const levels = readTable(CONFIG.SHEETS.LEVELS)
    .filter(row => row['Упражнение'] === exercise)
    .map(row => ({
      level: sanitizeLevel(row['Уровень']),
      name: row['Название уровня'],
      sets: Number(row['Подходы_план']),
      reps: Number(row['Повторы_план'])
    }));
  if (!levels.length) {
    throw createError(404, 'Levels not found', exercise, 'Проверьте название упражнения или заполните справочник.');
  }
  return respond(200, { exercise, levels });
}

function handleGetPlan(e) {
  const from = e?.parameter?.from;
  const to = e?.parameter?.to;
  if (!from || !to) {
    throw createError(400, 'Missing date range', { from, to }, 'Передайте from=YYYY-MM-DD&to=YYYY-MM-DD.');
  }
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  const rows = readTable(CONFIG.SHEETS.WEEK_PLAN);
  const items = rows.filter(row => {
    const date = row['Дата'] instanceof Date ? row['Дата'] : parseIsoDate(row['Дата']);
    return date >= fromDate && date <= toDate;
  });
  return respond(200, { from, to, items });
}

function handlePostLog(body) {
  const required = ['Дата', 'Упражнение', 'Уровень', 'Сеты', 'Итог'];
  required.forEach(field => {
    if (!body[field]) {
      throw createError(400, 'Missing field', field, `Заполните поле ${field}.`);
    }
  });

  const workoutDate = parseIsoDate(body['Дата']);
  const exercise = body['Упражнение'];
  const level = sanitizeLevel(body['Уровень']);
  const outcome = body['Итог'];
  const rpe = body['RPE'];

  const levelMap = getLevelMap();
  const key = `${exercise}|${level}`;
  const levelInfo = levelMap[key];
  if (!levelInfo) {
    throw createError(404, 'Level not found', key, 'Добавьте уровень в Справочник_Уровней.');
  }

  const sets = String(body['Сеты']).split(',').map(part => Number(part.trim()) || 0);
  const totalVolume = sets.reduce((sum, current) => sum + current, 0);

  const history = readTable(CONFIG.SHEETS.LOG)
    .filter(row => row['Упражнение'] === exercise && sanitizeLevel(row['Уровень']) === level)
    .sort((a, b) => new Date(a['Дата']).getTime() - new Date(b['Дата']).getTime());

  const decision = inferDecision(history, {
    'Итог': outcome,
    'RPE': rpe
  });

  const logRow = Object.assign({}, body, {
    'Дата': workoutDate,
    'Уровень': level,
    'Название уровня': levelInfo['Название уровня'],
    'Подходы_план': levelInfo['Подходы_план'],
    'Повторы_план': levelInfo['Повторы_план'],
    'Объём_факт': totalVolume,
    'Решение_прогрессии': decision
  });

  appendRow(CONFIG.SHEETS.LOG, logRow);

  if (body['ID_Плана']) {
    updatePlanStatusById(body['ID_Плана'], 'выполнено');
  }

  updateProfileFromLog(Object.assign({}, logRow, {
    'Дата': Utilities.formatDate(workoutDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  }));

  return respond(201, { status: 'ok', decision, volume: totalVolume });
}

function handlePostTest(body) {
  const required = ['Дата', 'Упражнение', 'Пытался_уровень', 'Результат'];
  required.forEach(field => {
    if (!body[field]) {
      throw createError(400, 'Missing field', field, `Заполните поле ${field}.`);
    }
  });
  const testRow = Object.assign({}, body, {
    'Дата': parseIsoDate(body['Дата']),
    'Пытался_уровень': sanitizeLevel(body['Пытался_уровень']),
    'Следующий_уровень_рекоменд': body['Следующий_уровень_рекоменд'] ? sanitizeLevel(body['Следующий_уровень_рекоменд']) : ''
  });
  appendRow(CONFIG.SHEETS.TESTS, testRow);
  return respond(201, { status: 'ok' });
}

function handlePostAdvance(body) {
  const required = ['Упражнение', 'Текущий_уровень', 'Решение'];
  required.forEach(field => {
    if (!body[field]) {
      throw createError(400, 'Missing field', field, `Заполните поле ${field}.`);
    }
  });

  const exercise = body['Упражнение'];
  const level = sanitizeLevel(body['Текущий_уровень']);
  const decision = body['Решение'];
  if (!CONFIG.PROGRESSION_DECISIONS.includes(decision)) {
    throw createError(400, 'Invalid decision value', decision, 'Используйте держать/вверх/делоад.');
  }

  const sheet = getSheet(CONFIG.SHEETS.PROFILE);
  const headers = getHeaders(sheet);
  const exerciseCol = headers.indexOf('Упражнение');
  const levelCol = headers.indexOf('Текущий_уровень');
  const recCol = headers.indexOf('Рекомендация');
  let updated = false;

  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    for (let i = 0; i < values.length; i++) {
      if (values[i][exerciseCol] === exercise) {
        let newLevel = level;
        if (decision === 'вверх') {
          newLevel = nextSublevel(level);
        } else if (decision === 'делоад') {
          newLevel = previousSublevel(level);
        }
        sheet.getRange(i + 2, levelCol + 1).setValue(newLevel);
        sheet.getRange(i + 2, recCol + 1).setValue('держать');
        updated = true;
        break;
      }
    }
  }

  if (!updated) {
    appendRow(CONFIG.SHEETS.PROFILE, {
      'Упражнение': exercise,
      'Текущий_уровень': decision === 'вверх' ? nextSublevel(level) : (decision === 'делоад' ? previousSublevel(level) : level),
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
      throw createError(400, 'Missing field', field, `Укажите ${field}.`);
    }
  });

  const fromDate = parseIsoDate(body.from);
  const toDate = parseIsoDate(body.to);
  if (fromDate > toDate) {
    throw createError(400, 'Invalid date range', body, 'Дата from должна быть раньше to.');
  }

  const templateRows = readTable(CONFIG.SHEETS.WEEK_TEMPLATE);
  const planSheet = getSheet(CONFIG.SHEETS.WEEK_PLAN);
  const existingPlans = readTable(CONFIG.SHEETS.WEEK_PLAN);
  const levelMap = getLevelMap();

  const inserts = [];
  for (let cursor = new Date(fromDate); cursor <= toDate; cursor.setDate(cursor.getDate() + 1)) {
    const weekdayShort = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][cursor.getDay()];
    const matches = templateRows.filter(row => normalizeDayName(row['День']) === weekdayShort);
    matches.forEach(row => {
      [1, 2].forEach(slot => {
        const exercise = row[`Упр${slot}`];
        const levelRaw = row[`Уровень${slot}`];
        if (!exercise || !levelRaw) {
          return;
        }
        const level = sanitizeLevel(levelRaw);
        const levelKey = `${exercise}|${level}`;
        const info = levelMap[levelKey];
        if (!info) {
          throw createError(400, 'Level missing in template', levelKey, 'Добавьте уровень в Справочник_Уровней.');
        }
        const id = getPlanId(cursor, exercise, slot);
        if (existingPlans.some(plan => plan['ID_Плана'] === id) || inserts.some(insert => insert[8] === id)) {
          return;
        }
        inserts.push([
          new Date(cursor),
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
  }

  if (!inserts.length) {
    return respond(200, { status: 'ok', inserted: 0, message: 'Новых записей нет.' });
  }

  planSheet.getRange(planSheet.getLastRow() + 1, 1, inserts.length, inserts[0].length).setValues(inserts);
  return respond(201, { status: 'ok', inserted: inserts.length });
}

# Дневник прогрессии по системе Пола Уэйда — Полное решение

## 1) Схема листов и таблиц (подробно, с примерами строк)

### 1.1 Справочник_Уровней
- **Назначение:** единый реестр прогрессии для всех 6 движений.
- **Диапазон:** `A:E`, строки начиная со 2-й зарезервированы под данные.
- **Настройки:**
  - Колонки `Уровень`, `Подходы_план`, `Повторы_план` — защитить от редактирования пользователями без прав администратора.
  - Формат колонки `Уровень` — *Plain text*. Вводить уровни как `'1.1` (апостроф подавляет автопревращение в дату).
  - Data validation для `Упражнение`: выпадающий список `{"Подтягивания";"Приседания";"Отжимания";"Подъёмы ног";"Мостик";"Отжимания в стойке на руках"}`.
- **Структура колонок:**
  1. `Упражнение` (список из 6 движений).
  2. `Уровень` (Plain text `X.Y`).
  3. `Название уровня` (строка).
  4. `Подходы_план` (целое число ≥1).
  5. `Повторы_план` (целое число ≥1).
- **Готовый CSV для импорта:** `data/levels.csv` (UTF-8, разделитель `,`).
- **Полный справочник уровней (демо-заполнение):**

#### Подтягивания

| Упражнение | Уровень | Название уровня | Подходы_план | Повторы_план |
|------------|---------|-----------------|--------------|--------------|
| Подтягивания | 1.1 | Вертикальные подтягивания | 1 | 10 |
| Подтягивания | 1.2 | Вертикальные подтягивания | 2 | 20 |
| Подтягивания | 1.3 | Вертикальные подтягивания | 3 | 40 |
| Подтягивания | 2.1 | Горизонтальные подтягивания | 1 | 10 |
| Подтягивания | 2.2 | Горизонтальные подтягивания | 2 | 20 |
| Подтягивания | 2.3 | Горизонтальные подтягивания | 3 | 30 |
| Подтягивания | 3.1 | Подтягивания "Складной нож" | 1 | 10 |
| Подтягивания | 3.2 | Подтягивания "Складной нож" | 2 | 15 |
| Подтягивания | 3.3 | Подтягивания "Складной нож" | 3 | 20 |
| Подтягивания | 4.1 | Неполные подтягивания | 1 | 8 |
| Подтягивания | 4.2 | Неполные подтягивания | 2 | 11 |
| Подтягивания | 4.3 | Неполные подтягивания | 2 | 15 |
| Подтягивания | 5.1 | Полные подтягивания | 1 | 5 |
| Подтягивания | 5.2 | Полные подтягивания | 2 | 8 |
| Подтягивания | 5.3 | Полные подтягивания | 2 | 10 |
| Подтягивания | 6.1 | Узкие подтягивания | 1 | 5 |
| Подтягивания | 6.2 | Узкие подтягивания | 2 | 8 |
| Подтягивания | 6.3 | Узкие подтягивания | 2 | 10 |
| Подтягивания | 7.1 | Разновысокие подтягивания | 1 | 5 |
| Подтягивания | 7.2 | Разновысокие подтягивания | 2 | 7 |
| Подтягивания | 7.3 | Разновысокие подтягивания | 2 | 9 |
| Подтягивания | 8.1 | Неполные подтягивания на одной руке | 1 | 4 |
| Подтягивания | 8.2 | Неполные подтягивания на одной руке | 2 | 6 |
| Подтягивания | 8.3 | Неполные подтягивания на одной руке | 2 | 8 |
| Подтягивания | 9.1 | Подтягивания на одной руке с поддержкой | 1 | 3 |
| Подтягивания | 9.2 | Подтягивания на одной руке с поддержкой | 2 | 5 |
| Подтягивания | 9.3 | Подтягивания на одной руке с поддержкой | 2 | 7 |
| Подтягивания | 10.1 | Подтягивания на одной руке | 1 | 1 |
| Подтягивания | 10.2 | Подтягивания на одной руке | 2 | 3 |
| Подтягивания | 10.3 | Подтягивания на одной руке | 2 | 6 |

#### Приседания

| Упражнение | Уровень | Название уровня | Подходы_план | Повторы_план |
|------------|---------|-----------------|--------------|--------------|
| Приседания | 1.1 | Приседания в стойке на плечах | 1 | 10 |
| Приседания | 1.2 | Приседания в стойке на плечах | 2 | 25 |
| Приседания | 1.3 | Приседания в стойке на плечах | 3 | 50 |
| Приседания | 2.1 | Приседания "Складной нож" | 1 | 10 |
| Приседания | 2.2 | Приседания "Складной нож" | 2 | 20 |
| Приседания | 2.3 | Приседания "Складной нож" | 3 | 40 |
| Приседания | 3.1 | Приседания с поддержкой | 1 | 10 |
| Приседания | 3.2 | Приседания с поддержкой | 2 | 15 |
| Приседания | 3.3 | Приседания с поддержкой | 3 | 30 |
| Приседания | 4.1 | Неполные приседания | 1 | 8 |
| Приседания | 4.2 | Неполные приседания | 2 | 35 |
| Приседания | 4.3 | Неполные приседания | 3 | 50 |
| Приседания | 5.1 | Полные приседания | 1 | 5 |
| Приседания | 5.2 | Полные приседания | 2 | 10 |
| Приседания | 5.3 | Полные приседания | 2 | 30 |
| Приседания | 6.1 | Узкие приседания | 1 | 5 |
| Приседания | 6.2 | Узкие приседания | 2 | 10 |
| Приседания | 6.3 | Узкие приседания | 2 | 20 |
| Приседания | 7.1 | Разновысокие приседания | 1 | 5 |
| Приседания | 7.2 | Разновысокие приседания | 2 | 10 |
| Приседания | 7.3 | Разновысокие приседания | 2 | 20 |
| Приседания | 8.1 | Неполные приседания на одной ноге | 1 | 5 |
| Приседания | 8.2 | Неполные приседания на одной ноге | 2 | 10 |
| Приседания | 8.3 | Неполные приседания на одной ноге | 2 | 20 |
| Приседания | 9.1 | Приседания на одной ноге с поддержкой | 1 | 5 |
| Приседания | 9.2 | Приседания на одной ноге с поддержкой | 2 | 10 |
| Приседания | 9.3 | Приседания на одной ноге с поддержкой | 2 | 20 |
| Приседания | 10.1 | Приседания на одной ноге | 1 | 5 |
| Приседания | 10.2 | Приседания на одной ноге | 2 | 10 |
| Приседания | 10.3 | Приседания на одной ноге | 2 | 50 |

#### Отжимания

| Упражнение | Уровень | Название уровня | Подходы_план | Повторы_план |
|------------|---------|-----------------|--------------|--------------|
| Отжимания | 1.1 | Отжимания от стены | 1 | 10 |
| Отжимания | 1.2 | Отжимания от стены | 2 | 25 |
| Отжимания | 1.3 | Отжимания от стены | 3 | 50 |
| Отжимания | 2.1 | Отжимания в наклоне | 1 | 10 |
| Отжимания | 2.2 | Отжимания в наклоне | 2 | 20 |
| Отжимания | 2.3 | Отжимания в наклоне | 3 | 40 |
| Отжимания | 3.1 | Отжимания на коленях | 1 | 10 |
| Отжимания | 3.2 | Отжимания на коленях | 2 | 15 |
| Отжимания | 3.3 | Отжимания на коленях | 3 | 30 |
| Отжимания | 4.1 | Неполные отжимания | 1 | 8 |
| Отжимания | 4.2 | Неполные отжимания | 2 | 12 |
| Отжимания | 4.3 | Неполные отжимания | 2 | 25 |
| Отжимания | 5.1 | Полные отжимания | 1 | 5 |
| Отжимания | 5.2 | Полные отжимания | 2 | 10 |
| Отжимания | 5.3 | Полные отжимания | 2 | 20 |
| Отжимания | 6.1 | Узкие отжимания | 1 | 5 |
| Отжимания | 6.2 | Узкие отжимания | 2 | 10 |
| Отжимания | 6.3 | Узкие отжимания | 2 | 20 |
| Отжимания | 7.1 | Разновысокие отжимания | 1 | 5 |
| Отжимания | 7.2 | Разновысокие отжимания | 2 | 10 |
| Отжимания | 7.3 | Разновысокие отжимания | 2 | 20 |
| Отжимания | 8.1 | Неполные отжимания на одной руке | 1 | 5 |
| Отжимания | 8.2 | Неполные отжимания на одной руке | 2 | 10 |
| Отжимания | 8.3 | Неполные отжимания на одной руке | 2 | 20 |
| Отжимания | 9.1 | Отжимания на одной руке с поддержкой | 1 | 5 |
| Отжимания | 9.2 | Отжимания на одной руке с поддержкой | 2 | 10 |
| Отжимания | 9.3 | Отжимания на одной руке с поддержкой | 2 | 20 |
| Отжимания | 10.1 | Отжимания на одной руке | 1 | 5 |
| Отжимания | 10.2 | Отжимания на одной руке | 2 | 10 |
| Отжимания | 10.3 | Отжимания на одной руке | 1 | 100 |

#### Подъёмы ног

| Упражнение | Уровень | Название уровня | Подходы_план | Повторы_план |
|------------|---------|-----------------|--------------|--------------|
| Подъёмы ног | 1.1 | Подтягивание коленей к груди | 1 | 10 |
| Подъёмы ног | 1.2 | Подтягивание коленей к груди | 2 | 25 |
| Подъёмы ног | 1.3 | Подтягивание коленей к груди | 3 | 40 |
| Подъёмы ног | 2.1 | Подъёмы коленей из положения лёжа | 1 | 10 |
| Подъёмы ног | 2.2 | Подъёмы коленей из положения лёжа | 2 | 20 |
| Подъёмы ног | 2.3 | Подъёмы коленей из положения лёжа | 3 | 35 |
| Подъёмы ног | 3.1 | Подъёмы согнутых ног из положения лёжа | 1 | 10 |
| Подъёмы ног | 3.2 | Подъёмы согнутых ног из положения лёжа | 2 | 15 |
| Подъёмы ног | 3.3 | Подъёмы согнутых ног из положения лёжа | 3 | 30 |
| Подъёмы ног | 4.1 | Подъёмы ног "Лягушка" | 1 | 8 |
| Подъёмы ног | 4.2 | Подъёмы ног "Лягушка" | 2 | 15 |
| Подъёмы ног | 4.3 | Подъёмы ног "Лягушка" | 2 | 25 |
| Подъёмы ног | 5.1 | Подъёмы прямых ног из положения лёжа | 1 | 5 |
| Подъёмы ног | 5.2 | Подъёмы прямых ног из положения лёжа | 2 | 10 |
| Подъёмы ног | 5.3 | Подъёмы прямых ног из положения лёжа | 2 | 20 |
| Подъёмы ног | 6.1 | Подтягивание коленей в висе | 1 | 5 |
| Подъёмы ног | 6.2 | Подтягивание коленей в висе | 2 | 10 |
| Подъёмы ног | 6.3 | Подтягивание коленей в висе | 2 | 15 |
| Подъёмы ног | 7.1 | Подъёмы согнутых ног в висе | 1 | 5 |
| Подъёмы ног | 7.2 | Подъёмы согнутых ног в висе | 2 | 10 |
| Подъёмы ног | 7.3 | Подъёмы согнутых ног в висе | 2 | 15 |
| Подъёмы ног | 8.1 | Подъёмы ног в висе - "Лягушка" | 1 | 5 |
| Подъёмы ног | 8.2 | Подъёмы ног в висе - "Лягушка" | 2 | 10 |
| Подъёмы ног | 8.3 | Подъёмы ног в висе - "Лягушка" | 2 | 15 |
| Подъёмы ног | 9.1 | Неполные подъёмы прямых ног в висе | 1 | 5 |
| Подъёмы ног | 9.2 | Неполные подъёмы прямых ног в висе | 2 | 10 |
| Подъёмы ног | 9.3 | Неполные подъёмы прямых ног в висе | 2 | 15 |
| Подъёмы ног | 10.1 | Подъёмы прямых ног в висе | 1 | 5 |
| Подъёмы ног | 10.2 | Подъёмы прямых ног в висе | 2 | 10 |
| Подъёмы ног | 10.3 | Подъёмы прямых ног в висе | 1 | 30 |

#### Мостик

| Упражнение | Уровень | Название уровня | Подходы_план | Повторы_план |
|------------|---------|-----------------|--------------|--------------|
| Мостик | 1.1 | "Мостик" от плеч | 1 | 10 |
| Мостик | 1.2 | "Мостик" от плеч | 2 | 25 |
| Мостик | 1.3 | "Мостик" от плеч | 3 | 50 |
| Мостик | 2.1 | Прямой "Мостик" | 1 | 10 |
| Мостик | 2.2 | Прямой "Мостик" | 2 | 20 |
| Мостик | 2.3 | Прямой "Мостик" | 3 | 40 |
| Мостик | 3.1 | "Мостик" из обратного наклона | 1 | 8 |
| Мостик | 3.2 | "Мостик" из обратного наклона | 2 | 15 |
| Мостик | 3.3 | "Мостик" из обратного наклона | 3 | 30 |
| Мостик | 4.1 | "Мостик" из упора на голову | 1 | 8 |
| Мостик | 4.2 | "Мостик" из упора на голову | 2 | 15 |
| Мостик | 4.3 | "Мостик" из упора на голову | 2 | 25 |
| Мостик | 5.1 | "Полумостик" | 1 | 8 |
| Мостик | 5.2 | "Полумостик" | 2 | 15 |
| Мостик | 5.3 | "Полумостик" | 2 | 20 |
| Мостик | 6.1 | Полный "Мостик" | 1 | 6 |
| Мостик | 6.2 | Полный "Мостик" | 2 | 10 |
| Мостик | 6.3 | Полный "Мостик" | 2 | 15 |
| Мостик | 7.1 | "Мостик" по стенке вниз | 1 | 3 |
| Мостик | 7.2 | "Мостик" по стенке вниз | 2 | 6 |
| Мостик | 7.3 | "Мостик" по стенке вниз | 2 | 10 |
| Мостик | 8.1 | "Мостик" по стенке вверх | 1 | 3 |
| Мостик | 8.2 | "Мостик" по стенке вверх | 2 | 4 |
| Мостик | 8.3 | "Мостик" по стенке вверх | 2 | 8 |
| Мостик | 9.1 | Неполный "Мостик" из положения стоя | 1 | 1 |
| Мостик | 9.2 | Неполный "Мостик" из положения стоя | 2 | 3 |
| Мостик | 9.3 | Неполный "Мостик" из положения стоя | 2 | 6 |
| Мостик | 10.1 | Полный "Мостик" из положения стоя | 1 | 1 |
| Мостик | 10.2 | Полный "Мостик" из положения стоя | 2 | 3 |
| Мостик | 10.3 | Полный "Мостик" из положения стоя | 2 | 30 |

#### Отжимания в стойке на руках

| Упражнение | Уровень | Название уровня | Подходы_план | Повторы_план |
|------------|---------|-----------------|--------------|--------------|
| Отжимания в стойке на руках | 1.1 | Стойка на голове у стены | 1 | 30 |
| Отжимания в стойке на руках | 1.2 | Стойка на голове у стены | 1 | 60 |
| Отжимания в стойке на руках | 1.3 | Стойка на голове у стены | 1 | 120 |
| Отжимания в стойке на руках | 2.1 | Стойка "Ворон" | 1 | 10 |
| Отжимания в стойке на руках | 2.2 | Стойка "Ворон" | 1 | 30 |
| Отжимания в стойке на руках | 2.3 | Стойка "Ворон" | 1 | 60 |
| Отжимания в стойке на руках | 3.1 | Стойка на руках у стены | 1 | 30 |
| Отжимания в стойке на руках | 3.2 | Стойка на руках у стены | 1 | 60 |
| Отжимания в стойке на руках | 3.3 | Стойка на руках у стены | 1 | 120 |
| Отжимания в стойке на руках | 4.1 | Неполные отжимания в стойке на руках у стены | 1 | 5 |
| Отжимания в стойке на руках | 4.2 | Неполные отжимания в стойке на руках у стены | 2 | 10 |
| Отжимания в стойке на руках | 4.3 | Неполные отжимания в стойке на руках у стены | 2 | 20 |
| Отжимания в стойке на руках | 5.1 | Отжимания в стойке на руках у стены | 1 | 5 |
| Отжимания в стойке на руках | 5.2 | Отжимания в стойке на руках у стены | 2 | 10 |
| Отжимания в стойке на руках | 5.3 | Отжимания в стойке на руках у стены | 2 | 15 |
| Отжимания в стойке на руках | 6.1 | Узкие отжимания в стойке на руках у стены | 1 | 5 |
| Отжимания в стойке на руках | 6.2 | Узкие отжимания в стойке на руках у стены | 2 | 9 |
| Отжимания в стойке на руках | 6.3 | Узкие отжимания в стойке на руках у стены | 2 | 12 |
| Отжимания в стойке на руках | 7.1 | Разновысокие отжимания в стойке на руках у стены | 1 | 5 |
| Отжимания в стойке на руках | 7.2 | Разновысокие отжимания в стойке на руках у стены | 2 | 8 |
| Отжимания в стойке на руках | 7.3 | Разновысокие отжимания в стойке на руках у стены | 2 | 10 |
| Отжимания в стойке на руках | 8.1 | Неполные отжимания на одной руке у стены | 1 | 4 |
| Отжимания в стойке на руках | 8.2 | Неполные отжимания на одной руке у стены | 2 | 6 |
| Отжимания в стойке на руках | 8.3 | Неполные отжимания на одной руке у стены | 2 | 8 |
| Отжимания в стойке на руках | 9.1 | Отжимания на одной руке с поддержкой у стены | 1 | 3 |
| Отжимания в стойке на руках | 9.2 | Отжимания на одной руке с поддержкой у стены | 2 | 4 |
| Отжимания в стойке на руках | 9.3 | Отжимания на одной руке с поддержкой у стены | 2 | 6 |
| Отжимания в стойке на руках | 10.1 | Отжимания в стойке на одной руке у стены | 1 | 1 |
| Отжимания в стойке на руках | 10.2 | Отжимания в стойке на одной руке у стены | 2 | 2 |
| Отжимания в стойке на руках | 10.3 | Отжимания в стойке на одной руке у стены | 2 | 5 |

### 1.2 Программа_Недели
- **Назначение:** ручной шаблон «идеальной» недели (6 тренировочных дней × 2 движения/день).
- **Диапазон:** `A:I`.
- **Колонки и типы:**
  1. `День` (текст: Пн, Вт, Ср, Чт, Пт, Сб — допускаются и полные формы «Понедельник», «Вторник» и т.д.; можно добавить Вс для активного восстановления).
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
- **Готовый CSV-шаблон:** `data/weekly_program.csv` (Plain text уровней перед импортом).
- **Пример строк:**

| День | Упр1 | Уровень1 | Упр2 | Уровень2 | Название уровня1* | Подходы1* | Повторы1* | Название уровня2* | Подходы2* | Повторы2* |
|------|------|----------|------|----------|--------------------|-----------|-----------|--------------------|-----------|-----------|
| Понедельник | Подтягивания | 1.1 | Приседания | 1.1 | Вертикальные подтягивания | 1 | 10 | Приседания в стойке на плечах | 1 | 10 |
| Вторник | Отжимания | 1.1 | Подъёмы ног | 1.1 | Отжимания от стены | 1 | 10 | Подтягивание коленей к груди | 1 | 10 |
| Среда | Отжимания в стойке на руках | 1.1 | Мостик | 1.1 | Стойка на голове у стены | 1 | 30 | "Мостик" от плеч | 1 | 10 |
| Четверг | Подтягивания | 1.1 | Приседания | 1.1 | Вертикальные подтягивания | 1 | 10 | Приседания в стойке на плечах | 1 | 10 |
| Пятница | Отжимания | 1.1 | Подъёмы ног | 1.1 | Отжимания от стены | 1 | 10 | Подтягивание коленей к груди | 1 | 10 |
| Суббота | Отжимания в стойке на руках | 1.1 | Мостик | 1.1 | Стойка на голове у стены | 1 | 30 | "Мостик" от плеч | 1 | 10 |

\*—колонки, заполняемые формулами `INDEX/FILTER` (или `XLOOKUP`).

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
  <title>Convict Conditioning Demo</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; margin: 2rem; background: #f7f7f9; }
    h1 { margin-top: 0; }
    section { background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 1.5rem; }
    button { cursor: pointer; padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #0077cc; background: #0d84ff; color: #fff; }
    button:disabled { opacity: 0.6; cursor: wait; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #d4d4dd; padding: 0.5rem; text-align: left; }
    th { background: #f0f4ff; }
    label { display: block; margin-top: 0.75rem; }
    input, select, textarea { width: 100%; padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; }
    textarea { resize: vertical; min-height: 70px; }
    .status { font-size: 0.9rem; margin-top: 0.5rem; color: #555; }
    .log { font-family: "Fira Mono", monospace; font-size: 0.85rem; background: #f3f3f7; padding: 0.75rem; border-radius: 8px; max-height: 200px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>Convict Conditioning API Demo</h1>
  <p>Заполните конфигурацию <code>WEBAPP_URL</code> и <code>API_KEY</code> перед использованием.</p>

  <section>
    <h2>План на сегодня</h2>
    <button id="refresh-plan">Обновить</button>
    <div class="status" id="plan-status"></div>
    <table>
      <thead>
        <tr><th>Упражнение</th><th>Уровень</th><th>Название уровня</th><th>Сеты×Повторы</th><th>Статус</th></tr>
      </thead>
      <tbody id="plan-body"></tbody>
    </table>
  </section>

  <section>
    <h2>Добавить тренировку</h2>
    <form id="log-form">
      <label>Дата
        <input type="date" name="Дата" required />
      </label>
      <label>Упражнение
        <select name="Упражнение" required>
          <option value="Подтягивания">Подтягивания</option>
          <option value="Приседания">Приседания</option>
          <option value="Отжимания">Отжимания</option>
          <option value="Подъёмы ног">Подъёмы ног</option>
          <option value="Мостик">Мостик</option>
          <option value="Отжимания в стойке на руках">Отжимания в стойке на руках</option>
        </select>
      </label>
      <label>ID плана (если есть)
        <input type="text" name="ID_Плана" placeholder="20240101-Pod1" />
      </label>
      <label>Уровень
        <input type="text" name="Уровень" placeholder="2.1" required />
      </label>
      <label>Сеты (через запятую)
        <input type="text" name="Сеты" placeholder="10,10,8" required />
      </label>
      <label>RPE
        <input type="number" name="RPE" min="1" max="10" />
      </label>
      <label>Итог
        <select name="Итог" required>
          <option value="выполнено">выполнено</option>
          <option value="перевыполнено">перевыполнено</option>
          <option value="не выполнено">не выполнено</option>
        </select>
      </label>
      <label>Примечание
        <textarea name="Примечание" placeholder="Комментарии"></textarea>
      </label>
      <button type="submit">Отправить лог</button>
    </form>
    <div class="status" id="log-status"></div>
  </section>

  <section>
    <h2>Уровни упражнения</h2>
    <label>Выберите упражнение
      <select id="levels-select">
        <option value="Подтягивания">Подтягивания</option>
        <option value="Приседания">Приседания</option>
        <option value="Отжимания">Отжимания</option>
        <option value="Подъёмы ног">Подъёмы ног</option>
        <option value="Мостик">Мостик</option>
        <option value="Отжимания в стойке на руках">Отжимания в стойке на руках</option>
      </select>
    </label>
    <button id="load-levels">Показать уровни</button>
    <div class="status" id="levels-status"></div>
    <div class="log" id="levels-log"></div>
  </section>

  <script>
    const WEBAPP_URL = 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec';
    const API_KEY = 'YOUR_API_KEY';

    function isoToday() {
      const date = new Date();
      const tzOffset = date.getTimezoneOffset();
      const local = new Date(date.getTime() - tzOffset * 60000);
      return local.toISOString().slice(0, 10);
    }

    async function apiRequest(path, params = {}, method = 'GET') {
      const url = new URL(WEBAPP_URL);
      url.searchParams.set('path', path);
      if (method === 'GET') {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
          }
        });
      }
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      if (API_KEY) {
        options.headers['X-API-Key'] = API_KEY;
      }
      if (method !== 'GET') {
        options.body = JSON.stringify(params);
      }
      const response = await fetch(url.toString(), options);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || response.statusText);
      }
      return response.json();
    }

    async function loadPlan() {
      const today = isoToday();
      const status = document.getElementById('plan-status');
      const body = document.getElementById('plan-body');
      status.textContent = 'Загружаем…';
      body.innerHTML = '';
      try {
        const data = await apiRequest('plan', { from: today, to: today });
        if (!data.items || !data.items.length) {
          status.textContent = 'На сегодня план не найден.';
          return;
        }
        data.items.forEach(item => {
          const tr = document.createElement('tr');
          const setsXreps = `${item['Подходы_план']}×${item['Повторы_план']}`;
          tr.innerHTML = `<td>${item['Упражнение']}</td>` +
                         `<td>${item['Уровень']}</td>` +
                         `<td>${item['Название уровня'] || ''}</td>` +
                         `<td>${setsXreps}</td>` +
                         `<td>${item['Статус'] || ''}</td>`;
          body.appendChild(tr);
        });
        status.textContent = `Найдено записей: ${data.items.length}`;
      } catch (err) {
        status.textContent = `Ошибка: ${err.message}`;
      }
    }

    async function submitLog(event) {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      const status = document.getElementById('log-status');
      status.textContent = 'Отправляем…';
      try {
        const result = await apiRequest('log', payload, 'POST');
        status.textContent = `Успешно. Решение: ${result.decision}, объём: ${result.volume}`;
        form.reset();
        form.querySelector('[name="Дата"]').value = isoToday();
        await loadPlan();
      } catch (err) {
        status.textContent = `Ошибка: ${err.message}`;
      }
    }

    async function loadLevels() {
      const select = document.getElementById('levels-select');
      const status = document.getElementById('levels-status');
      const log = document.getElementById('levels-log');
      status.textContent = 'Загружаем…';
      log.textContent = '';
      try {
        const data = await apiRequest('levels', { exercise: select.value });
        log.textContent = data.levels
          .map(level => `${level.level} — ${level.name} (${level.sets}×${level.reps})`)
          .join('\n');
        status.textContent = `Всего уровней: ${data.levels.length}`;
      } catch (err) {
        status.textContent = `Ошибка: ${err.message}`;
      }
    }

    document.getElementById('refresh-plan').addEventListener('click', loadPlan);
    document.getElementById('log-form').addEventListener('submit', submitLog);
    document.getElementById('load-levels').addEventListener('click', loadLevels);

    document.getElementById('log-form').querySelector('[name="Дата"]').value = isoToday();
    loadPlan();
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

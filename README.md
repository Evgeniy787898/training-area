# Training Area — Convict Conditioning Toolkit

Этот репозиторий содержит готовые артефакты для развёртывания приложения «Дневник прогрессии по системе Пола Уэйда» на базе Google Sheets + Google Apps Script:

- `convict-conditioning-solution.md` — подробный blueprint с описанием листов, формул, тестов и FAQ.
- `apps-script/Code.js` — готовый бэкенд на Google Apps Script с REST API.
- `frontend/index.html` — минимальный демо-фронтенд на чистом HTML/JS (fetch).
- `data/levels.csv` — полный каталог прогрессии для 6 движений (10×3 уровней).
- `data/weekly_program.csv` — пример недельной программы (2 упражнения × 6 дней).

## Быстрый старт

1. Импортируйте CSV-файлы `data/levels.csv` и `data/weekly_program.csv` в листы `Справочник_Уровней` и `Программа_Недели` (Plain text для колонок `Уровень`).
2. Вставьте код из `apps-script/Code.js` в редактор Google Apps Script и задеплойте как Web App.
3. Откройте `frontend/index.html`, заполните `WEBAPP_URL` и `API_KEY`, протестируйте запросы.

Подробные шаги по настройке, прогрессии и тест-кейсы см. в `convict-conditioning-solution.md`.

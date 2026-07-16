# AtriumSense

Full-stack сервис мониторинга комфорта в атриуме Nazarbayev University.
Превращает поток сообщений телеграм-датчиков (`result.json`) в понятный
дашборд: текущее состояние атриума, история измерений с фильтрами,
аналитика по дням и отчёты пользователей о реальных условиях.

Сделано для Code Girl Summer 2026 Hackathon Case («Умный мониторинг
комфорта в атриуме университета»).

## Ссылки

- Frontend (Vercel): https://frontend-swart-phi-97.vercel.app
- Backend (Railway): https://atriumsense-backend-production.up.railway.app (docs: `/docs`)
- GitHub: https://github.com/dev-riza/Gummy-Bear

## Стек

| Слой      | Технология                          |
| --------- | ------------------------------------ |
| Frontend  | React + TypeScript (Vite), React Router, Recharts |
| Backend   | Python + FastAPI                     |
| База данных | SQLite                             |
| ORM       | SQLAlchemy                           |
| Обмен данными | REST API + JSON                  |

## Структура проекта

```
backend/
  app/
    main.py         # точка входа FastAPI, CORS, автозапуск сидирования
    database.py      # engine/session SQLAlchemy
    models.py         # ORM-модели Reading, Report
    schemas.py         # Pydantic-схемы запросов/ответов
    parser.py           # парсер сырых сообщений Telegram-экспорта
    analytics.py          # статусы комфорта, comfort score, рекомендации
    seed.py                 # идемпотентный импорт data/result.json в SQLite
    routers/
      readings.py            # /api/readings, /api/readings/{id}, /api/current, CSV-экспорт
      summary.py               # /api/summary, /api/summary/available-dates
      reports.py                # CRUD /api/reports
  data/result.json              # исходный экспорт Telegram-канала
  requirements.txt
frontend/
  src/
    api/            # типы + клиент REST API
    components/      # Layout, Badge, States (loading/error/empty), ConfirmDialog
    context/           # ThemeContext (светлая/тёмная тема), ToastContext
    pages/               # Home, History, Analytics, Reports
    index.css              # золото-белая дизайн-система (+ тёмная тема)
```

## Локальный запуск

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed               # импортирует data/result.json в atrium.db (один раз)
uvicorn app.main:app --reload --port 8000
```

API поднимется на `http://localhost:8000`, документация — на
`http://localhost:8000/docs`. При первом запуске `main.py` тоже сам
досеивает базу, если она пустая, так что шаг с `seed.py` не строго
обязателен, но рекомендован для явности.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Откроется `http://localhost:5173`. `vite.config.ts` проксирует `/api/*`
на `http://127.0.0.1:8000`, поэтому в локальной разработке переменные
окружения не нужны.

Для сборки под деплой, если backend находится на другом домене,
задайте:

```
VITE_API_URL=https://your-backend.up.railway.app
```

в `frontend/.env.production` (или в переменных окружения Vercel).

## Импорт данных

`backend/app/parser.py` разбирает текстовые сообщения вида
`"🏫 Atrium: 🌡 29.75ºC 💡 Dark 🔇 Quiet"` и `"🌍 Outside NU: 🌡 24.0°C"`
в структурированные записи `Reading` (`measured_at`, `location`,
`temperature`, `brightness`, `noise`). Освещение и шум присутствуют
только у измерений `atrium` — у `outside` они всегда `null`, как и
требует кейс. `backend/app/seed.py` запускает импорт один раз при
пустой таблице (при старте приложения и/или вручную).

## Правила определения комфорта (comfort score)

Все пороги — собственная редакционная логика приложения, подобранная
под диапазон наблюдаемых данных (внутри ~27-33°C, снаружи ~19-38°C).
Это **не** медицинская или официальная санитарная рекомендация.

**Текстовый статус температуры** (`analytics.temperature_status`):

| Диапазон      | Статус        |
| ------------- | ------------- |
| < 20°C        | Прохладно     |
| 20–27°C       | Комфортно     |
| 27–30°C       | Тепло         |
| 30–33°C       | Жарко         |
| ≥ 33°C        | Очень жарко   |

**Comfort score (0–100)** — свой показатель, учитывающий три сигнала:

1. Температура: без штрафа в диапазоне 20–27°C; штраф растёт с
   отклонением, причём выше 30°C и особенно выше 33°C — резче.
2. Шум: `Quiet` — 0 штрафа, `Mild noise` −10, `Noisy` −25, `Very noisy` −40.
3. Освещение: `Normal brightness` — 0 штрафа, `Bright` −5, `Dim` −8,
   `Dark`/`Very bright` −15 (слишком темно или слишком ярко одинаково
   мешают учёбе).

Итоговый score = 100 − сумма штрафов, ограничен диапазоном [0, 100].
Читается в `/api/readings`, `/api/current` и `/api/summary` только для
измерений `atrium` (у `outside` нет шума/освещения, поэтому score не
считается).

**Рекомендация** (`study_recommendation`): «Подходит для учёбы», если
температура ≤ 29°C и шум не выше `Mild noise`; иначе — «Лучше выбрать
другое место».

## Аналитика (`/api/summary`)

За выбранный день считаются: мин/макс/средняя температура в атриуме и
на улице, средняя разница внутри/снаружи, количество некомфортных
измерений (`comfort_score < 60`), средний comfort score, а также пять
собственных аналитических выводов: самое прохладное время, самый
жаркий период, самое тихое время, лучший период для учёбы (максимум
comfort score за день) и количество некомфортных измерений.

## Реализованные обязательные функции

- Импорт `result.json` → SQLite через SQLAlchemy ORM.
- Текущее состояние атриума с текстовой оценкой и рекомендацией.
- История измерений: таблица, фильтры по дате/месту/шуму/освещению/
  диапазону температуры, сортировка по времени и температуре, пагинация.
- Аналитика: мин/макс/средняя температура за день + 5 собственных
  выводов.
- Отчёты пользователей: полный CRUD (создание, просмотр, редактирование,
  удаление), поле `status` (`open`/`resolved`).
- REST API: `GET/POST/PATCH/DELETE`, корректные HTTP-коды (200/201/204/
  404/422), валидация через Pydantic.
- Состояния интерфейса: загрузка, ошибка, пустой результат, успешное
  действие (toast-уведомления).
- Адаптивный интерфейс (ноутбук/телефон).

## Реализованные бонусные функции

- **Визуализация**: график температуры внутри/снаружи (Recharts) с
  переключением между днями.
- **Умные рекомендации**: собственный comfort score, «лучшее время для
  учёбы», текстовая рекомендация на главной странице.
- **Работа с данными**: экспорт истории измерений в CSV (с учётом
  активных фильтров), пагинация, дополнительные фильтры (шум,
  освещение, диапазон температуры).
- **UX**: светлая/тёмная тема (переключатель в шапке), разные цветовые
  состояния (badge) для комфортных/проблемных условий, подтверждение
  перед удалением отчёта, toast-уведомления об успешных действиях,
  отметка отчёта решённым и обратно.

## API

| Метод | Маршрут                     | Описание                                  |
| ----- | ---------------------------- | ------------------------------------------ |
| GET   | `/api/readings`               | список измерений (фильтры, сортировка, пагинация) |
| GET   | `/api/readings/{id}`           | одно измерение                            |
| GET   | `/api/readings/export`          | CSV-экспорт (те же фильтры)              |
| GET   | `/api/current`                    | последнее состояние атриум/улица + рекомендация |
| GET   | `/api/summary`                      | статистика и выводы за день             |
| GET   | `/api/summary/available-dates`        | список дат, для которых есть данные   |
| GET   | `/api/reports`                          | список отчётов (фильтр по статусу)  |
| POST  | `/api/reports`                           | создать отчёт                      |
| PATCH | `/api/reports/{id}`                       | изменить отчёт (категория/комментарий/статус) |
| DELETE| `/api/reports/{id}`                        | удалить отчёт                    |

## Деплой

Уже развёрнуто: backend на Railway (`backend/Procfile` →
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, переменная
`CORS_ORIGINS` указывает на домен Vercel), frontend на Vercel
(`frontend/.env.production` → `VITE_API_URL` указывает на домен
Railway). Ссылки — в начале README.

Чтобы задеплоить свою копию:

1. Запушить репозиторий на GitHub.
2. Backend в Railway: указать `backend/` как корень сервиса (Procfile
   уже задаёт команду запуска), переменная
   `CORS_ORIGINS=https://<ваш-домен>.vercel.app`.
3. Frontend в Vercel: указать `frontend/` как корень проекта, переменная
   окружения `VITE_API_URL=https://<ваш-backend>.up.railway.app`.

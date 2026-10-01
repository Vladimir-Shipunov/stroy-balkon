# БАЛКОН-МСК — сайт и 2D-конфигуратор балконов

Премиальный сайт компании по остеклению и отделке балконов в Москве: маркетинговые
страницы, **2D-конфигуратор** (готовые сцены балконов: планировки, остекление, отделка, мебель, свет), **админка заказов** и встроенный **AI-консультант** на базе Claude.

## Стек

- **Frontend (сайт):** React 18 + TypeScript + React Router + Vite, CSS Modules.
  Исходники в [`src/`](src/), точка входа — [`index.html`](index.html) → [`src/main.tsx`](src/main.tsx).
- **Backend (API):** Node.js + Express + SQLite (better-sqlite3). Исходники в [`server/`](server/).
- **Легаси-сайт:** статические страницы в [`public/`](public/) (исторические, обслуживаются Express).

## Запуск для разработки

Нужны два процесса:

```bash
npm install

# 1) API-сервер (Express) на http://localhost:3000
npm run dev          # nodemon, авто-перезапуск   (или npm start — без перезапуска)

# 2) Vite dev-сервер (сайт) на http://localhost:5173
npm run dev:app
```

Vite проксирует запросы `/api/*` на Express (`:3000`), поэтому формы заявок и AI-чат
работают в режиме разработки. Откройте сайт по адресу из вывода `npm run dev:app`.

## Сборка

```bash
npm run typecheck    # проверка типов (tsc --noEmit)
npm run build:app    # сборка SPA в public/app/ (отдаётся Express под /app/)
```

Готовая сборка кладётся в [`public/app/`](public/app/); Express отдаёт её и API из одного
источника, так что CORS-настройки в продакшене не требуются.

## ⚙️ Переменные окружения

Скопируйте [`.env.example`](.env.example) в `.env` и заполните нужные значения.

### AI-консультант (Claude)

AI-чат в правом нижнем углу работает через эндпоинт `POST /api/ai-chat`, который
обращается к Claude. Чтобы его включить:

1. Получите API-ключ на <https://console.anthropic.com/>.
2. Добавьте в `.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   # необязательно — модель по умолчанию claude-sonnet-4-6
   ANTHROPIC_MODEL=claude-sonnet-4-6
   ```
3. Перезапустите Express.

Без ключа чат **не падает**: эндпоинт отвечает 503, а виджет показывает вежливое
сообщение и предлагает оставить заявку. Ключ хранится только на сервере и в браузер
не попадает.

Возможности AI: отвечает по-русски как консультант по ремонту балконов, видит текущую
страницу и конфигурацию балкона, может **менять сцену конфигуратора** (планировка, остекление,
отделка, плинтус, свет, мебель) и при намерении заказать — открыть форму записи на замер.

## 🧱 Сцены конфигуратора — ассеты public/vam/

Конфигуратор собирает балкон из готовых картинок-слоёв (пол → стены/потолок/окна →
плинтус → мебель → светильник), лежащих в [public/vam/](public/vam/). Слои и каталог
генерирует скрипт [scripts/importVamAssets.mjs](scripts/importVamAssets.mjs) из локальной
распаковки приложения-образца (D:\VamBalkon_extract — путь можно передать аргументом);
результат (файлы и [amManifest.ts](src/pages/Configurator/vamManifest.ts)) лежит в репозитории,
в рантайме внешний путь не читается. Как устроены исходные ассеты и что подключено —
в [docs/vam-2d-mapping.md](docs/vam-2d-mapping.md).

```bash
node scripts/importVamAssets.mjs [путь-до-VamBalkon_extract]   # пересобрать public/vam и манифест
```

Цены конфигуратор не считает: заявка на замер уходит с описанием выбранной
конфигурации (metadata.summary) и картинкой сцены, смету делает специалист.
## Структура сайта (`src/`)

```
src/
  app/App.tsx              — роутер, провайдеры, AI-виджет
  components/              — Header, Footer, CallModal, ChatWidget, общие
  pages/
    Home, Services, Portfolio, About, Contacts, NotFound
    Configurator/          — 2D-сцена (VamScene), панели, состояние, каталог сцен
    Admin/OrdersAdmin      — заказы (по токену)
  data/site.ts             — контент компании
  styles/                  — токены дизайна + глобальные стили
```

## Маршруты

| Путь | Назначение |
|---|---|
| `/` | Главная |
| `/services` | Услуги и цены |
| `/portfolio` | Портфолио |
| `/about` | О компании |
| `/contacts` | Контакты (форма + карта) |
| `/configurator` | 2D-конфигуратор балкона |
| `/admin/orders` | Заказы (по административному токену) |

## API (Express)

- `POST /api/request-call` — заявка на звонок `{ name, phone }`
- `POST /api/orders` — заказ
- `POST /api/ai-chat` — AI-консультант `{ page, config, messages }`
- `GET /api/health` — статус сервера


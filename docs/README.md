# Retail Price Monitor

MVP PWA/web app для збору цін по продуктових мережах України для RGM, комерції, маркетингу та трейд-маркетингу.

## Що реалізовано

- React + TypeScript + Vite frontend.
- Express + TypeScript backend.
- Parser architecture з adapter pattern.
- Demo parser adapters: `АТБ МАРКЕТ`, `МЕТРО`, `АШАН`.
- Generic/manual parser для мереж без реалізованого adapter.
- Throttling, retry, timeout і user-agent параметри в `BaseParser`.
- Anti-duplicate logic на рівні API response.
- Excel export у `/exports`.
- Manual Excel import через кнопку `Імпорт Excel вручну`; очікується workbook із sheet `Prices` у тому ж форматі колонок.
- Multi-network batch run: можна обрати декілька активних мереж, результат агрегується в одну таблицю та один Excel export.
- Sheets: `Prices`, `Errors`, `Summary`.
- Автофільтри, freeze top row, форматування цін.
- Логування у `/logs/parser.log`.
- PWA manifest.

## Команди запуску

```bash
npm install
npm run dev
```

Frontend: `http://127.0.0.1:5173`

Backend API: `http://127.0.0.1:4000`

## Доступ для колег

Рекомендований локальний режим для команди в одній мережі:

```bash
npm run build
npm start
```

Після запуску колеги відкривають:

```text
http://<IP-адреса-цього-компʼютера>:4000
```

Дізнатись IP на Windows:

```powershell
ipconfig
```

Для dev режиму можна також відкрити Vite URL з локальної мережі, який показує `npm run dev`, але production режим на `:4000` стабільніший для спільного користування.

## Production build

```bash
npm run build
```

## CLI parser

```bash
npm run parse
```

Параметри через env:

```bash
NETWORK="АТБ МАРКЕТ" CITY="Київ" CATEGORY="М’ясо птиці" npm run parse
```

## Excel exports

Файли зберігаються у:

```text
/exports
```

Формат імені:

```text
retail-prices-YYYY-MM-DDTHH-MM-SS.xlsx
```

## Production adapters

За замовчуванням app працює у production-first режимі:

- `html/api` adapters пробують публічні search/category сторінки, JSON-LD, `__NEXT_DATA__` і HTML product blocks.
- `playwright` adapters призначені для динамічних каталогів.
- `manual` adapters не повертають fake SKU, а створюють `MANUAL_REQUIRED`.
- Demo data вмикається тільки через `DEMO_MODE=true`.

Coverage у MVP:

- `stores-api.zakaz.ua`: `МЕТРО`, `АШАН`, `НОВУС`, `ТАВРІЯ В`, `МЕГА-МАРКЕТ`, `УЛЬТРАМАРКЕТ`, `ВОСТОРГ`, `ЧУДО МАРКЕТ`, `ЕПІЦЕНТР`, `ІДЕАЛ`.
- `WooCommerce Store API`: `ВЕЛИКА КИШЕНЯ`.
- `EcomCatalogGlobal API`: `ФОРА`.
- `Vue Storefront + Multisearch`: `ВАРУС`.
- `Playwright DOM category adapter`: `ФОЗЗІ`.
- `GraphQL search`: `ТРАШ`.
- `manual`: `АТБ МАРКЕТ` та мережі без підтвердженого публічного каталогу/API.

`АТБ МАРКЕТ`: серверний доступ до публічних search URL повертає `HTTP 403`, тому production adapter не робить повторні спроби і не обходить блокування. Для ATB потрібен легальний API/partner feed, ручний Excel import або затверджений браузерний workflow.

Discovery по додаткових мережах:

- `ФОРА`: працює через `GetSimpleCatalogItems`, базовий `filialId=310`, `deliveryType=2`, `merchantId=4`.
- `ВАРУС`: працює через `api.multisearch.io` для пошуку ID і `product_v2/_search` для SKU details, `shop_id=57`.
- `ТРАШ`: працює через публічний GraphQL `search`.
- `ФОЗЗІ`: працює через Playwright DOM adapter по публічних category pages. Direct HTTP fetch повертає `403`, тому на Windows adapter за замовчуванням використовує системний `msedge` channel без stealth/proxy/captcha обходу.

## Demo mode

Щоб увімкнути demo data:

```bash
DEMO_MODE=true npm run dev
```

Demo data повертають:

- `АТБ МАРКЕТ`
- `МЕТРО`
- `АШАН`

Інші мережі повертають статус `потребує ручної перевірки` і помилку `MANUAL_REQUIRED`.

## Production roadmap

1. Зробити site discovery для кожної мережі: API, HTML, Playwright, manual.
2. Затвердити legal/compliance правила scraping для кожного сайту.
3. Додати mapping категорій і міст/магазинів.
4. Реалізувати adapters за пріоритетом business impact.
5. Додати Supabase storage для історії цін.
6. Додати scheduler на Vercel Cron або окремий worker.
7. Додати Power BI-ready model: price history, promo depth, price index, manufacturer/brand hierarchy.

## Ризики

- Частина мереж не має стабільного онлайн-каталогу.
- Сайти можуть змінювати DOM/API без попередження.
- Ціни можуть залежати від міста, магазину, доставки або авторизованої сесії.
- Необхідно не обходити авторизацію і збирати тільки публічні дані.

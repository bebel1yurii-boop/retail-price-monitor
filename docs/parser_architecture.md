# Parser Architecture

## Ціль

Єдина таблиця цін незалежно від джерела: API, HTML, Playwright або manual import.

## Потік даних

```mermaid
flowchart LR
  UI["React UI"] --> API["/api/parse"]
  API --> Factory["Parser Factory"]
  Factory --> Adapter["Network Adapter"]
  Adapter --> Raw["Raw Products"]
  Raw --> Norm["Normalization Service"]
  Norm --> Rows["Price Rows"]
  Rows --> Export["Excel Service"]
  Export --> XLSX["/exports/*.xlsx"]
```

## Adapter pattern

Кожна мережа має окремий parser adapter:

- `atbParser.ts`
- `metroParser.ts`
- `auchanParser.ts`
- `silpoParser.ts`
- `novusParser.ts`
- `foraParser.ts`
- `genericParser.ts`

`parserFactory.ts` вибирає adapter за назвою мережі.

## Production-first mode

За замовчуванням app працює у production-first режимі:

- `adapterConfigs.ts` містить coverage по кожній мережі зі списку.
- `SearchHtmlParser` пробує публічні search/category URL, JSON-LD, `__NEXT_DATA__` і HTML product blocks.
- `PlaywrightSearchParser` використовується для мереж із динамічним каталогом.
- `GenericParser` у production не повертає fake SKU; якщо каталог/API не підтверджений, повертає `MANUAL_REQUIRED`.
- Старі demo adapters доступні тільки через `DEMO_MODE=true`.

Production guardrail:

- якщо сайт не віддає публічні товарні дані, adapter повертає контрольовану помилку;
- parser не обходить авторизацію;
- parser не використовує приватні або персональні дані;
- search budget обмежений через `PARSER_BUDGET_MS`;
- кількість query на категорію можна обмежити через `MAX_SEARCH_QUERIES`.
- `401/403/404` не retry-яться, щоб не створювати агресивний трафік і не блокувати UI.

## Environment flags

```bash
DEMO_MODE=true npm run dev
MAX_SEARCH_QUERIES=3 npm run dev
PARSER_BUDGET_MS=55000 npm run dev
```

## BaseParser

`BaseParser` містить production guardrails:

- delay між запитами: 2-5 секунд
- retry: 3 спроби
- timeout: 30 секунд
- max parallel pages: 2
- user-agent
- cache directory для сторінок
- централізоване формування помилок

## Normalization

`normalizationService.ts`:

- чистить назви SKU
- приводить ціни до number
- визначає pack/weight з назви
- визначає manufacturer/brand за словником
- рахує promo flag і discount %
- приводить мережі до єдиного написання

## Manual required

Для мереж без стабільного каталогу або без adapter:

- повертається один template row
- `sourceStatus = потребує ручної перевірки`
- створюється error `MANUAL_REQUIRED`
- Excel export все одно формується

## Production adapter checklist

1. Перевірити robots.txt, ToS і legal restrictions.
2. Визначити тип джерела: API, HTML, Playwright, manual.
3. Зробити mapping міста/магазину.
4. Зробити mapping категорій.
5. Додати throttling і retry через `BaseParser`.
6. Логувати помилки по кожному URL/SKU.
7. Не зупиняти весь процес при помилці одного товару.
8. Додати unit test на normalization.
9. Додати smoke test на 5-10 SKU.

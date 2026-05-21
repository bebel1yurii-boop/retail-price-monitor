# Discovery Status

## Підключено

| Мережа | Технічний шлях | Статус |
|---|---|---|
| МЕТРО | `stores-api.zakaz.ua` | Працює |
| АШАН | `stores-api.zakaz.ua` | Працює |
| НОВУС | `stores-api.zakaz.ua` | Працює |
| ТАВРІЯ В | `stores-api.zakaz.ua` | Працює |
| МЕГА-МАРКЕТ | `stores-api.zakaz.ua` | Працює |
| УЛЬТРАМАРКЕТ | `stores-api.zakaz.ua` | Працює |
| ВОСТОРГ | `stores-api.zakaz.ua` | Працює |
| ЧУДО МАРКЕТ | `stores-api.zakaz.ua` | Працює |
| ЕПІЦЕНТР FOOD | `stores-api.zakaz.ua` | Працює, але саме FOOD store |
| ІДЕАЛ | `stores-api.zakaz.ua` | Працює |
| ВЕЛИКА КИШЕНЯ | WooCommerce Store API `/wp-json/wc/store/products` | Часткове покриття |
| ФОРА | `api.catalog.ecom.fora.ua/api/2.0/exec/EcomCatalogGlobal`, method `GetSimpleCatalogItems` | Працює |
| ВАРУС | `api.multisearch.io` для ID + `varus.ua/api/catalog/vue_storefront_catalog_2/product_v2/_search` для деталей | Працює |
| ФОЗЗІ | Playwright DOM adapter через публічні category pages `fozzyshop.ua`, системний browser channel `msedge` на Windows | Працює, HTTP fetch напряму блокується |
| ТРАШ | `thrash.ua/graphql`, query `search` | Працює |

## Потребують окремого adapter

| Мережа | Що знайдено | Наступний крок |
|---|---|---|
| АТБ | `HTTP 403` для server-side search URLs | Legal API/feed/manual import |

## Велика Кишеня

Working endpoints:

```text
https://kishenya.ua/wp-json/wc/store/products?search=ковбаса&per_page=100
https://kishenya.ua/wp-json/wc/store/products/categories
```

Limitations:

- API search добре працює по ковбасах і частині напівфабрикатів.
- Для `М’ясо птиці` покриття часткове, бо у відкритому WooCommerce Store API не видно повного food category tree, лише promo/sales catalog.

## Fozzy

Direct server-side HTTP requests return `403`, але публічні category pages коректно відкриваються системним браузером без stealth/proxy:

```text
https://fozzyshop.ua/3839-ptytsya
https://fozzyshop.ua/3832-napivfabrykaty-m-yasni
https://fozzyshop.ua/3665-kovbasa-m-yasni-vyroby
```

Adapter читає `.product-mini-card`, пагінацію `?page=N`, `data-product-id`, `data-product-name`, `data-category-name`, `.old_price`, `.regular_price`, `.price_drop`, image URL та product URL.

Production note: на Windows за замовчуванням використовується Playwright `channel: "msedge"`, бо bundled Chromium з кастомним user-agent отримує `403`. Це не anti-bot bypass: без stealth, proxy, captcha або fingerprint spoofing. Для серверного deployment потрібен встановлений системний browser channel або погоджений API/feed від Fozzy.

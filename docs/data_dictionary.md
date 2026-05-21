# Data Dictionary

## Prices sheet

| Column | Field | Description |
|---|---|---|
| A | Collection Date | Дата збору даних у форматі YYYY-MM-DD |
| B | Network | Торгова мережа |
| C | City | Місто збору |
| D | Category Group | Бізнес-група товару |
| E | Category Source | Назва категорії на сайті джерела |
| F | Manufacturer | Виробник, визначений словником |
| G | Brand | Бренд, визначений словником |
| H | SKU | Назва товару |
| I | Pack / Weight | Вага або фасування |
| J | Regular Price | Регулярна ціна |
| K | Promo Price | Промо ціна |
| L | Discount % | Розрахунок `(regular_price - promo_price) / regular_price * 100` |
| M | Promo Flag | `так` або `ні` |
| N | Promo Start Date | Дата початку промо, якщо доступна |
| O | Promo End Date | Дата завершення промо, якщо доступна |
| P | Product URL | Посилання на товар |
| Q | Comment | Коментар parser adapter |
| R | Source Status | `успішно`, `помилка`, `потребує ручної перевірки` |

## Errors sheet

| Field | Description |
|---|---|
| Date | Timestamp помилки |
| Network | Торгова мережа |
| City | Місто |
| Group | Група товару |
| URL | URL, де сталася помилка |
| Error Type | Класифікація помилки |
| Error Text | Текст помилки |
| Manual Review | Чи потрібна ручна перевірка |

## Summary sheet

- SKU Count
- Promo SKU Count
- Average Regular Price
- Average Promo Price
- Average Discount %
- Error Count
- SKU by Manufacturer
- SKU by Network

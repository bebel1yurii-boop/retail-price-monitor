import type { PriceRow } from '../types';

interface Props {
  rows: PriceRow[];
}

export function ResultsTable({ rows }: Props) {
  return (
    <section className="table-panel">
      <div className="section-title">
        <h2>Результати збору</h2>
        <span>{rows.length} SKU</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Мережа</th>
              <th>Місто</th>
              <th>Група</th>
              <th>Категорія джерела</th>
              <th>Виробник</th>
              <th>Бренд</th>
              <th>SKU</th>
              <th>Вага</th>
              <th>Рег. ціна</th>
              <th>Промо</th>
              <th>Знижка</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="empty-cell">
                  Запустіть парсинг, щоб побачити результати.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={`${row.network}-${row.city}-${row.sku}`}>
                <td>{row.collectionDate}</td>
                <td>{row.network}</td>
                <td>{row.city}</td>
                <td>{row.categoryGroup}</td>
                <td>{row.categorySource}</td>
                <td>{row.manufacturer}</td>
                <td>{row.brand}</td>
                <td className="sku-cell">{row.sku}</td>
                <td>{row.packWeight || '-'}</td>
                <td>{formatPrice(row.regularPrice)}</td>
                <td>{formatPrice(row.promoPrice)}</td>
                <td>{row.discountPct !== null ? `${row.discountPct}%` : '-'}</td>
                <td>
                  <span className={`status status-${statusClass(row.sourceStatus)}`}>{row.sourceStatus}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatPrice(value: number | null) {
  return value === null ? '-' : new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function statusClass(status: PriceRow['sourceStatus']) {
  if (status === 'успішно') return 'success';
  if (status === 'помилка') return 'error';
  return 'manual';
}

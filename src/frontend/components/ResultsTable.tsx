import { useState } from 'react';
import type { PriceRow } from '../types';

interface Props {
  rows: PriceRow[];
}

export function ResultsTable({ rows }: Props) {
  const extended = rows.some((row) => row.extendedMode === 'так');
  const [view, setView] = useState<'base' | 'extended'>('base');
  const showExtended = extended && view === 'extended';

  return (
    <section className="table-panel">
      <div className="section-title">
        <h2>Результати збору</h2>
        <div className="section-title-meta">
          {extended && (
            <div className="table-view-switch" role="tablist" aria-label="Вид таблиці">
              <button className={view === 'base' ? 'active' : ''} role="tab" aria-selected={view === 'base'} onClick={() => setView('base')}>
                Основні поля
              </button>
              <button className={view === 'extended' ? 'active' : ''} role="tab" aria-selected={view === 'extended'} onClick={() => setView('extended')}>
                Розширені поля
              </button>
            </div>
          )}
          <span>{rows.length} SKU</span>
        </div>
      </div>
      <div className="table-wrap">
        <table className={showExtended ? 'extended-table' : ''}>
          <thead>
            {showExtended ? <ExtendedHeaders /> : <BaseHeaders />}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={showExtended ? 14 : 13} className="empty-cell">
                  Запустіть парсинг, щоб побачити результати.
                </td>
              </tr>
            )}
            {rows.map((row) => showExtended ? <ExtendedRow key={`${row.network}-${row.city}-${row.sku}`} row={row} /> : <BaseRow key={`${row.network}-${row.city}-${row.sku}`} row={row} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BaseHeaders() {
  return (
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
  );
}

function BaseRow({ row }: { row: PriceRow }) {
  return (
    <tr>
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
      <td><Status value={row.sourceStatus} /></td>
    </tr>
  );
}

function ExtendedHeaders() {
  return (
    <tr>
      <th>Мережа</th>
      <th>SKU</th>
      <th>SKU ID</th>
      <th>EAN</th>
      <th>Ціна за кг / л</th>
      <th>Наявність</th>
      <th>Залишок</th>
      <th>Доставка</th>
      <th>Pickup</th>
      <th>Промо-механіка</th>
      <th>Позиція</th>
      <th>Фото</th>
      <th>Completeness</th>
      <th>Статус</th>
    </tr>
  );
}

function ExtendedRow({ row }: { row: PriceRow }) {
  return (
    <tr>
      <td>{row.network}</td>
      <td className="sku-cell">{row.sku}</td>
      <td>{row.externalSkuId || '-'}</td>
      <td>{row.ean || '-'}</td>
      <td>{row.unitPrice !== null && row.unitPrice !== undefined ? `${formatPrice(row.unitPrice)} ${row.unitPriceBasis}` : '-'}</td>
      <td>{row.availabilityStatus || '-'}</td>
      <td>{row.stockQuantity ?? '-'}</td>
      <td>{row.deliveryAvailable || '-'}</td>
      <td>{row.pickupAvailable || '-'}</td>
      <td>{row.promoMechanic || '-'}</td>
      <td>{row.categoryPosition ?? '-'}</td>
      <td>{row.imageCount ?? '-'}</td>
      <td>{row.cardCompletenessPct !== null && row.cardCompletenessPct !== undefined ? `${row.cardCompletenessPct}%` : '-'}</td>
      <td><Status value={row.sourceStatus} /></td>
    </tr>
  );
}

function Status({ value }: { value: PriceRow['sourceStatus'] }) {
  return <span className={`status status-${statusClass(value)}`}>{value}</span>;
}

function formatPrice(value: number | null) {
  return value === null ? '-' : new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function statusClass(status: PriceRow['sourceStatus']) {
  if (status === 'успішно') return 'success';
  if (status === 'помилка') return 'error';
  return 'manual';
}

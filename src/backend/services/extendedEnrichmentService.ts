import type { PriceRow } from '../types';

export function enrichRows(rows: PriceRow[]): PriceRow[] {
  return rows.map((row, index) => {
    const pack = parsePack(row.packWeight || row.sku);
    const currentPrice = row.promoPrice ?? row.regularPrice;
    const unitPrice = calculateUnitPrice(currentPrice, pack);
    const ean = row.ean || extractEan(`${row.sku} ${row.comment}`);
    const externalSkuId = row.externalSkuId || extractExternalSkuId(row);
    const imageCount = row.imageCount ?? (row.imageUrl ? 1 : 0);
    const completenessFields = [
      row.sku,
      row.categorySource,
      row.manufacturer !== 'Не визначено' ? row.manufacturer : '',
      row.brand !== 'Не визначено' ? row.brand : '',
      row.packWeight,
      row.regularPrice,
      row.productUrl,
      row.imageUrl,
      ean
    ];

    return {
      ...row,
      externalSkuId,
      ean,
      unitPrice,
      unitPriceBasis: pack?.basis ?? '',
      availabilityStatus: row.availabilityStatus || (row.sourceStatus === 'успішно' ? 'доступно онлайн' : ''),
      stockQuantity: row.stockQuantity ?? null,
      deliveryAvailable: row.deliveryAvailable || '',
      pickupAvailable: row.pickupAvailable || '',
      storeName: row.storeName || '',
      storeAddress: row.storeAddress || '',
      countryOfOrigin: row.countryOfOrigin || '',
      productComposition: row.productComposition || '',
      promoMechanic: row.promoMechanic || (row.promoFlag === 'так' ? 'цінова знижка' : ''),
      loyaltyPrice: row.loyaltyPrice ?? null,
      minimumPromoQuantity: row.minimumPromoQuantity ?? null,
      onlineExclusive: row.onlineExclusive || '',
      categoryPosition: row.categoryPosition ?? index + 1,
      searchPosition: row.searchPosition ?? null,
      imageCount,
      cardCompletenessPct: row.cardCompletenessPct ?? calculateCompleteness(completenessFields),
      rating: row.rating ?? null,
      reviewCount: row.reviewCount ?? null,
      badges: row.badges || '',
      extendedMode: 'так'
    };
  });
}

function extractExternalSkuId(row: PriceRow) {
  const fromComment = row.comment.match(/\b(?:id|sku|articul)=([a-z0-9_-]+)/i)?.[1];
  if (fromComment) return fromComment;
  return row.productUrl.match(/\/(\d+)(?:[-/.]|$)/)?.[1] ?? '';
}

function extractEan(value: string) {
  return value.match(/\b(\d{13})\b/)?.[1] ?? '';
}

function parsePack(value: string) {
  const match = value.match(/(\d+(?:[,.]\d+)?)\s*(кг|г|гр|л|мл)/i);
  if (!match) return null;
  const quantity = Number.parseFloat(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (unit === 'г' || unit === 'гр') return { quantity: quantity / 1000, basis: 'за кг' };
  if (unit === 'мл') return { quantity: quantity / 1000, basis: 'за л' };
  return { quantity, basis: unit === 'кг' ? 'за кг' : 'за л' };
}

function calculateUnitPrice(price: number | null, pack: ReturnType<typeof parsePack>) {
  if (price === null || !pack) return null;
  return Number((price / pack.quantity).toFixed(2));
}

function calculateCompleteness(values: unknown[]) {
  const filled = values.filter((value) => value !== '' && value !== null && value !== undefined).length;
  return Math.round((filled / values.length) * 100);
}

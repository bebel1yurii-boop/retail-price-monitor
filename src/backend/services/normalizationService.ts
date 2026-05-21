import { detectBrand, detectManufacturer } from './manufacturerService';
import { calculatePromo } from './promoService';
import type { PriceRow } from '../types';

export interface RawProduct {
  sku: string;
  regularPrice?: string | number | null;
  promoPrice?: string | number | null;
  productUrl?: string;
  categorySource?: string;
  imageUrl?: string;
  promoStartDate?: string;
  promoEndDate?: string;
  comment?: string;
  manufacturer?: string;
  brand?: string;
}

export function normalizePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractPackWeight(name: string): string {
  const match = name.match(/(\d+(?:[,.]\d+)?\s?(?:кг|г|гр|мл|л|шт))/i);
  return match?.[1]?.replace(',', '.') ?? '';
}

export function cleanSkuName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function normalizeNetwork(network: string): string {
  return network.trim().toUpperCase();
}

export function normalizeProduct(raw: RawProduct, context: { network: string; city: string; category: string }): PriceRow {
  const sku = cleanSkuName(raw.sku);
  const regularPrice = normalizePrice(raw.regularPrice);
  const promoPrice = normalizePrice(raw.promoPrice);
  const promo = calculatePromo(regularPrice, promoPrice);

  return {
    collectionDate: new Date().toISOString().slice(0, 10),
    network: normalizeNetwork(context.network),
    city: context.city,
    categoryGroup: context.category,
    categorySource: raw.categorySource ?? context.category,
    manufacturer: raw.manufacturer ?? detectManufacturer(sku),
    brand: raw.brand ?? detectBrand(sku),
    sku,
    packWeight: extractPackWeight(sku),
    regularPrice,
    promoPrice,
    discountPct: promo.discountPct,
    promoFlag: promo.promoFlag,
    promoStartDate: raw.promoStartDate ?? '',
    promoEndDate: raw.promoEndDate ?? '',
    productUrl: raw.productUrl ?? '',
    imageUrl: raw.imageUrl,
    comment: raw.comment ?? '',
    sourceStatus: 'успішно'
  };
}

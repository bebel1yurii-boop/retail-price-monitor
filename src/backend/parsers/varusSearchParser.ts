import { BaseParser } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

interface MultiSearchResponse {
  total: number;
  results?: {
    items?: Array<{ id: string }>;
  };
}

interface VarusCatalogResponse {
  hits?: VarusProduct[];
  total?: number;
}

interface VarusProduct {
  id: number;
  sku: string;
  name: string;
  image?: string;
  slug?: string;
  url_key?: string;
  url_path?: string;
  regular_price?: number;
  special_price_discount?: number;
  special_price_to_date?: string | null;
  weight?: number | string;
  volume?: number | string;
  productquantityunit?: string;
  brand_data?: { name?: string };
  category?: Array<{ name?: string; category_id?: number }>;
  sqpp_data_region_default?: {
    price?: number;
    special_price?: number;
    special_price_to_date?: string | null;
    special_price_from_date?: string | null;
    special_price_discount?: number;
    promo_price?: number;
    promo_price_to_date?: string | null;
    promo_price_from_date?: string | null;
    promo_price_discount?: number;
    in_stock?: boolean;
    available?: boolean;
  };
}

const queryByCategory: Record<string, string[]> = {
  poultry: ['курка', 'куряче філе', 'куряче стегно', 'куряче крило', 'індичка'],
  semifinished: ['нагетси', 'котлета куряча', 'пельмені', 'напівфабрикати', 'чебуреки'],
  sausage: ['ковбаса', 'сосиски', 'сардельки', 'шинка', 'балик']
};

const productSourceFields = [
  'brand_data.name',
  'category',
  'category_ids',
  'stock.is_in_stock',
  'sku',
  'id',
  'name',
  'image',
  'regular_price',
  'special_price_discount',
  'special_price_to_date',
  'slug',
  'url_key',
  'url_path',
  'type_id',
  'volume',
  'weight',
  'wghweigh',
  'packingtype',
  'productquantityunit',
  'productquantityunitstep',
  'productminsalablequantity',
  'productquantitysteprecommended',
  'sqpp_data_region_default'
].join(',');

export class VarusSearchParser extends BaseParser {
  private multiSearchEndpoint = 'https://api.multisearch.io/';
  private catalogEndpoint = 'https://varus.ua/api/catalog/vue_storefront_catalog_2/product_v2/_search';

  constructor(request: ParseRequest, logger: LoggerService) {
    super(request, logger);
  }

  async parse() {
    const group = getBusinessGroup(this.request.category);
    const terms = queryByCategory[group];
    const rawProducts: RawProduct[] = [];
    const errors = [];

    for (const term of terms) {
      try {
        const ids = await this.searchIds(term);
        const products = await this.fetchProducts(ids);
        this.logger.info(`${this.request.network}: ${products.length} products from Varus search "${term}"`);
        rawProducts.push(...products.map((product) => this.toRawProduct(product, term)));
      } catch (error) {
        errors.push(this.buildError(this.catalogEndpoint, 'VARUS_SEARCH_ERROR', error, true));
      }
    }

    const rows = rawProducts
      .map((product) => normalizeProduct(product, this.request))
      .filter((row) => matchesRequestedGroup(row, group));

    return { rows: dedupeRows(rows), errors };
  }

  private async searchIds(term: string) {
    const limit = Number(process.env.VARUS_SEARCH_LIMIT ?? 80);
    const params = new URLSearchParams({
      id: '12138',
      query: term,
      uid: 'guest',
      lang: 'uk',
      tags: '1',
      key: '468671b168b5ec56b8c34d458bf03f1b',
      location: 'default',
      limit: String(limit),
      categories: '0',
      fields: 'id',
      sort: 'relevance',
      filters: '{}'
    });
    const url = `${this.multiSearchEndpoint}?${params}`;
    const payload = await this.retry(() => this.fetchJson<MultiSearchResponse>(url), url);
    return (payload.results?.items ?? []).map((item) => item.id).filter(Boolean);
  }

  private async fetchProducts(ids: string[]) {
    if (!ids.length) return [];
    const request = {
      _availableFilters: [],
      _appliedFilters: [
        { attribute: 'id', value: { in: ids }, scope: 'default' },
        { attribute: 'sqpp_data_region_default.in_stock', value: { eq: true }, scope: 'default' }
      ],
      _appliedSort: [],
      _searchText: ''
    };
    const params = new URLSearchParams({
      _source_exclude: '',
      _source_include: productSourceFields,
      from: '0',
      request: JSON.stringify(request),
      request_format: 'search-query',
      response_format: 'compact',
      shop_id: '57',
      size: String(ids.length),
      sort: ''
    });
    const url = `${this.catalogEndpoint}?${params}`;
    const payload = await this.retry(() => this.fetchJson<VarusCatalogResponse>(url), url);
    return payload.hits ?? [];
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'accept-language': 'uk-UA,uk;q=0.9,en;q=0.5',
          'user-agent': this.options.userAgent
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private toRawProduct(product: VarusProduct, term: string): RawProduct {
    const region = product.sqpp_data_region_default;
    const promoPrice = positive(region?.special_price) ?? positive(region?.promo_price);
    const regularPrice = positive(region?.price) ?? positive(product.regular_price) ?? promoPrice;
    const hasPromo = promoPrice !== null && regularPrice !== null && regularPrice > promoPrice;
    const promoDiscount = region?.special_price_discount || region?.promo_price_discount || product.special_price_discount || '';

    return {
      sku: product.name,
      regularPrice,
      promoPrice: hasPromo ? promoPrice : null,
      productUrl: `https://varus.ua/${product.url_path ?? product.url_key ?? product.slug ?? ''}`.replace(/\/$/, ''),
      imageUrl: product.image ? `https://varus.ua/img/product/311/311/${product.image}` : undefined,
      categorySource: product.category?.map((category) => category.name).filter(Boolean).join('; ') || `search:${term}`,
      promoStartDate: region?.special_price_from_date ?? region?.promo_price_from_date ?? '',
      promoEndDate: region?.special_price_to_date ?? region?.promo_price_to_date ?? product.special_price_to_date ?? '',
      manufacturer: product.brand_data?.name,
      brand: product.brand_data?.name,
      comment: `Varus Vue Storefront search; id=${product.id}; sku=${product.sku}; discount=${promoDiscount}`.trim()
    };
  }
}

function getBusinessGroup(category: string): 'poultry' | 'semifinished' | 'sausage' {
  const normalized = category.toLowerCase();
  if (normalized.includes('напів')) return 'semifinished';
  if (normalized.includes('ковбас')) return 'sausage';
  return 'poultry';
}

function positive(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function matchesRequestedGroup(row: PriceRow, group: 'poultry' | 'semifinished' | 'sausage') {
  const value = `${row.sku} ${row.categorySource}`.toLowerCase();
  if (group === 'poultry') return /(кур|індич|крил|стегн|гоміл|філе)/i.test(value) && !/(ковбас|сосиск|сардель|шинка)/i.test(value);
  if (group === 'semifinished') return /(нагетс|котлет|пельмен|напів|чебурек|вареник|млинец|млинець|бендерик)/i.test(value);
  return /(ковбас|сосиск|сардель|шинка|балик|буженин|салям|м'ясн|м’ясн|делікатес)/i.test(value);
}

function dedupeRows(rows: PriceRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.network}|${row.city}|${row.sku}|${row.productUrl}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

import { BaseParser } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

interface ForaCatalogResponse {
  items?: ForaProduct[];
  itemsCount?: number;
  EComError?: {
    ErrorCode: number;
    ErrorMessage: string;
    ErrorDescription?: string | null;
  };
}

interface ForaProduct {
  id: number;
  name: string;
  unit?: string;
  price: number | null;
  oldPrice: number | null;
  mainImage?: string;
  slug?: string;
  promotion?: unknown;
  promoTitle?: string | null;
  priceStartFrom?: string | null;
  priceStopAfter?: string | null;
  prices?: Array<{ Type: string; Value: number }>;
  unitText?: string;
  isWeightedProduct?: boolean;
  categories?: Array<{ id: number; name?: string | null; slug?: string | null }>;
  parameters?: Array<{ key: string; name: string; value: string }>;
}

const queryByCategory: Record<string, string[]> = {
  poultry: ['курка', 'куряче філе', 'куряче стегно', 'куряче крило', 'індичка'],
  semifinished: ['нагетси', 'котлета куряча', 'пельмені', 'напівфабрикати', 'чебуреки'],
  sausage: ['ковбаса', 'сосиски', 'сардельки', 'шинка', 'балик']
};

const filialByCity: Record<string, number> = {
  Київ: 310,
  Львів: 310,
  Дніпро: 310,
  Одеса: 310,
  Харків: 310
};

export class ForaCatalogParser extends BaseParser {
  private endpoint = 'https://api.catalog.ecom.fora.ua/api/2.0/exec/EcomCatalogGlobal';

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
        const products = await this.search(term);
        this.logger.info(`${this.request.network}: ${products.length} products from Fora catalog search "${term}"`);
        rawProducts.push(...products.map((product) => this.toRawProduct(product, term)));
      } catch (error) {
        errors.push(this.buildError(this.endpoint, 'FORA_CATALOG_SEARCH_ERROR', error, true));
      }
    }

    const rows = rawProducts
      .map((product) => normalizeProduct(product, this.request))
      .filter((row) => matchesRequestedGroup(row, group));

    return { rows: dedupeRows(rows), errors };
  }

  private async search(term: string) {
    const maxPages = Number(process.env.FORA_MAX_PAGES ?? 4);
    const pageSize = Number(process.env.FORA_PAGE_SIZE ?? 50);
    const products: ForaProduct[] = [];

    for (let page = 0; page < maxPages; page += 1) {
      const from = page * pageSize + 1;
      const to = (page + 1) * pageSize;
      const payload = await this.retry(
        () =>
          this.postCatalog({
            method: 'GetSimpleCatalogItems',
            data: {
              merchantId: 4,
              basketGuid: '00000000-0000-0000-0000-000000000000',
              deliveryType: 2,
              filialId: filialByCity[this.request.city] ?? 310,
              customFilter: term,
              From: from,
              To: to
            }
          }),
        `${this.endpoint}?method=GetSimpleCatalogItems&q=${encodeURIComponent(term)}&from=${from}`
      );
      products.push(...(payload.items ?? []));
      const total = payload.itemsCount ?? products.length;
      if (!payload.items?.length || products.length >= total) break;
    }

    return products.filter((product) => product.name && product.price);
  }

  private async postCatalog(body: unknown): Promise<ForaCatalogResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'accept-language': 'uk-UA,uk;q=0.9,en;q=0.5',
          'content-type': 'application/json',
          'user-agent': this.options.userAgent
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as ForaCatalogResponse;
      if (payload.EComError && payload.EComError.ErrorCode !== 0) {
        throw new Error(payload.EComError.ErrorDescription ?? payload.EComError.ErrorMessage);
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  private toRawProduct(product: ForaProduct, term: string): RawProduct {
    const hasPromo = product.oldPrice !== null && product.price !== null && product.oldPrice > product.price;
    const manufacturer = product.parameters?.find(
      (item) => item.key === 'brand' || String(item.name ?? '').toLowerCase().includes('виробник')
    )?.value;
    return {
      sku: product.name,
      regularPrice: hasPromo ? product.oldPrice : product.price,
      promoPrice: hasPromo ? product.price : null,
      productUrl: product.slug ? `https://fora.ua/product/${product.slug}` : 'https://fora.ua/',
      imageUrl: product.mainImage,
      categorySource: product.categories?.map((category) => category.name ?? category.id).join('; ') || `search:${term}`,
      promoStartDate: product.priceStartFrom ?? '',
      promoEndDate: product.priceStopAfter ?? '',
      manufacturer,
      brand: manufacturer,
      comment: `Fora EcomCatalogGlobal; id=${product.id}; unit=${product.unit ?? product.unitText ?? ''}; promo=${product.promoTitle ?? ''}`.trim()
    };
  }
}

function getBusinessGroup(category: string): 'poultry' | 'semifinished' | 'sausage' {
  const normalized = category.toLowerCase();
  if (normalized.includes('напів')) return 'semifinished';
  if (normalized.includes('ковбас')) return 'sausage';
  return 'poultry';
}

function matchesRequestedGroup(row: PriceRow, group: 'poultry' | 'semifinished' | 'sausage') {
  const value = `${row.sku} ${row.categorySource}`.toLowerCase();
  if (group === 'poultry') return /(кур|індич|крил|стегн|гоміл|філе)/i.test(value) && !/(ковбас|сосиск|сардель|шинка)/i.test(value);
  if (group === 'semifinished') return /(нагетс|котлет|пельмен|напів|чебурек|вареник|млинец|млинець|бендерик)/i.test(value);
  return /(ковбас|сосиск|сардель|шинка|балик|буженин|салям|м'ясн|м’ясн)/i.test(value);
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

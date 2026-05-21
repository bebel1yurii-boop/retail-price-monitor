import { BaseParser } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

interface ThrashSearchResponse {
  data?: {
    search?: {
      paging?: {
        count: number;
        items: Array<ThrashProduct | null>;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface ThrashProduct {
  id: string;
  slug: string;
  title: string;
  price: string | null;
  oldPrice: string | null;
  discountPercent: string | null;
  weight: string | null;
  articul: number | null;
  imageUrl: string | null;
  available: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  category: { id: string; title: string } | null;
}

const queryByCategory: Record<string, string[]> = {
  poultry: ['курка', 'куряче філе', 'куряче стегно', 'куряче крило', 'індичка'],
  semifinished: ['нагетси', 'котлета куряча', 'пельмені', 'напівфабрикати', 'чебуреки'],
  sausage: ['ковбаса', 'сосиски', 'сардельки', 'шинка', 'балик']
};

const searchQuery = `
  query SearchProducts($query: String, $pagingInfo: InputBatch!) {
    search(query: $query, pagingInfo: $pagingInfo) {
      paging {
        count
        items {
          ... on Product {
            id
            slug
            title
            price
            oldPrice
            discountPercent
            weight
            articul
            imageUrl
            available
            periodStart
            periodEnd
            category { id title }
          }
        }
      }
    }
  }
`;

export class ThrashGraphqlParser extends BaseParser {
  private endpoint = 'https://thrash.ua/graphql';

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
        this.logger.info(`${this.request.network}: ${products.length} products from Thrash GraphQL search "${term}"`);
        rawProducts.push(...products.map((product) => this.toRawProduct(product, term)));
      } catch (error) {
        errors.push(this.buildError(this.endpoint, 'THRASH_GRAPHQL_SEARCH_ERROR', error, true));
      }
    }

    const rows = rawProducts
      .map((product) => normalizeProduct(product, this.request))
      .filter((row) => matchesRequestedGroup(row, group));

    return { rows: dedupeRows(rows), errors };
  }

  private async search(term: string) {
    const maxPages = Number(process.env.THRASH_MAX_PAGES ?? 6);
    const pageSize = Number(process.env.THRASH_PAGE_SIZE ?? 50);
    const products: ThrashProduct[] = [];

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize;
      const payload = await this.retry(
        () => this.fetchGraphql<ThrashSearchResponse>(searchQuery, { query: term, pagingInfo: { offset, limit: pageSize } }),
        `${this.endpoint}?q=${encodeURIComponent(term)}&offset=${offset}`
      );
      const items = payload.data?.search?.paging?.items?.filter((item): item is ThrashProduct => Boolean(item?.title)) ?? [];
      products.push(...items);
      const total = payload.data?.search?.paging?.count ?? products.length;
      if (!items.length || products.length >= total) break;
    }

    return products.filter((product) => product.available !== false);
  }

  private async fetchGraphql<T>(query: string, variables: unknown): Promise<T> {
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
        body: JSON.stringify({ query, variables })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as T & { errors?: Array<{ message: string }> };
      if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join('; '));
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  private toRawProduct(product: ThrashProduct, term: string): RawProduct {
    const price = parsePrice(product.price);
    const oldPrice = parsePrice(product.oldPrice);
    const hasPromo = oldPrice !== null && price !== null && oldPrice > price;

    return {
      sku: product.title,
      regularPrice: hasPromo ? oldPrice : price,
      promoPrice: hasPromo ? price : null,
      productUrl: product.slug ? `https://thrash.ua/product/${product.slug}` : 'https://thrash.ua/search',
      categorySource: product.category?.title ?? `search:${term}`,
      imageUrl: product.imageUrl ?? undefined,
      promoStartDate: product.periodStart ?? '',
      promoEndDate: product.periodEnd ?? '',
      comment: `Thrash GraphQL search; articul=${product.articul ?? ''}; discount=${product.discountPercent ?? ''}`.trim()
    };
  }
}

function getBusinessGroup(category: string): 'poultry' | 'semifinished' | 'sausage' {
  const normalized = category.toLowerCase();
  if (normalized.includes('напів')) return 'semifinished';
  if (normalized.includes('ковбас')) return 'sausage';
  return 'poultry';
}

function parsePrice(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesRequestedGroup(row: PriceRow, group: 'poultry' | 'semifinished' | 'sausage') {
  const value = `${row.sku} ${row.categorySource}`.toLowerCase();
  if (group === 'poultry') return /(кур|індич|крил|стегн|гоміл|філе)/i.test(value) && !/(ковбас|сосиск|сардель|шинка)/i.test(value);
  if (group === 'semifinished') return /(нагетс|котлет|пельмен|напів|чебурек|вареник|млинец|млинець|бендерик)/i.test(value);
  return /(ковбас|сосиск|сардель|шинка|балик|буженин|салям)/i.test(value);
}

function dedupeRows(rows: PriceRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.network}|${row.city}|${row.sku}|${row.packWeight}|${row.regularPrice}|${row.promoPrice}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

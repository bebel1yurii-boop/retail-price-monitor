import { BaseParser } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

interface WooProduct {
  name: string;
  permalink: string;
  sku: string;
  on_sale: boolean;
  prices: {
    price: string;
    regular_price: string;
    sale_price: string;
    currency_minor_unit: number;
  };
  images?: Array<{ src: string }>;
  categories?: Array<{ name: string; slug: string }>;
}

const queriesByGroup: Record<string, string[]> = {
  poultry: ['куряче', 'курка', 'філе куряче', 'стегно куряче', 'крило куряче'],
  semifinished: ['котлета куряча', 'нагетси', 'пельмені', 'напівфабрикати', 'шніцель'],
  sausage: ['ковбаса', 'сосиски', 'сардельки', 'шинка']
};

export class WoocommerceStoreParser extends BaseParser {
  constructor(
    request: ParseRequest,
    logger: LoggerService,
    private baseUrl: string
  ) {
    super(request, logger);
  }

  async parse() {
    const queries = this.getQueries();
    const rawProducts: RawProduct[] = [];
    const errors = [];

    for (const query of queries) {
      try {
        const products = await this.fetchProducts(query);
        this.logger.info(`${this.request.network}: ${products.length} WooCommerce products for query "${query}"`);
        rawProducts.push(...products.map((product) => this.toRawProduct(product)));
      } catch (error) {
        errors.push(this.buildError(this.baseUrl, 'WOOCOMMERCE_STORE_API_ERROR', error, true));
      }
    }

    const rows = dedupeRows(rawProducts.map((product) => normalizeProduct(product, this.request))).filter((row) =>
      isRelevant(row.sku, this.request.category)
    );
    if (!rows.length) {
      errors.push(this.buildError(this.baseUrl, 'NO_WOOCOMMERCE_PRODUCTS', 'WooCommerce Store API returned no relevant products.', true));
    }
    return { rows, errors };
  }

  private async fetchProducts(query: string) {
    const url = `${this.baseUrl.replace(/\/$/, '')}/wp-json/wc/store/products?search=${encodeURIComponent(query)}&per_page=100`;
    return this.retry(async () => {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'accept-language': 'uk-UA,uk;q=0.9',
          'user-agent': this.options.userAgent
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as WooProduct[];
    }, url);
  }

  private getQueries() {
    const category = this.request.category.toLowerCase();
    if (category.includes('напів')) return queriesByGroup.semifinished;
    if (category.includes('ковбас')) return queriesByGroup.sausage;
    return queriesByGroup.poultry;
  }

  private toRawProduct(product: WooProduct): RawProduct {
    const regular = centsToPrice(product.prices.regular_price, product.prices.currency_minor_unit);
    const current = centsToPrice(product.prices.price, product.prices.currency_minor_unit);
    const sale = centsToPrice(product.prices.sale_price, product.prices.currency_minor_unit);
    const hasPromo = product.on_sale && regular !== null && current !== null && regular > current;
    return {
      sku: decodeHtml(product.name),
      regularPrice: hasPromo ? regular : current ?? regular,
      promoPrice: hasPromo ? sale ?? current : null,
      productUrl: product.permalink,
      imageUrl: product.images?.[0]?.src,
      categorySource: product.categories?.map((category) => category.name).join('; ') || this.request.category,
      comment: 'WooCommerce Store API'
    };
  }
}

function centsToPrice(value: string, minorUnit: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return Number((parsed / 10 ** minorUnit).toFixed(2));
}

function dedupeRows(rows: PriceRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.network}|${row.sku}|${row.productUrl}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRelevant(sku: string, category: string) {
  const name = sku.toLowerCase();
  const group = category.toLowerCase();
  if (group.includes('напів')) return /(котлет|нагетс|пельмен|напів|шніцель|млинець|бендерик)/i.test(name);
  if (group.includes('ковбас')) return /(ковбас|сосиск|сардель|шинка|салямі)/i.test(name);
  return /(кур|філе|стегно|крило|гомілк)/i.test(name) && !/(ковбас|сосиск|котлет|нагетс|пельмен)/i.test(name);
}

function decodeHtml(value: string) {
  return value
    .replace(/&#8217;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

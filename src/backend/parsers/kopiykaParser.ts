import { BaseParser, NonRetryableHttpError } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

interface KopiykaProduct {
  id: number;
  name: string;
  slug: string;
  amount: number;
  sale: boolean;
  cost: number;
  cost_old: number;
  sale_percent: number | null;
  weighted: boolean;
  weight_unit: string | null;
  images?: Array<{ original: string }>;
}

const urlsByGroup: Record<'poultry' | 'semifinished' | 'sausage', string[]> = {
  poultry: ['https://kopiyka.ua/catalog/m-yaso-ta-pticya'],
  semifinished: ['https://kopiyka.ua/catalog/napivfabrikati/napivfabrikati'],
  sausage: ['https://kopiyka.ua/catalog/miaso-kovbasni-virobi/kovbasi']
};

export class KopiykaParser extends BaseParser {
  constructor(request: ParseRequest, logger: LoggerService) {
    super(request, logger);
  }

  async parse() {
    const products: RawProduct[] = [];
    const errors = [];

    for (const url of urlsByGroup[getBusinessGroup(this.request.category)]) {
      try {
        const html = await this.retry(() => this.fetchHtml(url), url);
        const cards = parseProducts(html);
        this.logger.info(`${this.request.network}: ${cards.length} Kopiyka embedded JSON products from ${url}`);
        products.push(...cards.map((card) => this.toRawProduct(card, url)));
      } catch (error) {
        errors.push(this.buildError(url, 'KOPIYKA_CATEGORY_PAGE_ERROR', error, true));
      }
    }

    const rows = dedupeRows(products.map((product) => normalizeProduct(product, this.request)));
    if (!rows.length && !errors.length) {
      errors.push(this.buildError('https://kopiyka.ua', 'NO_KOPIYKA_PRODUCTS', 'Kopiyka public category pages returned no product cards.', true));
    }
    return { rows, errors };
  }

  private async fetchHtml(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'uk-UA,uk;q=0.9',
          'user-agent': this.options.userAgent
        }
      });
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) throw new NonRetryableHttpError(response.status);
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private toRawProduct(product: KopiykaProduct, sourceUrl: string): RawProduct {
    const hasPromo = product.sale && product.cost_old > product.cost;
    return {
      sku: product.name,
      regularPrice: hasPromo ? product.cost_old : product.cost,
      promoPrice: hasPromo ? product.cost : null,
      productUrl: `https://kopiyka.ua/product/${product.slug}`,
      imageUrl: product.images?.[0]?.original,
      categorySource: sourceUrl,
      comment: `Kopiyka embedded JSON; id=${product.id}; stock=${product.amount}; discount=${product.sale_percent ?? ''}; weighted=${product.weighted}; unit=${product.weight_unit ?? ''}`
    };
  }
}

function parseProducts(html: string): KopiykaProduct[] {
  const decoded = html.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const matches = [...decoded.matchAll(/"id":(\d+),"name":"([^"]+)","slug":"([^"]+)","amount":([\d.]+),"sale":(true|false)[\s\S]*?"cost":([\d.]+),"cost_old":([\d.]+)[\s\S]*?"sale_percent":(null|[\d.]+)[\s\S]*?"weighted":(true|false),"weight_unit":(null|"[^"]*")[\s\S]*?"images":\[(.*?)\],"__typename":"Product"/g)];
  return matches.map((match) => ({
    id: Number(match[1]),
    name: decodeJsonText(match[2]),
    slug: match[3],
    amount: Number(match[4]),
    sale: match[5] === 'true',
    cost: Number(match[6]),
    cost_old: Number(match[7]),
    sale_percent: match[8] === 'null' ? null : Number(match[8]),
    weighted: match[9] === 'true',
    weight_unit: match[10] === 'null' ? null : decodeJsonText(match[10].slice(1, -1)),
    images: [...match[11].matchAll(/"original":"([^"]+)"/g)].map((image) => ({ original: decodeJsonText(image[1]) }))
  }));
}

function decodeJsonText(value: string) {
  return value.replace(/\\u([\da-f]{4})/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16))).replace(/\\\//g, '/');
}

function getBusinessGroup(category: string): 'poultry' | 'semifinished' | 'sausage' {
  const value = category.toLowerCase();
  if (value.includes('напів')) return 'semifinished';
  if (value.includes('ковбас')) return 'sausage';
  return 'poultry';
}

function dedupeRows(rows: PriceRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.sku}|${row.productUrl}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

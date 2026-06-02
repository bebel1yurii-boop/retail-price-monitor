import { BaseParser, NonRetryableHttpError } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

const urlsByGroup: Record<'poultry' | 'semifinished' | 'sausage', string[]> = {
  poultry: ['https://market.rukavychka.ua/mjaso-i-napivfabrikati/'],
  semifinished: ['https://market.rukavychka.ua/mjaso-i-napivfabrikati/', 'https://market.rukavychka.ua/napivfabrikati/'],
  sausage: ['https://market.rukavychka.ua/kovbasa-i-sosiski/']
};

export class RukavychkaParser extends BaseParser {
  constructor(request: ParseRequest, logger: LoggerService) {
    super(request, logger);
  }

  async parse() {
    const products: RawProduct[] = [];
    const errors = [];

    for (const categoryUrl of urlsByGroup[getBusinessGroup(this.request.category)]) {
      let url = categoryUrl;
      for (let pageNumber = 1; url && pageNumber <= 8; pageNumber += 1) {
        try {
          const html = await this.retry(() => this.fetchHtml(url), url);
          const cards = parseCards(html, categoryUrl);
          this.logger.info(`${this.request.network}: ${cards.length} Rukavychka products from ${url}`);
          products.push(...cards);
          url = nextPageUrl(html, categoryUrl, pageNumber + 1);
        } catch (error) {
          errors.push(this.buildError(url, 'RUKAVYCHKA_CATEGORY_PAGE_ERROR', error, true));
          break;
        }
      }
    }

    const rows = dedupeRows(products.map((product) => normalizeProduct(product, this.request)));
    if (!rows.length && !errors.length) {
      errors.push(this.buildError('https://market.rukavychka.ua', 'NO_RUKAVYCHKA_PRODUCTS', 'Rukavychka public category pages returned no product cards.', true));
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
}

function parseCards(html: string, categoryUrl: string): RawProduct[] {
  return html
    .split(/<div class="product-layout\b/gi)
    .slice(1)
    .map((fragment) => `<div class="product-layout${fragment}`)
    .map((card) => {
      const productUrl = decodeHtml(card.match(/<div class="fm-module-title">\s*<a href="([^"]+)"/i)?.[1] ?? '');
      const sku = cleanText(card.match(/<div class="fm-module-title">\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
      const oldPrice = cleanText(card.match(/class="fm-module-price-old"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
      const currentPrice = cleanText(card.match(/class="fm-module-price-new[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
      const externalSkuId = cleanText(card.match(/class="fm-category-product-model"[^>]*>Код товару:\s*([\s\S]*?)<\/div>/i)?.[1] ?? '');
      return {
        sku,
        regularPrice: oldPrice || currentPrice,
        promoPrice: oldPrice ? currentPrice : null,
        productUrl,
        imageUrl: decodeHtml(card.match(/<img[^>]+src="([^"]+)"[^>]+class="img-fluid"/i)?.[1] ?? ''),
        categorySource: categoryUrl,
        comment: `Rukavychka OpenCart public category page; externalSkuId=${externalSkuId}`
      };
    })
    .filter((product) => product.sku && product.regularPrice && product.productUrl);
}

function nextPageUrl(html: string, baseUrl: string, pageNumber: number) {
  const href = decodeHtml(
    html.match(new RegExp(`href="([^"]*[?&]page=${pageNumber}(?:&amp;[^"]*)?)"`, 'i'))?.[1] ?? ''
  );
  return href ? new URL(href, baseUrl).toString() : '';
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ');
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

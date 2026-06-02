import { BaseParser, NonRetryableHttpError } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

const categoryUrls: Record<'poultry' | 'semifinished' | 'sausage', string[]> = {
  poultry: [
    'https://rostmarket.com.ua/catalogsearch/result/?q=%D0%BA%D1%83%D1%80%D1%8F%D1%87%D0%B5',
    'https://rostmarket.com.ua/catalogsearch/result/?q=%D1%84%D1%96%D0%BB%D0%B5%20%D0%BA%D1%83%D1%80%D1%8F%D1%87%D0%B5',
    'https://rostmarket.com.ua/catalogsearch/result/?q=%D1%81%D1%82%D0%B5%D0%B3%D0%BD%D0%BE%20%D0%BA%D1%83%D1%80%D1%8F%D1%87%D0%B5',
    'https://rostmarket.com.ua/catalogsearch/result/?q=%D1%96%D0%BD%D0%B4%D0%B8%D1%87%D0%BA%D0%B0%20%D0%BC%27%D1%8F%D1%81%D0%BE',
    'https://rostmarket.com.ua/catalogsearch/result/?q=%D0%BA%D0%B0%D1%87%D0%BA%D0%B0%20%D0%BC%27%D1%8F%D1%81%D0%BE'
  ],
  semifinished: ['https://rostmarket.com.ua/m-jasni-napivfabrikati/', 'https://rostmarket.com.ua/m-jasni-napivfabrikati-zamorozheni/'],
  sausage: ['https://rostmarket.com.ua/kovbasni-virobi/']
};

export class RostMarketParser extends BaseParser {
  constructor(request: ParseRequest, logger: LoggerService) {
    super(request, logger);
  }

  async parse() {
    const group = getBusinessGroup(this.request.category);
    const rawProducts: RawProduct[] = [];
    const errors = [];

    for (const categoryUrl of categoryUrls[group]) {
      let url = categoryUrl;
      for (let pageNumber = 1; url && pageNumber <= 8; pageNumber += 1) {
        try {
          const html = await this.retry(() => this.fetchHtml(url), url);
          const products = parseCards(html, categoryUrl);
          this.logger.info(`${this.request.network}: ${products.length} Rost products from ${url}`);
          rawProducts.push(...products);
          url = nextPageUrl(html, categoryUrl);
        } catch (error) {
          errors.push(this.buildError(url, 'ROST_CATEGORY_PAGE_ERROR', error, true));
          break;
        }
      }
    }

    const rows = dedupeRows(rawProducts.map((product) => normalizeProduct(product, this.request)));
    if (!rows.length) {
      errors.push(this.buildError('https://rostmarket.com.ua', 'NO_ROST_PRODUCTS', 'Rost public category pages returned no product cards.', true));
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
  return [...html.matchAll(/<li\b[^>]*class="[^"]*\bproduct-item\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => {
      const card = match[0];
      const currentPrice = priceAmount(card, 'finalPrice');
      const oldPrice = priceAmount(card, 'oldPrice');
      const url = decodeHtml(card.match(/class="product-item-link"[^>]*href="([^"]+)"/i)?.[1] ?? '');
      const name = cleanText(card.match(/class="product-item-link"[^>]*>[\s\S]*?<h3>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
      return {
        sku: name,
        regularPrice: oldPrice || currentPrice,
        promoPrice: oldPrice && Number(oldPrice) > Number(currentPrice) ? currentPrice : null,
        productUrl: url,
        imageUrl: decodeHtml(card.match(/class="product-image-photo[^"]*"[\s\S]*?src="([^"]+)"/i)?.[1] ?? ''),
        categorySource: categoryUrl,
        comment: `Rost Magento public category page; externalSkuId=${attribute(card, 'data-product-sku')}`
      };
    })
    .filter((product) => product.sku && product.regularPrice);
}

function nextPageUrl(html: string, baseUrl: string) {
  const href = decodeHtml(html.match(/class="action next"[^>]*href="([^"]+)"/i)?.[1] ?? '');
  return href ? new URL(href, baseUrl).toString() : '';
}

function attribute(html: string, name: string) {
  return decodeHtml(html.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1] ?? '');
}

function priceAmount(html: string, priceType: string) {
  return decodeHtml(
    html.match(new RegExp(`data-price-amount="([^"]+)"[^>]*data-price-type="${priceType}"`, 'i'))?.[1] ?? ''
  );
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([a-f\d]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
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

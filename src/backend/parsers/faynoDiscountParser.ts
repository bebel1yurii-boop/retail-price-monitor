import { BaseParser, NonRetryableHttpError } from './baseParser';
import { isSkuRelevant } from '../services/categoryValidationService';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

const discountsUrl = 'https://fayno.market/discounts';

export class FaynoDiscountParser extends BaseParser {
  constructor(request: ParseRequest, logger: LoggerService) {
    super(request, logger);
  }

  async parse() {
    try {
      const html = await this.retry(() => this.fetchHtml(), discountsUrl);
      const rawProducts = parseDiscountCards(html);
      const rows = dedupeRows(rawProducts.map((product) => normalizeProduct(product, this.request))).filter((row) =>
        isSkuRelevant(row.sku, this.request.category)
      );

      this.logger.info(`${this.request.network}: ${rawProducts.length} public promo cards from Fayno discounts page`);
      this.logger.info(`${this.request.network}: ${rows.length} relevant promo SKU for "${this.request.category}"`);

      const errors = rawProducts.length
        ? []
        : [
            this.buildError(
              discountsUrl,
              'FAYNO_NO_PUBLIC_PROMO_PRODUCTS',
              'Public Fayno discounts page returned no promo cards.',
              true
            )
          ];
      return { rows, errors };
    } catch (error) {
      return {
        rows: [],
        errors: [this.buildError(discountsUrl, 'FAYNO_DISCOUNTS_HTML_ERROR', error, true)]
      };
    }
  }

  private async fetchHtml() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(discountsUrl, {
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

function parseDiscountCards(html: string): RawProduct[] {
  return [...html.matchAll(/<a\b[^>]*class="[^"]*\bdiscount-product-card\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const card = match[0];
      const name = classText(card, 'name') || attribute(card, 'alt');
      const currentPrice = classText(card, 'new-price');
      const oldPrice = classText(card, 'old-price');
      const { promoStartDate, promoEndDate } = parsePromoRange(classText(card, 'datetime'));
      return {
        sku: name,
        regularPrice: oldPrice || currentPrice,
        promoPrice: oldPrice ? currentPrice : null,
        productUrl: attribute(card, 'href'),
        imageUrl: attribute(card, 'src'),
        promoStartDate,
        promoEndDate,
        categorySource: 'fayno.market/discounts',
        comment: 'Fayno public discounts page; promo-only HTML adapter'
      };
    })
    .filter((product) => product.sku && product.regularPrice);
}

function classText(html: string, className: string) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<[^>]+class="[^"]*\\b${escaped}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'));
  return cleanText(match?.[1] ?? '');
}

function attribute(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return decodeHtml(html.match(new RegExp(`\\b${escaped}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.[1] ?? '').trim();
}

function parsePromoRange(value: string) {
  const dates = [...value.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)].map((match) => `${match[3]}-${match[2]}-${match[1]}`);
  return {
    promoStartDate: dates[0] ?? '',
    promoEndDate: dates[1] ?? ''
  };
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
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

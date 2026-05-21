import fs from 'node:fs';
import crypto from 'node:crypto';
import { BaseParser, NonRetryableHttpError, isNonRetryableError } from './baseParser';
import { getCategoryQueries, type ProductionAdapterConfig } from './adapterConfigs';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseError, ParseRequest, PriceRow } from '../types';

export class SearchHtmlParser extends BaseParser {
  constructor(
    request: ParseRequest,
    logger: LoggerService,
    protected config: ProductionAdapterConfig
  ) {
    super(request, logger);
  }

  async parse(): Promise<{ rows: PriceRow[]; errors: ParseError[] }> {
    if (!this.config.websiteUrl || !this.config.searchPaths.length) {
      return this.manualRequired('NO_PUBLIC_SEARCH_URL', 'Для мережі не налаштовано публічний search/catalog URL.');
    }

    const errors: ParseError[] = [];
    const rawProducts: RawProduct[] = [];
    const queries = getCategoryQueries(this.config, this.request.category).slice(0, Number(process.env.MAX_SEARCH_QUERIES ?? 3));
    const startedAt = Date.now();
    const maxBudgetMs = Number(process.env.PARSER_BUDGET_MS ?? 55000);
    let blockedBySite = false;

    for (const query of queries) {
      if (blockedBySite) break;
      if (Date.now() - startedAt > maxBudgetMs) {
        errors.push(this.buildError(this.config.websiteUrl, 'PARSER_BUDGET_EXCEEDED', 'Adapter stopped by parser time budget.', true));
        break;
      }
      for (const searchPath of this.config.searchPaths) {
        if (Date.now() - startedAt > maxBudgetMs) break;
        const url = this.buildSearchUrl(searchPath, query);
        try {
          this.logger.info(`${this.config.canonicalName}: fetching ${url}`);
          const html = await this.retry(() => this.getPageHtml(url), url);
          const extracted = this.extractProducts(html, url);
          this.logger.info(`${this.config.canonicalName}: ${extracted.length} product candidates from ${url}`);
          rawProducts.push(...extracted);
          if (extracted.length > 0) break;
        } catch (error) {
          const errorType = isNonRetryableError(error) && [401, 403].includes(error.status) ? 'SITE_BLOCKED_PUBLIC_ACCESS' : 'HTML_SEARCH_ERROR';
          errors.push(this.buildError(url, errorType, error, true));
          if (errorType === 'SITE_BLOCKED_PUBLIC_ACCESS') {
            blockedBySite = true;
            break;
          }
        }
      }
    }

    const rows = rawProducts
      .filter((product) => isCategoryRelevant(product.sku, this.request.category))
      .map((product) =>
        normalizeProduct(
          {
            ...product,
            categorySource: this.request.category,
            comment: product.comment ?? `Production HTML search adapter: ${this.config.canonicalName}`
          },
          this.request
        )
      );

    if (!rows.length) {
      errors.push(
        this.buildError(
          this.config.websiteUrl,
          'NO_PUBLIC_PRODUCT_DATA',
          'Сайт не віддав товарні дані у HTML/JSON-LD/Next data або потребує окремого API/Playwright discovery.',
          true
        )
      );
    }

    return { rows, errors };
  }

  protected async getPageHtml(url: string) {
    const cachePath = this.getCachePath(crypto.createHash('sha1').update(url).digest('hex'));
    if (fs.existsSync(cachePath)) {
      const stat = fs.statSync(cachePath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < 60 * 60 * 1000) return fs.readFileSync(cachePath, 'utf8');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': this.options.userAgent,
          accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'accept-language': 'uk-UA,uk;q=0.9,en;q=0.6'
        }
      });
      if ([401, 403, 404].includes(response.status)) throw new NonRetryableHttpError(response.status);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      fs.writeFileSync(cachePath, text, 'utf8');
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractProducts(html: string, sourceUrl: string): RawProduct[] {
    const products = [
      ...extractJsonLdProducts(html),
      ...extractNextDataProducts(html),
      ...extractMicrodataProducts(html, sourceUrl)
    ];
    return dedupeRawProducts(products).slice(0, 250);
  }

  private buildSearchUrl(searchPath: string, query: string) {
    const base = this.config.websiteUrl.replace(/\/$/, '');
    return `${base}${searchPath.replace('{query}', encodeURIComponent(query))}`;
  }

  private manualRequired(errorType: string, message: string): { rows: PriceRow[]; errors: ParseError[] } {
    return {
      rows: [],
      errors: [this.buildError(this.config.websiteUrl, errorType, message, true)]
    };
  }
}

function extractJsonLdProducts(html: string): RawProduct[] {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return matches.flatMap((match) => {
    try {
      const json = JSON.parse(cleanScript(match[1]));
      return collectProducts(json);
    } catch {
      return [];
    }
  });
}

function extractNextDataProducts(html: string): RawProduct[] {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return [];
  try {
    return collectProducts(JSON.parse(cleanScript(match[1])));
  } catch {
    return [];
  }
}

function extractMicrodataProducts(html: string, sourceUrl: string): RawProduct[] {
  const blocks = html.match(/<[^>]+(?:product|goods|card|item)[^>]*>[\s\S]{0,5000}?(?:₴|грн|uah)[\s\S]{0,1200}?<\/[^>]+>/gi) ?? [];
  return blocks
    .reduce<RawProduct[]>((acc, block) => {
      const sku = decodeHtml(
        attr(block, 'title') ??
          attr(block, 'aria-label') ??
          text(block.match(/<(?:h2|h3|a|span)[^>]*>([\s\S]{4,180}?)<\/(?:h2|h3|a|span)>/i)?.[1] ?? '')
      );
      const price = block.match(/(\d+[\s\d]*[,.]\d{1,2}|\d+[\s\d]*)\s?(?:₴|грн|uah)/i)?.[1] ?? null;
      const href = attr(block, 'href');
      if (!sku || !price) return acc;
      acc.push({
        sku,
        regularPrice: price,
        productUrl: href ? new URL(href, sourceUrl).toString() : sourceUrl,
        comment: 'Extracted from HTML product block'
      });
      return acc;
    }, []);
}

function collectProducts(value: unknown): RawProduct[] {
  const products: RawProduct[] = [];
  visit(value);
  return products;

  function visit(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const record = node as Record<string, unknown>;
    const type = String(record['@type'] ?? record.type ?? '').toLowerCase();
    const name = stringField(record, ['name', 'title', 'productName', 'displayName']);
    const price = priceField(record);
    if (name && (type.includes('product') || price !== null)) {
      products.push({
        sku: name,
        regularPrice: price,
        promoPrice: promoPriceField(record, price),
        productUrl: stringField(record, ['url', 'productUrl', 'href']) ?? undefined,
        imageUrl: stringField(record, ['image', 'imageUrl', 'thumbnail']) ?? undefined,
        comment: 'Extracted from structured page data'
      });
    }

    Object.values(record).forEach(visit);
  }
}

function priceField(record: Record<string, unknown>) {
  const offers = record.offers && typeof record.offers === 'object' ? (record.offers as Record<string, unknown>) : undefined;
  return (
    stringField(record, ['price', 'regularPrice', 'oldPrice', 'basePrice', 'currentPrice']) ??
    (offers ? stringField(offers, ['price', 'regularPrice', 'lowPrice']) : null)
  );
}

function promoPriceField(record: Record<string, unknown>, regularPrice: string | number | null) {
  const value = stringField(record, ['promoPrice', 'specialPrice', 'salePrice', 'discountPrice']);
  return value && value !== regularPrice ? value : null;
}

function stringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value) && value.length && typeof value[0] === 'string') return value[0];
  }
  return null;
}

function dedupeRawProducts(products: RawProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    const key = `${product.sku}|${product.productUrl ?? ''}`.toLowerCase();
    if (!product.sku || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isCategoryRelevant(sku: string, category: string) {
  const name = sku.toLowerCase();
  const normalizedCategory = category.toLowerCase();
  if (normalizedCategory.includes('напів')) return /(нагетс|котлет|пельмен|вареник|млинець|шніцель|напівфаб)/i.test(name);
  if (normalizedCategory.includes('ковбас')) return /(ковбас|сосиск|сардель|шинка|балик|салямі|делікатес)/i.test(name);
  return /(кур|індич|птиц|філе|стегно|крило|гомілк|фарш)/i.test(name) && !/(ковбас|сосиск|нагетс|котлет|пельмен)/i.test(name);
}

function cleanScript(value: string) {
  return decodeHtml(value.trim());
}

function attr(html: string, name: string) {
  return html.match(new RegExp(`${name}=[\"']([^\"']+)[\"']`, 'i'))?.[1] ?? null;
}

function text(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

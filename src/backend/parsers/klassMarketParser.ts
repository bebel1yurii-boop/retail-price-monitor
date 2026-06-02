import { chromium, type Browser, type Page } from 'playwright';
import { BaseParser } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

interface KlassCard {
  id: string;
  sku: string;
  name: string;
  url: string;
  imageUrl: string;
  currentPrice: string;
  oldPrice: string;
}

const categoryUrls: Record<'poultry' | 'semifinished' | 'sausage', string[]> = {
  poultry: ['https://klassmarket.ua/kuriatyna/'],
  semifinished: ['https://klassmarket.ua/miasni-napivfabrykaty/', 'https://klassmarket.ua/napivfabrykaty-ta-stravy-zamorozheni/'],
  sausage: ['https://klassmarket.ua/kovbasni-vyroby/']
};

export class KlassMarketParser extends BaseParser {
  constructor(request: ParseRequest, logger: LoggerService) {
    super(request, logger);
  }

  async parse() {
    const group = getBusinessGroup(this.request.category);
    const browser = await this.launchBrowser();
    const page = await browser.newPage({ locale: 'uk-UA', viewport: { width: 1366, height: 900 } });
    const rawProducts: RawProduct[] = [];
    const errors = [];

    try {
      for (const categoryUrl of categoryUrls[group]) {
        let url: string | null = categoryUrl;
        for (let pageNumber = 1; url && pageNumber <= 8; pageNumber += 1) {
          try {
            const cards = await this.readPage(page, url);
            this.logger.info(`${this.request.network}: ${cards.length} Klass products from ${url}`);
            rawProducts.push(...cards.map((card) => this.toRawProduct(card, categoryUrl)));
            url = await page.locator('.pager__item--forth a[href], a.pager__item--forth[href]').first().getAttribute('href').catch(() => null);
            if (url) url = new URL(url, categoryUrl).toString();
          } catch (error) {
            errors.push(this.buildError(url ?? categoryUrl, 'KLASS_CATEGORY_PAGE_ERROR', error, true));
            break;
          }
        }
      }
    } finally {
      await browser.close();
    }

    const rows = dedupeRows(rawProducts.map((product) => normalizeProduct(product, this.request)));
    if (!rows.length) {
      errors.push(this.buildError('https://klassmarket.ua', 'NO_KLASS_PRODUCTS', 'Klass public category pages returned no product cards.', true));
    }
    return { rows, errors };
  }

  private async readPage(page: Page, url: string) {
    await this.retry(async () => {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.options.timeoutMs });
      if (response?.status() && response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
      await page.waitForSelector('.catalogCard', { timeout: 10000 });
    }, url);

    return page.evaluate(`(() => {
      const clean = (value) => value ? value.replace(/\\s+/g, ' ').trim() : '';
      return Array.from(document.querySelectorAll('.catalogCard')).map((card) => {
        const box = card.querySelector('.catalogCard-box');
        const link = card.querySelector('.catalogCard-title a[href]');
        const image = card.querySelector('.catalogCard-img');
        return {
          id: box?.dataset.id || '',
          sku: clean(card.querySelector('.catalogCard-code')?.textContent).replace(/^Артикул:\\s*/i, ''),
          name: clean(link?.textContent),
          url: link?.href || '',
          imageUrl: image?.src || '',
          currentPrice: clean(card.querySelector('.catalogCard-price')?.textContent),
          oldPrice: clean(card.querySelector('.catalogCard-oldPrice')?.textContent)
        };
      });
    })()`) as Promise<KlassCard[]>;
  }

  private async launchBrowser(): Promise<Browser> {
    const channel = process.platform === 'win32' ? 'msedge' : undefined;
    if (channel) {
      try {
        return await chromium.launch({ channel, headless: true });
      } catch {
        this.logger.warn(`${this.request.network}: Edge unavailable, falling back to bundled Chromium`);
      }
    }
    return chromium.launch({ headless: true });
  }

  private toRawProduct(card: KlassCard, sourceUrl: string): RawProduct {
    const currentPrice = parsePrice(card.currentPrice);
    const oldPrice = parsePrice(card.oldPrice);
    const hasPromo = oldPrice !== null && currentPrice !== null && oldPrice > currentPrice;
    return {
      sku: card.name,
      regularPrice: hasPromo ? oldPrice : currentPrice,
      promoPrice: hasPromo ? currentPrice : null,
      productUrl: card.url,
      imageUrl: card.imageUrl,
      categorySource: sourceUrl,
      comment: `Klass public category page; article=${card.sku}; id=${card.id}`
    };
  }
}

function parsePrice(value: string) {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
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

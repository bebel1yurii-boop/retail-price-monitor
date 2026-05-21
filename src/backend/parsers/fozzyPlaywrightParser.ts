import { chromium, type Browser, type Page } from 'playwright';
import { BaseParser } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

interface FozzyCard {
  id: string;
  name: string;
  url: string;
  category: string;
  unit: string;
  currentPrice: string;
  oldPrice: string;
  discount: string;
  imageUrl: string;
}

const categoryUrls: Record<'poultry' | 'semifinished' | 'sausage', string[]> = {
  poultry: ['https://fozzyshop.ua/3839-ptytsya'],
  semifinished: [
    'https://fozzyshop.ua/3832-napivfabrykaty-m-yasni',
    'https://fozzyshop.ua/3680-napivfabrykaty',
    'https://fozzyshop.ua/4071-varenyky-pelmeni',
    'https://fozzyshop.ua/4274-kotlety-nagetsy'
  ],
  sausage: ['https://fozzyshop.ua/3665-kovbasa-m-yasni-vyroby']
};

export class FozzyPlaywrightParser extends BaseParser {
  constructor(request: ParseRequest, logger: LoggerService) {
    super(request, logger);
  }

  async parse() {
    const group = getBusinessGroup(this.request.category);
    const browser = await this.launchBrowser();
    const page = await browser.newPage({
      locale: 'uk-UA',
      viewport: { width: 1366, height: 900 }
    });
    const rawProducts: RawProduct[] = [];
    const errors = [];

    try {
      for (const baseUrl of categoryUrls[group]) {
        const maxPages = Number(process.env.FOZZY_MAX_PAGES ?? 8);
        for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
          const url = pageNumber === 1 ? baseUrl : `${baseUrl}?page=${pageNumber}`;
          try {
            const cards = await this.readCategoryPage(page, url);
            this.logger.info(`${this.request.network}: ${cards.length} Fozzy products from ${url}`);
            if (!cards.length) break;
            rawProducts.push(...cards.map((card) => this.toRawProduct(card, url)));

            const hasNext = await page
              .locator(`a[href="${new URL(baseUrl).pathname}?page=${pageNumber + 1}"]`)
              .count()
              .catch(() => 0);
            if (!hasNext) break;
          } catch (error) {
            errors.push(this.buildError(url, 'FOZZY_CATEGORY_PAGE_ERROR', error, true));
            break;
          }
        }
      }
    } finally {
      await browser.close();
    }

    const rows = dedupeRows(
      rawProducts
        .map((product) => normalizeProduct(product, this.request))
        .filter((row) => matchesRequestedGroup(row, group))
    );

    if (!rows.length) {
      errors.push(
        this.buildError(
          'https://fozzyshop.ua',
          'NO_FOZZY_PRODUCTS',
          'Fozzy category pages did not return relevant public product cards.',
          true
        )
      );
    }

    return { rows, errors };
  }

  private async readCategoryPage(page: Page, url: string) {
    await this.retry(async () => {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.options.timeoutMs });
      const status = response?.status();
      if (status && status >= 400) {
        throw new Error(`HTTP ${status}`);
      }
      await page.waitForSelector('.product-mini-card', { timeout: 15000 }).catch(async (error) => {
        const title = await page.title().catch(() => '');
        const bodySample = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
        throw new Error(
          `Fozzy product cards not found: ${error instanceof Error ? error.message : String(error)}; title=${title}; body=${bodySample.slice(0, 300)}`
        );
      });
    }, url);

    return page.evaluate(`(() => {
      const clean = (value) => value ? value.replace(/\\s+/g, ' ').trim() : '';
      return Array.from(document.querySelectorAll('.product-mini-card')).map((card) => {
        const link = card.querySelector('.product_mini_name a[href], .product_mini_image a[href]');
        const image = card.querySelector('.product_mini_image img');
        return {
          id: card.dataset.productId || '',
          name: clean(card.dataset.productName || card.querySelector('.product_mini_name')?.textContent),
          url: link?.href || '',
          category: clean(card.dataset.categoryName),
          unit: clean(card.dataset.unitType || card.querySelector('.product_mini_unit')?.textContent),
          currentPrice: clean(card.querySelector('.regular_price')?.textContent || card.dataset.price),
          oldPrice: clean(card.querySelector('.old_price')?.textContent),
          discount: clean(card.querySelector('.price_drop')?.textContent),
          imageUrl: image?.src || ''
        };
      });
    })()`) as Promise<FozzyCard[]>;
  }

  private async launchBrowser(): Promise<Browser> {
    const configuredChannel = process.env.FOZZY_BROWSER_CHANNEL;
    const defaultChannel = process.platform === 'win32' ? 'msedge' : undefined;
    const channel = configuredChannel === 'bundled' ? undefined : configuredChannel ?? defaultChannel;

    if (channel) {
      try {
        return await chromium.launch({ channel, headless: true });
      } catch (error) {
        this.logger.warn(`${this.request.network}: Playwright channel "${channel}" unavailable, falling back to bundled Chromium`);
      }
    }

    return chromium.launch({ headless: true });
  }

  private toRawProduct(card: FozzyCard, sourceUrl: string): RawProduct {
    const currentPrice = parsePrice(card.currentPrice);
    const oldPrice = parsePrice(card.oldPrice);
    const hasPromo = oldPrice !== null && currentPrice !== null && oldPrice > currentPrice;

    return {
      sku: [card.name, card.unit].filter(Boolean).join(', '),
      regularPrice: hasPromo ? oldPrice : currentPrice,
      promoPrice: hasPromo ? currentPrice : null,
      productUrl: card.url,
      imageUrl: card.imageUrl,
      categorySource: card.category || this.request.category,
      comment: `Fozzy public category page; id=${card.id}; source=${sourceUrl}; discount=${card.discount}`.trim()
    };
  }
}

function getBusinessGroup(category: string): 'poultry' | 'semifinished' | 'sausage' {
  const normalized = category.toLowerCase();
  if (normalized.includes('напів')) return 'semifinished';
  if (normalized.includes('ковбас')) return 'sausage';
  return 'poultry';
}

function parsePrice(value: string) {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesRequestedGroup(row: PriceRow, group: 'poultry' | 'semifinished' | 'sausage') {
  const value = `${row.sku} ${row.categorySource}`.toLowerCase();
  if (group === 'poultry') {
    return /(кур|індич|качк|перепіл|крил|стегн|гоміл|філе|птиц)/i.test(value) && !/(ковбас|сосиск|сардель|шинка)/i.test(value);
  }
  if (group === 'semifinished') {
    return /(напів|котлет|нагет|пельмен|вареник|гіоз|млин|чебурек|страв)/i.test(value);
  }
  return /(ковбас|сосиск|сардель|шинка|балик|буженин|салям|делікатес)/i.test(value);
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

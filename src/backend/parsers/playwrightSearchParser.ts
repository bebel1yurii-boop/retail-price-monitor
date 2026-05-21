import { chromium } from 'playwright';
import { SearchHtmlParser } from './searchHtmlParser';
import type { ProductionAdapterConfig } from './adapterConfigs';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest } from '../types';

export class PlaywrightSearchParser extends SearchHtmlParser {
  constructor(request: ParseRequest, logger: LoggerService, config: ProductionAdapterConfig) {
    super(request, logger, config);
  }

  protected async getPageHtml(url: string) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ userAgent: this.options.userAgent });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.options.timeoutMs });
      await page.waitForLoadState('networkidle', { timeout: Math.min(this.options.timeoutMs, 15000) }).catch(() => undefined);
      return await page.content();
    } finally {
      await browser.close();
    }
  }
}

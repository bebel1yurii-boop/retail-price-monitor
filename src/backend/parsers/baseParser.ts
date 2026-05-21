import fs from 'node:fs';
import path from 'node:path';
import type { LoggerService } from '../services/loggerService';
import type { ParseError, ParseRequest, PriceRow } from '../types';

export interface ParserOptions {
  delayMinMs: number;
  delayMaxMs: number;
  retries: number;
  timeoutMs: number;
  maxParallelPages: number;
  userAgent: string;
}

export abstract class BaseParser {
  protected cacheDir = path.resolve(process.cwd(), '.cache', 'pages');

  constructor(
    protected request: ParseRequest,
    protected logger: LoggerService,
    protected options: ParserOptions = defaultParserOptions
  ) {}

  abstract parse(): Promise<{ rows: PriceRow[]; errors: ParseError[] }>;

  protected async retry<T>(operation: () => Promise<T>, url: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.options.retries; attempt += 1) {
      try {
        await this.randomDelay();
        return await operation();
      } catch (error) {
        lastError = error;
        if (isNonRetryableError(error)) {
          this.logger.warn(`${this.request.network}: non-retryable error for ${url}: ${error.message}`);
          throw error;
        }
        this.logger.warn(`${this.request.network}: retry ${attempt}/${this.options.retries} failed for ${url}`);
      }
    }
    throw lastError;
  }

  protected async randomDelay() {
    const delay = this.options.delayMinMs + Math.random() * (this.options.delayMaxMs - this.options.delayMinMs);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  protected getCachePath(key: string) {
    fs.mkdirSync(this.cacheDir, { recursive: true });
    return path.join(this.cacheDir, `${key.replace(/[^a-z0-9а-яіїєґ-]/gi, '_')}.html`);
  }

  protected buildError(url: string, errorType: string, error: unknown, manualReview = false): ParseError {
    return {
      date: new Date().toISOString(),
      network: this.request.network,
      city: this.request.city,
      category: this.request.category,
      url,
      errorType,
      errorText: error instanceof Error ? error.message : String(error),
      manualReview
    };
  }
}

export class NonRetryableHttpError extends Error {
  constructor(
    public status: number,
    message = `HTTP ${status}`
  ) {
    super(message);
    this.name = 'NonRetryableHttpError';
  }
}

export function isNonRetryableError(error: unknown): error is NonRetryableHttpError {
  return error instanceof NonRetryableHttpError || Boolean(error && typeof error === 'object' && 'status' in error && [401, 403, 404].includes(Number((error as { status?: number }).status)));
}

export const defaultParserOptions: ParserOptions = {
  delayMinMs: 2000,
  delayMaxMs: 5000,
  retries: 3,
  timeoutMs: 30000,
  maxParallelPages: 2,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RetailPriceMonitor/0.1 Safari/537.36'
};

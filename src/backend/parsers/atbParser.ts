import { BaseParser } from './baseParser';
import { getDemoProducts } from './demoCatalog';
import { normalizeProduct } from '../services/normalizationService';
import type { PriceRow } from '../types';

export class AtbParser extends BaseParser {
  async parse() {
    this.logger.info(`АТБ МАРКЕТ: demo parser started for category ${this.request.category}`);
    const rows: PriceRow[] = getDemoProducts('atb', this.request.category).map((product) =>
      normalizeProduct(product, this.request)
    );
    return { rows, errors: [] };
  }
}

import { BaseParser } from './baseParser';
import { normalizeProduct } from '../services/normalizationService';
import type { ParseError, PriceRow } from '../types';

export class GenericParser extends BaseParser {
  async parse(): Promise<{ rows: PriceRow[]; errors: ParseError[] }> {
    const isAtb = this.request.network.toUpperCase().includes('АТБ');
    const isSimi = ['СІМ 23', 'СІМІ', 'SIMI'].some((name) => this.request.network.toUpperCase().includes(name));
    this.logger.warn(
      isAtb
        ? `${this.request.network}: public server-side access is blocked or not available`
        : isSimi
          ? `${this.request.network}: public leaflet contains image pages only; OCR workflow is required`
          : `${this.request.network}: parser adapter is not implemented`
    );
    if (process.env.DEMO_MODE !== 'true') {
      return {
        rows: [],
        errors: [
          {
            date: new Date().toISOString(),
            network: this.request.network,
            city: this.request.city,
            category: this.request.category,
            url: isSimi ? 'https://simi.ua/lystivka/' : '',
            errorType: isAtb ? 'SITE_BLOCKED_PUBLIC_ACCESS' : isSimi ? 'LEAFLET_OCR_REQUIRED' : 'MANUAL_REQUIRED',
            errorText: isAtb
              ? 'АТБ повертає HTTP 403 на серверний доступ до публічного каталогу. Не виконуємо обхід блокування. Потрібен легальний API/partner feed, ручний Excel import або затверджений браузерний workflow.'
              : isSimi
                ? 'Офіційна листівка СІМІ опублікована як набір зображень без PDF, структурованого SKU-каталогу або API цін. Потрібен окремий OCR workflow з ручною перевіркою або ручний Excel import.'
              : 'Публічний каталог/API не налаштований або не підтверджений. Використайте ручний Excel import або додайте network-specific adapter.',
            manualReview: true
          }
        ]
      };
    }

    const row = normalizeProduct(
      {
        sku: 'Manual import template row',
        comment: 'Потрібне ручне внесення або окремий parser adapter'
      },
      this.request
    );
    row.sourceStatus = 'потребує ручної перевірки';
    return {
      rows: [row],
      errors: [
        {
          date: new Date().toISOString(),
          network: this.request.network,
          city: this.request.city,
          category: this.request.category,
          url: '',
          errorType: 'MANUAL_REQUIRED',
          errorText: 'Мережа не має реалізованого demo/parser adapter в MVP',
          manualReview: true
        }
      ] satisfies ParseError[]
    };
  }
}

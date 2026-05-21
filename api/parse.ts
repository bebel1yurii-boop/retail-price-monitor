import { createParser } from '../src/backend/parsers/parserFactory';
import { LoggerService } from '../src/backend/services/loggerService';
import type { ParseResult } from '../src/backend/types';

type ApiRequest = { method?: string; body?: Record<string, unknown> };
type ApiResponse = { status: (code: number) => { json: (payload: unknown) => void } };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const { network, city, category } = req.body ?? {};
  if (!network || !city || !category) {
    res.status(400).json({ message: 'network, city and category are required' });
    return;
  }

  const logger = new LoggerService();
  try {
    logger.info(`Parse requested: ${network} / ${city} / ${category}`);
    const parser = createParser({ network, city, category }, logger);
    const result = await parser.parse();
    const rows = deduplicateRows(result.rows);
    const payload: ParseResult = {
      rows,
      errors: result.errors,
      logs: logger.getEntries(),
      summary: buildSummary(rows, result.errors.length)
    };
    res.status(200).json(payload);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    res.status(500).json({
      rows: [],
      errors: [
        {
          date: new Date().toISOString(),
          network,
          city,
          category,
          url: '',
          errorType: 'VERCEL_PARSER_RUNTIME_ERROR',
          errorText: error instanceof Error ? error.message : String(error),
          manualReview: true
        }
      ],
      logs: logger.getEntries()
    });
  }
}

function deduplicateRows<T extends { network: string; city: string; sku: string; packWeight: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.network}|${row.city}|${row.sku}|${row.packWeight}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSummary(rows: ParseResult['rows'], errorCount: number) {
  const avg = (values: Array<number | null>) => {
    const clean = values.filter((value): value is number => typeof value === 'number');
    return clean.length ? Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(2)) : null;
  };
  return {
    skuCount: rows.length,
    promoSkuCount: rows.filter((row) => row.promoFlag === 'так').length,
    avgRegularPrice: avg(rows.map((row) => row.regularPrice)),
    avgPromoPrice: avg(rows.map((row) => row.promoPrice)),
    avgDiscountPct: avg(rows.map((row) => row.discountPct)),
    errorCount
  };
}

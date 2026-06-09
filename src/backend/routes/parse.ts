import { Router } from 'express';
import { createParser } from '../parsers/parserFactory';
import { filterRowsByCategory } from '../services/categoryValidationService';
import { enrichRows } from '../services/extendedEnrichmentService';
import { LoggerService } from '../services/loggerService';
import type { ParseResult } from '../types';

export const parseRouter = Router();

parseRouter.post('/', async (req, res) => {
  const logger = new LoggerService();
  const { network, city, category, extended = false } = req.body ?? {};
  if (!network || !city || !category) {
    res.status(400).json({ message: 'network, city and category are required' });
    return;
  }

  try {
    logger.info(`Parse requested: ${network} / ${city} / ${category}`);
    const parser = createParser({ network, city, category }, logger);
    const result = await parser.parse();
    const parsedRows = deduplicateRows(result.rows);
    const validatedRows = filterRowsByCategory(parsedRows, category);
    const excludedCount = parsedRows.length - validatedRows.length;
    if (excludedCount) logger.info(`${network}: category validation excluded ${excludedCount} unrelated SKU`);
    const rows = extended ? enrichRows(validatedRows) : validatedRows;
    if (extended) logger.info(`${network}: extended enrichment applied to ${rows.length} SKU`);
    const summary = buildSummary(rows, result.errors.length);
    const payload: ParseResult = {
      rows,
      errors: result.errors,
      logs: logger.getEntries(),
      summary
    };
    res.json(payload);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    const payload: ParseResult = {
      rows: [],
      errors: [
        {
          date: new Date().toISOString(),
          network,
          city,
          category,
          url: '',
          errorType: 'PARSER_RUNTIME_ERROR',
          errorText: error instanceof Error ? error.message : String(error),
          manualReview: true
        }
      ],
      logs: logger.getEntries(),
      summary: buildSummary([], 1)
    };
    res.json(payload);
  }
});

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

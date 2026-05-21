import { ForaCatalogParser } from '../src/backend/parsers/foraCatalogParser';
import { GenericParser } from '../src/backend/parsers/genericParser';
import { ThrashGraphqlParser } from '../src/backend/parsers/thrashGraphqlParser';
import { VarusSearchParser } from '../src/backend/parsers/varusSearchParser';
import { WoocommerceStoreParser } from '../src/backend/parsers/woocommerceStoreParser';
import { ZakazApiParser } from '../src/backend/parsers/zakazApiParser';
import { getZakazChainForNetwork } from '../src/backend/parsers/zakazChains';
import { LoggerService } from '../src/backend/services/loggerService';
import type { ParseResult } from '../src/backend/types';

type ApiRequest = { method?: string; body?: Record<string, unknown> };
type ApiResponse = { status: (code: number) => { json: (payload: unknown) => void } };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const network = typeof req.body?.network === 'string' ? req.body.network : '';
  const city = typeof req.body?.city === 'string' ? req.body.city : '';
  const category = typeof req.body?.category === 'string' ? req.body.category : '';
  if (!network || !city || !category) {
    res.status(400).json({ message: 'network, city and category are required' });
    return;
  }

  const logger = new LoggerService();
  try {
    logger.info(`Parse requested: ${network} / ${city} / ${category}`);
    const parser = createVercelParser({ network, city, category }, logger);
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

function createVercelParser(request: { network: string; city: string; category: string }, logger: LoggerService) {
  const zakazChain = getZakazChainForNetwork(request.network);
  if (zakazChain) return new ZakazApiParser(request, logger, zakazChain);
  const normalized = request.network.toUpperCase();
  if (normalized.includes('ВЕЛИКА КИШЕНЯ')) return new WoocommerceStoreParser(request, logger, 'https://kishenya.ua');
  if (normalized.includes('ТРАШ')) return new ThrashGraphqlParser(request, logger);
  if (normalized.includes('ФОРА')) return new ForaCatalogParser(request, logger);
  if (normalized.includes('ВАРУС')) return new VarusSearchParser(request, logger);
  return new GenericParser(request, logger);
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

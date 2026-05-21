import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { findProductionAdapter } from '../src/backend/parsers/adapterConfigs';
import type { NetworkConfig, ParseResult } from '../src/backend/types';

type JsonBody = Record<string, unknown>;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url ?? '/', 'https://retail-price-monitor.vercel.app');
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, { status: 'ok' });
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return sendJson(res, 200, buildConfig());
    }
    if (req.method === 'POST' && url.pathname === '/api/parse') {
      return await parsePrices(req, res);
    }
    if (req.method === 'POST' && url.pathname === '/api/export') {
      return await exportExcel(req, res);
    }
    return sendJson(res, 404, { message: 'Not found' });
  } catch (error) {
    return sendJson(res, 500, {
      message: 'SERVERLESS_API_ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function buildConfig() {
  const networks = readJson<NetworkConfig[]>('src/backend/config/networks.json');
  const categories = readJson<string[]>('src/backend/config/categories.json');
  const cities = readJson<string[]>('src/backend/config/cities.json');

  return {
    networks: networks.map((network) => {
      const adapter = findProductionAdapter(network.network_name);
      return adapter
        ? {
            ...network,
            parser_type: adapter.parserType,
            parser_status: adapter.parserType === 'manual' ? 'inactive' : 'active',
            website_url: adapter.websiteUrl,
            notes:
              adapter.notes && adapter.notes !== 'Production search adapter'
                ? adapter.notes
                : adapter.parserType === 'manual'
                  ? 'Production: manual required або потрібен окремий discovery/API adapter.'
                  : `Production: ${adapter.parserType} search adapter. Якщо сайт не віддає публічні дані, результат буде MANUAL_REQUIRED.`
          }
        : { ...network, parser_status: network.parser_type === 'manual' ? 'inactive' : 'active' };
    }),
    categories,
    cities
  };
}

async function parsePrices(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  const network = asString(body.network);
  const city = asString(body.city);
  const category = asString(body.category);
  if (!network || !city || !category) {
    return sendJson(res, 400, { message: 'network, city and category are required' });
  }

  const [{ createParser }, { LoggerService }] = await Promise.all([
    import('../src/backend/parsers/parserFactory'),
    import('../src/backend/services/loggerService')
  ]);
  const logger = new LoggerService();
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
  return sendJson(res, 200, payload);
}

async function exportExcel(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const errors = Array.isArray(body.errors) ? body.errors : [];
  const { createExcelBuffer } = await import('../src/backend/services/excelService');
  const buffer = await createExcelBuffer(rows as never[], errors as never[]);
  const fileName = `retail-prices-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.end(Buffer.from(buffer));
}

async function readBody(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')) as T;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
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

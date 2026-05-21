import { Router } from 'express';
import ExcelJS from 'exceljs';
import type { PriceRow } from '../types';

export const importRouter = Router();

importRouter.post('/', expressRawXlsx(), async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.body);
    const sheet = workbook.getWorksheet('Prices') ?? workbook.worksheets[0];
    if (!sheet) {
      res.status(400).json({ message: 'Workbook does not contain sheets' });
      return;
    }

    const rows: PriceRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values as Array<unknown>;
      const sku = stringValue(values[8]);
      if (!sku) return;
      rows.push({
        collectionDate: stringValue(values[1]) || new Date().toISOString().slice(0, 10),
        network: stringValue(values[2]),
        city: stringValue(values[3]),
        categoryGroup: stringValue(values[4]),
        categorySource: stringValue(values[5]),
        manufacturer: stringValue(values[6]),
        brand: stringValue(values[7]),
        sku,
        packWeight: stringValue(values[9]),
        regularPrice: numberValue(values[10]),
        promoPrice: numberValue(values[11]),
        discountPct: numberValue(values[12]),
        promoFlag: stringValue(values[13]) === 'так' ? 'так' : 'ні',
        promoStartDate: stringValue(values[14]),
        promoEndDate: stringValue(values[15]),
        productUrl: stringValue(values[16]),
        comment: stringValue(values[17]) || 'Manual Excel import',
        sourceStatus: 'потребує ручної перевірки'
      });
    });

    res.json({ rows, errors: [], logs: [`Manual Excel import completed: ${rows.length} rows`] });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

function expressRawXlsx() {
  return async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      req.body = Buffer.concat(chunks);
      next();
    });
    req.on('error', next);
  };
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '');
  return String(value).trim();
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(stringValue(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

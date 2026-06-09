import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createExcelExport } from '../services/excelService';
import { isSkuRelevant } from '../services/categoryValidationService';
import type { ParseError, PriceRow } from '../types';

export const exportRouter = Router();

exportRouter.get('/download/:fileName', (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.resolve(process.cwd(), 'exports', fileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: 'Export file not found' });
    return;
  }
  res.download(filePath, fileName);
});

exportRouter.post('/', async (req, res) => {
  const rows = (req.body?.rows ?? []) as PriceRow[];
  const errors = (req.body?.errors ?? []) as ParseError[];
  try {
    if (!Array.isArray(rows) || !Array.isArray(errors)) {
      res.status(400).json({ message: 'rows and errors must be arrays' });
      return;
    }
    if (!rows.length && !errors.length) {
      res.status(400).json({ message: 'No rows or errors to export' });
      return;
    }
    const validatedRows = rows.filter((row) => isSkuRelevant(row.sku, row.categoryGroup));
    const result = await createExcelExport(validatedRows, errors);
    res.json({ downloadUrl: `/api/export/download/${encodeURIComponent(result.fileName)}`, fileName: result.fileName });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

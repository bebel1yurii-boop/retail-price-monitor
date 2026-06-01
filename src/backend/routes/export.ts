import { Router } from 'express';
import path from 'node:path';
import { createExcelExport } from '../services/excelService';
import type { ParseError, PriceRow } from '../types';

export const exportRouter = Router();

exportRouter.get('/download/:fileName', (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.resolve(process.cwd(), 'exports', fileName);
  res.download(filePath, fileName);
});

exportRouter.post('/', async (req, res) => {
  const rows = (req.body?.rows ?? []) as PriceRow[];
  const errors = (req.body?.errors ?? []) as ParseError[];
  try {
    const result = await createExcelExport(rows, errors);
    res.json({ downloadUrl: `/api/export/download/${encodeURIComponent(result.fileName)}`, fileName: result.fileName });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

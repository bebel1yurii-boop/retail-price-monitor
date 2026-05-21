import { Router } from 'express';
import { createExcelExport } from '../services/excelService';
import type { ParseError, PriceRow } from '../types';

export const exportRouter = Router();

exportRouter.post('/', async (req, res) => {
  const rows = (req.body?.rows ?? []) as PriceRow[];
  const errors = (req.body?.errors ?? []) as ParseError[];
  try {
    const result = await createExcelExport(rows, errors);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

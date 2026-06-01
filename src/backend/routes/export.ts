import { Router } from 'express';
import { createExcelBuffer } from '../services/excelService';
import type { ParseError, PriceRow } from '../types';

export const exportRouter = Router();

exportRouter.post('/', async (req, res) => {
  const rows = (req.body?.rows ?? []) as PriceRow[];
  const errors = (req.body?.errors ?? []) as ParseError[];
  try {
    const buffer = await createExcelBuffer(rows, errors);
    const fileName = `retail-prices-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

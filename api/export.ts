import { createExcelBuffer } from '../src/backend/services/excelService';

type ApiRequest = { method?: string; body?: Record<string, unknown> };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (key: string, value: string) => void;
  send: (payload: Buffer) => void;
  json: (payload: unknown) => void;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const errors = Array.isArray(req.body?.errors) ? req.body.errors : [];
  const buffer = await createExcelBuffer(rows, errors);
  const fileName = `retail-prices-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`;

  res.status(200);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(Buffer.from(buffer));
}

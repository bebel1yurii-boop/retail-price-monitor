import ExcelJS from 'exceljs';

type ApiRequest = { method?: string; body?: Record<string, unknown> };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (key: string, value: string) => void;
  send: (payload: Buffer) => void;
  json: (payload: unknown) => void;
};

const priceColumns = [
  ['Collection Date', 'collectionDate'],
  ['Network', 'network'],
  ['City', 'city'],
  ['Category Group', 'categoryGroup'],
  ['Category Source', 'categorySource'],
  ['Manufacturer', 'manufacturer'],
  ['Brand', 'brand'],
  ['SKU', 'sku'],
  ['Pack / Weight', 'packWeight'],
  ['Regular Price', 'regularPrice'],
  ['Promo Price', 'promoPrice'],
  ['Discount %', 'discountPct'],
  ['Promo Flag', 'promoFlag'],
  ['Promo Start Date', 'promoStartDate'],
  ['Promo End Date', 'promoEndDate'],
  ['Product URL', 'productUrl'],
  ['Comment', 'comment'],
  ['Source Status', 'sourceStatus']
] as const;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const errors = Array.isArray(req.body?.errors) ? req.body.errors : [];
  const workbook = buildWorkbook(rows, errors);
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `retail-prices-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`;

  res.status(200);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(Buffer.from(buffer));
}

function buildWorkbook(rows: unknown[], errors: unknown[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Retail Price Monitor';
  workbook.created = new Date();

  const prices = workbook.addWorksheet('Prices');
  prices.columns = priceColumns.map(([header, key]) => ({ header, key, width: header === 'SKU' ? 42 : 18 }));
  prices.addRows(rows);
  formatWorksheet(prices);
  prices.getColumn('J').numFmt = '#,##0.00';
  prices.getColumn('K').numFmt = '#,##0.00';
  prices.getColumn('L').numFmt = '0.0';

  const errorSheet = workbook.addWorksheet('Errors');
  errorSheet.columns = [
    { header: 'Date', key: 'date', width: 22 },
    { header: 'Network', key: 'network', width: 18 },
    { header: 'City', key: 'city', width: 18 },
    { header: 'Group', key: 'category', width: 24 },
    { header: 'URL', key: 'url', width: 44 },
    { header: 'Error Type', key: 'errorType', width: 22 },
    { header: 'Error Text', key: 'errorText', width: 50 },
    { header: 'Manual Review', key: 'manualReview', width: 16 }
  ];
  errorSheet.addRows(errors);
  formatWorksheet(errorSheet);

  const summary = workbook.addWorksheet('Summary');
  const typedRows = rows as Array<Record<string, unknown>>;
  const promoRows = typedRows.filter((row) => row.promoFlag === 'так');
  summary.addRows([
    ['Metric', 'Value'],
    ['SKU Count', typedRows.length],
    ['Promo SKU Count', promoRows.length],
    ['Average Regular Price', avg(typedRows.map((row) => toNumber(row.regularPrice)))],
    ['Average Promo Price', avg(typedRows.map((row) => toNumber(row.promoPrice)))],
    ['Average Discount %', avg(typedRows.map((row) => toNumber(row.discountPct)))],
    ['Error Count', errors.length],
    [],
    ['SKU by Manufacturer', 'Count'],
    ...Object.entries(countBy(typedRows, 'manufacturer')),
    [],
    ['SKU by Network', 'Count'],
    ...Object.entries(countBy(typedRows, 'network'))
  ]);
  formatWorksheet(summary);

  return workbook;
}

function formatWorksheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(sheet.columnCount, 1) }
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
}

function avg(values: Array<number | null>) {
  const clean = values.filter((value): value is number => typeof value === 'number');
  return clean.length ? Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(2)) : null;
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function countBy(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? 'Не визначено');
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

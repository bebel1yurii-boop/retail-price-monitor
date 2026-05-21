import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import type { ParseError, PriceRow } from '../types';

const exportDir = path.resolve(process.cwd(), 'exports');

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

export async function createExcelExport(rows: PriceRow[], errors: ParseError[]) {
  fs.mkdirSync(exportDir, { recursive: true });
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
  const promoRows = rows.filter((row) => row.promoFlag === 'так');
  const avg = (values: Array<number | null>) => {
    const clean = values.filter((value): value is number => typeof value === 'number');
    return clean.length ? Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(2)) : null;
  };
  const byManufacturer = countBy(rows, 'manufacturer');
  const byNetwork = countBy(rows, 'network');
  summary.addRows([
    ['Metric', 'Value'],
    ['SKU Count', rows.length],
    ['Promo SKU Count', promoRows.length],
    ['Average Regular Price', avg(rows.map((row) => row.regularPrice))],
    ['Average Promo Price', avg(rows.map((row) => row.promoPrice))],
    ['Average Discount %', avg(rows.map((row) => row.discountPct))],
    ['Error Count', errors.length],
    [],
    ['SKU by Manufacturer', 'Count'],
    ...Object.entries(byManufacturer),
    [],
    ['SKU by Network', 'Count'],
    ...Object.entries(byNetwork)
  ]);
  formatWorksheet(summary);

  const fileName = `retail-prices-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xlsx`;
  const filePath = path.join(exportDir, fileName);
  await workbook.xlsx.writeFile(filePath);
  return { fileName, filePath, downloadUrl: `/exports/${fileName}` };
}

function formatWorksheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(sheet.columnCount, 1) }
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };
}

function countBy<T, K extends keyof T>(rows: T[], key: K) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? 'Не визначено');
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

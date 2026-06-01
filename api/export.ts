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
  ['Source Status', 'sourceStatus'],
  ['External SKU ID', 'externalSkuId'],
  ['EAN', 'ean'],
  ['Unit Price', 'unitPrice'],
  ['Unit Price Basis', 'unitPriceBasis'],
  ['Availability Status', 'availabilityStatus'],
  ['Stock Quantity', 'stockQuantity'],
  ['Delivery Available', 'deliveryAvailable'],
  ['Pickup Available', 'pickupAvailable'],
  ['Store Name', 'storeName'],
  ['Store Address', 'storeAddress'],
  ['Country of Origin', 'countryOfOrigin'],
  ['Product Composition', 'productComposition'],
  ['Promo Mechanic', 'promoMechanic'],
  ['Loyalty Price', 'loyaltyPrice'],
  ['Minimum Promo Quantity', 'minimumPromoQuantity'],
  ['Online Exclusive', 'onlineExclusive'],
  ['Category Position', 'categoryPosition'],
  ['Search Position', 'searchPosition'],
  ['Image Count', 'imageCount'],
  ['Card Completeness %', 'cardCompletenessPct'],
  ['Rating', 'rating'],
  ['Review Count', 'reviewCount'],
  ['Badges', 'badges'],
  ['Extended Mode', 'extendedMode']
] as const;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const rows = Array.isArray(req.body?.rows) ? filterRowsByCategory(req.body.rows) : [];
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
  prices.getColumn('U').numFmt = '#,##0.00';

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

  const availability = workbook.addWorksheet('Availability');
  availability.columns = [
    { header: 'Collection Date', key: 'collectionDate', width: 18 },
    { header: 'Network', key: 'network', width: 18 },
    { header: 'City', key: 'city', width: 18 },
    { header: 'External SKU ID', key: 'externalSkuId', width: 18 },
    { header: 'EAN', key: 'ean', width: 18 },
    { header: 'SKU', key: 'sku', width: 42 },
    { header: 'Availability Status', key: 'availabilityStatus', width: 22 },
    { header: 'Stock Quantity', key: 'stockQuantity', width: 16 },
    { header: 'Delivery Available', key: 'deliveryAvailable', width: 18 },
    { header: 'Pickup Available', key: 'pickupAvailable', width: 18 },
    { header: 'Store Name', key: 'storeName', width: 24 },
    { header: 'Store Address', key: 'storeAddress', width: 36 }
  ];
  availability.addRows(rows);
  formatWorksheet(availability);

  const promotions = workbook.addWorksheet('Promotions');
  promotions.columns = [
    { header: 'Collection Date', key: 'collectionDate', width: 18 },
    { header: 'Network', key: 'network', width: 18 },
    { header: 'City', key: 'city', width: 18 },
    { header: 'SKU', key: 'sku', width: 42 },
    { header: 'Regular Price', key: 'regularPrice', width: 16 },
    { header: 'Promo Price', key: 'promoPrice', width: 16 },
    { header: 'Discount %', key: 'discountPct', width: 14 },
    { header: 'Promo Flag', key: 'promoFlag', width: 14 },
    { header: 'Promo Mechanic', key: 'promoMechanic', width: 22 },
    { header: 'Loyalty Price', key: 'loyaltyPrice', width: 16 },
    { header: 'Minimum Promo Quantity', key: 'minimumPromoQuantity', width: 20 },
    { header: 'Promo Start Date', key: 'promoStartDate', width: 18 },
    { header: 'Promo End Date', key: 'promoEndDate', width: 18 }
  ];
  promotions.addRows(typedRows.filter((row) => row.promoFlag === 'так'));
  formatWorksheet(promotions);

  const digitalShelf = workbook.addWorksheet('Digital Shelf');
  digitalShelf.columns = [
    { header: 'Collection Date', key: 'collectionDate', width: 18 },
    { header: 'Network', key: 'network', width: 18 },
    { header: 'City', key: 'city', width: 18 },
    { header: 'SKU', key: 'sku', width: 42 },
    { header: 'Category Source', key: 'categorySource', width: 32 },
    { header: 'Category Position', key: 'categoryPosition', width: 18 },
    { header: 'Search Position', key: 'searchPosition', width: 16 },
    { header: 'Image URL', key: 'imageUrl', width: 50 },
    { header: 'Image Count', key: 'imageCount', width: 14 },
    { header: 'Card Completeness %', key: 'cardCompletenessPct', width: 20 },
    { header: 'Rating', key: 'rating', width: 12 },
    { header: 'Review Count', key: 'reviewCount', width: 14 },
    { header: 'Badges', key: 'badges', width: 24 },
    { header: 'Product URL', key: 'productUrl', width: 50 }
  ];
  digitalShelf.addRows(rows);
  formatWorksheet(digitalShelf);

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

function filterRowsByCategory(rows: unknown[]) {
  return rows.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    const record = row as Record<string, unknown>;
    const sku = String(record.sku ?? '').toLowerCase();
    const category = String(record.categoryGroup ?? '').toLowerCase();
    if (/(приправа|спец|прянощ|соус|зі смаком|смаком кур|бульйон|вермішел|локшин|пюре|яйц|корм|ласощ|для кот|для кіш|для собак|кошен|цуцен|cat|dog|pet|шампун|насіння|оливк|джем|рахат|вафл|батончик|хумус|перець|сік|напій)/i.test(sku)) return false;
    if (category.includes('напів')) return /(напівфаб|пельмен|вареник|котлет|нагетс|чебурек|млинц|бендерик|хінкал|равіол|тефтел|фрикадел|шніцел|зраз|голубц)/i.test(sku);
    if (category.includes('ковбас')) return /(ковбас|сосиск|сардель|шинка|балик|буженин|салям|делікатес|бекон|карбонад|корейк|грудинк|пастром)/i.test(sku);
    if (/(пельмен|вареник|котлет|нагетс|чебурек|млинц|бендерик|хінкал|равіол|ковбас|сосиск|сардель|шинка|балик|делікатес|рулет|закуска|сендвіч|бургер|піца|паштет|по-домашньому|гриль|запеч|смажен|відвар|теріякі|з рисом|в соусі|у соусі)/i.test(sku)) return false;
    return /(курк|курча|куряч|індич|індюк|качк|качен|перепіл|філе|стегн|крил|гоміл|грудк|четвертин|ніжк|тушк|фарш|печін|серц|шлунк)/i.test(sku);
  });
}

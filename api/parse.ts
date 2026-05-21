type ApiRequest = { method?: string; body?: Record<string, unknown> };
type ApiResponse = { status: (code: number) => { json: (payload: unknown) => void } };

type RawProduct = {
  name?: string;
  title?: string;
  price?: number;
  oldPrice?: number;
  old_price?: number;
  slug?: string;
  id?: string | number;
  image?: string;
  img?: string;
  categoryName?: string;
  brandName?: string;
  producerName?: string;
};

const foraEndpoint = 'https://api.catalog.ecom.fora.ua/api/2.0/exec/EcomCatalogGlobal';
const queryByCategory: Record<string, string[]> = {
  poultry: ['курка', 'куряче філе', 'куряче стегно', 'куряче крило', 'індичка'],
  semifinished: ['нагетси', 'котлета куряча', 'пельмені', 'напівфабрикати', 'чебуреки'],
  sausage: ['ковбаса', 'сосиски', 'сардельки', 'шинка', 'балик']
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const network = typeof req.body?.network === 'string' ? req.body.network : '';
  const city = typeof req.body?.city === 'string' ? req.body.city : '';
  const category = typeof req.body?.category === 'string' ? req.body.category : '';
  if (!network || !city || !category) {
    res.status(400).json({ message: 'network, city and category are required' });
    return;
  }

  if (!network.toUpperCase().includes('ФОРА')) {
    res.status(200).json({
      rows: [],
      errors: [
        {
          date: new Date().toISOString(),
          network,
          city,
          category,
          url: '',
          errorType: 'VERCEL_ADAPTER_NOT_ENABLED',
          errorText:
            'На Vercel увімкнений тільки lightweight API adapter для ФОРА. Інші parser-и потребують окремого backend worker/server через runtime/timeout обмеження.',
          manualReview: true
        }
      ],
      logs: [`${new Date().toISOString()} [WARN] ${network}: Vercel adapter is not enabled`],
      summary: buildSummary([], 1)
    });
    return;
  }

  const logs: string[] = [`${new Date().toISOString()} [INFO] Parse requested: ${network} / ${city} / ${category}`];
  const errors: unknown[] = [];
  const rows = [];

  for (const term of queryByCategory[getGroup(category)]) {
    try {
      const products = await fetchFora(term);
      logs.push(`${new Date().toISOString()} [INFO] ФОРА: ${products.length} products for "${term}"`);
      rows.push(...products.map((product) => normalizeForaProduct(product, { network, city, category, term })));
    } catch (error) {
      errors.push({
        date: new Date().toISOString(),
        network,
        city,
        category,
        url: foraEndpoint,
        errorType: 'FORA_VERCEL_API_ERROR',
        errorText: error instanceof Error ? error.message : String(error),
        manualReview: true
      });
    }
  }

  const deduped = dedupeRows(rows).filter((row) => matchesGroup(row.sku, category));
  res.status(200).json({
    rows: deduped,
    errors,
    logs,
    summary: buildSummary(deduped, errors.length)
  });
}

async function fetchFora(query: string): Promise<RawProduct[]> {
  const response = await fetch(foraEndpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'GetSimpleCatalogItems',
      data: {
        merchantId: 4,
        basketGuid: '00000000-0000-0000-0000-000000000000',
        deliveryType: 2,
        filialId: 310,
        From: 0,
        To: 80,
        customFilter: query
      }
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return findProducts(payload);
}

function findProducts(payload: unknown): RawProduct[] {
  const candidates = [
    (payload as { data?: unknown })?.data,
    (payload as { result?: unknown })?.result,
    (payload as { items?: unknown })?.items,
    payload
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as RawProduct[];
    if (candidate && typeof candidate === 'object') {
      const object = candidate as Record<string, unknown>;
      for (const key of ['items', 'catalogItems', 'products', 'data']) {
        if (Array.isArray(object[key])) return object[key] as RawProduct[];
      }
    }
  }
  return [];
}

function normalizeForaProduct(product: RawProduct, context: { network: string; city: string; category: string; term: string }) {
  const sku = clean(product.name ?? product.title ?? '');
  const price = toNumber(product.price);
  const oldPrice = toNumber(product.oldPrice ?? product.old_price);
  const hasPromo = oldPrice !== null && price !== null && oldPrice > price;
  const regularPrice = hasPromo ? oldPrice : price;
  const promoPrice = hasPromo ? price : null;
  return {
    collectionDate: new Date().toISOString().slice(0, 10),
    network: context.network.toUpperCase(),
    city: context.city,
    categoryGroup: context.category,
    categorySource: product.categoryName ?? `search:${context.term}`,
    manufacturer: product.producerName ?? 'Не визначено',
    brand: product.brandName ?? detectBrand(sku),
    sku,
    packWeight: extractPackWeight(sku),
    regularPrice,
    promoPrice,
    discountPct: regularPrice && promoPrice ? Number((((regularPrice - promoPrice) / regularPrice) * 100).toFixed(1)) : null,
    promoFlag: promoPrice ? 'так' : 'ні',
    promoStartDate: '',
    promoEndDate: '',
    productUrl: product.slug ? `https://fora.ua/product/${product.slug}` : 'https://fora.ua',
    imageUrl: product.image ?? product.img,
    comment: `Fora Vercel lightweight adapter; id=${product.id ?? ''}`,
    sourceStatus: 'успішно'
  };
}

function getGroup(category: string): 'poultry' | 'semifinished' | 'sausage' {
  const normalized = category.toLowerCase();
  if (normalized.includes('напів')) return 'semifinished';
  if (normalized.includes('ковбас')) return 'sausage';
  return 'poultry';
}

function matchesGroup(sku: string, category: string) {
  const value = sku.toLowerCase();
  const group = getGroup(category);
  if (group === 'poultry') return /(кур|індич|крил|стегн|гоміл|філе)/i.test(value) && !/(ковбас|сосиск|пельмен|котлет)/i.test(value);
  if (group === 'semifinished') return /(нагет|котлет|пельмен|напів|чебурек|вареник|млин)/i.test(value);
  return /(ковбас|сосиск|сардель|шинка|балик|буженин|салям)/i.test(value);
}

function dedupeRows<T extends { sku: string; productUrl: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.sku}|${row.productUrl}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSummary(rows: Array<{ regularPrice: number | null; promoPrice: number | null; discountPct: number | null; promoFlag: string }>, errorCount: number) {
  const avg = (values: Array<number | null>) => {
    const cleanValues = values.filter((value): value is number => typeof value === 'number');
    return cleanValues.length ? Number((cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length).toFixed(2)) : null;
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

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value) return null;
  const parsed = Number.parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPackWeight(name: string) {
  return name.match(/(\d+(?:[,.]\d+)?\s?(?:кг|г|гр|мл|л|шт))/i)?.[1]?.replace(',', '.') ?? '';
}

function detectBrand(name: string) {
  if (/наша ряба/i.test(name)) return 'Наша Ряба';
  if (/легко/i.test(name)) return 'Легко!';
  if (/бащин/i.test(name)) return 'Бащинський';
  if (/глобино/i.test(name)) return 'Глобино';
  return 'Не визначено';
}

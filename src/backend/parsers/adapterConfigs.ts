import type { ParserType } from '../types';

export interface ProductionAdapterConfig {
  canonicalName: string;
  aliases: string[];
  websiteUrl: string;
  parserType: ParserType;
  searchPaths: string[];
  queryByCategory: Record<string, string[]>;
  notes: string;
}

const commonQueries = {
  poultry: ['куряче філе', 'куряче стегно', 'куряче крило', 'куряча гомілка'],
  semifinished: ['нагетси курячі', 'котлета куряча', 'пельмені курячі', 'напівфабрикати курячі'],
  sausage: ['ковбаса', 'сосиски', 'сардельки', 'шинка']
};

export const productionAdapters: ProductionAdapterConfig[] = [
  adapter(
    'АТБ МАРКЕТ',
    ['АТБ'],
    'https://www.atbmarket.com',
    'manual',
    [],
    'Official category URLs confirmed, but server-side HTTP and standard Playwright access receive Cloudflare 403. Use an approved partner feed, manual Excel import or a separately approved browser workflow.'
  ),
  adapter('МЕТРО', ['METRO'], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('АШАН', ['AUCHAN'], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ВЕЛИКА КИШЕНЯ', [], 'https://kishenya.ua', 'api', [], 'WooCommerce Store API adapter: /wp-json/wc/store/products. Partial coverage depends on search terms and promo catalog.'),
  adapter('ВАРУС', ['VARUS'], 'https://varus.ua/api/catalog/vue_storefront_catalog_2/product_v2/_search', 'api', [], 'Vue Storefront search adapter: Multisearch IDs + product_v2 catalog details.'),
  adapter('ДЕЛВІ', ['DELVI'], 'https://delvi.ua', 'manual', []),
  adapter('ФАЙНО МАРКЕТ', [], 'https://fayno.market/discounts', 'html', [], 'Public promo-only HTML adapter: fayno.market/discounts. Parses currently published discount cards; regular catalog is not publicly exposed.'),
  adapter('ВОСТОРГ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ЕКО МАРКЕТ', ['EKOMARKET'], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ТОРБА', ['TORBA'], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('КЛАС', [], 'https://klassmarket.ua', 'playwright', [], 'Playwright DOM adapter: public leaf category pages with browser-cookie challenge, pagination and SKU-level dedupe.'),
  adapter('ПОСАД', [], 'https://posad.com.ua', 'manual', [], 'Public site exposes promotions and newspapers, but no confirmed SKU catalog with product-level prices. OCR workflow or manual Excel import is required.'),
  adapter('РОСТ', [], 'https://rostmarket.com.ua', 'html', [], 'Magento HTML adapter: public category pages, pagination, regular and promo prices, SKU-level dedupe.'),
  adapter('ЧУДО МАРКЕТ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ЕПІЦЕНТР', ['EPICENTR'], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('КОЛО', [], 'https://kolo-market.com', 'manual', []),
  adapter('МЕГА-МАРКЕТ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('УЛЬТРАМАРКЕТ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ІДЕАЛ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('КОПІЙКА', [], 'https://kopiyka.ua', 'html', [], 'Embedded JSON adapter: public category pages, product prices, promotions, stock amount, images and SKU-level dedupe.'),
  adapter('ТАВРІЯ В', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ТОЧКА', [], '', 'manual', []),
  adapter('АРСЕН', [], 'https://arsen.ua', 'manual', []),
  adapter('БЛИЗЕНЬКО', [], 'https://blyzenko.ua', 'manual', [], 'Public WordPress API exposes promo posts and banners, but no confirmed SKU catalog with product-level prices. OCR workflow or manual Excel import is required.'),
  adapter('РУКАВИЧКА', [], 'https://market.rukavychka.ua', 'html', [], 'OpenCart HTML adapter: public category pages, pagination, regular and promo prices, product code, images and SKU-level dedupe.'),
  adapter('СІМ 23', ['СІМІ', 'SIMI'], 'https://simi.ua/lystivka/', 'manual', [], 'Official СІМІ promo leaflet is published as image pages without a PDF, structured SKU catalog or price API. A dedicated OCR workflow with manual review or manual Excel import is required.'),
  adapter('СІЛЬПО', ['SILPO'], 'https://silpo.ua/category/m-iaso-4411', 'manual', [], 'Official leaf category URLs are confirmed, but server-side HTTP and standard Playwright through system Edge receive a Cloudflare security check. Use an approved API/feed, manual Excel import or a separately approved browser workflow.'),
  adapter('НОВУС', ['NOVUS'], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ФОЗЗІ', ['FOZZY'], 'https://fozzyshop.ua', 'playwright', [], 'Playwright DOM adapter: public category pages, pagination, product cards, conservative throttling. Direct HTTP may return 403, so manual review fallback remains required.'),
  adapter('ФОРА', ['FORA'], 'https://api.catalog.ecom.fora.ua/api/2.0/exec/EcomCatalogGlobal', 'api', [], 'EcomCatalogGlobal adapter: GetSimpleCatalogItems with public catalog parameters.'),
  adapter('ТРАШ', ['THRASH'], 'https://thrash.ua/graphql', 'api', [], 'GraphQL search adapter: public search query with throttling and SKU-level dedupe.')
];

export function findProductionAdapter(network: string) {
  const needle = normalize(network);
  return productionAdapters.find((config) =>
    [config.canonicalName, ...config.aliases].some((alias) => needle.includes(normalize(alias)))
  );
}

export function getCategoryQueries(config: ProductionAdapterConfig, category: string) {
  const normalized = normalize(category);
  if (normalized.includes('НАПІВ')) return config.queryByCategory.semifinished;
  if (normalized.includes('КОВБАС')) return config.queryByCategory.sausage;
  return config.queryByCategory.poultry;
}

function adapter(
  canonicalName: string,
  aliases: string[],
  websiteUrl: string,
  parserType: ParserType,
  searchPaths: string[],
  notes?: string
): ProductionAdapterConfig {
  return {
    canonicalName,
    aliases,
    websiteUrl,
    parserType,
    searchPaths,
    queryByCategory: commonQueries,
    notes: notes ?? (parserType === 'manual' ? 'Публічний каталог/API не підтверджений. Потрібне ручне внесення або discovery.' : 'Production search adapter')
  };
}

export function normalize(value: string) {
  return value
    .toUpperCase()
    .replace(/'/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
}

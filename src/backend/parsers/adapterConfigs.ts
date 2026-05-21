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
  adapter('АТБ МАРКЕТ', ['АТБ'], 'https://www.atbmarket.com', 'manual', []),
  adapter('МЕТРО', ['METRO'], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('АШАН', ['AUCHAN'], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ВЕЛИКА КИШЕНЯ', [], 'https://kishenya.ua', 'api', [], 'WooCommerce Store API adapter: /wp-json/wc/store/products. Partial coverage depends on search terms and promo catalog.'),
  adapter('ВАРУС', ['VARUS'], 'https://varus.ua/api/catalog/vue_storefront_catalog_2/product_v2/_search', 'api', [], 'Vue Storefront search adapter: Multisearch IDs + product_v2 catalog details.'),
  adapter('ДЕЛВІ', ['DELVI'], 'https://delvi.ua', 'manual', []),
  adapter('ФАЙНО МАРКЕТ', [], 'https://fayno.market', 'manual', []),
  adapter('ВОСТОРГ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('КЛАС', [], 'https://klassmarket.ua', 'manual', []),
  adapter('ПОСАД', [], 'https://posad.com.ua', 'manual', []),
  adapter('РОСТ', [], 'https://rost.kh.ua', 'manual', []),
  adapter('ЧУДО МАРКЕТ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ЕПІЦЕНТР', ['EPICENTR'], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('КОЛО', [], 'https://kolo-market.com', 'manual', []),
  adapter('МЕГА-МАРКЕТ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('УЛЬТРАМАРКЕТ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ІДЕАЛ', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('КОПІЙКА', [], 'https://kopeyka.ua', 'manual', []),
  adapter('ТАВРІЯ В', [], 'https://stores-api.zakaz.ua', 'api', []),
  adapter('ТОЧКА', [], '', 'manual', []),
  adapter('АРСЕН', [], 'https://arsen.ua', 'manual', []),
  adapter('БЛИЗЕНЬКО', [], 'https://blyzenko.ua', 'manual', []),
  adapter('РУКАВИЧКА', [], 'https://rukavychka.ua', 'manual', []),
  adapter('СІМ 23', [], 'https://sim23.ua', 'manual', []),
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

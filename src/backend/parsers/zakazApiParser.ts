import { BaseParser } from './baseParser';
import { normalizeProduct, type RawProduct } from '../services/normalizationService';
import type { LoggerService } from '../services/loggerService';
import type { ParseRequest, PriceRow } from '../types';

interface ZakazStore {
  id: string;
  name: string;
  retail_chain: string;
  city: string;
  region_id: string;
}

interface ZakazCategory {
  id: string;
  title: string;
  count: number;
  parent_id: string | null;
  children?: ZakazCategory[];
}

interface ZakazProduct {
  title: string;
  price: number;
  discount?: {
    status: boolean;
    value: number;
    old_price: number;
    due_date: string | null;
  };
  web_url?: string;
  category_id?: string;
  parent_category_id?: string;
  producer?: {
    trademark?: string;
    name?: string;
  };
  img?: Record<string, string>;
  weight?: number;
}

interface ZakazProductsResponse {
  count: number;
  count_available: number;
  results: ZakazProduct[];
}

const cityMap: Record<string, string[]> = {
  Київ: ['kiev', 'kyiv'],
  Львів: ['lviv'],
  Дніпро: ['dnipro'],
  Одеса: ['odesa'],
  Харків: ['kharkiv'],
  Запоріжжя: ['zaporizhzhia'],
  Вінниця: ['vinnytsia'],
  Полтава: ['poltava'],
  Рівне: ['rivne'],
  'Івано-Франківськ': ['ivanofrankivsk']
};

const cityNameBySlug: Record<string, string> = {
  kiev: 'Київ',
  kyiv: 'Київ',
  lviv: 'Львів',
  dnipro: 'Дніпро',
  odesa: 'Одеса',
  kharkiv: 'Харків',
  zaporizhzhia: 'Запоріжжя',
  vinnytsia: 'Вінниця',
  poltava: 'Полтава',
  rivne: 'Рівне',
  ivanofrankivsk: 'Івано-Франківськ'
};

const fallbackCityByRetailChain: Record<string, string> = {
  chudomarket: 'Одеса',
  ekomarket: 'Київ',
  torba: 'Рівне',
  vostorg: 'Харків'
};

const metroCategoryIds: Record<string, string[]> = {
  poultry: ['chicken-metro', 'frozen-chicken-metro', 'frozen-turkey-metro', 'frozen-duck-metro', 'common-quail-metro'],
  semifinished: ['refrigerated-semis-metro', 'half-made-food-metro'],
  sausage: ['sausages-and-burgers-metro', 'delicatessen-metro']
};

export class ZakazApiParser extends BaseParser {
  private apiBase = 'https://stores-api.zakaz.ua';

  constructor(
    request: ParseRequest,
    logger: LoggerService,
    private retailChain: string
  ) {
    super(request, logger);
  }

  async parse() {
    const store = await this.resolveStore();
    if (!store) {
      return {
        rows: [],
        errors: [this.buildError(this.apiBase, 'STORE_NOT_FOUND', `Zakaz store not found for ${this.retailChain} / ${this.request.city}`, true)]
      };
    }
    const effectiveCity =
      cityNameBySlug[store.city] ??
      cityNameBySlug[store.region_id] ??
      store.city ??
      fallbackCityByRetailChain[this.retailChain] ??
      this.request.city;
    if (effectiveCity !== this.request.city) {
      this.logger.info(`${this.request.network}: у місті ${this.request.city} немає точки Zakaz, використовую ${effectiveCity}`);
    }

    const categoryIds = await this.getCategoryIds(store.id);
    if (!categoryIds.length) {
      return {
        rows: [],
        errors: [
          this.buildError(
            `${this.apiBase}/stores/${store.id}/categories/`,
            'ZAKAZ_CATEGORY_MAPPING_EMPTY',
            `No Zakaz categories matched ${this.request.category} for ${this.retailChain}`,
            true
          )
        ]
      };
    }

    const rawProducts: RawProduct[] = [];
    const errors = [];

    for (const categoryId of categoryIds) {
      try {
        const products = await this.fetchCategoryProducts(store.id, categoryId);
        this.logger.info(`${this.request.network}: ${products.length} products from Zakaz category ${categoryId}`);
        rawProducts.push(...products.map((product) => this.toRawProduct(product, categoryId)));
      } catch (error) {
        errors.push(this.buildError(`${this.apiBase}/stores/${store.id}/categories/${categoryId}/products/`, 'ZAKAZ_CATEGORY_ERROR', error, true));
      }
    }

    const rows = rawProducts.map((product) => normalizeProduct(product, { ...this.request, city: effectiveCity }));
    return { rows: dedupeRows(rows), errors };
  }

  private async resolveStore() {
    const stores = (await this.fetchJson<ZakazStore[]>(`${this.apiBase}/stores/`)).filter(
      (store) => store.retail_chain === this.retailChain
    );
    const cityCandidates = cityMap[this.request.city] ?? [this.request.city.toLowerCase()];
    return stores.find((store) => cityCandidates.includes(store.city) || cityCandidates.includes(store.region_id)) ?? stores[0] ?? null;
  }

  private async fetchCategoryProducts(storeId: string, categoryId: string) {
    const products: ZakazProduct[] = [];
    const maxPages = Number(process.env.ZAKAZ_MAX_PAGES ?? 12);

    for (let page = 1; page <= maxPages; page += 1) {
      const url = `${this.apiBase}/stores/${storeId}/categories/${categoryId}/products/?page=${page}`;
      const payload = await this.retry(() => this.fetchJson<ZakazProductsResponse>(url), url);
      products.push(...payload.results);
      if (!payload.results.length || products.length >= payload.count) break;
    }

    return products.filter((product) => product.title && product.price);
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'accept-language': 'uk-UA,uk;q=0.9,en;q=0.5',
          'user-agent': this.options.userAgent
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getCategoryIds(storeId: string) {
    const categories = await this.fetchJson<ZakazCategory[]>(`${this.apiBase}/stores/${storeId}/categories/`);
    const flat = flattenCategories(categories);
    const category = this.request.category.toLowerCase();
    const group = category.includes('напів') ? 'semifinished' : category.includes('ковбас') ? 'sausage' : 'poultry';
    const matched = flat.filter((item) => item.count > 0 && matchesBusinessGroup(item, group));
    const compact = removeDescendantsWhenParentSelected(matched);
    this.logger.info(`${this.request.network}: matched Zakaz categories ${compact.map((item) => item.id).join(', ')}`);
    return compact.map((item) => item.id);
  }

  private toRawProduct(product: ZakazProduct, categoryId: string): RawProduct {
    const hasPromo = Boolean(product.discount?.status && product.discount.old_price > product.price);
    return {
      sku: product.title,
      regularPrice: centsToPrice(hasPromo ? product.discount?.old_price : product.price),
      promoPrice: hasPromo ? centsToPrice(product.price) : null,
      productUrl: product.web_url,
      categorySource: categoryId,
      imageUrl: product.img?.s350x350 ?? product.img?.s200x200 ?? product.img?.s150x150,
      promoEndDate: product.discount?.due_date ?? '',
      manufacturer: product.producer?.name,
      brand: product.producer?.trademark,
      comment: `Zakaz Stores API; producer=${product.producer?.trademark ?? product.producer?.name ?? ''}`.trim()
    };
  }
}

function flattenCategories(categories: ZakazCategory[]) {
  const result: ZakazCategory[] = [];
  const walk = (items: ZakazCategory[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(categories);
  return result;
}

function matchesBusinessGroup(category: ZakazCategory, group: 'poultry' | 'semifinished' | 'sausage') {
  const value = `${category.id} ${category.title}`.toLowerCase();
  const id = category.id.toLowerCase();
  const excludedCommon = /(egg|яйц|seasoning|приправа|turmeric|куркума|corn|кукурудз|feed|корм|utensil|молотк|снеки|snacks|canned|консерв|pate|паштет|champagne|shampoo|sandwich|buns|булоч|соус|sauce|flavoring|flavouring)/i;
  const broadRoot = /^(meat-fish-poultry|frozen|ready-meals|second-courses)(-|$)/i.test(id);
  if (broadRoot) return false;

  if (group === 'poultry') {
    if (excludedCommon.test(value) || /(delicatessen|ковбас|сосиск|сардель|шинка|напів|semi|dumpling|cutlet|котлет|пельмен)/i.test(value)) return false;
    return /(chicken|turkey|duck|quail|курятина|індич|кач|перепіл)/i.test(value);
  }

  if (group === 'semifinished') {
    if (excludedCommon.test(value) || /(fish|seafood|риба|морепродукт|cheese|сир|for-barbecue|hamburger)/i.test(value)) return false;
    return /(semi|half-made|half-finished|dumpling|cutlet|meatball|meat-barbecue|marinade|nugget|напів|пельмен|котлет|фрикадель|шашлик|маринад|нагетс|млинц|бендерик|хінкалі|равіолі)/i.test(value);
  }

  if (excludedCommon.test(value)) return false;
  return /(sausage|sausages|frankfurter|wiener|delicatessen|bockwurst|ковбас|сосиск|сардель|делікатес|шинка|м'ясні вироби|м’ясні вироби)/i.test(value);
}

function removeDescendantsWhenParentSelected(categories: ZakazCategory[]) {
  const selected = new Map(categories.map((item) => [item.id, item]));
  return categories.filter((item) => {
    let parentId = item.parent_id;
    while (parentId) {
      if (selected.has(parentId)) return false;
      parentId = selected.get(parentId)?.parent_id ?? null;
    }
    return true;
  });
}

function centsToPrice(value: number | undefined) {
  return typeof value === 'number' ? Number((value / 100).toFixed(2)) : null;
}

function dedupeRows(rows: PriceRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.network}|${row.city}|${row.sku}|${row.productUrl}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

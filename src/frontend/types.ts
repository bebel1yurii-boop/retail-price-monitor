export interface NetworkConfig {
  network_name: string;
  canonical_name: string;
  website_url: string;
  parser_type: 'api' | 'html' | 'playwright' | 'manual';
  parser_status?: 'active' | 'inactive';
  supported_cities: string[];
  supported_categories: string[];
  notes: string;
}

export interface PriceRow {
  collectionDate: string;
  network: string;
  city: string;
  categoryGroup: string;
  categorySource: string;
  manufacturer: string;
  brand: string;
  sku: string;
  packWeight: string;
  regularPrice: number | null;
  promoPrice: number | null;
  discountPct: number | null;
  promoFlag: 'так' | 'ні';
  promoStartDate: string;
  promoEndDate: string;
  productUrl: string;
  comment: string;
  sourceStatus: 'успішно' | 'помилка' | 'потребує ручної перевірки';
}

export interface ParseError {
  date: string;
  network: string;
  city: string;
  category: string;
  url: string;
  errorType: string;
  errorText: string;
  manualReview: boolean;
}

export interface ParseResult {
  rows: PriceRow[];
  errors: ParseError[];
  logs: string[];
  summary: {
    skuCount: number;
    promoSkuCount: number;
    avgRegularPrice: number | null;
    avgPromoPrice: number | null;
    avgDiscountPct: number | null;
    errorCount: number;
  };
}

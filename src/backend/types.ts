export type ParserType = 'api' | 'html' | 'playwright' | 'manual';
export type SourceStatus = 'успішно' | 'помилка' | 'потребує ручної перевірки';

export interface ParseRequest {
  network: string;
  city: string;
  category: string;
  extended?: boolean;
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
  imageUrl?: string;
  comment: string;
  sourceStatus: SourceStatus;
  externalSkuId?: string;
  ean?: string;
  unitPrice?: number | null;
  unitPriceBasis?: string;
  availabilityStatus?: string;
  stockQuantity?: number | null;
  deliveryAvailable?: string;
  pickupAvailable?: string;
  storeName?: string;
  storeAddress?: string;
  countryOfOrigin?: string;
  productComposition?: string;
  promoMechanic?: string;
  loyaltyPrice?: number | null;
  minimumPromoQuantity?: number | null;
  onlineExclusive?: string;
  categoryPosition?: number | null;
  searchPosition?: number | null;
  imageCount?: number | null;
  cardCompletenessPct?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  badges?: string;
  extendedMode?: 'так' | 'ні';
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

export interface NetworkConfig {
  network_name: string;
  canonical_name: string;
  website_url: string;
  parser_type: ParserType;
  supported_cities: string[];
  supported_categories: string[];
  notes: string;
}

export function calculatePromo(regularPrice: number | null, promoPrice: number | null) {
  const hasPromo = regularPrice !== null && promoPrice !== null && promoPrice > 0 && regularPrice > promoPrice;
  return {
    promoFlag: hasPromo ? 'так' as const : 'ні' as const,
    discountPct: hasPromo ? Number((((regularPrice - promoPrice) / regularPrice) * 100).toFixed(1)) : null
  };
}

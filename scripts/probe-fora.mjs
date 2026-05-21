const root = 'https://fora.ua/';
const response = await fetch(root, { headers: { 'user-agent': 'Mozilla/5.0 RetailPriceMonitor/0.1' } });
const html = await response.text();
const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
  .map((match) => new URL(match[1], root).toString())
  .filter((url) => /\.js(?:\?|$)/i.test(url));

console.log('scripts', scripts.length);
for (const url of scripts) {
  const text = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 RetailPriceMonitor/0.1' } })
    .then((item) => item.text())
    .catch(() => '');
  if (!/productCategories|offersSplited|getOffersSplited|getProductCategories|search\(|EcomCatalogGlobal|catalog/i.test(text)) continue;
  console.log('\nHIT', url, 'len', text.length);
  for (const term of [
    'productCategories',
    'offersSplited',
    'getOffersSplited',
    'getProductCategories',
    'search(',
    'EcomCatalogGlobal',
    'Catalog'
  ]) {
    let index = text.indexOf(term);
    let count = 0;
    while (index >= 0 && count < 3) {
      console.log(`\n--- ${term} ---`);
      console.log(text.slice(Math.max(0, index - 800), Math.min(text.length, index + 1600)).replace(/\s+/g, ' '));
      index = text.indexOf(term, index + term.length);
      count += 1;
    }
  }
}

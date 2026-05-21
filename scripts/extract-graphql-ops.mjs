const targets = [
  ['fora-main', 'https://fora.ua/js/main.c5d7744f.js'],
  ['fora-vendor', 'https://fora.ua/js/3376.1150f821.js'],
  ['thrash-app', 'https://thrash.ua/assets/js/app.86564c14.js'],
  ['thrash-vendors', 'https://thrash.ua/assets/js/vendors.7232d2e0.js']
];

for (const [name, url] of targets) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 RetailPriceMonitor/0.1' } });
  const text = await response.text();
  console.log(`\n=== ${name} ${url} len=${text.length} ===`);
  const snippets = [];
  for (const keyword of ['productCategories', 'productCollection', 'offersOnlyProducts', 'suggestedProducts', 'search(', 'products', 'EcomCatalogGlobal', 'catalog']) {
    let index = text.indexOf(keyword);
    let guard = 0;
    while (index >= 0 && guard < 12) {
      snippets.push(text.slice(Math.max(0, index - 350), Math.min(text.length, index + 900)));
      index = text.indexOf(keyword, index + keyword.length);
      guard += 1;
    }
  }
  const cleaned = [...new Set(snippets)].slice(0, 20).map((snippet) => snippet.replace(/\s+/g, ' '));
  cleaned.forEach((snippet, index) => console.log(`\n--- snippet ${index + 1} ---\n${snippet}`));
}

const url = 'https://fora.ua/js/main.c5d7744f.js';
const text = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 RetailPriceMonitor/0.1' } }).then((response) =>
  response.text()
);

const methods = new Set();
for (const pattern of [/method:"([A-Za-z0-9_]+)"/g, /method:'([A-Za-z0-9_]+)'/g, /method:([A-Za-z0-9_]+)/g]) {
  for (const match of text.matchAll(pattern)) methods.add(match[1]);
}

console.log(
  [...methods]
    .filter((method) => /Catalog|Sku|Product|Item|Search|Categories|Filter|Promo|Offer|Store|Filial/i.test(method))
    .sort()
    .join('\n')
);

for (const method of [...methods].filter((item) => /Catalog|Sku|Product|Item|Search|Categories|Filter|Promo|Offer/i.test(item))) {
  const index = text.indexOf(`method:"${method}"`);
  if (index >= 0) {
    console.log(`\n### ${method}`);
    console.log(text.slice(Math.max(0, index - 900), Math.min(text.length, index + 1800)).replace(/\s+/g, ' '));
  }
}

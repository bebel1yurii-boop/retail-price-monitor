const targets = [
  ['kishenya', 'https://kishenya.ua/'],
  ['varus', 'https://varus.ua/'],
  ['fozzy', 'https://fozzyshop.ua/'],
  ['fora', 'https://fora.ua/'],
  ['thrash', 'https://thrash.ua/']
];

const headers = {
  'user-agent': 'Mozilla/5.0 RetailPriceMonitor/0.1',
  accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'accept-language': 'uk-UA,uk;q=0.9,en;q=0.5'
};

for (const [name, url] of targets) {
  console.log(`\n=== ${name} ${url} ===`);
  try {
    const response = await fetch(url, { headers, redirect: 'follow' });
    const html = await response.text();
    console.log('status', response.status, 'final', response.url, 'len', html.length);
    console.log('framework hints', {
      nuxt: html.includes('__NUXT__'),
      next: html.includes('__NEXT_DATA__'),
      vue: /data-vue-meta|vue/i.test(html),
      react: /react|data-react/i.test(html)
    });
    const links = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi)]
      .map((match) => new URL(match[1], response.url).toString())
      .filter((asset) => /\.(js|mjs)(\?|$)/i.test(asset))
      .slice(0, 30);
    console.log('js assets', links.slice(0, 12));
    console.log('html api hints', apiHints(html).slice(0, 30));

    for (const asset of links.slice(0, 8)) {
      try {
        const assetResponse = await fetch(asset, { headers: { ...headers, accept: '*/*' } });
        const text = await assetResponse.text();
        const hints = apiHints(text);
        if (hints.length) {
          console.log('asset hints', asset, hints.slice(0, 25));
        }
      } catch (error) {
        console.log('asset error', asset, error.message);
      }
    }
  } catch (error) {
    console.log('error', error.message);
  }
}

function apiHints(text) {
  const hints = new Set();
  const patterns = [
    /https?:\/\/[^"'`\s\\]+/gi,
    /\/api\/[^"'`\s\\]+/gi,
    /\/graphql[^"'`\s\\]*/gi,
    /\/catalog[^"'`\s\\]*/gi,
    /\/products?\/[^"'`\s\\]*/gi,
    /\/search[^"'`\s\\]*/gi,
    /\/stores?\/[^"'`\s\\]*/gi
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0]
        .replace(/\\u002F/g, '/')
        .replace(/\\\//g, '/')
        .replace(/[),;]+$/g, '');
      if (/api|graphql|catalog|product|search|store|category|v\d/i.test(value)) hints.add(value.slice(0, 180));
    }
  }
  return [...hints];
}

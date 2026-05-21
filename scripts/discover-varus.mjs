const response = await fetch('https://varus.ua/', {
  headers: {
    'user-agent': 'Mozilla/5.0 RetailPriceMonitor/0.1',
    'accept-language': 'uk-UA,uk;q=0.9'
  }
});
const html = await response.text();
console.log('status', response.status, 'len', html.length);

const hints = new Set();
for (const pattern of [
  /https?:\\?\/\\?\/[^"'`\s<>)]+/gi,
  /\/api\/[^"'`\s<>)]+/gi,
  /\/graphql[^"'`\s<>)]+/gi,
  /\/catalog[^"'`\s<>)]+/gi,
  /\/products?\/[^"'`\s<>)]+/gi,
  /\/search[^"'`\s<>)]+/gi
]) {
  for (const match of html.matchAll(pattern)) {
    hints.add(match[0].replace(/\\\//g, '/').slice(0, 220));
  }
}
console.log([...hints].filter((item) => /api|graphql|catalog|product|search|store/i.test(item)).slice(0, 150).join('\n'));

const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
  .map((match) => new URL(match[1], response.url).toString())
  .filter((url) => /\.js(\?|$)/i.test(url))
  .slice(0, 20);
console.log('\nSCRIPTS\n' + scripts.join('\n'));

for (const script of scripts.slice(0, 10)) {
  const scriptResponse = await fetch(script, { headers: { 'user-agent': 'Mozilla/5.0 RetailPriceMonitor/0.1' } });
  const text = await scriptResponse.text();
  const scriptHints = new Set();
  for (const pattern of [/https?:\\?\/\\?\/[^"'`\s<>)]+/gi, /\/api\/[^"'`\s<>)]+/gi, /\/graphql[^"'`\s<>)]+/gi]) {
    for (const match of text.matchAll(pattern)) scriptHints.add(match[0].replace(/\\\//g, '/').slice(0, 220));
  }
  if (scriptHints.size) console.log('\nSCRIPT HINTS', script, [...scriptHints].slice(0, 80).join('\n'));
}

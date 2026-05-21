const chains = ['auchan', 'novus', 'tavriav', 'megamarket', 'ultramarket', 'vostorg', 'chudomarket', 'epicentr', 'ideal'];
const headers = { accept: 'application/json', 'accept-language': 'uk-UA,uk;q=0.9', 'user-agent': 'Mozilla/5.0 RetailPriceMonitor/0.1' };

const stores = await (await fetch('https://stores-api.zakaz.ua/stores/', { headers })).json();

for (const chain of chains) {
  const store = stores.find((item) => item.retail_chain === chain);
  if (!store) {
    console.log('\nNO STORE', chain);
    continue;
  }

  const categories = await (await fetch(`https://stores-api.zakaz.ua/stores/${store.id}/categories/`, { headers })).json();
  const flat = [];
  walk(categories, flat);
  const hits = flat.filter((category) =>
    /кур|птиц|індич|кач|переп|м.яс|ковбас|сосиск|сардель|шинка|делікат|напів|котлет|пельмен|заморож|meat|poultry|sausage|chicken|semi|frozen/i.test(
      `${category.title} ${category.id}`
    )
  );

  console.log('\nCHAIN', chain, 'store', store.id, store.name, 'hits', hits.length);
  console.log(hits.slice(0, 80).map((hit) => `${hit.id} | ${hit.title} | ${hit.count} | parent=${hit.parent_id}`).join('\n'));
}

function walk(categories, out) {
  for (const category of categories) {
    out.push({ id: category.id, title: category.title, count: category.count, parent_id: category.parent_id });
    if (category.children) walk(category.children, out);
  }
}

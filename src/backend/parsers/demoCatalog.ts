import type { RawProduct } from '../services/normalizationService';

type DemoNetwork = 'atb' | 'metro' | 'auchan';

const categoryAliases: Record<string, string[]> = {
  'М’ясо птиці': ['М’ясо птиці', "М'ясо птиці", 'Птиця охолоджена'],
  Напівфабрикати: ['Напівфабрикати', 'Заморожені напівфабрикати', 'Готові до приготування'],
  'М’ясо-ковбасні вироби': ['М’ясо-ковбасні вироби', "М'ясо-ковбасні вироби", 'Ковбаси та делікатеси']
};

const catalog: Record<DemoNetwork, Record<string, RawProduct[]>> = {
  atb: {
    'М’ясо птиці': [
      product('Філе куряче охолоджене Наша Ряба 1 кг', 189.9, 169.9, 'https://www.atbmarket.com/'),
      product('Стегно куряче охолоджене Наша Ряба 1 кг', 129.9, 119.9, 'https://www.atbmarket.com/'),
      product('Крило куряче охолоджене 1 кг', 112.4, 99.9, 'https://www.atbmarket.com/'),
      product('Гомілка куряча охолоджена 1 кг', 118.9, null, 'https://www.atbmarket.com/')
    ],
    Напівфабрикати: [
      product('Котлета куряча Легко! 500 г', 118.5, null, 'https://www.atbmarket.com/'),
      product('Нагетси курячі Легко! 300 г', 96.9, 84.9, 'https://www.atbmarket.com/'),
      product('Пельмені курячі Легко! 800 г', 154.9, 139.9, 'https://www.atbmarket.com/'),
      product('Шніцель курячий заморожений 600 г', 132.5, null, 'https://www.atbmarket.com/')
    ],
    'М’ясо-ковбасні вироби': [
      product('Ковбаса варена Глобино Докторська 500 г', 154.9, 139.9, 'https://www.atbmarket.com/'),
      product('Сосиски Бащинський Філейні 360 г', 129.5, 114.9, 'https://www.atbmarket.com/'),
      product('Ковбаса Ятрань Салямі 350 г', 184.9, null, 'https://www.atbmarket.com/'),
      product('Шинка Алан куряча 400 г', 169.9, 149.9, 'https://www.atbmarket.com/')
    ]
  },
  metro: {
    'М’ясо птиці': [
      product('Філе куряче охолоджене 1 кг', 196.4, 179.9, 'https://metro.zakaz.ua/'),
      product('Крило куряче охолоджене 1 кг', 112.4, 99.9, 'https://metro.zakaz.ua/'),
      product('Фарш курячий охолоджений 500 г', 89.9, null, 'https://metro.zakaz.ua/')
    ],
    Напівфабрикати: [
      product('Нагетси курячі Легко! 300 г', 99.9, 89.9, 'https://metro.zakaz.ua/'),
      product('Котлета по-київськи 400 г', 124.9, null, 'https://metro.zakaz.ua/'),
      product('Пельмені з куркою 900 г', 159.9, 145.9, 'https://metro.zakaz.ua/')
    ],
    'М’ясо-ковбасні вироби': [
      product('Ковбаса варена Глобино Докторська 500 г', 154.9, 139.9, 'https://metro.zakaz.ua/'),
      product('Сардельки Ятрань 420 г', 132.9, null, 'https://metro.zakaz.ua/'),
      product('Балик Бащинський 300 г', 179.9, 159.9, 'https://metro.zakaz.ua/')
    ]
  },
  auchan: {
    'М’ясо птиці': [
      product('Стегно куряче охолоджене Наша Ряба 1 кг', 129.9, 119.9, 'https://auchan.ua/'),
      product('Філе куряче охолоджене 1 кг', 192.9, null, 'https://auchan.ua/'),
      product('Гомілка куряча охолоджена 1 кг', 116.9, 104.9, 'https://auchan.ua/')
    ],
    Напівфабрикати: [
      product('Котлета куряча заморожена 500 г', 109.9, 99.9, 'https://auchan.ua/'),
      product('Нагетси курячі 400 г', 119.9, null, 'https://auchan.ua/'),
      product('Млинці з куркою 450 г', 89.9, 79.9, 'https://auchan.ua/')
    ],
    'М’ясо-ковбасні вироби': [
      product('Сосиски Глобино Молочні 400 г', 119.9, 109.9, 'https://auchan.ua/'),
      product('Ковбаса Бащинський Салямі 350 г', 189.9, null, 'https://auchan.ua/'),
      product('Шинка куряча 400 г', 159.9, 139.9, 'https://auchan.ua/')
    ]
  }
};

export function getDemoProducts(network: DemoNetwork, selectedCategory: string): RawProduct[] {
  const canonical = toCanonicalCategory(selectedCategory);
  const sourceCategory = categoryAliases[canonical]?.[0] ?? canonical;
  return (catalog[network][canonical] ?? []).map((item) => ({
    ...item,
    categorySource: sourceCategory,
    comment: `${item.comment ?? 'Demo data'}; category matched by business group "${canonical}"`
  }));
}

function toCanonicalCategory(category: string) {
  const normalized = category.trim().toLowerCase().replace(/'/g, '’');
  const match = Object.entries(categoryAliases).find(([, aliases]) =>
    aliases.some((alias) => alias.toLowerCase().replace(/'/g, '’') === normalized)
  );
  return match?.[0] ?? category;
}

function product(sku: string, regularPrice: number, promoPrice: number | null, productUrl: string): RawProduct {
  return {
    sku,
    regularPrice,
    promoPrice,
    productUrl,
    comment: 'Demo data'
  };
}

const manufacturerDictionary: Record<string, string[]> = {
  'МХП': ['наша ряба', 'легко!', 'бас Легко', 'mhp'],
  'Глобино': ['глобино'],
  'Ятрань': ['ятрань'],
  'Бащинський': ['бащинський'],
  'Алан': ['алан'],
  'Натурвіль': ['натурвіль']
};

const brandDictionary: Record<string, string[]> = {
  'Наша Ряба': ['наша ряба'],
  'Легко!': ['легко!'],
  'Глобино': ['глобино'],
  'Ятрань': ['ятрань'],
  'Бащинський': ['бащинський']
};

export function detectManufacturer(name: string) {
  const lower = name.toLowerCase();
  return Object.entries(manufacturerDictionary).find(([, keys]) => keys.some((key) => lower.includes(key)))?.[0] ?? 'Не визначено';
}

export function detectBrand(name: string) {
  const lower = name.toLowerCase();
  return Object.entries(brandDictionary).find(([, keys]) => keys.some((key) => lower.includes(key)))?.[0] ?? 'Не визначено';
}

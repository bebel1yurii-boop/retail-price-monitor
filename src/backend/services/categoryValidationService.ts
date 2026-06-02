import type { PriceRow } from '../types';

type BusinessGroup = 'poultry' | 'semifinished' | 'sausage';

const commonExcluded =
  /(приправа|спец|прянощ|соус|зі смаком|смаком кур|бульйон|вермішел|локшин|пюре|яйц|корм|ласощ|для кот|для кіш|для собак|кошен|цуцен|котів|собак|соб\b|пауч|сух д\/к|cat|dog|pet|шампун|контейнер|рибн|салат|джерк|насіння|оливк|джем|рахат|вафл|батончик|хумус|перець|сік|напій|снек|соломк|чіпс|chipster)/i;

const poultryExcluded =
  /(пельмен|вареник|котлет|нагетс|чебурек|млинц|бендерик|хінкал|равіол|ковбас|сосиск|сардель|шинка|балик|делікатес|рулет|закуска|сендвіч|бургер|піца|паштет|по-домашньому|гриль|запеч|смажен|відвар|теріякі|з рисом|в соусі|у соусі)/i;

export function filterRowsByCategory(rows: PriceRow[], category: string) {
  return rows.filter((row) => isSkuRelevant(row.sku, category));
}

export function isSkuRelevant(sku: string, category: string) {
  const value = sku.toLowerCase();
  if (commonExcluded.test(value)) return false;

  const group = getBusinessGroup(category);
  if (group === 'poultry') {
    if (poultryExcluded.test(value)) return false;
    return /(курк|курча|куряч|індич|індюк|качк|качен|перепіл|птиц)/i.test(value);
  }

  if (group === 'semifinished') {
    return /(напівфаб|пельмен|вареник|котлет|нагетс|чебурек|млинц|бендерик|хінкал|равіол|тефтел|фрикадел|шніцел|зраз|голубц)/i.test(value);
  }

  return /(ковбас|сосиск|сардель|шинка|балик|буженин|салям|делікатес|бекон|карбонад|корейк|грудинк|пастром)/i.test(value);
}

function getBusinessGroup(category: string): BusinessGroup {
  const normalized = category.toLowerCase();
  if (normalized.includes('напів')) return 'semifinished';
  if (normalized.includes('ковбас')) return 'sausage';
  return 'poultry';
}

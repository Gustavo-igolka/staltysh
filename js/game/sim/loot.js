// Правила выпадения бартерных ресурсов (задача 2): тир локации + тип спота → конкретный ресурс.
// Чистая функция без зависимостей от мира — легко тестировать, вызывается из spots.js при зачистке точки.
import { RARITY_ORDER, RES_TYPES, resId } from '../../data/items.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// Шанс «осечки» тира: вместо ресурса своего тира спот отдаёт ресурс на ступень НИЖЕ.
// Разрешена только вниз и только для синего тира («синие споты чаще синие, реже белые»).
// Белые всегда белые; фиолетовые/красные всегда своего тира (по правилу задачи).
const TIER_FALLBACK_CHANCE = { grey: 0, blue: 0.25, purple: 0, red: 0 };

// Тип спота → тип ресурса. Люди → human, мутанты → mutant, прикопы → stash, разлом → rift.
export const SPOT_TO_RES_TYPE = { mutant: 'mutant', human: 'human', stash: 'stash', rift: 'rift' };

// Индекс редкости в порядке grey < blue < purple < red (-1 если неизвестна)
const rarityIndex = (r) => RARITY_ORDER.indexOf(r);

/**
 * Одна награда по правилам:
 *  - тип ресурса строго определяется типом спота (spotType);
 *  - редкость = тир локации (locationTier), кроме синих спотов: ~25% они отдают белый («реже белые»);
 *  - редкость НИКОГДА не поднимается выше тира локации (белый спот не выдаст синий, синий — фиолетовый);
 *  - если тип ресурса не существует в тире локации и ниже (напр. stash требует blue+, а тир grey),
 *    выдаётся минимально доступная редкость этого типа (исключение из правила «не выше» — иного
 *    ресурса данного источника просто нет в природе).
 * @param {'grey'|'blue'|'purple'|'red'} locationTier — тир локации (band.rarity карты)
 * @param {'mutant'|'human'|'stash'|'rift'} spotType — тип спота (источник ресурса)
 * @returns {{ type: string, rarity: string, amount: number }}
 */
export function getRandomLoot(locationTier, spotType) {
  const type = SPOT_TO_RES_TYPE[spotType] ?? 'mutant';
  const allowed = RES_TYPES[type].rarities; // например у stash: ['blue','purple','red']

  const tierIdx = Math.max(0, rarityIndex(locationTier));
  // осечка на ступень вниз — только там, где правило её допускает
  let wantIdx = tierIdx;
  if (wantIdx > 0 && Math.random() < (TIER_FALLBACK_CHANCE[RARITY_ORDER[tierIdx]] ?? 0)) wantIdx -= 1;

  // редкость не выше тира локации; если типу такая недоступна — берём ближайшую доступную ВНИЗ,
  // а если и ниже тира типу брать нечего — минимальную доступную (см. докстринг про stash/grey)
  let rarity = RARITY_ORDER[wantIdx];
  if (!allowed.includes(rarity)) {
    const within = allowed.filter((r) => rarityIndex(r) <= wantIdx);
    rarity = within.length ? within[within.length - 1] : allowed[0];
  }

  return { type, rarity, amount: Math.max(1, Math.round(rnd(1, 4))) };
}

// Формат предмета инвентаря ({ id, count }) — то, что уже понимают crate/host-коллбэки.
export const lootItem = (roll) => ({ id: resId(roll.type, roll.rarity), count: roll.amount });

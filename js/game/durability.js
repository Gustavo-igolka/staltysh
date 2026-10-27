// Прочность оружия, доп. оружия и брони. Сломанная вещь не даёт характеристик, но остаётся мёртвым грузом.
//
// Плюс — масштабирование по ступени (TIERS в data/items.js, 0..6). Прямого улучшения вещей больше нет: каждая
// ступень покупается в бартере как отдельный предмет. Вещи с явными статами по ступеням (fixedTier, data/armor.js)
// множитель не используют. Для остальных — черновой множитель TIER_GROWTH, пока для оружия не заданы свои цепочки.
import { getItem, TIERS } from '../data/items.js';

export const TIER_GROWTH = 0.15; // +15% к силовым характеристикам за ступень (черновое значение)
const SCALES_WITH_TIER = new Set([
  'dmg', 'mag', 'range',                              // оружие
  'bullet', 'tear', 'blast', 'bleedProt',             // броня: защита
  'rad', 'bio', 'psi', 'temp',                        // броня: заражения
  'carry', 'regen',                                   // броня: груз, периодическое лечение
]);

export const tierMult = (tier = 0) => 1 + Math.max(0, Math.min(TIERS.length - 1, tier)) * TIER_GROWTH;
// У вещей с явными статами по ступеням (броня из data/armor.js, fixedTier) множитель не применяется:
// каждая ступень — отдельный предмет со своими числами.
const multFor = (id, tier) => (getItem(id).fixedTier ? 1 : tierMult(tier));

// Статы предмета id на ступени tier (без учёта поломки — для этого есть activeStats(it))
export function tieredStats(id, tier = 0) {
  const base = getItem(id).stats ?? {};
  const mult = multFor(id, tier);
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = SCALES_WITH_TIER.has(k) ? Math.round(v * mult) : v;
  return out;
}

// Прибавка к весу у рюкзаков/сумок — поле вне stats, масштабируется так же
export function tieredWeightBonus(id, tier = 0) {
  const base = getItem(id).weightBonus ?? 0;
  return base ? Math.round(base * multFor(id, tier)) : 0;
}

export function durMax(it) {
  const base = getItem(it?.id)?.durMax ?? 0;
  return base ? Math.round(base * multFor(it.id, it?.tier)) : 0;
}
export const hasDurability = (it) => durMax(it) > 0;
export const durCur = (it) => (hasDurability(it) ? Math.max(0, Math.min(durMax(it), it.dur ?? durMax(it))) : 0);
export const isBroken = (it) => !!it && hasDurability(it) && durCur(it) <= 0;
// Характеристики предмета, которые реально действуют (у сломанного их нет)
export const activeStats = (it) => (it && !isBroken(it) ? tieredStats(it.id, it.tier) : {});

// Полный «эффективный» предмет (бой и отображение): база + масштаб по ступени во всех трёх местах сразу
export function tieredItemDef(id, tier = 0) {
  const d = getItem(id);
  return { ...d, stats: tieredStats(id, tier), durMax: Math.round((d.durMax ?? 0) * multFor(id, tier)), weightBonus: tieredWeightBonus(id, tier) };
}
export const effectiveItem = (it) => tieredItemDef(it.id, it?.tier ?? 0);

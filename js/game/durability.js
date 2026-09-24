// Прочность оружия, доп. оружия и брони. Сломанная вещь не даёт характеристик, но остаётся мёртвым грузом.
import { getItem } from '../data/items.js';

export const durMax = (it) => getItem(it.id).durMax ?? 0;
export const hasDurability = (it) => durMax(it) > 0;
export const durCur = (it) => (hasDurability(it) ? Math.max(0, Math.min(durMax(it), it.dur ?? durMax(it))) : 0);
export const isBroken = (it) => !!it && hasDurability(it) && durCur(it) <= 0;
// Характеристики предмета, которые реально действуют (у сломанного их нет)
export const activeStats = (it) => (it && !isBroken(it) ? (getItem(it.id).stats ?? {}) : {});

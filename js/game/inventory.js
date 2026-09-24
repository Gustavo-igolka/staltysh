// Логика инвентаря: сетка с весом, склад, слоты персонажа. Чистые функции, без DOM.
import { getItem } from '../data/items.js';
import { BASE_STATS } from '../data/player.js';
import { activeStats } from './durability.js';
import { uid, clamp } from '../core/util.js';

export const BASE_GRID = { w: 8, h: 10 }; // сетка большая и одинаковая: ограничивает вес, а не место
const EPS = 1e-6;
const fail = (msg) => ({ ok: false, msg });

// Лимит веса: 50 кг базово + прибавка брони + прибавка рюкзака/сумки. Размер сетки от рюкзака не зависит.
export function gridFor(backpack, armor) {
  const carry = activeStats(armor).carry ?? 0; // сломанная броня прибавки к весу не даёт
  const bag = backpack ? (getItem(backpack.id).weightBonus || 0) : 0;
  return { w: BASE_GRID.w, h: BASE_GRID.h, maxWeight: BASE_STATS.carryWeight + carry + bag };
}
export const getGrid = (state) => gridFor(state.slots.backpack, state.slots.armor);

export const itemWeight = (it) => getItem(it.id).weight * it.count;
export const totalWeight = (list) => list.reduce((s, it) => s + itemWeight(it), 0);

const rectOf = (it) => { const d = getItem(it.id); return { x: it.x, y: it.y, w: d.w, h: d.h }; };
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Первое свободное место в сетке для предмета it (или null)
export function findSpot(grid, list, it) {
  const d = getItem(it.id);
  for (let y = 0; y + d.h <= grid.h; y++) {
    for (let x = 0; x + d.w <= grid.w; x++) {
      const r = { x, y, w: d.w, h: d.h };
      if (!list.some((o) => hit(r, rectOf(o)))) return { x, y };
    }
  }
  return null;
}

// Сколько штук предмета ещё влезет по весу
const weightRoom = (grid, list, def) =>
  Math.max(0, Math.floor((grid.maxWeight - totalWeight(list) + EPS) / def.weight));

function removeCount(list, it, n) {
  it.count -= n;
  if (it.count <= 0) list.splice(list.indexOf(it), 1);
}

// Добавляет в инвентарь; возвращает, сколько штук реально добавлено
export function addToInventory(state, proto) {
  const grid = getGrid(state);
  const list = state.inventory;
  const def = getItem(proto.id);
  const { count, x, y, uid: _u, ...rest } = proto;
  rest.tier = rest.tier ?? 0;
  if (def.durMax && rest.dur === undefined) rest.dur = def.durMax;
  let left = count;
  let added = 0;

  if (def.stack > 1) {
    for (const it of list) {
      if (left <= 0) break;
      if (it.id !== proto.id || (it.tier ?? 0) !== rest.tier || it.count >= def.stack) continue;
      const n = Math.min(left, def.stack - it.count, weightRoom(grid, list, def));
      if (n <= 0) break;
      it.count += n; left -= n; added += n;
    }
  }
  while (left > 0) {
    const spot = findSpot(grid, list, proto);
    if (!spot) break;
    const n = Math.min(left, def.stack, weightRoom(grid, list, def));
    if (n <= 0) break;
    list.push({ ...rest, uid: uid(), count: n, x: spot.x, y: spot.y });
    left -= n; added += n;
  }
  return added;
}

// Склад без ограничений по размеру
export function addToStash(state, proto) {
  const def = getItem(proto.id);
  const { count, x, y, uid: _u, ...rest } = proto;
  rest.tier = rest.tier ?? 0;
  if (def.durMax && rest.dur === undefined) rest.dur = def.durMax;
  let left = count;
  if (def.stack > 1) {
    for (const it of state.stash) {
      if (left <= 0) break;
      if (it.id === proto.id && (it.tier ?? 0) === rest.tier && it.count < def.stack) {
        const n = Math.min(left, def.stack - it.count);
        it.count += n; left -= n;
      }
    }
  }
  while (left > 0) {
    const n = Math.min(left, def.stack);
    state.stash.push({ ...rest, uid: uid(), count: n });
    left -= n;
  }
}

export function moveToInventory(state, itemUid, qty) {
  const it = state.stash.find((i) => i.uid === itemUid);
  if (!it) return fail('Предмет не найден');
  const n = clamp(qty ?? it.count, 1, it.count);
  const added = addToInventory(state, { ...it, count: n });
  if (added <= 0) return fail('В инвентаре нет места или не хватает веса');
  removeCount(state.stash, it, added);
  return { ok: true, moved: added };
}

export function moveToStash(state, itemUid, qty) {
  const it = state.inventory.find((i) => i.uid === itemUid);
  if (!it) return fail('Предмет не найден');
  const n = clamp(qty ?? it.count, 1, it.count);
  addToStash(state, { ...it, count: n });
  removeCount(state.inventory, it, n);
  return { ok: true, moved: n };
}

// Пересобирает инвентарь под новую сетку (при смене рюкзака). null — не помещается.
export function repack(grid, list) {
  const area = (i) => getItem(i.id).w * getItem(i.id).h;
  const sorted = list.map((i) => ({ ...i })).sort((a, b) => area(b) - area(a));
  const out = [];
  for (const it of sorted) {
    const spot = findSpot(grid, out, it);
    if (!spot) return null;
    out.push({ ...it, x: spot.x, y: spot.y });
  }
  if (totalWeight(out) > grid.maxWeight + EPS) return null;
  return out;
}

export function equip(state, from, itemUid) {
  const list = state[from];
  const it = list?.find((i) => i.uid === itemUid);
  if (!it) return fail('Предмет не найден');
  const slot = getItem(it.id).slot;
  if (!slot) return fail('Этот предмет нельзя экипировать');

  // Броня и рюкзак меняют лимит веса: инвентарь не должен оказаться перегружен
  if (slot === 'armor' || slot === 'backpack') {
    const rest = from === 'inventory' ? state.inventory.filter((i) => i.uid !== itemUid) : state.inventory;
    const max = slot === 'armor' ? gridFor(state.slots.backpack, it).maxWeight : gridFor(it, state.slots.armor).maxWeight;
    if (totalWeight(rest) > max + EPS) return fail('Инвентарь слишком тяжёл для этой вещи. Убери часть вещей на склад');
  }
  removeCount(list, it, 1);

  const prev = state.slots[slot];
  const { x: _x, y: _y, ...keep } = it; // прочность и прочие поля экземпляра сохраняем
  state.slots[slot] = { ...keep, count: 1, tier: it.tier ?? 0 };
  if (prev) addToStash(state, prev);
  return { ok: true };
}

export function unequip(state, slot) {
  const it = state.slots[slot];
  if (!it) return fail('Слот пуст');
  if (slot === 'armor' || slot === 'backpack') {
    const max = slot === 'armor' ? gridFor(state.slots.backpack, null).maxWeight : gridFor(null, state.slots.armor).maxWeight;
    if (totalWeight(state.inventory) > max + EPS) return fail('Без этой вещи инвентарь окажется слишком тяжёлым. Сначала убери вещи на склад');
  }
  state.slots[slot] = null;
  addToStash(state, it);
  return { ok: true };
}

// Патроны в инвентаре вылазки (для перезарядки в бою)
export const countAmmo = (state, ammoId) =>
  state.inventory.reduce((s, it) => s + (it.id === ammoId ? it.count : 0), 0);

// Забирает до n патронов из инвентаря, возвращает сколько забрано
export function takeAmmo(state, ammoId, n) {
  let left = n;
  for (const it of [...state.inventory]) {
    if (left <= 0) break;
    if (it.id !== ammoId) continue;
    const k = Math.min(left, it.count);
    it.count -= k; left -= k;
    if (it.count <= 0) state.inventory.splice(state.inventory.indexOf(it), 1);
  }
  return n - left;
}

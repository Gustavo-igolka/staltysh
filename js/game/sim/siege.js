// Осада аномальной установки: 8 мутантов, спавнятся по одному раз в 7 секунд. Движение и атака мутантов —
// в ai.js (состояние 'siege'), этот файл только спавнит их по таймеру и считает исход.
import { TILE } from '../../data/tiles.js';
import { MUTANT_KINDS } from '../../data/enemies.js';
import { spawnNpc } from './ai.js';
import { RES_TYPES, resId } from '../../data/items.js';

export const SIEGE_TOTAL = 8;
export const SIEGE_INTERVAL = 7;
export const INSTALL_HP = 50;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function startSiege(world, x, y) {
  if (world.siege?.active) return world.siege;
  const s = {
    x, y, hp: INSTALL_HP, maxHp: INSTALL_HP, active: true,
    total: SIEGE_TOTAL, spawned: 0, killed: 0, timer: 0, npcIds: [], countedDead: new Set(), result: null,
  };
  world.siege = s;
  spawnSiegeMutant(world, s); // первый сразу
  return s;
}

function spawnSiegeMutant(world, s) {
  const ang = Math.random() * Math.PI * 2;
  const r = TILE * 6;
  const npc = spawnNpc(world, pick(MUTANT_KINDS), s.x + Math.cos(ang) * r, s.y + Math.sin(ang) * r, { x: s.x, y: s.y, radius: TILE * 8 });
  npc.siegeTarget = s;
  s.npcIds.push(npc.id);
  s.spawned += 1;
}

export function stepSiege(world, dt) {
  const s = world.siege;
  if (!s || !s.active) return;

  if (s.spawned < s.total) {
    s.timer += dt;
    if (s.timer >= SIEGE_INTERVAL) { s.timer = 0; spawnSiegeMutant(world, s); }
  }

  // считаем убитых насовсем (а не живым поиском в world.npcs): труп исчезает из world.npcs через пару
  // секунд после смерти, так что фильтр по текущему массиву со временем «забывал» бы уже убитых мутантов
  for (const id of s.npcIds) {
    if (s.countedDead.has(id)) continue;
    const npc = world.npcs.find((n) => n.id === id);
    if (npc ? npc.dead : true) { s.countedDead.add(id); s.killed += 1; } // npc отсутствует в массиве — значит, уже убит и труп истлел
  }

  const allSpawnedDead = s.spawned >= s.total && s.killed >= s.spawned;
  if (s.hp <= 0 || allSpawnedDead) finishSiege(world, s);
}

function finishSiege(world, s) {
  s.active = false;
  const lootFactor = Math.round((s.killed / s.total) * 100) / 100;
  s.result = { killed: s.killed, total: s.total, lootFactor, installDestroyed: s.hp <= 0, items: rollSiegeLoot(world, lootFactor) };
  world.events.push({ type: 'siege_end', result: s.result });
}

// Награда за осаду: ресурсы разломов (и немного мутантских) на редкость зоны, количество пропорционально
// доле убитых мутантов — 8/8 это полный лут, 0 убитых это ничего.
function rollSiegeLoot(world, lootFactor) {
  if (lootFactor <= 0) return [];
  const rarity = world.map.bands[0]?.rarity ?? 'grey';
  const types = ['rift', 'mutant'].filter((t) => RES_TYPES[t].rarities.includes(rarity));
  if (!types.length) return [];
  const items = [];
  for (const type of types) {
    const count = Math.max(1, Math.round(4 * lootFactor));
    items.push({ id: resId(type, rarity), count });
  }
  return items;
}

// Точки интереса открытого мира: споты мутантов/людей. Респаун только пока точка НЕ видна на экране
// (буквальная проверка «на экране», без учёта линии видимости). После зачистки — таймер, затем новый
// отряд спавнится, разбредаясь на 3-5 клеток карты от самой точки.
import { TILE } from '../../data/tiles.js';
import { HUMAN_KINDS, MUTANT_KINDS, ENEMY_KINDS } from '../../data/enemies.js';
import { spawnNpc } from './ai.js';
import { RES_TYPES, GEAR_RESOURCES, resId } from '../../data/items.js';

export const SPOT_RESPAWN_TIME = 90;
export const SCATTER_MIN = 3, SCATTER_MAX = 5; // клеток карты
export const ZONE_RADIUS = 7; // клеток карты — зона патрулирования вокруг точки

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createSpots(world) {
  const spots = [];
  for (const m of world.map.objects) {
    if (m.type !== 'mutant_spot' && m.type !== 'human_spot') continue;
    const spot = {
      id: world.nextId++, kind: m.type === 'mutant_spot' ? 'mutant' : 'human',
      x: m.x * TILE, y: m.y * TILE, state: 'alive', alive: [], timer: 0, crate: null,
    };
    spots.push(spot);
    spawnGroup(world, spot);
  }
  return spots;
}

export function spawnGroup(world, spot) {
  const pool = spot.kind === 'mutant' ? MUTANT_KINDS : HUMAN_KINDS;
  const kindId = pick(pool);
  const k = ENEMY_KINDS[kindId];
  const [lo, hi] = k.squad;
  const n = Math.round(rnd(lo, hi));
  spot.alive = [];
  for (let i = 0; i < n; i++) {
    const ang = rnd(0, Math.PI * 2);
    const r = rnd(SCATTER_MIN, SCATTER_MAX) * TILE;
    const x = spot.x + Math.cos(ang) * r, y = spot.y + Math.sin(ang) * r;
    const npc = spawnNpc(world, kindId, x, y, { x: spot.x, y: spot.y, radius: ZONE_RADIUS * TILE });
    npc.spotId = spot.id;
    spot.alive.push(npc.id);
  }
  spot.state = 'alive';
}

function onScreen(world, spot) {
  const cam = world.camera;
  if (!cam) return false;
  const pad = TILE; // небольшой запас, чтобы точка на самом краю экрана тоже считалась видимой
  return spot.x >= cam.x - pad && spot.x <= cam.x + cam.vw + pad && spot.y >= cam.y - pad && spot.y <= cam.y + cam.vh + pad;
}

function rollLoot(world, spot) {
  const rarity = world.map.bands.find((b) => spot.y / TILE >= b.fromY)?.rarity ?? 'grey';
  const types = GEAR_RESOURCES[rarity] ?? ['mutant', 'human'];
  const items = [{ id: `j_${pick(['gear', 'wire', 'compass'])}`, count: Math.round(rnd(1, 3)) }];
  const n = Math.round(rnd(1, 3));
  for (let i = 0; i < n; i++) {
    const type = pick(types);
    // редкость ресурса — редкость самой зоны, если этот тип ресурса вообще её достигает, иначе его низшая
    const rarities = RES_TYPES[type].rarities;
    const r = rarities.includes(rarity) ? rarity : rarities[0];
    items.push({ id: resId(type, r), count: Math.round(rnd(1, 4)) });
  }
  return items;
}

export function stepSpots(world, dt) {
  for (const spot of world.spots) {
    spot.alive = spot.alive.filter((id) => {
      const npc = world.npcs.find((n) => n.id === id);
      return npc && !npc.dead;
    });
    if (spot.state === 'alive') {
      if (spot.alive.length === 0) {
        spot.state = 'cleared';
        spot.timer = 0;
        spot.crate = { items: rollLoot(world, spot) };
        world.events.push({ type: 'spot_cleared', spotId: spot.id });
      }
    } else if (spot.state === 'cleared') {
      if (!onScreen(world, spot)) {
        spot.timer += dt;
        if (spot.timer >= SPOT_RESPAWN_TIME) {
          spot.crate = null;
          spawnGroup(world, spot);
        }
      }
    }
  }
}

export function lootCrate(world, spot) {
  if (!spot.crate) return [];
  const items = spot.crate.items;
  spot.crate = null;
  return items;
}

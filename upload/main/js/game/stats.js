// Итоговые характеристики персонажа: база (data/player.js) + броня + рюкзак
import { BASE_STATS } from '../data/player.js';
import { getGrid } from './inventory.js';
import { activeStats } from './durability.js';

export const MAX_ZONE_LEVEL = 4;

export function computeStats(state) {
  // сломанная броня характеристик не даёт; рюкзак/сумка добавляют скорость и живучесть
  const a = activeStats(state.slots.armor);
  const bag = activeStats(state.slots.backpack);
  const add = (key, base = BASE_STATS[key]) => base + (a[key] ?? 0) + (bag[key] ?? 0);

  const survivability = add('survivability');
  // Запас до смерти = (здоровье + защита) × живучесть
  const pool = (protection) => Math.round(((BASE_STATS.health + protection) * survivability) / 100);

  const bullet = add('bullet');
  const tear = add('tear');
  const blast = add('blast');

  return {
    health: BASE_STATS.health,
    survivability,
    speed: add('speed'),
    bullet, tear, blast,
    pools: { bullet: pool(bullet), tear: pool(tear), blast: pool(blast) },
    bleedProt: add('bleedProt'),
    bleedRemoval: add('bleedRemoval'),
    rad: add('rad'), bio: add('bio'), psi: add('psi'), temp: add('temp'),
    cleanseRate: BASE_STATS.cleanseRate,
    burnRemoval: BASE_STATS.burnRemoval,
    carry: getGrid(state).maxWeight,
    regen: { rate: BASE_STATS.regenRate, delay: BASE_STATS.regenDelay, periodic: add('regen', BASE_STATS.periodic), blockedByBleeding: BASE_STATS.bleedingBlocksRegen },
  };
}

// До какого уровня зоны заражения полностью защищает броня (100 очков = 1 уровень, максимум 4)
export const blockedZoneLevel = (protection) => Math.min(MAX_ZONE_LEVEL, Math.floor(protection / 100));

// Какой уровень заражения реально «бьёт» игрока в зоне: уровень зоны минус защита/100
export const effectiveZoneLevel = (zoneLevel, protection) => Math.max(0, zoneLevel - Math.floor(protection / 100));

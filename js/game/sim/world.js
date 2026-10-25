// Симуляция мира. Ничего не знает про DOM и рисование: получает ввод игрока, отдаёт состояние и события.
// Так её можно позже перенести на сервер для настоящего мультиплеера.
import { TILE, tileAt } from '../../data/tiles.js';
import { ENEMY_KINDS } from '../../data/enemies.js';
import { getItem, RES_TYPES, resId } from '../../data/items.js';
import { effectiveZoneLevel } from '../stats.js';
import { stepNpc } from './ai.js';
import { createSpots, stepSpots, lootCrate } from './spots.js';
import { stepSiege } from './siege.js';

export const SIM = {
  playerRadius: 10,
  baseSpeed: 4.6 * TILE,     // пикселей в секунду при скорости 100%
  bulletSpeed: 1000,
  wearPerShot: 0.1,          // потеря прочности оружия за выстрел
  armorWearPerDamage: 0.05,  // потеря прочности брони за единицу полученного урона
  bleedDps: 3, bleedTime: 5, // кровотечение у мишеней
  stopTime: 0.6,             // сколько длится замедление от «остановки»
  respawnTime: 4,
  interactRange: 1.6 * TILE,
  // Заражение: шкала 0-100 на каждый тип (rad/bio/psi/temp). Копится, пока «пробивает» непрощённый
  // уровень зоны, выводится статом вывода (cleanseRate — для rad/bio/psi, burnRemoval — для temp),
  // пока шкала полна — тикает урон по здоровью (отдельно от обычного урона, брони не касается).
  contamPerLevel: 7,   // прирост шкалы в секунду за каждый непрощённый уровень заражения
  contamDps: 2.5,      // урон здоровью в секунду, пока шкала конкретного типа на 100
  detectorRange: 9 * TILE, // металлоискатель: дистанция, с которой начинает расти сигнал (нужен в инвентаре, не в слоте)
};

const ZONE_TYPES = ['rad', 'bio', 'psi', 'temp'];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const rectCenterDist = (px, py, r) => {
  const cx = Math.max(r.x, Math.min(px, r.x + r.w));
  const cy = Math.max(r.y, Math.min(py, r.y + r.h));
  return Math.hypot(px - cx, py - cy);
};
const toPx = (o) => ({ x: o.x * TILE, y: o.y * TILE, w: (o.w ?? 0) * TILE, h: (o.h ?? 0) * TILE });

// ── создание ────────────────────────────────────────────────
export function createWorld({ map, host, snapshot, arrive }) {
  const world = {
    map, host, t: 0, over: false,
    players: {}, bullets: [], dummies: [], floaters: [], events: [], nextId: 1,
    hatch: null, transitions: [], markers: [], stashes: [],
    npcs: [], meleeQueue: [], siege: null, camera: null, // ИИ/споты/осада; camera ставится снаружи (session.js)
  };
  for (const o of map.objects) {
    if (o.type === 'hatch') world.hatch = { ...toPx(o), label: o.label };
    else if (o.type === 'transition') world.transitions.push({ ...toPx(o), label: o.label, locked: !!o.locked, to: o.to, arriveX: o.arriveX, arriveY: o.arriveY });
    else if (o.type === 'stash') world.stashes.push({ id: world.nextId++, x: o.x * TILE, y: o.y * TILE, found: false });
    else if (o.type === 'dummy') {
      const k = ENEMY_KINDS[o.kind];
      world.dummies.push({ id: world.nextId++, kind: o.kind, x: o.x * TILE, y: o.y * TILE, r: k.r, hp: k.hp, maxHp: k.hp, dead: false, respawnT: 0, flash: 0, slowT: 0, slow: 0, bleedT: 0, bleedAcc: 0 });
    } else if (o.type !== 'spawn') world.markers.push({ type: o.type, x: o.x * TILE, y: o.y * TILE });
  }
  // при переходе с другой карты игрок появляется в указанной точке, а не на штатном споне карты
  const spawn = arrive ?? (map.objects.find((o) => o.type === 'spawn') ?? { x: map.w / 2, y: map.h / 2 });
  addPlayer(world, 'p1', spawn.x * TILE, spawn.y * TILE, snapshot);
  world.spots = createSpots(world); // споты мутантов/людей — мир стартует уже населённым, а не пустым
  return world;
}

function makeWeapon(slot, w) {
  if (!w) return null;
  const def = getItem(w.id);
  return { slot, id: w.id, def, dur: w.dur ?? def.durMax, mag: Number.isFinite(w.mag) ? w.mag : 0, jammed: false, brokenNotified: (w.dur ?? def.durMax) <= 0 };
}

function addPlayer(world, id, x, y, snap) {
  const weapons = { weapon: makeWeapon('weapon', snap.weapons.weapon), secondary: makeWeapon('secondary', snap.weapons.secondary) };
  world.players[id] = {
    id, x, y, r: SIM.playerRadius, angle: -Math.PI / 2, alive: true,
    stats: snap.stats, hp: snap.stats.health, lastDamageT: -99, bleeding: false,
    weapons, active: weapons.weapon ? 'weapon' : (weapons.secondary ? 'secondary' : null),
    armor: snap.armor ? { id: snap.armor.id, dur: snap.armor.dur ?? getItem(snap.armor.id).durMax, def: getItem(snap.armor.id) } : null,
    cooldown: 0, reloadT: 0, reloadTotal: 0, reloadKind: null, drawT: 0, flash: 0,
    moving: false, prompt: null, zone: null, contam: { rad: 0, bio: 0, psi: 0, temp: 0 },
    input: { moveX: 0, moveY: 0, aim: null, firing: false, reload: false, swap: false, select: null, interact: false },
  };
}

export function setPlayerStats(world, id, stats) { world.players[id].stats = stats; }

// ── столкновения ────────────────────────────────────────────
// экспортируется, чтобы ИИ (ai.js) и осада (siege.js) пользовались той же проверкой столкновений, что игрок
export function blockedAt(map, x, y, r) {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!tileAt(map, tx, ty).solid) continue;
      const cx = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
      const cy = Math.max(ty * TILE, Math.min(y, (ty + 1) * TILE));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
  }
  return false;
}
export function moveWithCollision(map, e, dx, dy, r) {
  if (!blockedAt(map, e.x + dx, e.y, r)) e.x += dx;
  if (!blockedAt(map, e.x, e.y + dy, r)) e.y += dy;
}

function segCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / len2));
  return (x0 + dx * t - cx) ** 2 + (y0 + dy * t - cy) ** 2 <= r * r;
}

// ── шаг симуляции ───────────────────────────────────────────
const CORPSE_FADE = 2.5;

export function step(world, dt) {
  world.t += dt;
  const p1 = world.players.p1;
  for (const p of Object.values(world.players)) stepPlayer(world, p, dt);
  for (const npc of world.npcs) stepNpc(world, npc, dt, p1);
  drainMeleeQueue(world);
  stepBullets(world, dt);
  stepDummies(world, dt);
  stepSpots(world, dt);
  stepSiege(world, dt);
  world.npcs = world.npcs.filter((n) => !n.dead || n.corpseT > -CORPSE_FADE);
  for (const f of world.floaters) { f.t += dt; f.y -= 26 * dt; }
  world.floaters = world.floaters.filter((f) => f.t < f.life);
}

function drainMeleeQueue(world) {
  const queue = world.meleeQueue.splice(0);
  for (const hit of queue) {
    const npc = world.npcs.find((n) => n.id === hit.npcId);
    if (!npc || npc.dead) continue;
    for (const p of Object.values(world.players)) {
      if (p.alive) damagePlayer(world, p, hit.dmgType ?? 'tear', hit.dmg);
    }
  }
}

const floater = (world, x, y, text, color = '#fff', life = 0.9) => world.floaters.push({ x, y, text, color, t: 0, life });

function stepPlayer(world, p, dt) {
  if (!p.alive) return;
  const inp = p.input;
  if (inp.aim !== null && inp.aim !== undefined) p.angle = inp.aim;

  // движение: скорость персонажа × штраф оружия в руках × местность
  let w = p.active ? p.weapons[p.active] : null;
  let speed = SIM.baseSpeed * (p.stats.speed / 100);
  if (w) speed *= Math.max(0.3, (100 + (w.def.stats.speed ?? 0)) / 100);
  speed *= tileAt(world.map, Math.floor(p.x / TILE), Math.floor(p.y / TILE)).speed ?? 1;
  let mx = inp.moveX, my = inp.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  p.moving = len > 0.05;
  moveWithCollision(world.map, p, mx * speed * dt, my * speed * dt, p.r);

  // смена оружия (время доставания берётся у оружия, которое достаём)
  const want = inp.select ?? (inp.swap ? (p.active === 'weapon' ? 'secondary' : 'weapon') : null);
  if (want && want !== p.active && p.weapons[want]) {
    p.active = want; w = p.weapons[want];
    p.reloadT = 0; p.reloadKind = null;
    p.drawT = w.def.stats.draw ?? 0;
  }

  // таймеры оружия
  if (p.cooldown > 0) p.cooldown -= dt;
  if (p.drawT > 0) p.drawT -= dt;
  if (p.flash > 0) p.flash -= dt;
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0 && w) finishReload(world, p, w); }
  if (w && inp.reload) startReload(world, p, w);
  if (w && inp.firing && p.cooldown <= 0 && p.reloadT <= 0 && p.drawT <= 0) fire(world, p, w);

  // регенерация: не идёт при кровотечении и пока не прошло время после ранения
  const st = p.stats;
  if (p.hp < st.health) {
    const regenOk = world.t - p.lastDamageT >= st.regen.delay && !(p.bleeding && st.regen.blockedByBleeding);
    if (regenOk) p.hp += (st.health * st.regen.rate / 100) * dt;
    if (st.regen.periodic > 0) p.hp += (st.health * st.regen.periodic / 100) * dt;
    p.hp = Math.min(st.health, p.hp);
  }

  stepContamination(world, p, dt);
  stepDetector(world, p);

  // подсказки и взаимодействие: люк бункера, переходы, ящик с добычей у зачищенной точки, прикоп
  p.prompt = null;
  let crateSpot = null;
  let trHit = null;
  let stashHit = null;
  if (world.hatch && rectCenterDist(p.x, p.y, world.hatch) <= SIM.interactRange) p.prompt = { type: 'hatch', text: 'Войти в бункер' };
  else {
    trHit = world.transitions.find((t) => rectCenterDist(p.x, p.y, t) <= SIM.interactRange);
    if (trHit) p.prompt = { type: 'transition', text: trHit.locked ? `${trHit.label}: пока закрыто` : trHit.label };
    else {
      crateSpot = world.spots.find((s) => s.crate && Math.hypot(p.x - s.x, p.y - s.y) <= SIM.interactRange);
      if (crateSpot) p.prompt = { type: 'crate', text: 'Забрать добычу' };
      else if (p.hasDetector) {
        stashHit = world.stashes.find((s) => !s.found && Math.hypot(p.x - s.x, p.y - s.y) <= SIM.interactRange);
        if (stashHit) p.prompt = { type: 'stash', text: 'Раскопать прикоп' };
      }
    }
  }
  if (inp.interact && p.prompt) {
    if (p.prompt.type === 'hatch') world.events.push({ type: 'exit', pid: p.id });
    else if (p.prompt.type === 'crate') world.events.push({ type: 'loot_crate', pid: p.id, spotId: crateSpot.id });
    else if (p.prompt.type === 'stash') world.events.push({ type: 'loot_stash', pid: p.id, stashId: stashHit.id });
    else if (p.prompt.type === 'transition') {
      if (trHit.locked) world.events.push({ type: 'transition_locked', pid: p.id });
      else world.events.push({ type: 'transition', pid: p.id, to: trHit.to, arriveX: trHit.arriveX, arriveY: trHit.arriveY });
    }
  }
}

// Металлоискатель: нужен просто в инвентаре вылазки (не в слоте экипировки). Сигнал — непрерывная
// величина 0..1 от расстояния до ближайшего нераскопанного прикопа, без дискретных «бипов» (чтобы не
// спамить тостами) — HUD сам решает, как это показать (пульсация/шкала).
function stepDetector(world, p) {
  const carrying = !!world.host.hasItem?.('metal_detector');
  p.hasDetector = carrying;
  p.detector = 0;
  if (!carrying || !world.stashes.length) return;
  let nearest = Infinity;
  for (const s of world.stashes) {
    if (s.found) continue;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < nearest) nearest = d;
  }
  if (nearest < SIM.detectorRange) p.detector = Math.max(0, 1 - nearest / SIM.detectorRange);
}

// Раскопка прикопа: редкость ресурса = редкость зоны (прикопы бывают только на картах от синей редкости).
function rollStashLoot(world, stash) {
  const rarity = world.map.bands.find((b) => stash.y / TILE >= b.fromY)?.rarity ?? 'grey';
  const rarities = RES_TYPES.stash.rarities;
  const r = rarities.includes(rarity) ? rarity : rarities[0];
  const items = [{ id: resId('stash', r), count: Math.round(rnd(1, 3)) }];
  if (Math.random() < 0.5) items.push({ id: `j_${pick(['gear', 'wire', 'compass', 'radio'])}`, count: Math.round(rnd(1, 2)) });
  return items;
}

export function lootStash(world, stashId) {
  const stash = world.stashes.find((s) => s.id === stashId);
  if (!stash || stash.found) return [];
  stash.found = true;
  return rollStashLoot(world, stash);
}

// Текущая зона заражения под игроком (если он внутри нескольких — берём самую опасную по уровню)
function zoneAt(world, x, y) {
  const zones = world.map.zones;
  if (!zones) return null;
  let best = null;
  for (const z of zones) {
    const dx = x - z.x * TILE, dy = y - z.y * TILE;
    if (dx * dx + dy * dy <= (z.r * TILE) ** 2 && (!best || z.level > best.level)) best = z;
  }
  return best;
}

function stepContamination(world, p, dt) {
  const prevZone = p.zone;
  const z = zoneAt(world, p.x, p.y);
  p.zone = z;
  if (z && z !== prevZone) world.events.push({ type: 'zone_enter', pid: p.id, zone: { name: z.name, level: z.level } });
  const prevMax = Math.max(p.contam.rad, p.contam.bio, p.contam.psi, p.contam.temp);
  for (const type of ZONE_TYPES) {
    const inThisZone = z && z.type === type;
    const effLevel = inThisZone ? effectiveZoneLevel(z.level, p.stats[type] ?? 0) : 0;
    if (effLevel > 0) {
      p.contam[type] = Math.min(100, p.contam[type] + SIM.contamPerLevel * effLevel * dt);
    } else if (p.contam[type] > 0) {
      const removal = type === 'temp' ? p.stats.burnRemoval : p.stats.cleanseRate;
      p.contam[type] = Math.max(0, p.contam[type] - removal * dt);
    }
    if (p.contam[type] >= 100 && p.alive) {
      p.hp = Math.max(0, p.hp - (SIM.contamDps * p.stats.health / 100) * dt);
      p.lastDamageT = world.t;
      if (p.hp <= 0) { p.alive = false; world.events.push({ type: 'death', pid: p.id }); }
    }
  }
  const newMax = Math.max(p.contam.rad, p.contam.bio, p.contam.psi, p.contam.temp);
  if (prevMax < 100 && newMax >= 100) world.events.push({ type: 'contam_critical', pid: p.id });
}

function startReload(world, p, w) {
  if (p.reloadT > 0 || p.drawT > 0) return;
  const max = w.def.stats.mag;
  const need = max - w.mag;
  if (need <= 0 && !w.jammed) return;
  if (need > 0 && !w.jammed && world.host.ammoCount(w.def.ammo) <= 0) { world.events.push({ type: 'no_ammo', pid: p.id }); return; }
  const tactical = w.mag > 0 && !w.jammed; // тактическая — когда магазин не пуст и нет заклинивания
  p.reloadKind = tactical ? 'tactical' : 'full';
  p.reloadTotal = tactical ? w.def.stats.reloadTac : w.def.stats.reloadFull;
  p.reloadT = p.reloadTotal;
}

function finishReload(world, p, w) {
  const need = w.def.stats.mag - w.mag;
  if (need > 0) w.mag += world.host.takeAmmo(w.def.ammo, need);
  w.jammed = false; // заклинивание снимается только полной перезарядкой (тактическая при клине недоступна)
  p.reloadKind = null; p.reloadT = 0;
}

function fire(world, p, w) {
  if (w.jammed) { if (world.t - (p.lastJamMsg ?? -9) > 1.2) { p.lastJamMsg = world.t; world.events.push({ type: 'jam', pid: p.id }); } return; }
  if (w.mag <= 0) { startReload(world, p, w); return; }
  const s = w.def.stats;
  const ang = p.angle;
  world.bullets.push({
    id: world.nextId++, x: p.x + Math.cos(ang) * (p.r + 6), y: p.y + Math.sin(ang) * (p.r + 6),
    vx: Math.cos(ang) * SIM.bulletSpeed, vy: Math.sin(ang) * SIM.bulletSpeed,
    dmg: s.dmg, range: s.range * TILE, dist: 0, owner: p.id,
    bleed: s.bleedChance ?? 0, stop: s.stop ?? 0, mutMult: s.mutantMult ?? 1,
  });
  w.mag -= 1;
  p.cooldown = 1 / s.rate;
  p.flash = 0.06;
  w.dur = Math.max(0, w.dur - SIM.wearPerShot);
  if (w.dur <= 0) {
    if (!w.brokenNotified) { w.brokenNotified = true; world.events.push({ type: 'weapon_broken', pid: p.id, slot: w.slot }); }
    w.jammed = true; // сломанное оружие клинит после выстрела
  }
}

function stepBullets(world, dt) {
  const keep = [];
  for (const b of world.bullets) {
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    const stepLen = Math.hypot(b.vx, b.vy) * dt;
    if (tileAt(world.map, Math.floor(nx / TILE), Math.floor(ny / TILE)).blocksBullets) continue;
    let hit = false;
    if (b.owner === 'npc') {
      // пули НПС бьют только по игроку
      const p = world.players.p1;
      if (p.alive && segCircle(b.x, b.y, nx, ny, p.x, p.y, p.r)) {
        damagePlayer(world, p, b.dmgType ?? 'bullet', b.dmg);
        hit = true;
      }
    } else {
      for (const d of world.dummies) {
        if (d.dead) continue;
        if (segCircle(b.x, b.y, nx, ny, d.x, d.y, d.r)) { hitEntity(world, d, b, true); hit = true; break; }
      }
      if (!hit) for (const n of world.npcs) {
        if (n.dead) continue;
        if (segCircle(b.x, b.y, nx, ny, n.x, n.y, n.r)) { hitEntity(world, n, b, false); hit = true; break; }
      }
    }
    if (hit) continue;
    b.x = nx; b.y = ny; b.dist += stepLen;
    if (b.dist < b.range) keep.push(b);
  }
  world.bullets = keep;
}

function hitEntity(world, e, b, isDummy) {
  const kind = ENEMY_KINDS[isDummy ? e.kind : e.kindId];
  const mult = kind.mutant ? (b.mutMult ?? 1) : 1;
  const dmg = Math.round(b.dmg * mult);
  e.hp -= dmg; e.flash = 0.12;
  floater(world, e.x, e.y - e.r - 4, String(dmg), mult > 1 ? '#ffb347' : '#ffffff');
  if (b.stop) { e.slowT = SIM.stopTime; e.slow = b.stop / 100; }
  if (b.bleed && Math.random() * 100 < b.bleed) { e.bleedT = SIM.bleedTime; e.bleedAcc = 0; floater(world, e.x + 8, e.y, 'кровь', '#ff6b5e', 0.8); }
  if (e.hp <= 0) (isDummy ? killDummy(world, e) : killNpc(world, e));
}

function killDummy(world, d) {
  d.hp = 0; d.dead = true; d.respawnT = SIM.respawnTime; d.bleedT = 0; d.slowT = 0;
  world.events.push({ type: 'kill', kind: d.kind });
}

function killNpc(world, n) {
  n.hp = 0; n.dead = true; n.corpseT = CORPSE_FADE; n.bleedT = 0; n.slowT = 0;
  world.events.push({ type: 'kill', kind: n.kindId });
}

function stepDummies(world, dt) {
  for (const d of world.dummies) {
    if (d.flash > 0) d.flash -= dt;
    if (d.dead) { d.respawnT -= dt; if (d.respawnT <= 0) { d.dead = false; d.hp = d.maxHp; } continue; }
    if (d.slowT > 0) d.slowT -= dt;
    if (d.bleedT > 0) {
      d.bleedT -= dt; d.bleedAcc += dt;
      while (d.bleedAcc >= 1) {
        d.bleedAcc -= 1; d.hp -= SIM.bleedDps;
        floater(world, d.x, d.y - d.r, String(SIM.bleedDps), '#ff6b5e', 0.7);
        if (d.hp <= 0) { killDummy(world, d); break; }
      }
    }
  }
}

// ── урон игроку (пригодится, когда появятся враги; сейчас вызывается из инструментов разработчика) ──
export function damagePlayer(world, p, type, amount) {
  if (!p.alive) return;
  const pool = p.stats.pools[type] ?? p.stats.pools.bullet;
  p.hp = Math.max(0, p.hp - (amount / pool) * p.stats.health); // доля запаса против этого типа урона = доля здоровья
  p.lastDamageT = world.t;
  floater(world, p.x, p.y - p.r - 6, `-${Math.round(amount)}`, '#ff6b5e');
  if (p.armor && p.armor.dur > 0) {
    p.armor.dur = Math.max(0, p.armor.dur - amount * SIM.armorWearPerDamage);
    if (p.armor.dur <= 0) world.events.push({ type: 'armor_broken', pid: p.id });
  }
  if (p.hp <= 0) { p.alive = false; world.events.push({ type: 'death', pid: p.id }); }
}

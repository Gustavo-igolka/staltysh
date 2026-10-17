// ИИ отрядов: патрулирование / погоня / атака (дальний бой) / бегство (мутанты и ближний бой) / осада (разлом).
// Тикает не каждый кадр, а раз в AI_TICK секунд — для производительности на телефоне; движение и стрельба
// применяются каждый кадр в stepNpc() на основе уже выбранного состояния.
import { TILE, tileAt } from '../../data/tiles.js';
import { ENEMY_KINDS } from '../../data/enemies.js';
import { blockedAt as collides, moveWithCollision } from './world.js';
import { findPath, pathToWorld, hasLineOfSight } from './pathfind.js';

export const AI_TICK = 0.35;

const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function varied(base, pct) {
  const k = 1 + rnd(-pct, pct) / 100;
  return Math.round(base * k * 100) / 100;
}

export function spawnNpc(world, kindId, x, y, home) {
  const k = ENEMY_KINDS[kindId];
  const npc = {
    id: world.nextId++, kindId, x, y, angle: 0,
    r: k.r, hp: varied(k.hp, k.variancePct), maxHp: 0,
    moveSpeed: varied(k.moveSpeed, k.variancePct),
    dead: false, corpseT: 0, flash: 0, slowT: 0, slow: 0, bleedT: 0, bleedAcc: 0,
    state: 'patrol', stateT: 0, fleeT: 0, repositionT: rnd(0, k.ranged?.reposition ?? 3),
    home, path: null, pathIdx: 0, repathT: 0, wanderGoal: null,
    cooldown: rnd(0, 1 / (k.ranged?.rate ?? k.melee?.rate ?? 1)),
    siegeTarget: null,
  };
  npc.maxHp = npc.hp;
  world.npcs.push(npc);
  return npc;
}

function kindOf(npc) { return ENEMY_KINDS[npc.kindId]; }

function pickWanderGoal(world, npc) {
  const home = npc.home;
  const ang = rnd(0, Math.PI * 2);
  const r = rnd(home.radius * 0.3, home.radius);
  return { x: home.x + Math.cos(ang) * r, y: home.y + Math.sin(ang) * r };
}

function followPath(world, npc, dt, goal) {
  // перестраиваем путь изредка, а не каждый кадр
  npc.repathT -= dt;
  const hasLos = hasLineOfSight(world.map, npc.x, npc.y, goal.x, goal.y);
  if (hasLos) { npc.path = null; moveToward(world, npc, goal, dt); return; }
  if (!npc.path || npc.repathT <= 0) {
    npc.repathT = 0.9;
    const cells = findPath(world.map, npc.x, npc.y, goal.x, goal.y);
    npc.path = cells ? pathToWorld(cells) : null;
    npc.pathIdx = 0;
  }
  if (npc.path && npc.path.length) {
    let wp = npc.path[npc.pathIdx];
    if (wp && dist(npc, wp) < TILE * 0.5) npc.pathIdx = Math.min(npc.pathIdx + 1, npc.path.length - 1);
    wp = npc.path[npc.pathIdx];
    if (wp) moveToward(world, npc, wp, dt);
  } else {
    moveToward(world, npc, goal, dt); // путь не нашёлся — идём напрямую (лучше, чем стоять)
  }
}

function moveToward(world, npc, goal, dt) {
  const dx = goal.x - npc.x, dy = goal.y - npc.y;
  const len = Math.hypot(dx, dy) || 1;
  npc.angle = Math.atan2(dy, dx);
  const slow = npc.slowT > 0 ? (1 - npc.slow) : 1;
  const speed = npc.moveSpeed * slow;
  const terrain = tileAt(world.map, Math.floor(npc.x / TILE), Math.floor(npc.y / TILE)).speed ?? 1;
  const step = Math.min(len, speed * terrain * dt);
  moveWithCollision(world.map, npc, (dx / len) * step, (dy / len) * step, npc.r);
}

function fireAt(world, npc, target, k) {
  const spread = (rnd(-k.ranged.accuracyDeg, k.ranged.accuracyDeg) * Math.PI) / 180;
  const ang = Math.atan2(target.y - npc.y, target.x - npc.x) + spread;
  world.bullets.push({
    id: world.nextId++, x: npc.x + Math.cos(ang) * (npc.r + 6), y: npc.y + Math.sin(ang) * (npc.r + 6),
    vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900,
    dmg: k.ranged.dmg, range: k.ranged.range, dist: 0, owner: 'npc', dmgType: k.dmgType,
  });
  npc.angle = Math.atan2(target.y - npc.y, target.x - npc.x);
}

export function stepNpc(world, npc, dt, player) {
  if (npc.dead) { npc.corpseT -= dt; return; }
  const k = kindOf(npc);
  if (npc.flash > 0) npc.flash -= dt;
  if (npc.slowT > 0) npc.slowT -= dt;
  if (npc.cooldown > 0) npc.cooldown -= dt;
  if (npc.bleedT > 0) {
    npc.bleedT -= dt; npc.bleedAcc += dt;
    while (npc.bleedAcc >= 1) { npc.bleedAcc -= 1; npc.hp -= 3; if (npc.hp <= 0) return killFromBleed(world, npc); }
  }

  npc.stateT -= dt;
  const canSeePlayer = player.alive && dist(npc, player) <= k.vision && hasLineOfSight(world.map, npc.x, npc.y, player.x, player.y);

  // осада: цель — установка, а не игрок (если игрок не атакует рядом — обычное поведение не включаем)
  if (npc.siegeTarget && npc.siegeTarget.active) {
    stepSiegeNpc(world, npc, dt, k);
    return;
  }

  // переходы между состояниями по раз-в-AI_TICK логике решает caller (стейт меняется плавно через stateT<=0)
  if (npc.stateT <= 0) {
    npc.stateT = AI_TICK;
    if (npc.state === 'flee') {
      npc.fleeT -= AI_TICK;
      if (npc.fleeT <= 0) npc.state = canSeePlayer ? 'chase' : 'patrol';
    } else if (k.melee && npc.hp / npc.maxHp * 100 <= k.fleeHpPct && (npc.state === 'chase' || npc.state === 'attack')) {
      npc.state = 'flee'; npc.fleeT = k.fleeTime;
    } else if (canSeePlayer) {
      npc.state = k.ranged ? 'attack' : 'chase';
    } else if (npc.state === 'chase' || npc.state === 'attack') {
      npc.state = 'patrol'; // потеряли из виду — возвращаемся патрулировать
    }
  }

  if (npc.state === 'patrol') {
    if (!npc.wanderGoal || dist(npc, npc.wanderGoal) < TILE) npc.wanderGoal = pickWanderGoal(world, npc);
    followPath(world, npc, dt, npc.wanderGoal);
  } else if (npc.state === 'flee') {
    const away = { x: npc.x + (npc.x - player.x), y: npc.y + (npc.y - player.y) };
    followPath(world, npc, dt, away);
  } else if (npc.state === 'chase') {
    followPath(world, npc, dt, player);
    if (k.melee && dist(npc, player) <= k.melee.range && npc.cooldown <= 0) {
      world.meleeQueue.push({ npcId: npc.id, dmg: k.melee.dmg, dmgType: k.dmgType });
      npc.cooldown = 1 / k.melee.rate;
    }
  } else if (npc.state === 'attack') {
    // дальнобойные держат дистанцию: если слишком близко или видимость пропала — идём к игроку,
    // иначе изредка смещаются вбок (репозиция), а не стоят на месте, и стреляют с разбросом
    if (!canSeePlayer) { npc.state = 'chase'; }
    else {
      const d = dist(npc, player);
      npc.repositionT -= dt;
      if (d > k.ranged.range * 0.9) {
        followPath(world, npc, dt, player);
      } else if (npc.repositionT <= 0) {
        npc.repositionT = rnd(k.ranged.reposition * 0.6, k.ranged.reposition * 1.4);
        const ang = Math.atan2(player.y - npc.y, player.x - npc.x) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        moveToward(world, npc, { x: npc.x + Math.cos(ang) * TILE * 3, y: npc.y + Math.sin(ang) * TILE * 3 }, dt);
      } else {
        npc.angle = Math.atan2(player.y - npc.y, player.x - npc.x);
      }
      if (npc.cooldown <= 0) { fireAt(world, npc, player, k); npc.cooldown = 1 / k.ranged.rate; }
    }
  }
}

// Установка бронирована прочнее, чем игрок: одиночный мутант не должен сносить её за пару ударов —
// иначе вся механика «успей отбить осаду» не имеет смысла. Урон по установке — доля обычного урона по игроку.
const SIEGE_DMG_FACTOR = 0.4;

function stepSiegeNpc(world, npc, dt, k) {
  const t = npc.siegeTarget;
  const target = { x: t.x, y: t.y };
  if (dist(npc, target) <= (k.melee?.range ?? 40) + 20) {
    npc.angle = Math.atan2(target.y - npc.y, target.x - npc.x);
    if (npc.cooldown <= 0) {
      t.hp = Math.max(0, t.hp - (k.melee?.dmg ?? 12) * SIEGE_DMG_FACTOR);
      npc.cooldown = 1 / (k.melee?.rate ?? 1);
    }
  } else {
    followPath(world, npc, dt, target);
  }
}

const CORPSE_FADE = 2.5; // должно совпадать с world.js — смерть от кровотечения оформляется так же, как смерть от пули

// Смерть от кровотечения: случается вне stepBullets(), поэтому оформляем её так же полно, как killNpc() в
// world.js — иначе труп не исчезает, НПС не пропадает из spot.alive/siege.killed, и событие kill не уйдёт.
function killFromBleed(world, npc) {
  npc.hp = 0; npc.dead = true; npc.corpseT = CORPSE_FADE; npc.bleedT = 0; npc.slowT = 0;
  world.events.push({ type: 'kill', kind: npc.kindId });
}

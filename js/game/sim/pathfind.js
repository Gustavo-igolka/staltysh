// Простой ограниченный A* по клеткам карты — дёшево для телефона. Используется только когда прямая
// видимость до цели перекрыта (NPC проверяет LOS первым и путь строит лишь при необходимости).
import { TILE, tileAt } from '../../data/tiles.js';

const MAX_NODES = 1400;

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item, pri) {
    this.a.push([pri, item]);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p][0] <= this.a[i][0]) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]]; i = p;
    }
  }
  pop() {
    const top = this.a[0]; const last = this.a.pop();
    if (this.a.length) { this.a[0] = last; this._down(0); }
    return top && top[1];
  }
  _down(i) {
    const n = this.a.length;
    for (;;) {
      let s = i, l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.a[l][0] < this.a[s][0]) s = l;
      if (r < n && this.a[r][0] < this.a[s][0]) s = r;
      if (s === i) break;
      [this.a[s], this.a[i]] = [this.a[i], this.a[s]]; i = s;
    }
  }
}

const key = (x, y) => x + ',' + y;
const solidAt = (map, x, y) => x < 0 || y < 0 || x >= map.w || y >= map.h || tileAt(map, x, y).solid;

// A* по клеткам от (sx,sy) до (gx,gy) (мировые пиксели). Возвращает массив клеток [{x,y}, ...] или null.
export function findPath(map, sx, sy, gx, gy) {
  const s = { x: Math.floor(sx / TILE), y: Math.floor(sy / TILE) };
  const g = { x: Math.floor(gx / TILE), y: Math.floor(gy / TILE) };
  if (solidAt(map, g.x, g.y)) return null;

  // ограничивающая рамка с запасом вокруг старта/цели — не обшариваем всю карту
  const pad = 20;
  const minX = Math.max(0, Math.min(s.x, g.x) - pad), maxX = Math.min(map.w - 1, Math.max(s.x, g.x) + pad);
  const minY = Math.max(0, Math.min(s.y, g.y) - pad), maxY = Math.min(map.h - 1, Math.max(s.y, g.y) + pad);

  const open = new MinHeap();
  const came = new Map();
  const gScore = new Map([[key(s.x, s.y), 0]]);
  const h = (x, y) => Math.hypot(x - g.x, y - g.y);
  open.push(s, h(s.x, s.y));
  let visited = 0;
  const closed = new Set();

  while (open.size && visited < MAX_NODES) {
    const cur = open.pop();
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck); visited++;
    if (cur.x === g.x && cur.y === g.y) return reconstruct(came, cur);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        if (solidAt(map, nx, ny)) continue;
        // запрещаем срезать углы по диагонали через стену
        if (dx !== 0 && dy !== 0 && (solidAt(map, cur.x + dx, cur.y) || solidAt(map, cur.x, cur.y + dy))) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const cost = (gScore.get(ck) ?? 0) + (dx !== 0 && dy !== 0 ? 1.414 : 1);
        if (cost < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, cost);
          came.set(nk, cur);
          open.push({ x: nx, y: ny }, cost + h(nx, ny));
        }
      }
    }
  }
  return null; // не нашли (или слишком далеко) — вызывающий код сам решит, что делать
}

function reconstruct(came, node) {
  const path = [node];
  let k = key(node.x, node.y);
  while (came.has(k)) {
    node = came.get(k);
    path.push(node);
    k = key(node.x, node.y);
  }
  return path.reverse();
}

export const pathToWorld = (path) => path.map((c) => ({ x: (c.x + 0.5) * TILE, y: (c.y + 0.5) * TILE }));

// Проверка прямой видимости (для пуль и для ИИ) — шагаем вдоль отрезка и смотрим на tileAt().blocksBullets
export function hasLineOfSight(map, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / (TILE * 0.5)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (tileAt(map, Math.floor(x / TILE), Math.floor(y / TILE)).blocksBullets) return false;
  }
  return true;
}

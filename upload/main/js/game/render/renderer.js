// Рисование мира на canvas. Карта рисуется кусками (чанками) один раз и потом только копируется — так быстро на телефоне.
import { TILE, TILES } from '../../data/tiles.js';
import { ENEMY_KINDS } from '../../data/enemies.js';

const CH = 12;        // размер чанка в клетках
const CS = 1.5;       // во сколько раз чанк детальнее игровых пикселей
const VIEW_TILES = 14; // сколько клеток помещается по короткой стороне экрана
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// быстрый детерминированный шум для «случайных» деталей клетки
const hash = (x, y, k = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); };

export function createRenderer(canvas, map) {
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 0, scale: 1, vw: 0, vh: 0 };
  const cache = new Map();
  let cssW = 0, cssH = 0, dpr = 1;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    cam.scale = clamp(Math.min(cssW, cssH) / (VIEW_TILES * TILE), 0.7, 2.2);
    cam.vw = cssW / cam.scale; cam.vh = cssH / cam.scale;
  }

  // ── чанки ──
  function drawTile(c, ch, tx, ty, px, py) {
    const S = TILE * CS;
    const t = ch;
    const base = TILES[t] ?? TILES['.'];
    const v = hash(tx, ty);
    const shade = (v - 0.5) * 14;
    const fill = (color, k = 0) => { c.fillStyle = shadeColor(color, shade + k); c.fillRect(px, py, S, S); };
    const ground = TILES['.'];
    if (t === 'T') {
      fill(ground.color);
      c.fillStyle = '#152a18'; c.beginPath(); c.arc(px + S / 2, py + S / 2 + 2, S * 0.46, 0, 7); c.fill();
      c.fillStyle = '#21402a'; c.beginPath(); c.arc(px + S * 0.45, py + S * 0.42, S * 0.36, 0, 7); c.fill();
      c.fillStyle = '#2d5233'; c.beginPath(); c.arc(px + S * 0.4, py + S * 0.36, S * 0.16, 0, 7); c.fill();
    } else if (t === '#') {
      fill(base.color);
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(px, py, S, 3);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(px, py + S - 4, S, 4);
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(px + S * (0.2 + v * 0.5), py); c.lineTo(px + S * (0.3 + v * 0.4), py + S * 0.55); c.stroke();
    } else if (t === 'w' || t === 'W') {
      fill(base.color);
      c.strokeStyle = t === 'w' ? 'rgba(150,210,215,.25)' : 'rgba(90,150,160,.2)'; c.lineWidth = 1.2;
      const oy = py + S * (0.3 + v * 0.4);
      c.beginPath(); c.moveTo(px + S * 0.15, oy); c.quadraticCurveTo(px + S * 0.4, oy - 4, px + S * 0.6, oy); c.quadraticCurveTo(px + S * 0.75, oy + 3, px + S * 0.88, oy); c.stroke();
    } else if (t === 'm') {
      fill(base.color);
      c.fillStyle = 'rgba(20,30,10,.35)';
      c.beginPath(); c.ellipse(px + S * (0.3 + v * 0.4), py + S * (0.35 + hash(tx, ty, 2) * 0.3), S * 0.28, S * 0.16, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(120,150,70,.18)';
      c.beginPath(); c.arc(px + S * hash(tx, ty, 3), py + S * hash(tx, ty, 4), 2.5, 0, 7); c.fill();
    } else if (t === 'g') {
      fill(base.color);
      c.strokeStyle = 'rgba(120,170,90,.35)'; c.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { const gx = px + S * hash(tx, ty, 5 + i), gy = py + S * (0.3 + hash(tx, ty, 8 + i) * 0.6); c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 2, gy - 6); c.moveTo(gx, gy); c.lineTo(gx + 2, gy - 5); c.stroke(); }
    } else if (t === '=') {
      fill(base.color);
      c.fillStyle = 'rgba(0,0,0,.18)';
      for (let i = 0; i < 3; i++) c.fillRect(px + S * hash(tx, ty, 11 + i), py + S * hash(tx, ty, 14 + i), 3, 2);
    } else if (t === 'b') {
      fill(base.color);
      c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
    } else fill(base.color);
  }

  function chunk(cx, cy) {
    const key = cx + ',' + cy;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas');
    const S = TILE * CS;
    cv.width = CH * S; cv.height = CH * S;
    const c = cv.getContext('2d');
    for (let j = 0; j < CH; j++) {
      for (let i = 0; i < CH; i++) {
        const tx = cx * CH + i, ty = cy * CH + j;
        if (tx >= map.w || ty >= map.h) continue;
        drawTile(c, map.tiles[ty][tx], tx, ty, i * S, j * S);
      }
    }
    cache.set(key, cv);
    return cv;
  }

  // ── кадр ──
  function draw(world, pid, opts = {}) {
    const p = world.players[pid];
    const mapW = map.w * TILE, mapH = map.h * TILE;
    // камера следует за игроком и не выходит за края карты
    const tx = clamp(p.x - cam.vw / 2, 0, Math.max(0, mapW - cam.vw));
    const ty = clamp(p.y - cam.vh / 2, 0, Math.max(0, mapH - cam.vh));
    cam.x += (tx - cam.x) * 0.25; cam.y += (ty - cam.y) * 0.25;
    if (opts.snapCamera) { cam.x = tx; cam.y = ty; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#080b0a'; ctx.fillRect(0, 0, cssW, cssH);
    ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, -cam.x * cam.scale * dpr, -cam.y * cam.scale * dpr);
    ctx.imageSmoothingEnabled = true;

    // карта
    const cw = CH * TILE;
    const c0 = Math.max(0, Math.floor(cam.x / cw)), c1 = Math.floor((cam.x + cam.vw) / cw);
    const r0 = Math.max(0, Math.floor(cam.y / cw)), r1 = Math.floor((cam.y + cam.vh) / cw);
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      if (cx * CH >= map.w || cy * CH >= map.h) continue;
      ctx.drawImage(chunk(cx, cy), cx * cw, cy * cw, cw, cw);
    }

    drawObjects(world, opts);
    for (const d of world.dummies) drawDummy(d);
    drawPlayer(world, p);
    drawBullets(world);
    drawFloaters(world);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawObjects(world, opts) {
    const h = world.hatch;
    if (h) {
      ctx.fillStyle = '#20282a'; ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = '#39443f'; ctx.fillRect(h.x + 6, h.y + 6, h.w - 12, h.h - 12);
      ctx.strokeStyle = '#e3a93a'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]); ctx.strokeRect(h.x + 2, h.y + 2, h.w - 4, h.h - 4); ctx.setLineDash([]);
      ctx.fillStyle = '#e3a93a'; ctx.font = '700 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('БУНКЕР', h.x + h.w / 2, h.y + h.h / 2);
    }
    for (const t of world.transitions) {
      ctx.strokeStyle = t.locked ? 'rgba(220,90,69,.7)' : 'rgba(98,194,131,.8)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.strokeRect(t.x + 2, t.y + 2, t.w - 4, t.h - 4); ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▲ ' + t.label, t.x + t.w / 2, t.y + t.h / 2);
    }
    if (opts.debug) {
      const letters = { mutant_spot: 'М', human_spot: 'Л', stash: 'П', rift: 'Р', science_post: 'Н' };
      for (const m of world.markers) {
        ctx.fillStyle = 'rgba(227,169,58,.25)'; ctx.beginPath(); ctx.arc(m.x, m.y, 14, 0, 7); ctx.fill();
        ctx.fillStyle = '#e3a93a'; ctx.font = '700 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letters[m.type] ?? '?', m.x, m.y);
      }
    }
  }

  function drawDummy(d) {
    const k = ENEMY_KINDS[d.kind];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (d.dead) {
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(d.x - 6, d.y - 6); ctx.lineTo(d.x + 6, d.y + 6); ctx.moveTo(d.x + 6, d.y - 6); ctx.lineTo(d.x - 6, d.y + 6); ctx.stroke();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(d.x, d.y + d.r * 0.7, d.r, d.r * 0.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = d.flash > 0 ? '#ffffff' : k.color;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; ctx.stroke();
    if (d.slowT > 0) { ctx.strokeStyle = 'rgba(111,214,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 4, 0, 7); ctx.stroke(); }
    if (d.bleedT > 0) { ctx.fillStyle = '#ff5a4d'; ctx.beginPath(); ctx.arc(d.x + d.r * 0.6, d.y + d.r * 0.4, 3, 0, 7); ctx.fill(); }
    const bw = 30, by = d.y - d.r - 12;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(d.x - bw / 2, by, bw, 4);
    ctx.fillStyle = k.mutant ? '#c98a3a' : '#c05a4c'; ctx.fillRect(d.x - bw / 2, by, bw * (d.hp / d.maxHp), 4);
    ctx.fillStyle = 'rgba(230,236,232,.85)'; ctx.font = '11px sans-serif'; ctx.fillText(k.name, d.x, by - 7);
  }

  function drawPlayer(world, p) {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.7, p.r, p.r * 0.5, 0, 0, 7); ctx.fill();
    const w = p.active ? p.weapons[p.active] : null;
    if (w) { // тонкая линия прицела до максимальной дальности
      const len = Math.min(w.def.stats.range * TILE, 9 * TILE);
      ctx.strokeStyle = 'rgba(255,240,200,.16)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(p.angle) * (p.r + 4), p.y + Math.sin(p.angle) * (p.r + 4));
      ctx.lineTo(p.x + Math.cos(p.angle) * len, p.y + Math.sin(p.angle) * len); ctx.stroke(); ctx.setLineDash([]);
    }
    // ствол
    ctx.strokeStyle = '#1b1f1c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * (p.r + 8), p.y + Math.sin(p.angle) * (p.r + 8)); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = p.alive ? '#d8c894' : '#6b6b6b';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a3320'; ctx.lineWidth = 2; ctx.stroke();
    if (p.flash > 0) {
      ctx.fillStyle = 'rgba(255,220,120,.9)'; ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * (p.r + 12), p.y + Math.sin(p.angle) * (p.r + 12), 5, 0, 7); ctx.fill();
    }
  }

  function drawBullets(world) {
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (const b of world.bullets) {
      const k = 0.022;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * k, b.y - b.vy * k); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function drawFloaters(world) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 13px sans-serif';
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  const worldToScreen = (x, y) => ({ x: (x - cam.x) * cam.scale, y: (y - cam.y) * cam.scale });
  const zoneRarity = (y) => (map.bands.find((b) => y / TILE >= b.fromY) ?? map.bands[map.bands.length - 1]);

  resize();
  return { cam, resize, draw, worldToScreen, zoneRarity, dispose() { cache.clear(); } };
}

function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

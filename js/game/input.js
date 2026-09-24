// Ввод игрока: два виртуальных стика и кнопки на телефоне, WASD + мышь на компьютере.
// Отдаёт «намерения» (куда идти, куда целиться, стрелять ли) — симуляция не знает, откуда они пришли.
const DEAD = 0.12;    // мёртвая зона стика
const STICK_R = 58;   // радиус хода стика в пикселях
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR', 'KeyQ', 'KeyE', 'KeyF', 'Digit1', 'Digit2', 'Escape', 'KeyP']);

export function createInput({ zones, canvas, playerScreen, touchMode, onStick }) {
  const edge = { reload: false, swap: false, interact: false, pause: false, select: null };
  const keys = new Set();
  const stick = { move: { active: false, id: null, x: 0, y: 0, ox: 0, oy: 0 }, aim: { active: false, id: null, x: 0, y: 0, ox: 0, oy: 0 } };
  const mouse = { x: 0, y: 0, down: false, moved: false };
  let lastAim = -Math.PI / 2;
  const off = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); off.push(() => target.removeEventListener(type, fn, opts)); };

  // ── клавиатура ──
  listen(window, 'keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyR') edge.reload = true;
    else if (e.code === 'KeyQ') edge.swap = true;
    else if (e.code === 'Digit1') edge.select = 'weapon';
    else if (e.code === 'Digit2') edge.select = 'secondary';
    else if (e.code === 'KeyE' || e.code === 'KeyF') edge.interact = true;
    else if (e.code === 'Escape' || e.code === 'KeyP') edge.pause = true;
  });
  listen(window, 'keyup', (e) => keys.delete(e.code));
  listen(window, 'blur', () => { keys.clear(); mouse.down = false; });

  // ── мышь (по холсту) ──
  const rel = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  listen(canvas, 'pointermove', (e) => { if (e.pointerType !== 'mouse') return; Object.assign(mouse, rel(e)); mouse.moved = true; });
  listen(canvas, 'pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; Object.assign(mouse, rel(e)); mouse.moved = true; mouse.down = true; });
  listen(window, 'pointerup', (e) => { if (e.pointerType === 'mouse') mouse.down = false; });
  listen(canvas, 'contextmenu', (e) => e.preventDefault());

  // ── виртуальные стики: появляются там, где коснулся палец ──
  function bindStick(el, kind) {
    if (!el) return;
    const s = stick[kind];
    listen(el, 'pointerdown', (e) => {
      if (s.active) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* не критично */ }
      Object.assign(s, { active: true, id: e.pointerId, x: 0, y: 0, ox: e.clientX, oy: e.clientY });
      onStick(kind, { active: true, ox: s.ox, oy: s.oy, kx: 0, ky: 0 });
    });
    listen(el, 'pointermove', (e) => {
      if (!s.active || e.pointerId !== s.id) return;
      let dx = e.clientX - s.ox, dy = e.clientY - s.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
      s.x = dx / STICK_R; s.y = dy / STICK_R;
      onStick(kind, { active: true, ox: s.ox, oy: s.oy, kx: dx, ky: dy });
    });
    const end = (e) => {
      if (e.pointerId !== s.id) return;
      Object.assign(s, { active: false, id: null, x: 0, y: 0 });
      onStick(kind, { active: false });
    };
    listen(el, 'pointerup', end);
    listen(el, 'pointercancel', end);
  }
  bindStick(zones.move, 'move');
  bindStick(zones.aim, 'aim');

  function read() {
    // движение: стик или клавиши
    let mx = 0, my = 0;
    const sm = stick.move;
    const ml = Math.hypot(sm.x, sm.y);
    if (sm.active && ml > DEAD) {
      const k = Math.min(1, (ml - DEAD) / (1 - DEAD)) / ml;
      mx = sm.x * k; my = sm.y * k;
    } else {
      mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
    }

    // прицел: правый стик (стрельба, когда стик отведён), иначе мышь, иначе в сторону движения на телефоне
    let firing = keys.has('Space');
    const sa = stick.aim;
    const al = Math.hypot(sa.x, sa.y);
    if (sa.active && al > 0.25) {
      lastAim = Math.atan2(sa.y, sa.x);
      firing = firing || al > 0.5;
    } else if (mouse.moved) {
      const ps = playerScreen();
      lastAim = Math.atan2(mouse.y - ps.y, mouse.x - ps.x);
      firing = firing || mouse.down;
    } else if (touchMode && Math.hypot(mx, my) > 0.2) {
      lastAim = Math.atan2(my, mx);
    }

    const out = { moveX: mx, moveY: my, aim: lastAim, firing, reload: edge.reload, swap: edge.swap, select: edge.select, interact: edge.interact, pause: edge.pause };
    edge.reload = edge.swap = edge.interact = edge.pause = false; edge.select = null;
    return out;
  }

  return {
    read,
    press(name) { edge[name] = true; },
    dispose() { off.forEach((f) => f()); },
  };
}

// Ввод игрока: два виртуальных стика и кнопки на телефоне, WASD + мышь на компьютере.
// Отдаёт «намерения» (куда идти, куда целиться, стрелять ли) — симуляция не знает, откуда они пришли.
// Клавиши хранятся как e.code (физическая клавиша), поэтому «C» работает и на русской раскладке («С»).
const DEAD = 0.12;    // мёртвая зона стика
const STICK_R = 58;   // радиус хода стика в пикселях

// Клавиши по умолчанию; игрок переопределяет их в Настройки → Управление (state.settings.keys)
export const DEFAULT_KEYS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Space',
  reload: 'KeyR', swap: 'KeyQ', weapon1: 'Digit1', weapon2: 'Digit2',
  heal: 'KeyC', interact: 'KeyE', inventory: 'KeyI', map: 'KeyM', pause: 'Escape',
};
export const KEY_LABELS = {
  up: 'Вверх', down: 'Вниз', left: 'Влево', right: 'Вправо', fire: 'Огонь',
  reload: 'Перезарядка', swap: 'Смена оружия', weapon1: 'Основное оружие', weapon2: 'Доп. оружие',
  heal: 'Аптечка', interact: 'Взаимодействие', inventory: 'Инвентарь', map: 'Карта', pause: 'Пауза',
};
// запасные клавиши: работают всегда и не переназначаются
export const ALT_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', interact: 'KeyF', pause: 'KeyP' };

const KEY_NAMES = { Space: 'Пробел', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Shift', ShiftRight: 'Shift', Tab: 'Tab', Enter: 'Enter' };
export const keyName = (code) => KEY_NAMES[code] ?? String(code).replace(/^(Key|Digit)/, '');

export function createInput({ zones, canvas, playerScreen, touchMode, onStick, getKeys = () => DEFAULT_KEYS, autoAim = () => true }) {
  const edge = { reload: false, swap: false, interact: false, pause: false, select: null, map: false, inventory: false, heal: false };
  const keys = new Set();
  const stick = { move: { active: false, id: null, x: 0, y: 0, ox: 0, oy: 0 }, aim: { active: false, id: null, x: 0, y: 0, ox: 0, oy: 0 } };
  const mouse = { x: 0, y: 0, down: false, moved: false };
  let lastAim = -Math.PI / 2;
  let fireHeld = false; // отдельная кнопка «Огонь» на телефоне — стик прицела больше не стреляет сам
  const off = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); off.push(() => target.removeEventListener(type, fn, opts)); };

  // ── клавиатура ──
  const actionOf = (code, kb) => Object.keys(kb).find((a) => code === kb[a] || code === ALT_KEYS[a]);

  listen(window, 'keydown', (e) => {
    const act = actionOf(e.code, getKeys());
    if (act) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (act === 'reload') edge.reload = true;
    else if (act === 'swap') edge.swap = true;
    else if (act === 'weapon1') edge.select = 'weapon';
    else if (act === 'weapon2') edge.select = 'secondary';
    else if (act === 'heal') edge.heal = true;
    else if (act === 'interact') edge.interact = true;
    else if (act === 'pause') edge.pause = true;
    else if (act === 'map') edge.map = true;
    else if (act === 'inventory') edge.inventory = true;
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
    const kb = getKeys();
    const down = (a) => keys.has(kb[a]) || (ALT_KEYS[a] !== undefined && keys.has(ALT_KEYS[a]));

    // движение: стик или клавиши
    let mx = 0, my = 0;
    const sm = stick.move;
    const ml = Math.hypot(sm.x, sm.y);
    if (sm.active && ml > DEAD) {
      const k = Math.min(1, (ml - DEAD) / (1 - DEAD)) / ml;
      mx = sm.x * k; my = sm.y * k;
    } else {
      mx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
      my = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
    }

    // прицел: правый стик только задаёт направление (не стреляет), иначе мышь, иначе в сторону движения на телефоне.
    // Стрельба — отдельная кнопка «Огонь» (fireHeld) на телефоне, назначенная клавиша/ЛКМ на компьютере.
    let firing = down('fire') || fireHeld;
    const sa = stick.aim;
    const al = Math.hypot(sa.x, sa.y);
    if (sa.active && al > 0.25) {
      lastAim = Math.atan2(sa.y, sa.x);
    } else if (mouse.moved) {
      const ps = playerScreen();
      lastAim = Math.atan2(mouse.y - ps.y, mouse.x - ps.x);
      firing = firing || mouse.down;
    } else if (touchMode && autoAim() && Math.hypot(mx, my) > 0.2) {
      lastAim = Math.atan2(my, mx);
    }

    const out = {
      moveX: mx, moveY: my, aim: lastAim, firing,
      reload: edge.reload, swap: edge.swap, select: edge.select, interact: edge.interact, pause: edge.pause,
      map: edge.map, inventory: edge.inventory, heal: edge.heal,
    };
    edge.reload = edge.swap = edge.interact = edge.pause = edge.map = edge.inventory = edge.heal = false; edge.select = null;
    return out;
  }

  return {
    read,
    press(name) { edge[name] = true; },
    setFire(v) { fireHeld = v; },
    dispose() { off.forEach((f) => f()); },
  };
}

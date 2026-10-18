// Игровая сессия: связывает состояние игрока, симуляцию, рисование, ввод и HUD.
import { h } from '../core/dom.js';
import { getState, mutate } from '../core/state.js';
import { computeStats } from './stats.js';
import { countAmmo, takeAmmo, applyDeathLoss, addToInventory } from './inventory.js';
import { createWorld, step, setPlayerStats, damagePlayer } from './sim/world.js';
import { startSiege } from './sim/siege.js';
import { lootCrate } from './sim/spots.js';
import { createRenderer } from './render/renderer.js';
import { createInput } from './input.js';
import { buildGameUI } from '../ui/game.js';
import { renderInventory } from '../ui/inventory.js';
import { renderSettings } from '../ui/settings.js';
import { getItem } from '../data/items.js';
import { on } from '../core/events.js';
import { MAPS } from '../data/maps/index.js';

const DT = 1 / 60;
const NO_EDGES = { reload: false, swap: false, select: null, interact: false, map: false, inventory: false };

function wantsTouch(mode) {
  if (mode === 'touch') return true;
  if (mode === 'keyboard') return false;
  return !!window.matchMedia?.('(pointer: coarse)').matches;
}

const snapWeapon = (inst) => (inst ? { id: inst.id, dur: inst.dur, mag: inst.mag } : null);

export function startGame({ root, mapId = 'swamp', onEnd }) {
  const map = MAPS[mapId];
  const st0 = getState();
  const touch = wantsTouch(st0.settings.controls);
  const dev = !!st0.settings.dev;

  // «мост» между симуляцией и сохранением игрока: только здесь мир касается state
  const host = {
    ammoCount: (id) => countAmmo(getState(), id),
    takeAmmo: (id, n) => mutate((st) => ({ ok: true, taken: takeAmmo(st, id, n) })).taken,
  };
  const world = createWorld({
    map, host,
    snapshot: {
      stats: computeStats(st0),
      weapons: { weapon: snapWeapon(st0.slots.weapon), secondary: snapWeapon(st0.slots.secondary) },
      armor: st0.slots.armor ? { id: st0.slots.armor.id, dur: st0.slots.armor.dur } : null,
    },
  });
  const p = world.players.p1;

  const ui = buildGameUI({ touch, dev });
  root.replaceChildren(ui.el);
  const renderer = createRenderer(ui.canvas, map);
  world.camera = renderer.cam; // живая ссылка — нужна spots.js, чтобы проверять видимость точки на экране
  const input = createInput({ zones: ui.zones, canvas: ui.canvas, touchMode: touch, playerScreen: () => renderer.worldToScreen(p.x, p.y), onStick: ui.setStick });

  let paused = false, ended = false, raf = 0, acc = 0, debugMarkers = false, snap = true;
  let last = performance.now(), lastCommit = last;
  let carry = { ...NO_EDGES };

  // ── сохранение результата в состояние игрока ──
  function commit() {
    mutate((st) => {
      for (const slot of ['weapon', 'secondary']) {
        const w = p.weapons[slot], inst = st.slots[slot];
        if (w && inst) { inst.dur = w.dur; inst.mag = w.mag; }
      }
      if (p.armor && st.slots.armor) st.slots.armor.dur = p.armor.dur;
      return { ok: true };
    });
  }

  function end(reason) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    commit();
    // при смерти инвентарь вылазки теряется, но личные непередаваемые вещи (кроме бартерных ресурсов)
    // возвращаются на склад бункера, а не пропадают навсегда
    if (reason === 'death') mutate((st) => { applyDeathLoss(st); return { ok: true }; });
    input.dispose(); renderer.dispose(); offOverlayRefresh?.();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    ui.el.remove();
    onEnd?.({ reason });
  }

  function setPaused(v) {
    paused = v;
    ui.pauseLayer.hidden = !v;
    if (!v) return;
    const atHatch = p.prompt?.type === 'hatch';
    ui.pauseLayer.replaceChildren(
      h('h2', null, 'Пауза'),
      h('button', { class: 'btn primary', onclick: () => setPaused(false) }, 'Продолжить'),
      h('button', { class: 'btn ghost', onclick: () => { setPaused(false); openMenuOverlay('Настройки', renderSettings); } }, 'Настройки'),
      h('button', { class: 'btn ghost', disabled: !atHatch, onclick: () => end('hatch') }, 'Войти в бункер'),
      atHatch ? null : h('p', null, 'В бункер можно войти только у люка на юге карты.'),
      dev ? h('button', { class: 'btn danger', onclick: () => end('dev') }, 'Выйти (режим разработчика)') : null);
  }

  function handleEvents() {
    for (const e of world.events.splice(0)) {
      if (ended) return;
      if (e.type === 'exit') end('hatch');
      else if (e.type === 'death') end('death');
      else if (e.type === 'transition_locked') ui.toast('Путь на север пока закрыт: новая локация появится позже');
      else if (e.type === 'no_ammo') ui.toast('В инвентаре нет патронов');
      else if (e.type === 'jam') ui.toast('Оружие клинит: нужна полная перезарядка');
      else if (e.type === 'weapon_broken') { ui.toast('Оружие сломано'); commit(); }
      else if (e.type === 'armor_broken') { ui.toast('Броня сломана: защиты больше нет'); commit(); setPlayerStats(world, 'p1', computeStats(getState())); }
      else if (e.type === 'zone_enter') ui.toast(`${e.zone.name}: заражение ${e.zone.level} ур.`);
      else if (e.type === 'contam_critical') ui.toast('Заражение критическое: наносит урон здоровью', 'warn');
      else if (e.type === 'loot_crate') {
        const spot = world.spots.find((s) => s.id === e.spotId);
        const items = spot ? lootCrate(world, spot) : [];
        if (items.length) {
          mutate((st) => { for (const it of items) addToInventory(st, it); return { ok: true }; });
          const names = items.map((it) => getItem(it.id).name).join(', ');
          ui.toast(`Добыча: ${names}`);
        }
      } else if (e.type === 'spot_cleared') {
        ui.toast('Точка зачищена: добыча ждёт в ящике');
      } else if (e.type === 'siege_end') {
        const r = e.result;
        if (r.items?.length) mutate((st) => { for (const it of r.items) addToInventory(st, it); return { ok: true }; });
        ui.toast(r.installDestroyed
          ? `Установка уничтожена: убито ${r.killed}/${r.total}, награда ×${r.lootFactor}`
          : `Осада отбита: убито ${r.killed}/${r.total}, полная награда`);
      }
    }
  }

  // ── полноэкранные оверлеи поверх игры: ставят симуляцию на паузу, не показывая экран «Пауза» ──
  let overlayRefreshFn = null;
  const offOverlayRefresh = on('ui:refresh', () => { if (ui.overlayOpen && overlayRefreshFn) ui.redrawOverlay(overlayRefreshFn); });

  function closeAnyOverlay() {
    ui.closeOverlay();
    overlayRefreshFn = null;
    paused = false;
  }
  function openMenuOverlay(title, render) {
    overlayRefreshFn = render;
    paused = true;
    ui.openOverlay(title, render, closeAnyOverlay);
  }
  function openMapOverlay() {
    paused = true;
    const render = (el) => {
      const cv = h('canvas', { class: 'map-canvas' });
      el.append(cv);
      requestAnimationFrame(() => renderer.drawFullMap(cv, world));
    };
    overlayRefreshFn = null;
    ui.openOverlay('Карта', render, closeAnyOverlay);
  }

  const view = () => {
    const w = p.active ? p.weapons[p.active] : null;
    return {
      hp: p.hp, maxHp: p.stats.health, zone: renderer.zoneRarity(p.y),
      weapon: w && { name: w.def.name, mag: w.mag, reserve: countAmmo(getState(), w.def.ammo), durPct: (w.dur / w.def.durMax) * 100, jammed: w.jammed },
      reloadPct: p.reloadT > 0 ? 1 - p.reloadT / p.reloadTotal : null, reloadKind: p.reloadKind,
      drawing: p.drawT > 0, prompt: p.prompt, contam: p.contam,
    };
  };

  function frame(now) {
    if (ended) return;
    raf = requestAnimationFrame(frame);
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;

    const inp = input.read();
    if (inp.pause) { if (ui.overlayOpen) closeAnyOverlay(); else setPaused(!paused); }
    if (inp.inventory) { if (ui.overlayOpen) closeAnyOverlay(); else if (!paused) openMenuOverlay('Инвентарь', renderInventory); }
    if (inp.map) { if (ui.overlayOpen) closeAnyOverlay(); else if (!paused) openMapOverlay(); }
    // одноразовые нажатия копим, пока не пройдёт хотя бы один шаг симуляции
    carry.reload ||= inp.reload; carry.swap ||= inp.swap; carry.interact ||= inp.interact; carry.select = inp.select ?? carry.select;

    if (!paused && p.alive) {
      acc += elapsed;
      let first = true;
      while (acc >= DT) {
        p.input = first ? { ...inp, ...carry } : { ...inp, ...NO_EDGES };
        if (first) carry = { ...NO_EDGES };
        first = false;
        step(world, DT);
        acc -= DT;
      }
    }
    handleEvents();
    if (ended) return;

    renderer.draw(world, 'p1', { debug: debugMarkers, snapCamera: snap });
    snap = false;
    ui.update(view());
    if (now - lastCommit > 5000) { commit(); lastCommit = now; }
  }

  // ── подписки ──
  const onResize = () => { renderer.resize(); snap = true; };
  const onVisibility = () => { if (document.hidden && !paused) setPaused(true); };
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  ui.pauseBtn.addEventListener('click', () => (ui.overlayOpen ? closeAnyOverlay() : input.press('pause')));
  ui.btnInv.addEventListener('click', () => (ui.overlayOpen ? closeAnyOverlay() : openMenuOverlay('Инвентарь', renderInventory)));
  ui.btnMap.addEventListener('click', () => (ui.overlayOpen ? closeAnyOverlay() : openMapOverlay()));
  ui.prompt.addEventListener('click', () => input.press('interact'));
  ui.btnReload?.addEventListener('pointerdown', (e) => { e.preventDefault(); input.press('reload'); });
  ui.btnSwap?.addEventListener('pointerdown', (e) => { e.preventDefault(); input.press('swap'); });
  ui.btnFire?.addEventListener('pointerdown', (e) => { e.preventDefault(); input.setFire(true); });
  ui.btnFire?.addEventListener('pointerup', (e) => { e.preventDefault(); input.setFire(false); });
  ui.btnFire?.addEventListener('pointercancel', () => input.setFire(false));

  if (dev) {
    window.__world = world; window.__renderer = renderer; // отладка из консоли/тестов
    const b = (label, fn) => ui.devBox.append(h('button', { onclick: fn }, label));
    b('−25 пуля', () => damagePlayer(world, p, 'bullet', 25));
    b('−25 разрыв', () => damagePlayer(world, p, 'tear', 25));
    b('−25 взрыв', () => damagePlayer(world, p, 'blast', 25));
    b('Лечить', () => { p.hp = p.stats.health; });
    b('Метки точек', () => { debugMarkers = !debugMarkers; });
    b('Осада разлома рядом', () => { startSiege(world, p.x + 4 * 32, p.y); });
  }

  ui.update(view());
  raf = requestAnimationFrame(frame);
  return { stop: () => end('stop'), world };
}

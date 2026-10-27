// Экран игры: холст, HUD, сенсорное управление, пауза
import { h } from '../core/dom.js';
import { rarityCss } from './common.js';

const CONTAM_LABELS = { rad: 'Радиация', bio: 'Биозаражение', psi: 'Пси-излучение', temp: 'Температура' };

export function buildGameUI({ touch, dev }) {
  const canvas = h('canvas', { class: 'game-canvas' });

  // HUD
  const hpFill = h('i'); const hpText = h('span');
  const zoneChip = h('span', { class: 'zone' });
  const pauseBtn = h('button', { class: 'gbtn small', 'aria-label': 'Пауза' }, 'II');
  const btnInv = h('button', { class: 'gbtn small', 'aria-label': 'Инвентарь' }, '🎒');
  const btnMap = h('button', { class: 'gbtn small', 'aria-label': 'Карта' }, '🗺');
  const wName = h('b'); const wAmmo = h('span', { class: 'ammo' }); const wState = h('small');
  const durFill = h('i'); const reloadFill = h('i');
  const prompt = h('button', { class: 'prompt', hidden: true });
  const toastEl = h('div', { class: 'gtoast', hidden: true });
  const contamBox = h('div', { class: 'contam' });
  const detectorFill = h('i'); const detectorText = h('span');
  const detectorBox = h('div', { class: 'detector', hidden: true }, h('span', null, '📡'), detectorText, h('div', { class: 'bar detector-bar' }, detectorFill));
  const hudMid = h('div', { class: 'hud-mid' }, contamBox, detectorBox);

  const top = h('div', { class: 'hud-top' },
    h('div', { class: 'hp' }, h('div', { class: 'bar hp-bar' }, hpFill), hpText),
    zoneChip, h('div', { class: 'hud-top-btns' }, btnInv, btnMap, pauseBtn));
  const weapon = h('div', { class: 'hud-weapon' },
    h('div', { class: 'wrow' }, wName, wAmmo),
    h('div', { class: 'bar dur-bar' }, durFill),
    h('div', { class: 'bar reload-bar' }, reloadFill),
    wState);

  // сенсорное управление
  const zoneMove = touch ? h('div', { class: 'zone-move' }) : null;
  const zoneAim = touch ? h('div', { class: 'zone-aim' }) : null;
  const mkStick = () => h('div', { class: 'stick', hidden: true }, h('i'));
  const stickMove = mkStick(); const stickAim = mkStick();
  const btnFire = touch ? h('button', { class: 'gbtn fire', 'aria-label': 'Огонь' }, '●') : null;
  const btnReload = touch ? h('button', { class: 'gbtn reload', 'aria-label': 'Перезарядка' }, '⟳') : null;
  const btnSwap = touch ? h('button', { class: 'gbtn swap', 'aria-label': 'Смена оружия' }, '⇄') : null;
  const btnHeal = touch ? h('button', { class: 'gbtn heal', 'aria-label': 'Аптечка' }, '✚') : null;

  // пауза
  const pauseLayer = h('div', { class: 'pause-layer', hidden: true });

  // инструменты разработчика
  const devBox = dev ? h('div', { class: 'devbox' }) : null;

  // полноэкранный оверлей (инвентарь/настройки/карта) поверх идущей игры
  const overlayHead = h('h2', null);
  const overlayBody = h('div', { class: 'game-overlay-body' });
  const overlayClose = h('button', { class: 'btn ghost small' }, 'Закрыть');
  const overlay = h('div', { class: 'game-overlay', hidden: true },
    h('div', { class: 'game-overlay-head' }, overlayHead, overlayClose),
    overlayBody);

  const el = h('div', { class: 'game' + (touch ? ' touch' : '') },
    canvas, h('div', { class: 'game-vignette' }),
    zoneMove, zoneAim, stickMove, stickAim,
    top, hudMid, weapon, prompt, btnFire, btnReload, btnSwap, btnHeal, devBox, toastEl, pauseLayer, overlay);

  let toastT = null;
  return {
    el, canvas, pauseBtn, btnInv, btnMap, prompt, btnFire, btnReload, btnSwap, btnHeal, devBox, pauseLayer,
    zones: { move: zoneMove, aim: zoneAim },

    openOverlay(title, render, onClose) {
      overlayHead.textContent = title;
      overlayBody.replaceChildren();
      render(overlayBody);
      overlay.hidden = false;
      overlayClose.onclick = () => { overlay.hidden = true; onClose?.(); };
    },
    closeOverlay() { overlay.hidden = true; },
    redrawOverlay(render) { overlayBody.replaceChildren(); render(overlayBody); },
    get overlayOpen() { return !overlay.hidden; },

    setStick(kind, s) {
      const st = kind === 'move' ? stickMove : stickAim;
      st.hidden = !s.active;
      if (!s.active) return;
      const r = el.getBoundingClientRect();
      st.style.left = `${s.ox - r.left}px`; st.style.top = `${s.oy - r.top}px`;
      st.firstChild.style.transform = `translate(${s.kx}px, ${s.ky}px)`;
    },

    toast(msg, kind = 'info') {
      toastEl.textContent = msg; toastEl.hidden = false;
      toastEl.classList.toggle('warn', kind === 'warn');
      clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 2200);
    },

    update(v) {
      hpFill.style.width = `${Math.max(0, (v.hp / v.maxHp) * 100)}%`;
      hpText.textContent = `${Math.ceil(v.hp)}`;
      zoneChip.textContent = v.zone.name;
      const chips = Object.entries(v.contam ?? {}).filter(([, val]) => val > 0.5);
      contamBox.replaceChildren(...chips.map(([type, val]) =>
        h('div', { class: 'contam-chip' + (val >= 100 ? ' crit' : '') },
          h('span', null, CONTAM_LABELS[type] ?? type),
          h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, val)}%` } })))));
      zoneChip.style.setProperty('--rc', rarityCss(v.zone.rarity));
      if (v.detector === null || v.detector === undefined) {
        detectorBox.hidden = true;
      } else {
        detectorBox.hidden = false;
        const pct = Math.round(v.detector * 100);
        detectorFill.style.width = `${pct}%`;
        detectorText.textContent = v.detector > 0.03 ? `Сигнал: ${pct}%` : 'Сигнала нет';
        detectorBox.classList.toggle('hot', v.detector >= 0.75);
      }
      if (btnHeal) {
        btnHeal.textContent = v.heals > 0 ? `✚${v.heals}` : '✚';
        btnHeal.classList.toggle('empty', !v.heals);
      }
      if (v.weapon) {
        weapon.hidden = false;
        wName.textContent = v.weapon.name;
        wAmmo.textContent = `${v.weapon.mag} / ${v.weapon.reserve}`;
        durFill.style.width = `${v.weapon.durPct}%`;
        durFill.parentElement.classList.toggle('warn', v.weapon.durPct <= 0);
        reloadFill.style.width = `${(v.reloadPct ?? 0) * 100}%`;
        reloadFill.parentElement.style.visibility = v.reloadPct === null ? 'hidden' : 'visible';
        wState.textContent = v.weapon.jammed ? 'Клин: нужна полная перезарядка'
          : v.reloadPct !== null ? (v.reloadKind === 'tactical' ? 'Тактическая перезарядка' : 'Полная перезарядка')
          : v.drawing ? 'Достаю оружие…' : (v.weapon.mag === 0 && v.weapon.reserve === 0 ? 'Нет патронов' : '');
        wState.classList.toggle('bad', v.weapon.jammed || (v.weapon.mag === 0 && v.weapon.reserve === 0));
      } else {
        weapon.hidden = false;
        wName.textContent = 'Нет оружия'; wAmmo.textContent = ''; wState.textContent = ''; reloadFill.parentElement.style.visibility = 'hidden';
      }
      prompt.hidden = !v.prompt;
      if (v.prompt) prompt.textContent = (touch ? '' : `[${v.interactKey ?? 'E'}] `) + v.prompt.text;
    },
  };
}

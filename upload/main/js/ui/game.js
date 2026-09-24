// Экран игры: холст, HUD, сенсорное управление, пауза
import { h } from '../core/dom.js';
import { rarityCss } from './common.js';

export function buildGameUI({ touch, dev }) {
  const canvas = h('canvas', { class: 'game-canvas' });

  // HUD
  const hpFill = h('i'); const hpText = h('span');
  const zoneChip = h('span', { class: 'zone' });
  const pauseBtn = h('button', { class: 'gbtn small', 'aria-label': 'Пауза' }, 'II');
  const wName = h('b'); const wAmmo = h('span', { class: 'ammo' }); const wState = h('small');
  const durFill = h('i'); const reloadFill = h('i');
  const prompt = h('button', { class: 'prompt', hidden: true });
  const toastEl = h('div', { class: 'gtoast', hidden: true });

  const top = h('div', { class: 'hud-top' },
    h('div', { class: 'hp' }, h('div', { class: 'bar hp-bar' }, hpFill), hpText),
    zoneChip, pauseBtn);
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
  const btnReload = touch ? h('button', { class: 'gbtn' }, '⟳') : null;
  const btnSwap = touch ? h('button', { class: 'gbtn' }, '⇄') : null;

  // пауза
  const pauseLayer = h('div', { class: 'pause-layer', hidden: true });

  // инструменты разработчика
  const devBox = dev ? h('div', { class: 'devbox' }) : null;

  const el = h('div', { class: 'game' + (touch ? ' touch' : '') },
    canvas, h('div', { class: 'game-vignette' }),
    zoneMove, zoneAim, stickMove, stickAim,
    top, weapon, prompt, btnReload, btnSwap, devBox, toastEl, pauseLayer);

  let toastT = null;
  return {
    el, canvas, pauseBtn, prompt, btnReload, btnSwap, devBox, pauseLayer,
    zones: { move: zoneMove, aim: zoneAim },

    setStick(kind, s) {
      const st = kind === 'move' ? stickMove : stickAim;
      st.hidden = !s.active;
      if (!s.active) return;
      const r = el.getBoundingClientRect();
      st.style.left = `${s.ox - r.left}px`; st.style.top = `${s.oy - r.top}px`;
      st.firstChild.style.transform = `translate(${s.kx}px, ${s.ky}px)`;
    },

    toast(msg) {
      toastEl.textContent = msg; toastEl.hidden = false;
      clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 2200);
    },

    update(v) {
      hpFill.style.width = `${Math.max(0, (v.hp / v.maxHp) * 100)}%`;
      hpText.textContent = `${Math.ceil(v.hp)}`;
      zoneChip.textContent = v.zone.name;
      zoneChip.style.setProperty('--rc', rarityCss(v.zone.rarity));
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
      if (v.prompt) prompt.textContent = (touch ? '' : '[E] ') + v.prompt.text;
    },
  };
}

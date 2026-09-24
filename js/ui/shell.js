// Каркас приложения: верхняя панель с кошельком, область экрана, нижнее меню
import { h } from '../core/dom.js';
import { fmt } from '../core/util.js';

const SYNC = {
  local:   ['Сохранено на этом устройстве', 'local'],
  pending: ['Есть несохранённые изменения', 'pending'],
  saving:  ['Сохраняю в облако…', 'pending'],
  saved:   ['Сохранено в облаке', 'saved'],
  error:   ['Облако недоступно. Прогресс сохранён на устройстве', 'error'],
};

export function createShell(screens, onNavigate) {
  const who = h('span', { class: 'who' });
  const money = h('span', { class: 'chip-val money', title: 'Деньги' });
  const chromo = h('span', { class: 'chip-val chromo', title: 'Хромогрониты' });
  const sync = h('span', { class: 'sync', role: 'img' });
  const main = h('main', { class: 'main', id: 'main' });

  const nav = h('nav', { class: 'nav', 'aria-label': 'Разделы' },
    screens.map((s) => h('button', { dataset: { screen: s.id }, onclick: () => onNavigate(s.id) },
      h('i', { 'aria-hidden': 'true' }, s.icon), h('span', null, s.label))));

  const el = h('div', { class: 'shell' },
    h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, h('b', null, 'Бункер'), who),
      h('div', { class: 'wallet' }, money, chromo, sync)),
    h('div', { class: 'hazard' }),
    main,
    nav);

  return {
    el,
    main,
    setActive(id) {
      nav.querySelectorAll('button').forEach((b) => {
        const on = b.dataset.screen === id;
        b.classList.toggle('active', on);
        if (on) b.scrollIntoView({ inline: 'center', block: 'nearest' });
      });
    },
    updateTop(state) {
      who.textContent = state.nickname;
      money.textContent = `¤ ${fmt(state.wallet.money)}`;
      chromo.textContent = `◆ ${fmt(state.wallet.chromogroniti)}`;
    },
    setSync(status) {
      const [title, cls] = SYNC[status] ?? SYNC.local;
      sync.className = `sync ${cls}`;
      sync.title = title;
      sync.setAttribute('aria-label', title);
    },
  };
}

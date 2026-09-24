import { h } from '../core/dom.js';
import { getState, mutate } from '../core/state.js';
import { getItem, SHOP } from '../data/items.js';
import { buyItem, sellItem, sellAllJunk, junkValue, ownedCount } from '../game/economy.js';
import { fmt, fmtKg } from '../core/util.js';
import { chips, emptyState, statLine, section, refresh } from './common.js';
import { toast } from './toast.js';

let tab = 'buy';
let cat = 'ammo';

export function renderShop(root) {
  root.append(
    h('h2', { class: 'screen-title' }, 'Магазин'),
    chips([['buy', 'Купить'], ['sell', 'Продать']], tab, (v) => { tab = v; refresh(); }),
    tab === 'buy' ? buyView() : sellView());
}

function buyView() {
  const s = getState();
  const c = SHOP.find((x) => x.id === cat) ?? SHOP[0];
  return h('div', null,
    h('p', { class: 'muted' }, 'Покупки попадают в инвентарь. Что не влезло по месту или весу — уходит на склад.'),
    chips(SHOP.map((x) => [x.id, x.name]), c.id, (v) => { cat = v; refresh(); }),
    c.soon
      ? emptyState('Баффы появятся позже', 'Раздел уже на месте — наполним его, когда решим, какие баффы будут в игре.')
      : h('div', { class: 'rows' }, c.items.map((id) => shopRow(s, id))));
}

function shopRow(s, id) {
  const d = getItem(id);
  const bulk = d.stack > 1 ? Math.min(10, d.stack) : 0;
  const btn = (n) => h('button', {
    class: 'btn small', disabled: s.wallet.money < d.price * n,
    onclick: () => {
      const r = mutate((st) => buyItem(st, id, n));
      if (!r.ok) return toast(r.msg, 'warn');
      toast(`Куплено: ${d.name} ×${n}` + (r.toStash ? ` (на склад: ${r.toStash} — инвентарь полон)` : ''), 'ok');
    },
  }, `×${n} · ${fmt(d.price * n)}`);

  return h('div', { class: 'row' },
    h('div', { class: 'row-main' },
      h('b', null, d.name),
      h('small', null, [statLine(d), `масса ${fmtKg(d.weight)} кг`, `у тебя: ${ownedCount(s, id)}`].filter(Boolean).join(' · ')),
      d.desc ? h('small', { class: 'desc' }, d.desc) : null),
    h('div', { class: 'row-act' }, btn(1), bulk ? btn(bulk) : null));
}

function sellView() {
  const s = getState();
  const rows = [
    ...s.inventory.map((it) => ({ it, from: 'inventory' })),
    ...s.stash.map((it) => ({ it, from: 'stash' })),
  ].filter((r) => getItem(r.it.id).sell > 0);
  const invSum = junkValue(s, 'inventory');
  const stashSum = junkValue(s, 'stash');

  const sellAll = (from) => {
    const r = mutate((st) => sellAllJunk(st, from));
    toast(r.ok ? `Продано хлама на ¤ ${fmt(r.gained)}` : r.msg, r.ok ? 'ok' : 'warn');
  };

  return h('div', null,
    h('p', { class: 'muted' }, 'Здесь продаётся хлам. Оружие, броня и бартерные ресурсы не продаются.'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', disabled: !stashSum, onclick: () => sellAll('stash') }, `Весь хлам со склада · +${fmt(stashSum)}`),
      h('button', { class: 'btn ghost', disabled: !invSum, onclick: () => sellAll('inventory') }, `Из инвентаря · +${fmt(invSum)}`)),
    rows.length
      ? section(null, h('div', { class: 'rows' }, rows.map(({ it, from }) => {
          const d = getItem(it.id);
          const one = () => { const r = mutate((st) => sellItem(st, from, it.uid, 1)); toast(r.ok ? `Продано: ${d.name} (+${fmt(r.gained)})` : r.msg, r.ok ? 'ok' : 'warn'); };
          const all = () => { const r = mutate((st) => sellItem(st, from, it.uid)); toast(r.ok ? `Продано: ${d.name} ×${it.count} (+${fmt(r.gained)})` : r.msg, r.ok ? 'ok' : 'warn'); };
          return h('div', { class: 'row' },
            h('div', { class: 'row-main' },
              h('b', null, d.name),
              h('small', null, `${from === 'stash' ? 'склад' : 'инвентарь'} · ×${it.count} · ¤ ${fmt(d.sell)} за штуку`)),
            h('div', { class: 'row-act' },
              h('button', { class: 'btn small', onclick: one }, it.count > 1 ? 'Продать 1' : 'Продать'),
              it.count > 1 ? h('button', { class: 'btn small ghost', onclick: all }, 'Все') : null));
        })))
      : emptyState('Хлама нет', 'Его можно найти на спотах в открытом мире.'));
}

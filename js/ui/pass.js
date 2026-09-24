import { h } from '../core/dom.js';
import { getState, mutate } from '../core/state.js';
import { getItem, RARITY } from '../data/items.js';
import { PASS_REWARDS, PASS_SEASON_DAYS, passProgress } from '../data/pass.js';
import { claimPassReward } from '../game/pass.js';
import { fmt } from '../core/util.js';
import { rarityCss } from './common.js';
import { toast } from './toast.js';

const ACC = { grey: 'серую', blue: 'синюю', purple: 'фиолетовую', red: 'красную' };

export function rewardLabel(r) {
  if (r.type === 'money') return `¤ ${fmt(r.amount)}`;
  if (r.type === 'item') return `${getItem(r.id).name} ×${r.count}`;
  if (r.type === 'coupon') return `Скидка ${r.percent}% на ${ACC[r.rarity]} вещь`;
  return 'Красное оружие или броня на выбор';
}

export function renderPass(root) {
  const s = getState();
  const p = passProgress(s.pass.xp);
  const pct = p.need ? (p.into / p.need) * 100 : 100;

  root.append(
    h('h2', { class: 'screen-title' }, 'Боевой пропуск'),
    h('section', { class: 'panel pass-head' },
      h('div', null, h('b', { class: 'big' }, `Уровень ${p.level}`), h('small', null, ` из 25 · сезон ${s.pass.season} · ${PASS_SEASON_DAYS} дней`)),
      h('div', { class: 'bar' }, h('i', { style: { width: `${pct}%` } })),
      h('small', { class: 'muted' }, p.need ? `Опыт: ${p.into} / ${p.need} до следующего уровня` : 'Все уровни пройдены'),
      h('small', { class: 'muted' }, 'Опыт даётся за раунды и задания (появятся вместе с игрой). Бесплатный трек, бартерных ресурсов в наградах нет.')),
    h('div', { class: 'rows pass-rows' }, PASS_REWARDS.map((r, i) => {
      const lvl = i + 1;
      const claimed = s.pass.claimed.includes(lvl);
      const open = lvl <= p.level;
      const key = r.type === 'coupon' ? r.rarity : r.type === 'red_gear' ? 'red' : 'grey';
      return h('div', { class: 'row pass-row' + (claimed ? ' done' : open ? ' open' : ''), style: { '--rc': rarityCss(key) } },
        h('span', { class: 'lvl' }, lvl),
        h('div', { class: 'row-main' }, h('b', null, rewardLabel(r))),
        h('div', { class: 'row-act' },
          claimed ? h('small', { class: 'ok' }, 'Получено')
            : open ? h('button', { class: 'btn small', onclick: () => {
                const res = mutate((st) => claimPassReward(st, lvl));
                if (!res.ok) return toast(res.msg, 'warn');
                toast(res.reward.type === 'red_gear' ? 'Выбор красной вещи откроется вместе с углублённым бартером — награда сохранена' : `Получено: ${rewardLabel(res.reward)}`, 'ok');
              } }, 'Забрать')
            : h('small', { class: 'muted' }, 'Закрыто')));
    })));
}

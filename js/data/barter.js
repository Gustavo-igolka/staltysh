import { ARMOR_SECTIONS } from './armor.js';
import { getItem } from './items.js';

// Бартер: вкладка → подраздел → ветка (цепочка улучшений одной вещи).
// Сейчас в цепочке только первая (слабая) ступень — её покупают за деньги.
// Улучшения (серый → … → красный) добавим на этапе «углублённый бартер». Веток будет много — добавляй сюда.
export const BARTER_TABS = [
  { id: 'weapon', name: 'Оружие', sections: [
    { id: 'assault', name: 'Штурмовые', branches: [{ id: 'ar_rust', name: 'Ржавая', chain: ['w_ar_1'] }] },
    { id: 'sniper',  name: 'Снайперские', branches: [{ id: 'sn_hunt', name: 'Охотничья', chain: ['w_sn_1'] }] },
    { id: 'mg',      name: 'Пулемёты', branches: [{ id: 'mg_diy', name: 'Самодельная', chain: ['w_mg_1'] }] },
    { id: 'shotgun', name: 'Дробовики', branches: [{ id: 'sg_obrez', name: 'Обрез', chain: ['w_sg_1'] }] },
  ] },
  { id: 'secondary', name: 'Доп. оружие', sections: [
    { id: 'pistol', name: 'Пистолеты', branches: [{ id: 'pi_old', name: 'Старая', chain: ['w_pi_1'] }] },
    { id: 'smg',    name: 'Пистолеты-пулемёты', branches: [{ id: 'smg_diy', name: 'Самодельная', chain: ['w_smg_1'] }] },
  ] },
  { id: 'bags', name: 'Сумки', sections: [
    { id: 'backpack', name: 'Рюкзаки', branches: [{ id: 'bp_old', name: 'Старый', chain: ['bp_1'] }] },
    { id: 'bag',      name: 'Сумки и контейнеры', branches: [{ id: 'bag_belt', name: 'Поясная', chain: ['bag_1'] }] },
  ] },
  { id: 'armor', name: 'Броня', sections: ARMOR_SECTIONS },
];

export const allBranches = () =>
  BARTER_TABS.flatMap((t) => t.sections.flatMap((s) => s.branches));

export const isBarterItem = (id) => allBranches().some((b) => b.chain[0] === id);
export const branchOf = (rootId) => allBranches().find((b) => b.chain[0] === rootId);

// Все предметы ветки с явными ступенями (корень + всё, куда он улучшается). Пусто для веток старого типа.
export function branchItemIds(rootId) {
  const out = [];
  const walk = (id) => { if (out.includes(id)) return; out.push(id); (getItem(id).next ?? []).forEach(walk); };
  walk(rootId);
  return out;
}
export const isExplicitBranch = (rootId) => !!getItem(rootId).fixedTier;

// К какой ветке относится предмет (корень ветки) и какие предметы ведут в него
export const rootOf = (id) => allBranches().find((b) => branchItemIds(b.chain[0]).includes(id))?.chain[0] ?? null;
export const isBarterNode = (id) => rootOf(id) !== null;
export const parentsOf = (id) => {
  const root = rootOf(id);
  return root ? branchItemIds(root).filter((p) => (getItem(p).next ?? []).includes(id)) : [];
};

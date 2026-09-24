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
  { id: 'armor', name: 'Броня', sections: [
    { id: 'combat', name: 'Боевая', note: 'Против пуль, разрывов и взрывов.', branches: [
      { id: 'com_light', name: 'Лёгкая', chain: ['a_light_1'] },
      { id: 'com_med', name: 'Средняя', chain: ['a_med_1'] },
      { id: 'com_heavy', name: 'Тяжёлая', chain: ['a_heavy_1'] },
    ] },
    { id: 'science', name: 'Научная', note: 'Защита от заражений. Только научная броня может закрыть 4 уровень зоны или сразу все заражения на 3 уровне.', branches: [
      { id: 'sci_suit', name: 'Комбинезон', chain: ['a_sci_1'] },
      { id: 'sci_iso', name: 'Изолятор', chain: ['a_sci_2'] },
    ] },
    { id: 'combo', name: 'Комбинированная', note: 'Что-то среднее между боевой и научной.', branches: [
      { id: 'mix_jacket', name: 'Куртка', chain: ['a_mix_1'] },
      { id: 'mix_field', name: 'Полевая', chain: ['a_mix_2'] },
    ] },
  ] },
];

export const allBranches = () =>
  BARTER_TABS.flatMap((t) => t.sections.flatMap((s) => s.branches));

export const isBarterItem = (id) => allBranches().some((b) => b.chain[0] === id);

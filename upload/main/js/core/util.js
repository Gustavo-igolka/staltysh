// Мелкие общие функции
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
export const fmtKg = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

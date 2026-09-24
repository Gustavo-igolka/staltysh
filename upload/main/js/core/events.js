// Крошечная шина событий: on('имя', fn) / emit('имя', данные)
const handlers = new Map();

export function on(name, fn) {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name).add(fn);
  return () => handlers.get(name)?.delete(fn);
}

export function emit(name, data) {
  handlers.get(name)?.forEach((fn) => {
    try { fn(data); } catch (e) { console.error(`[events] ${name}`, e); }
  });
}

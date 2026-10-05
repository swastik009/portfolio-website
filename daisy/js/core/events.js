// Tiny pub/sub. Handlers are isolated: one throwing never blocks the rest.
export function createBus() {
  const handlers = new Map();
  const bus = {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
    once(type, fn) {
      const off = bus.on(type, (payload) => { off(); fn(payload); });
      return off;
    },
    emit(type, payload) {
      for (const fn of [...(handlers.get(type) ?? [])]) {
        try { fn(payload); } catch (err) { console.error(`[bus] "${type}" handler failed`, err); }
      }
    },
  };
  return bus;
}

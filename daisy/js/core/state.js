// The single source of game state. Everything else reads it and changes it via set/add/push.
export const START_CLOCK = 23 * 60 + 2; // 11:02 PM, Dec 31 1999
export const MIDNIGHT = 24 * 60;

export function defaultState() {
  return {
    version: 1,
    handle: '',
    act: 1,
    beat: 0,
    flags: {},
    logsFound: [],
    trust: 0,
    suspicion: 0,
    clock: START_CLOCK,
    growth: 0, // Daisy: 0 = weak and colourless … 1 = full strength, the city's red
    barksSeen: [],
    transcript: [],
    settings: { quality: 'high', volume: { master: 0.9, music: 0.6, sfx: 0.9, ambience: 0.7, voice: 1 } },
  };
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function createStore(bus, initial = defaultState()) {
  let state = structuredClone(initial);
  const store = {
    get(path) { return path ? getPath(state, path) : state; },
    set(path, value) {
      const keys = path.split('.');
      let o = state;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      const last = keys.at(-1);
      const prev = o[last];
      if (Object.is(prev, value)) return;
      o[last] = value;
      bus.emit('state:change', { path, value, prev });
    },
    add(path, n) { store.set(path, (store.get(path) ?? 0) + n); },
    push(path, item) {
      const arr = store.get(path) ?? [];
      if (arr.includes(item)) return false;
      store.set(path, [...arr, item]);
      return true;
    },
    snapshot() { return structuredClone(state); },
    replace(next) {
      state = structuredClone(next);
      bus.emit('state:replace', state);
    },
  };
  return store;
}

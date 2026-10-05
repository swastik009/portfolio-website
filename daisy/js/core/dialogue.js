// Data-driven dialogue. Conditions read state; choices change it through the store.
import { getPath } from './state.js';

export function evalCond(cond, state) {
  if (!cond) return true;
  return Object.entries(cond).every(([path, test]) => {
    const v = getPath(state, path);
    const num = Array.isArray(v) ? v.length : (v ?? 0);
    return Object.entries(test).every(([op, x]) => {
      switch (op) {
        case 'eq': return Array.isArray(v) ? v.length === x : v === x;
        case 'ne': return Array.isArray(v) ? v.length !== x : v !== x;
        case 'gte': return num >= x;
        case 'lte': return num <= x;
        case 'has': return Array.isArray(v) && v.includes(x);
        case 'truthy': return Boolean(v) === x;
        default: throw new Error(`unknown op "${op}" in condition on "${path}"`);
      }
    });
  });
}

export function interpolate(text, state) {
  return text.replace(/\{(\w+(?:\.\w+)*)\}/g, (m, path) => {
    const v = getPath(state, path);
    return v == null ? m : String(v);
  });
}

export function createDialogue(nodes) {
  const byId = new Map();
  for (const n of nodes) {
    if (byId.has(n.id)) throw new Error(`duplicate dialogue id "${n.id}"`);
    byId.set(n.id, n);
  }
  const api = {
    has: (id) => byId.has(id),
    node(id) {
      const n = byId.get(id);
      if (!n) throw new Error(`unknown dialogue node "${id}"`);
      return n;
    },
    lines(id, state) {
      return api.node(id).lines
        .filter((l) => evalCond(l.if, state))
        .map((l) => ({
          ...l,
          text: interpolate(l.text, state),
          choices: l.choices?.filter((c) => evalCond(c.if, state)).map((c) => ({ ...c, text: interpolate(c.text, state) })),
        }));
    },
  };
  return api;
}

export function applyChoice(choice, store) {
  for (const [path, n] of Object.entries(choice.add ?? {})) store.add(path, n);
  for (const [path, v] of Object.entries(choice.set ?? {})) store.set(path, v);
  return choice.next ?? null;
}

export function validateDialogue(nodes) {
  const errors = [];
  const ids = new Set();
  for (const n of nodes) {
    if (ids.has(n.id)) errors.push(`duplicate dialogue id "${n.id}"`);
    ids.add(n.id);
  }
  for (const n of nodes) {
    if (!n.lines?.length) errors.push(`node "${n.id}" has no lines`);
    if (n.next && !ids.has(n.next)) errors.push(`node "${n.id}" next -> "${n.next}" missing`);
    (n.lines ?? []).forEach((l, i) => {
      if (l.choices?.length && i !== n.lines.length - 1) errors.push(`node "${n.id}": choices must be on the last line`);
    });
    for (const l of n.lines ?? []) {
      for (const c of l.choices ?? []) {
        if (c.next && !ids.has(c.next)) errors.push(`node "${n.id}" choice "${c.text}" -> "${c.next}" missing`);
      }
    }
  }
  return errors;
}

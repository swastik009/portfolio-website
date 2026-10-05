export function formatClock(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  return `${h24 % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

export function keySound(key, rand = Math.random) {
  if (key === 'Enter') return 'key_enter';
  if (key === ' ') return 'key_space';
  return `key_${1 + Math.floor(rand() * 4)}`;
}

// FRAG01.BIN arriving over a thin line: fast at first, then crawling. Only the telco login finishes it.
export const transferPct = (s) => Math.min(99, Math.floor(99 * (1 - Math.exp(-Math.max(0, s) / 240))));

// How much film the frame wears: grain thickens and colour drains as the story clock nears midnight. Pure.
import { START_CLOCK, MIDNIGHT } from '../core/state.js';

export function filmForClock(clock) {
  const c = Number.isFinite(clock) ? clock : START_CLOCK;
  const k = Math.max(0, Math.min(1, (c - START_CLOCK) / (MIDNIGHT - START_CLOCK)));
  return { grain: Math.round((0.09 + k * 0.07) * 1000) / 1000, drain: Math.round(k * 0.35 * 1000) / 1000 };
}

import { evalCond } from '../../core/dialogue.js';

export function pickBark(barks, trigger, state) {
  const seen = state.barksSeen ?? [];
  return barks.find((b) => b.trigger === trigger && (b.repeat || !seen.includes(b.id)) && evalCond(b.if, state)) ?? null;
}

const LEET = { o: '0', e: '3', a: '4', i: '1', s: '5' };
// Daisy's early "broken" voice: random case flips and digit swaps, same length so typing rhythm stays intact.
export function glitchText(text, rand = Math.random, amount = 0.25) {
  return [...text].map((ch) => {
    if (rand() >= amount) return ch;
    const lower = ch.toLowerCase();
    if (LEET[lower] && rand() < 0.5) return LEET[lower];
    return ch === lower ? ch.toUpperCase() : lower;
  }).join('');
}

// Daisy's conversation survives a resume: we keep the last `cap` lines in state.
export function appendTranscript(list, entry, cap = 80) {
  return [...(list ?? []), entry].slice(-cap);
}

// Daisy's status lines: "/ thinking…" spins, then settles to "(thought for 4s)" or the line's own `done` text.
export const SPIN = ['/', '-', '\\', '|'];
export const thinkDone = (label, ms, done) => done ?? (label === 'thinking' ? `thought for ${Math.max(1, Math.round(ms / 1000))}s` : label);

// The wake puzzle: tune into the hum, then sing "Daisy Bell" back to it, five rounds from two notes to a whole line,
// slow to fast. A wrong note replays that round. Pure.
import { DAISY_MELODY, noteToFreq } from '../core/synths.js';

export const TUNE = { target: 0.73, width: 0.05 };
const line = (a, b) => DAISY_MELODY.slice(a, b).map((n) => n.note);
// dur: how long it hums each note (s). 1–2 are easy, 3 is the turn, 4–5 are long and quick.
export const ROUNDS = [
  { notes: line(0, 2), dur: 0.8 },  // Dai-sy
  { notes: line(0, 4), dur: 0.7 },  // Dai-sy, Dai-sy
  { notes: line(4, 10), dur: 0.45 }, // give me your answer do
  { notes: line(10, 18), dur: 0.3 }, // I'm half crazy, all for the love
  { notes: line(0, 10), dur: 0.26 }, // the whole first line
];
// The keys, low to high: every note the rounds use.
export const KEYS = [...new Set(ROUNDS.flatMap((r) => r.notes))].sort((a, b) => noteToFreq(a) - noteToFreq(b));

export function clarity(v, { target, width } = TUNE) {
  const d = Math.abs((Number.isFinite(v) ? v : 0) - target);
  return Math.max(0, 1 - d / (width * 3));
}
export const isTuned = (v, t = TUNE) => Math.abs(v - t.target) <= t.width;

export function createEcho(phrase) {
  let i = 0;
  return {
    get index() { return i; },
    reset() { i = 0; },
    press(note) {
      if (i >= phrase.length) return 'done';
      if (note !== phrase[i]) { i = 0; return 'wrong'; }
      i++;
      return i === phrase.length ? 'done' : 'ok';
    },
  };
}

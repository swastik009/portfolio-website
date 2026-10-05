// Daisy's body: a 2D pixel blob. Physics (bounce, squash, lean), palette (colourless → the city's red) and faces. Pure.
export const SIZE = 48; // logical pixels; the chat window shows it at 3x
export const FLOOR = 38; // rows below hold her reflection
const G = 420; // px/s²

// Faces and bodies as data. lid: 0 open … 1 shut; tilt: + raises the inner lid ends (pleading), − lowers them (anger).
export const MOODS = {
  asleep: { eye: 'dot', ew: 3, eh: 4, lid: 1, tilt: 0, glints: 0, mouth: 'none', rest: 0.8, track: 0, breathe: 0.035, breatheHz: 0.25, hops: 0, glitchy: 0.08 },
  weak: { eye: 'dot', ew: 3, eh: 4, lid: 0.5, tilt: -0.15, glints: 1, mouth: 'none', rest: 0.88, track: 0.35, breathe: 0.025, breatheHz: 0.35, hops: 0, sway: 0.6, glitchy: 0.22 },
  calm: { eye: 'dot', ew: 3, eh: 4, lid: 0.2, tilt: 0, glints: 1, mouth: 'none', rest: 1, track: 3, breathe: 0.015, breatheHz: 0.4, hops: 0 },
  happy: { eye: 'arc', ew: 5, eh: 3, lid: 0, tilt: 0, glints: 0, mouth: 'smile', rest: 1.02, track: 6, breathe: 0.02, breatheHz: 0.7, hops: 0.35 },
  sad: { eye: 'dot', ew: 3, eh: 4, lid: 0.35, tilt: 0.5, glints: 1, mouth: 'frown', rest: 0.9, track: 1, breathe: 0.02, breatheHz: 0.3, hops: 0 },
  puppy: { eye: 'dot', ew: 5, eh: 6, lid: 0, tilt: 0.45, glints: 2, mouth: 'wobble', rest: 1.06, track: 5, breathe: 0.012, breatheHz: 0.9, hops: 0, tremble: 1 },
  generous: { eye: 'arc', ew: 3, eh: 2, lid: 0, tilt: 0, glints: 0, mouth: 'smile', rest: 1, track: 2, breathe: 0.02, breatheHz: 0.45, hops: 0, sway: 0.8, blush: 1 },
  sly: { eye: 'dot', ew: 3, eh: 4, lid: 0.45, tilt: -0.25, glints: 1, mouth: 'smirk', rest: 0.98, track: 4, breathe: 0.012, breatheHz: 0.4, hops: 0 },
  surprised: { eye: 'white', ew: 5, eh: 6, pupil: 2, lid: 0, tilt: 0, glints: 0, mouth: 'o', rest: 1.1, track: 6, breathe: 0.01, breatheHz: 1, hops: 0 },
  scared: { eye: 'white', ew: 5, eh: 6, pupil: 1, lid: 0, tilt: 0.45, glints: 0, mouth: 'wobble', rest: 0.82, track: 9, breathe: 0.02, breatheHz: 2, hops: 0, shiver: 0.5 },
  sleepy: { eye: 'line', ew: 4, eh: 3, lid: 0, tilt: 0, glints: 0, mouth: 'none', rest: 0.84, track: 0.2, breathe: 0.04, breatheHz: 0.22, hops: 0, sway: 0.4 },
  dizzy: { eye: 'x', ew: 3, eh: 3, lid: 0, tilt: 0, glints: 0, mouth: 'wobble', rest: 0.94, track: 0, breathe: 0.01, breatheHz: 0.5, hops: 0, sway: 2.2, swayHz: 4 },
  angry: { eye: 'dot', ew: 4, eh: 4, lid: 0.35, tilt: -0.65, glints: 0, mouth: 'grit', rest: 0.94, track: 8, breathe: 0.03, breatheHz: 1.4, hops: 0, shiver: 0.2 },
  furious: { eye: 'white', ew: 5, eh: 5, pupil: 1, lid: 0.25, tilt: -0.75, glints: 0, mouth: 'roar', rest: 1.12, track: 14, breathe: 0.04, breatheHz: 2.4, hops: 0, shiver: 0.7, spikes: 1 },
  // The eerie one: no blink, no breath, pupils that snap to you, a grin too wide for the face.
  stare: { eye: 'white', ew: 4, eh: 4, pupil: 1, lid: 0, tilt: 0, glints: 0, mouth: 'grin', rest: 1, track: 40, breathe: 0, breatheHz: 0, hops: 0, noBlink: 1 },
};

export function createBody() {
  return { y: 0, vy: 0, air: false, s: 1, vs: 0, lean: 0, vlean: 0, x: 0, vx: 0, windup: 0 };
}

const spring = (v, x, target, k, c, dt) => v + (-k * (x - target) - c * v) * dt;

// One physics step. rest: the squash the body settles at (a weak blob sags). leanTo: the lean it is pulled toward.
export function stepBody(b, dt, { rest = 1, leanTo = 0 } = {}) {
  if (b.windup > 0) { // anticipation: crouch, then launch
    b.windup -= dt;
    if (b.windup <= 0) { b.air = true; b.vy = b.launch; }
  }
  let target = b.windup > 0 ? rest * 0.72 : rest;
  if (b.air) {
    b.vy -= G * dt;
    b.y += b.vy * dt;
    target = 1 + Math.min(0.3, Math.abs(b.vy) * 0.0028); // stretch with speed
    if (b.y <= 0) {
      const impact = -b.vy;
      b.y = 0;
      b.vs -= impact * 0.06; // the landing squash
      if (impact > 45) b.vy = impact * 0.32; // a real, smaller second bounce
      else { b.vy = 0; b.air = false; }
    }
  }
  b.vs = spring(b.vs, b.s, target, 260, 9, dt);
  b.s = Math.max(0.55, Math.min(1.45, b.s + b.vs * dt));
  b.vlean = spring(b.vlean, b.lean, leanTo, 160, 10, dt);
  b.lean += b.vlean * dt;
  b.vx = spring(b.vx, b.x, 0, 30, 7, dt);
  b.x += b.vx * dt;
  return b;
}

export function hop(b, height = 14) {
  if (b.air || b.windup > 0) return b;
  b.launch = Math.sqrt(2 * G * height);
  b.windup = 0.09;
  return b;
}

// Poked: thrown sideways, away from the poke, leaning back.
export function poke(b, dir) {
  b.vx += -dir * 70;
  b.vlean += -dir * 9;
  b.vs -= 2.2;
  return b;
}

// The nudge: she bumps toward something (the cursor, your hand) — wanting attention.
export function nudge(b, dir) {
  b.vx += dir * 45;
  b.vlean += dir * 6;
  b.vs += 1.2;
  return b;
}

// Where the pupils sit, in whole pixels: the cursor direction, clamped to the eye.
export function pupilOffset(look, ew, eh) {
  const rx = Math.max(1, Math.floor(ew / 2)), ry = Math.max(1, Math.floor(eh / 2) - 1);
  return { x: Math.round(Math.max(-1, Math.min(1, look.x)) * rx), y: Math.round(Math.max(-1, Math.min(1, look.y)) * ry) };
}

export const stepLook = (cur, target, dt, rate) => {
  const k = 1 - Math.exp(-dt * rate);
  return { x: cur.x + (target.x - cur.x) * k, y: cur.y + (target.y - cur.y) * k };
};

// The colour: 0 = colourless (Chapter 1), 1 = the city's red. Tones: shadow, mid, light, highlight, ink.
const PALE = ['#5d5966', '#8d8996', '#b9b5c1', '#e2dfe6', '#14111a'];
const RED = ['#5c0b10', '#a8181a', '#ff2a1f', '#ff9a7c', '#1a0508'];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function palette(t) {
  const k = Math.max(0, Math.min(1, Number(t) || 0)); // saves from before growth existed have none: colourless, never NaN-black
  return PALE.map((p, i) => { const a = rgb(p), b = rgb(RED[i]); return a.map((v, j) => Math.round(v + (b[j] - v) * k)); });
}

// Stable per-cell noise in body space, so the fur moves with her and never shimmers.
export function hash(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// How she breaks while she is still weak. Spontaneous ones are chosen from these.
export const GLITCHES = ['tear', 'dropout', 'invert', 'freeze', 'ghost', 'scan', 'shift'];

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);

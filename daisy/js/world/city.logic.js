// Pure city math: the monorail coasting to rest when the power dies, and the far-to-near blackout wave.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const trainStopDistance = (v0, tau) => v0 * tau;
export const trainStopPos = (z0, v0, tau, t) => z0 - v0 * tau * (1 - Math.exp(-t / tau));
export const trainStopTime = (tau, eps = 0.05, v0) => (v0 <= eps ? 0 : tau * Math.log(v0 / eps));
export const BLACKOUT_STAGES = [
  { id: 'skyline', xMin: 40, xMax: Infinity, dist: 900 },
  { id: 'mid', xMin: 24, xMax: 40, dist: 400 },
  { id: 'street', xMin: -Infinity, xMax: Infinity, dist: 60 },
  { id: 'pub', xMin: 8, xMax: 12, dist: 25 },
  { id: 'across', xMin: 8, xMax: 16, dist: 15 },
];
// After the blackout only his patch comes back; the rest of the city stays dark (CNNet: "a few scattered neighborhoods").
export const STAYS_DARK = ['skyline', 'mid'];
export const soundDelay = (dist) => dist / 343;
export const lowpassFor = (dist) => clamp(18000 / (1 + dist / 40), 600, 18000);
export const stageLevel = (from, to, p) => clamp(from + (to - from) * p, 0, 1);
// Stereo position of the train for its z (Three: +z is right of the window): smooth, full right/left by ±45 m.
export const trainPan = (z) => 0.9 * Math.tanh(z / 25);
// A slight, distant thunderstorm: a strike every 40–90 s, 2–3 flickers in the cloud, thunder after dist / 343 s
// (strikes 0.5–2 km out, so 1.5–6 s), quieter the farther it is.
export function nextLightning(rand = Math.random) {
  const dist = 515 + rand() * 1540;
  const n = rand() < 0.5 ? 2 : 3;
  let at = 0;
  const flickers = Array.from({ length: n }, (_, i) => {
    const f = { at, peak: i === 0 ? 0.6 + rand() * 0.4 : 0.3 + rand() * 0.5 };
    at += 0.08 + rand() * 0.18;
    return f;
  });
  return { wait: 40 + rand() * 50, flickers, dist, thunderDelay: dist / 343, gain: 0.95 - (dist / 2055) * 0.35, variant: rand() < 0.5 ? 1 : 2 };
}

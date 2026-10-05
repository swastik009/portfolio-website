// The club sign down the street blinks on its own rhythm, so the room never settles. Deterministic so screenshots are
// repeatable. Pure.
export function clubLevel(t) {
  const period = 0.8;
  const cycle = Math.floor(t / period);
  const ph = t - cycle * period;
  if (cycle % 4 === 3) return ph < 0.15 || (ph > 0.3 && ph < 0.45) ? 1 : 0;
  return ph < 0.45 ? 1 : 0;
}

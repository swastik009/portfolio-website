// Where each of Daisy's eyes looks. Cursor when you move, the camera (you) when you stop, away when it lies. Pure.
export const IDLE_STARE_S = 3;
const unit = (v) => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));

export function gazeTarget(cursor, idleSeconds, averting) {
  if (averting) return { x: (cursor?.x ?? 0) >= 0 ? -0.9 : 0.9, y: -0.7 };
  if (idleSeconds >= IDLE_STARE_S) return { x: 0, y: 0 };
  return { x: unit(cursor?.x), y: unit(cursor?.y) };
}

export function stepGaze(cur, target, dt, lag) {
  const k = 1 - Math.exp(-dt / Math.max(0.001, lag));
  return { x: cur.x + (target.x - cur.x) * k, y: cur.y + (target.y - cur.y) * k };
}

export const nextBlinkIn = (rand = Math.random) => 1.5 + rand() * 5.5;

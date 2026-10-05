// Camera maths for looking around the room and the desktop parallax. Pure.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const unit = (v) => clamp(Number.isFinite(v) ? v : 0, -1, 1);

export function parallaxOffset(nx, ny, { reduced = false, x = 0.006, y = 0.004 } = {}) {
  if (reduced) return { x: 0, y: 0 };
  return { x: unit(nx) * x, y: unit(ny) * y };
}

// Seated at the desk: yaw 0 faces the desk (-Z); positive yaw turns left toward the bed and TV; negative toward
// the window. Pitch up to the decorations on the ceiling, down to the floor.
export const LOOK_LIMITS = { yaw: [-1.25, 2.35], pitch: [-0.7, 1.2] };

export function clampLook({ yaw, pitch }, L = LOOK_LIMITS) {
  return { yaw: clamp(yaw, L.yaw[0], L.yaw[1]), pitch: clamp(pitch, L.pitch[0], L.pitch[1]) };
}
export const dragLook = (look, dx, dy, sens = 0.004) => clampLook({ yaw: look.yaw - dx * sens, pitch: look.pitch - dy * sens });
export const lookDir = (yaw, pitch) => ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
export function lookTarget(pos, yaw, pitch, dist = 2) {
  const d = lookDir(yaw, pitch);
  return { x: pos.x + d.x * dist, y: pos.y + d.y * dist, z: pos.z + d.z * dist };
}
export const escAction = ({ inspecting, looking }) => (inspecting ? 'close-inspect' : looking ? 'exit-look' : 'none');

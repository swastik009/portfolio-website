// Phone numbers as players type them: dashes, spaces, dots, a leading 1. Pure.
export const normalizeNumber = (s) => String(s ?? '').replace(/\D/g, '');
export function sameNumber(a, b) {
  const x = normalizeNumber(a), y = normalizeNumber(b);
  return x.length >= 7 && y.length >= 7 && x.slice(-7) === y.slice(-7);
}

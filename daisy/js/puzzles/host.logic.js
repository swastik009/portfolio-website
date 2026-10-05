export function nextHint(hints, level) {
  if (!hints.length) return null;
  const i = Math.min(level, hints.length - 1);
  return { text: hints[i], level: Math.min(level + 1, hints.length) };
}

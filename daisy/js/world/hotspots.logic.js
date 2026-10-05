// Things in the room you can pick up. Data lives in data/room.json; this checks it and finds entries. Pure.
export function validateHotspots(data, nodeNames) {
  const errors = [];
  const ids = new Set();
  for (const h of data?.hotspots ?? []) {
    if (ids.has(h.id)) errors.push(`duplicate hotspot id "${h.id}"`);
    ids.add(h.id);
    if (!Array.isArray(h.nodes) || !h.nodes.length) errors.push(`${h.id}: needs nodes`);
    for (const n of h.nodes ?? []) if (!nodeNames.includes(n)) errors.push(`${h.id}: unknown room node "${n}"`);
    if (typeof h.title !== 'string' || !h.title) errors.push(`${h.id}: needs a title`);
    if (!h.back && !h.note && !h.subtitle?.length && !h.messages?.length && !h.toggle) errors.push(`${h.id}: needs note, back, subtitle or toggle`);
  }
  return errors;
}
// The answering machine's tape: the messages that have arrived so far (each `needs` a flag), oldest first.
export const messagesFor = (h, get) => (h?.messages ?? []).filter((m) => !m.needs || get(m.needs));
// Game clock (minutes past midnight) as the machine's display shows it.
export const clockLabel = (min) => `${(Math.floor(min / 60) % 12) || 12}:${String(min % 60).padStart(2, '0')} ${min >= 720 ? 'PM' : 'AM'}`;
export const hotspotById = (data, id) => (data?.hotspots ?? []).find((h) => h.id === id) ?? null;
// A recorded message's captions: { at, text } entries keep their times (seconds into the recording); plain strings are
// spread over `duration` by length. Returns [{ at, text }] in order.
export function subtitleCues(lines, duration) {
  if (lines.every((l) => typeof l === 'object')) return lines.map(({ at, text }) => ({ at, text }));
  const total = lines.reduce((n, l) => n + l.length, 0);
  let at = 0;
  return lines.map((text) => { const c = { at, text }; at += (duration * text.length) / total; return c; });
}

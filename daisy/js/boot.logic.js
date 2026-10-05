export function normalizeHandle(raw) {
  const s = String(raw ?? '').replace(/[^\x20-\x7E\t\n\r]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || 'ANON';
}

export function formatSavedAt(ms) {
  const d = new Date(ms);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, ' '); // ICU uses U+202F before AM/PM
  return `${date}, ${time}`;
}

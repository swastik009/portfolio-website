// Internet Voyager's address bar: what people type → a page we have, or "cannot find server". Pure.
export function normalizeUrl(input) {
  let s = String(input ?? '').trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, '').replace(/[?#].*$/, '').replace(/\/{2,}/g, '/');
  s = s.replace(/\/(index|default)\.html?$/, '/');
  if (s && !s.includes('/')) s += '/';
  return s;
}

// The web as it is right now: a page with `needs` exists only once that flag is set; `when` swaps in another file once a
// flag is set ({ "flags.blackout": "cnnet-dark.html" }). get(path) reads the game state.
export function pagesNow(pages, get) {
  return Object.fromEntries(Object.entries(pages).filter(([, p]) => !p.needs || get(p.needs)).map(([u, p]) => {
    const swap = Object.entries(p.when ?? {}).find(([flag]) => get(flag));
    return [u, swap ? { ...p, file: swap[1] } : p];
  }));
}

export function resolveUrl(input, pages) {
  const url = normalizeUrl(input);
  if (!url) return { url: '', page: null };
  for (const u of [url, `${url}/`, `www.${url}`, `www.${url}/`]) if (pages[u]) return { url: u, page: pages[u] };
  return { url, page: null };
}

export const linksIn = (html) => [...String(html).matchAll(/href="([^"]+)"/gi)].map((m) => normalizeUrl(m[1]));

// Pages may greet the player: {handle} is filled in by the browser, escaped, so a page is only ever text.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const fillPage = (html, handle) => String(html).replaceAll('{handle}', String(handle).replace(/[&<>"]/g, (c) => ESC[c]));

// A file is received once per session, however often RECEIVE is clicked.
export function downloadGuard() {
  const seen = new Set();
  return { start: (file) => (seen.has(file) ? false : (seen.add(file), true)) };
}

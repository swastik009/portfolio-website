// Dev jump panel (localhost only). Press ` or ~ (or click the DEV tab on the right edge) to open: every beat of act 1; click one and the game reloads with a
// save at the start of that beat (flags and clock as if you'd played up to it). Click RESUME on the title.
import { jumpState, beatLabel } from './core/jump.logic.js';
import { SAVE_KEY } from './core/save.js';

export function installDevPanel() {
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return; // never on the published demo
  // The jump rides through the reload in sessionStorage and lands here, before boot reads the save: the game's own
  // autosave fires as the old page hides and would otherwise write your old progress over it.
  const jump = sessionStorage.getItem('daisy.jump');
  if (jump) { localStorage.setItem(SAVE_KEY, jump); sessionStorage.removeItem('daisy.jump'); }
  let el = null;
  let act = null;
  const toggle = async () => {
    if (el) { el.remove(); el = null; return; }
    act ??= await (await fetch('data/acts/act1.json')).json();
    if (el) return; // a second press landed while the beats were loading
    const saved = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY))?.state; } catch { return null; } })();
    el = Object.assign(document.createElement('nav'), { className: 'devpanel' });
    el.innerHTML = '<b>JUMP TO BEAT</b><small>click a beat, then RESUME on the title · ` closes</small>';
    const go = (i, from) => {
      sessionStorage.setItem('daisy.jump', JSON.stringify({ version: 1, savedAt: Date.now(), state: jumpState(act, i, saved?.handle || 'acidburn') }));
      if (from) sessionStorage.setItem('daisy.from', from); else sessionStorage.removeItem('daisy.from');
      location.replace(location.pathname);
    };
    const at = (id) => act.beats.findIndex((b) => b.id === id);
    for (const [label, id, from] of [['▶ Swastik Presents', 'coldopen', 'credit'], ['▶ Blackout', 'blackout'], ['▶ Finale: the mail', 'chapterEnd', 'mail']]) {
      const btn = Object.assign(document.createElement('button'), { className: 'shortcut', textContent: label });
      btn.addEventListener('click', () => go(at(id), from));
      el.append(btn);
    }
    el.append(document.createElement('hr'));
    act.beats.forEach((b, i) => {
      const btn = Object.assign(document.createElement('button'), { textContent: beatLabel(b, i) });
      if (i === saved?.beat) btn.classList.add('now');
      btn.addEventListener('click', () => go(i));
      el.append(btn);
    });
    document.body.append(el);
  };
  const tab = Object.assign(document.createElement('button'), { className: 'devtab', textContent: 'DEV' });
  tab.addEventListener('click', toggle);
  document.body.append(tab);
  addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' && e.key !== '`' && e.key !== '~') return; // by key position too, so any layout works
    e.preventDefault();
    e.stopImmediatePropagation();
    toggle();
  }, true);
}

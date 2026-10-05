// Pre-game screens. All player-supplied text goes through textContent.
import { gsap } from 'gsap';
import { normalizeHandle, formatSavedAt } from './boot.logic.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const make = (cls, html = '') => Object.assign(document.createElement('div'), { className: cls, innerHTML: html });

// The loader: a studio card. The wordmark, a hairline that fills, what is loading, and once everything is in, a
// CONTINUE at the bottom (the click is also the browser's first user gesture, so audio can start).
export function showLoader(overlay) {
  const el = make('loader', `
    <div class="loader-card">
      <p class="loader-mark">DAISY</p>
      <div class="loader-bar"><i></i></div>
      <p class="loader-row"><span class="loader-what">Loading</span><span class="loader-pct">0%</span></p>
    </div>
    <p class="loader-line">WEB DEMO &nbsp;|&nbsp; BETA</p>
    <button class="loader-go" hidden><span>CONTINUE</span></button>`);
  overlay.append(el);
  const bar = el.querySelector('.loader-bar i');
  const pct = el.querySelector('.loader-pct');
  const what = el.querySelector('.loader-what');
  gsap.from(el.querySelectorAll('.loader-mark, .loader-bar, .loader-row, .loader-line'), { opacity: 0, y: 6, duration: 1.4, stagger: 0.18, ease: 'power2.out' });
  let value = 0;
  const shown = { v: 0 };
  const draw = () => { bar.style.transform = `scaleX(${shown.v})`; pct.textContent = `${Math.round(shown.v * 100)}%`; };
  return {
    progress(p, label) {
      value = Math.max(value, Math.min(1, p));
      if (label) what.textContent = label;
      gsap.to(shown, { v: value, duration: 0.5, ease: 'power2.out', overwrite: true, onUpdate: draw });
    },
    // Everything is in: the bar settles full, CONTINUE appears; resolves on click / Enter / Space.
    async ready() {
      value = 1;
      what.textContent = 'Ready';
      await gsap.to(shown, { v: 1, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: draw });
      const go = el.querySelector('.loader-go');
      go.hidden = false;
      gsap.fromTo(go, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' });
      go.focus({ preventScroll: true });
      await new Promise((resolve) => {
        const done = () => { removeEventListener('keydown', onKey); resolve(); };
        const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(); } };
        addEventListener('keydown', onKey);
        go.addEventListener('click', done, { once: true });
      });
    },
    async close() {
      await gsap.to(el, { opacity: 0, duration: 1.4, ease: 'power2.inOut' });
      el.remove();
    },
  };
}

// The menu over a live shot of the room. Big type on the right, tilted into the scene; the mouse moves the camera
// and the type a little against each other. Resolves 'resume' | 'new'. SETTINGS and CREDITS open panels in place.
export function showMenu(overlay, { save, store, audio, room, credits = '' }) {
  return new Promise((resolve) => {
    const canResume = save.status === 'ok';
    const el = make('menu', `
      <div class="menu-stage">
        <p class="menu-kicker">Dec 31 1999 · 11:02 PM</p>
        <h1 class="menu-title">DAISY</h1>
        <nav class="menu-list">
          ${canResume ? '<button data-choice="resume"><span>Resume</span><small></small></button>' : ''}
          <button data-choice="new"><span>New game</span></button>
          <button data-choice="settings"><span>Settings</span></button>
          <button data-choice="credits"><span>Credits</span></button>
        </nav>
      </div>
      <section class="menu-panel" hidden></section>
      <p class="menu-foot">Headphones recommended</p>`);
    if (canResume) el.querySelector('[data-choice=resume] small').textContent = `saved ${formatSavedAt(save.savedAt)}`;
    overlay.append(el);
    const stage = el.querySelector('.menu-stage');
    const panel = el.querySelector('.menu-panel');
    const items = [...el.querySelectorAll('.menu-list button')];
    gsap.from([el.querySelector('.menu-kicker'), el.querySelector('.menu-title'), ...items, el.querySelector('.menu-foot')],
      { opacity: 0, x: 40, duration: 1.4, stagger: 0.09, ease: 'power3.out', delay: 0.4 });

    // Parallax: the camera drifts with the mouse, the type the other way.
    const par = { x: 0, y: 0 };
    const onMove = (e) => {
      const nx = (e.clientX / innerWidth) * 2 - 1, ny = (e.clientY / innerHeight) * 2 - 1;
      room.setParallax(nx * 2.2, -ny * 2.2);
      gsap.to(par, { x: -nx * 14, y: -ny * 10, duration: 1.2, ease: 'power2.out', overwrite: true,
        onUpdate: () => { stage.style.setProperty('--px', `${par.x}px`); stage.style.setProperty('--py', `${par.y}px`); } });
    };
    addEventListener('pointermove', onMove);

    const tick = () => audio.sfx('menu_hover', { gain: 0.5 });
    items.forEach((b) => { b.addEventListener('pointerenter', tick); b.addEventListener('focus', () => { if (b.matches(':focus-visible')) tick(); }); }); // keyboard focus ticks; a click's focus doesn't tick twice

    const closePanel = () => {
      audio.sfx('menu_back', { gain: 0.6 });
      audio.sfx('menu_whoosh', { gain: 0.25, rate: 1.15 });
      gsap.to(panel, { opacity: 0, x: 30, duration: 0.4, onComplete: () => { panel.hidden = true; } });
      gsap.to(stage, { opacity: 1, duration: 0.5 });
    };
    const openPanel = (kind) => {
      panel.hidden = false;
      if (kind === 'settings') {
        const vol = store.get('settings.volume');
        panel.innerHTML = `<h2>Settings</h2>
          <div class="menu-sliders">${Object.keys(vol).map((k) => `<label><span>${k}</span><input type="range" min="0" max="1" step="0.05" data-bus="${k}" value="${vol[k]}"></label>`).join('')}</div>
          <div class="menu-quality"><span>Quality</span><button data-q="high">High</button><button data-q="low">Low</button>
            <small>Display changes apply after restarting.</small></div>`;
        panel.querySelectorAll('input[data-bus]').forEach((s) => s.addEventListener('input', () => {
          store.set(`settings.volume.${s.dataset.bus}`, Number(s.value));
          audio.setVolume(s.dataset.bus, Number(s.value));
          saveSettings(store);
        }));
        panel.querySelectorAll('input[data-bus]').forEach((s) => s.addEventListener('change', tick)); // a tick at the volume you let go at
        const qs = panel.querySelectorAll('[data-q]');
        const markQ = () => qs.forEach((b) => b.classList.toggle('on', b.dataset.q === store.get('settings.quality')));
        qs.forEach((b) => b.addEventListener('click', () => { tick(); store.set('settings.quality', b.dataset.q); saveSettings(store); markQ(); }));
        markQ();
      } else {
        panel.innerHTML = '<h2>Credits</h2><div class="menu-credits"></div>';
        panel.querySelector('.menu-credits').textContent = credits;
      }
      const back = Object.assign(document.createElement('button'), { className: 'menu-back', textContent: '← Back' });
      back.addEventListener('click', closePanel);
      panel.prepend(back);
      gsap.fromTo(panel, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' });
      gsap.to(stage, { opacity: 0, duration: 0.4 });
    };

    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-choice]');
      if (!btn) return;
      const choice = btn.dataset.choice;
      if (choice === 'settings' || choice === 'credits') { audio.sfx('menu_select', { gain: 0.55 }); audio.sfx('menu_whoosh', { gain: 0.3 }); openPanel(choice); return; }
      audio.sfx('menu_select', { gain: 0.8 });
      audio.sfx('menu_whoosh', { gain: 0.35, rate: 0.8, delay: 0.2 }); // the focus pull
      removeEventListener('pointermove', onMove);
      items.forEach((b) => b.classList.toggle('chosen', b === btn));
      await gsap.to(el, { opacity: 0, duration: 0.9, delay: 0.25, ease: 'power2.in' });
      el.remove();
      resolve(choice);
    });
  });
}

// Settings outlive saves: a new game clears the save, not your volume.
const SETTINGS_KEY = 'daisy.settings.v1';
export function saveSettings(store) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(store.get('settings'))); } catch {}
}
export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'); } catch { return null; }
}

export function askHandle(overlay, { audio }) {
  return new Promise((resolve) => {
    // Terminal-style: keys are read from the window, so there is no field to focus or lose.
    const el = make('handle-screen', `
      <pre>META-LINK BBS LOADER v2.1
NOTICE: Your choices tonight decide how this ends.

ENTER HANDLE: <span class="handle-input"></span><span class="caret">█</span></pre>`);
    overlay.append(el);
    const text = el.querySelector('.handle-input');
    const onKey = async (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') text.textContent = text.textContent.slice(0, -1);
      else if (e.key.length === 1 && text.textContent.length < 16) text.textContent += e.key;
      else if (e.key !== 'Enter') return;
      e.preventDefault();
      audio.sfx(e.key === 'Enter' ? 'key_enter' : `key_${1 + Math.floor(Math.random() * 4)}`, { gain: 0.6 });
      if (e.key !== 'Enter') return;
      removeEventListener('keydown', onKey);
      const handle = normalizeHandle(text.textContent);
      await gsap.to(el, { opacity: 0, duration: 0.6, delay: 0.3 });
      el.remove();
      resolve(handle);
    };
    addEventListener('keydown', onKey);
  });
}

export function showCorruptSave(overlay) {
  return new Promise((resolve) => {
    const el = make('handle-screen', '<pre>SAVE FILE DAMAGED.\nThe old session could not be read and will be discarded.\n\nPress any key to continue_</pre>');
    overlay.append(el);
    const go = () => { el.remove(); removeEventListener('keydown', go); resolve(); };
    addEventListener('keydown', go);
    el.addEventListener('click', go);
  });
}

export function showFatal(overlay, error) {
  overlay.replaceChildren(make('bsod', '<p class="bsod-title">DAISY</p><pre></pre><p>Press F5 to restart._</p>'));
  overlay.querySelector('.bsod pre').textContent = `A fatal exception has occurred.\n\n${error?.stack ?? error}`;
}

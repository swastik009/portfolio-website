// Internet Voyager 4.0 — a 1999 browser. Pages are real late-90s HTML documents listed in data/web/index.json; only those
// resolve. Each renders in its own iframe (no desktop CSS leaking in), so View Source shows exactly what renders.
import { gsap } from 'gsap';
import { ICONS } from '../icons.js';
import { resolveUrl, fillPage, pagesNow } from './voyager.logic.js';

let indexP = null;
const loadIndex = () => (indexP ??= fetch('data/web/index.json').then((r) => {
  if (!r.ok) throw new Error(`${r.status} loading data/web/index.json`);
  return r.json();
}));
let current = null; // the open browser's navigate(), so a second launch reuses the window

// What Voyager itself adds to every page: <blink> (no modern engine still blinks), and a visible selection highlight.
const BROWSER_CSS = '<style>blink{animation:vb 1s steps(1) infinite}@keyframes vb{50%{visibility:hidden}}::selection{color:#000;background:#a8c8ff}@media (prefers-reduced-motion:reduce){blink{animation:none}}</style>';
// Pages are their own documents, so they don't get the desktop's Win98 scrollbars; lend them 98.css's rules.
let scrollbarCss = null;
const winScrollbars = () => (scrollbarCss ??= [...document.styleSheets].flatMap((sheet) => {
  try { return [...sheet.cssRules]; } catch { return []; }
}).filter((r) => r.selectorText?.includes('::-webkit-scrollbar')).map((r) => r.cssText).join(''));
const NOT_FOUND = '<HTML><BODY BGCOLOR="#FFFFFF"><FONT FACE="Tahoma,Arial" SIZE="2"><H2>The page cannot be displayed</H2><P>Internet Voyager cannot find server or DNS Error.</P><HR><P>Cannot find server: <B></B></P></FONT></BODY></HTML>';

export async function openVoyager({ wm, bus, audio, getHandle = () => 'user', getFlag = () => false }, start) {
  if (current && wm.isOpen('voyager')) { wm.focus('voyager'); if (start) current(start); return; }
  const index = await loadIndex();
  const body = document.createElement('div');
  body.className = 'voyager';
  body.innerHTML = `
    <div class="v-toolbar">
      <button data-go="back" disabled>◀ Back</button><button data-go="forward" disabled>Forward ▶</button><button data-go="home">Home</button><button data-go="source">Source</button>
      <span class="v-throbber" aria-hidden="true"></span>
    </div>
    <form class="v-address"><label>Address</label><input spellcheck="false" autocomplete="off"><button>Go</button></form>
    <div class="v-view"></div>
    <div class="status-bar"><p class="status-bar-field v-status">Done</p><p class="status-bar-field v-progress"><span></span></p></div>`;
  const $ = (s) => body.querySelector(s);
  const input = $('.v-address input');
  const view = $('.v-view');
  const status = $('.v-status');
  const progress = $('.v-progress span');
  const history = [];
  let at = -1;
  let nav = 0;
  let lastHtml = '';
  const win = wm.open({ id: 'voyager', title: 'Internet Voyager', icon: ICONS.voyager, width: 760, height: 540, x: 30, y: 16, content: body, onClose: () => { current = null; } });

  // The progress bar is decoration: loading waits on a timer, never on the animation (rAF can stall in a backgrounded window).
  const dial = (seconds) => {
    gsap.fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: seconds, ease: 'power1.in' });
    return new Promise((r) => setTimeout(r, seconds * 1000));
  };

  async function go(target, { push = true } = {}) {
    const my = ++nav; // a newer click wins; older loads drop their result
    const { url, page } = resolveUrl(target, pagesNow(index.pages, getFlag));
    input.value = url ? `http://${url}` : String(target);
    body.classList.add('loading');
    status.textContent = `Opening page http://${url}...`;
    audio.sfx('hdd_seek', { gain: 0.12 });
    const [html] = await Promise.all([
      page ? fetch(`data/web/${page.file}`).then((r) => (r.ok ? r.text() : null)).then((h) => h && fillPage(h, getHandle())).catch(() => null) : null,
      dial(0.6 + Math.random() * 0.9),
    ]);
    if (my !== nav) return;
    // A fresh frame per page, srcdoc set before it is attached: its only load is this page (no about:blank race).
    // Sandboxed: a page can never run script or submit a form; only our own listeners (wire) act on it.
    const frame = Object.assign(document.createElement('iframe'), { className: 'v-frame', title: 'page', sandbox: 'allow-same-origin', srcdoc: `<style>${winScrollbars()}</style>${BROWSER_CSS}${html ?? NOT_FOUND}` });
    await new Promise((loaded) => { frame.addEventListener('load', loaded, { once: true }); view.replaceChildren(frame); });
    if (my !== nav) return;
    const doc = frame.contentDocument;
    if (html) lastHtml = html;
    else doc.querySelector('b').textContent = url || String(target);
    wire(doc);
    win.setTitle(`${html ? page.title : 'Cannot find server'} - Internet Voyager`);
    status.textContent = 'Done';
    body.classList.remove('loading');
    if (push) { history.splice(at + 1); history.push(url || String(target)); at = history.length - 1; }
    $('[data-go=back]').disabled = at <= 0;
    $('[data-go=forward]').disabled = at >= history.length - 1;
    if (html) bus.emit('voyager:visit', { url, clue: page.clue ?? null });
  }

  // Events inside the page don't reach the desktop, so the browser routes links, the status bar and window focus itself.
  function wire(doc) {
    doc.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('href');
      if (href.startsWith('receive:')) { bus.emit('voyager:receive', { file: href.slice(8), host: history[at] ?? '' }); return; }
      go(href);
    });
    doc.addEventListener('pointerover', (e) => { const a = e.target.closest('a[href]'); status.textContent = a ? a.getAttribute('href') : 'Done'; });
    doc.addEventListener('pointerdown', () => { wm.focus('voyager'); audio.sfx('mouse_click', { gain: 0.45 }); });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) for (const m of doc.querySelectorAll('marquee')) m.stop();
  }
  $('.v-address').addEventListener('submit', (e) => { e.preventDefault(); go(input.value); });
  $('.v-toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    if (b.dataset.go === 'source') {
      const ta = Object.assign(document.createElement('textarea'), { readOnly: true, value: lastHtml || '(no page)', spellcheck: false });
      ta.style.cssText = 'width:100%;height:100%;box-sizing:border-box;font:12px Menlo,monospace;resize:none';
      wm.close('voyager-source'); // reopen so it always shows the current page
      wm.open({ id: 'voyager-source', title: 'source - Notepad', width: 560, height: 380, content: ta });
      return;
    }
    if (b.dataset.go === 'home') go(index.home);
    else if (b.dataset.go === 'back' || b.dataset.go === 'forward') { at += b.dataset.go === 'back' ? -1 : 1; go(history[at], { push: false }); }
  });
  current = go;
  await go(start ?? index.home);
}

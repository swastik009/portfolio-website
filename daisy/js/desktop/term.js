// A phosphor terminal with a guide: breadcrumb + status header, clickable names, Tab completion, a strip of the
// commands that work here, masked password entry and history.
import { completeLine, splitLinks, flowNext } from './termguide.logic.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createTerm(el, { prompt = '$ ', onLine, audio, guide = null }) {
  el.classList.add('term');
  el.innerHTML = `
    <div class="term-head" hidden><span class="term-crumb"></span><span class="term-status"></span></div>
    <div class="term-scroll">
      <pre class="term-out"></pre>
      <div class="term-line"><span class="term-prompt"></span><span class="term-typed"></span><span class="term-caret">█</span><span class="term-ghost"></span></div>
    </div>
    <div class="term-manual" hidden></div>
    <input class="term-input" autocomplete="off" spellcheck="false">`;
  const $ = (s) => el.querySelector(s);
  const scroller = $('.term-scroll'), out = $('.term-out'), promptEl = $('.term-prompt'), typed = $('.term-typed');
  const ghost = $('.term-ghost'), input = $('.term-input'), head = $('.term-head'), manual = $('.term-manual');
  const history = [];
  let hIndex = 0;
  let masked = false;
  let locked = false;
  let flowing = null;
  promptEl.textContent = prompt;
  const names = () => guide?.names?.() ?? [];
  const scroll = () => { scroller.scrollTop = scroller.scrollHeight; };
  const show = () => {
    typed.textContent = masked ? '' : input.value;
    scroll();
  };

  if (guide?.manual) {
    manual.hidden = false;
    manual.innerHTML = '<b>C:\\TOOLS</b>';
    for (const [cmd, desc] of guide.manual) {
      const b = document.createElement('button');
      b.innerHTML = '<code></code><span></span>';
      b.querySelector('code').textContent = cmd;
      b.querySelector('span').textContent = desc;
      b.addEventListener('click', () => { input.value = cmd.split('<')[0]; show(); input.focus({ preventScroll: true }); });
      manual.append(b);
    }
  }

  async function submit(line) {
    out.append(`${promptEl.textContent}${masked ? '' : line}\n`);
    if (line.trim() && !masked) { history.push(line); hIndex = history.length; }
    locked = true;
    el.classList.add('busy');
    try { await onLine(line); } finally { locked = false; el.classList.remove('busy'); input.focus({ preventScroll: true }); show(); }
  }

  el.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) setTimeout(() => input.focus({ preventScroll: true })); });
  input.addEventListener('input', () => {
    show();
    typed.classList.remove('glow');
    void typed.offsetWidth; // restart the phosphor flare
    typed.classList.add('glow');
  });
  input.addEventListener('keydown', async (e) => {
    if (flowing) { e.preventDefault(); flowing(e.key); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (guide && !masked) { input.value = completeLine(input.value, { commands: guide.commands, names: names() }).line; show(); }
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      hIndex = Math.max(0, Math.min(history.length, hIndex + (e.key === 'ArrowUp' ? -1 : 1)));
      input.value = history[hIndex] ?? '';
      show();
      return;
    }
    if (e.key !== 'Enter' || locked) return;
    const line = input.value;
    input.value = '';
    show();
    await submit(line);
  });
  out.addEventListener('click', (e) => {
    const b = e.target.closest('.term-link');
    if (!b || locked) return;
    input.value = '';
    submit(b.dataset.cmd);
  });
  out.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.term-link');
    if (b) guide?.onHover?.(b.dataset.cmd, b);
  });

  function appendLinked(text, links) {
    for (const part of splitLinks(text, Object.keys(links))) {
      if (!part.name) { out.append(part.text); continue; }
      const L = links[part.name];
      const b = document.createElement('button');
      b.className = `term-link ${L.className ?? ''}`.trim();
      b.dataset.cmd = L.cmd;
      b.textContent = part.text;
      out.append(b);
    }
  }

  return {
    async print(text, { speed = 0, links = null } = {}) {
      if (links) { appendLinked(`${text}\n`, links); scroll(); return; }
      if (!speed) { out.append(`${text}\n`); scroll(); return; }
      const node = document.createTextNode('');
      out.append(node);
      for (const ch of `${text}\n`) {
        node.data += ch;
        scroll();
        if (ch === '\n') audio?.sfx('key_1', { gain: 0.05, rate: 3 });
        await sleep(speed);
      }
    },
    flow(script) {
      return new Promise((resolve) => {
        let shown = '';
        let idle = 0;
        const finish = async () => {
          flowing = null;
          el.classList.add('busy');
          clearTimeout(idle);
          input.value = '';
          show();
          out.append(`${promptEl.textContent}${script}\n`);
          scroll();
          resolve();
        };
        const arm = () => { clearTimeout(idle); idle = setTimeout(() => { shown = script; typed.textContent = script; setTimeout(finish, 500); }, 5000); };
        flowing = (key) => {
          const r = flowNext(script, shown, key);
          if (r.done) { finish(); return; }
          if (r.shown !== shown) audio?.sfx('key_1', { gain: 0.25, detune: Math.random() * 80 - 40 });
          shown = r.shown;
          typed.textContent = shown;
          ghost.textContent = shown === script ? '   ⏎' : '';
          arm();
        };
        el.classList.remove('busy'); // flourishes run inside a command: show the line while it types itself
        typed.textContent = '';
        ghost.textContent = '';
        arm();
        input.focus();
      });
    },
    run: (line) => submit(line),
    setPrompt(p) { promptEl.textContent = p; },
    setMasked(m) { masked = m; show(); },
    setHeader(text) { head.hidden = false; $('.term-crumb').textContent = text; },
    setStatus(text) { head.hidden = false; $('.term-status').textContent = text; },
    focus() { input.focus({ preventScroll: true }); },
    clear() { out.textContent = ''; },
  };
}

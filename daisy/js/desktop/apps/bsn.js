// DSN Messenger (Door Service Network): the #nullroute group chat, or a private chat with one person (`id`, `channel` = their
// handle). A scripted conversation that only moves while you are reading it.
import { ICONS } from '../icons.js';
import { fillHandle, readDelay, bsnShouldAdvance } from './bsn.logic.js';
import { evalCond, interpolate } from '../../core/dialogue.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createBsn({ wm, bus, audio, store, id = 'bsn', channel = '#nullroute', members = [] }) {
  const root = document.createElement('div');
  root.className = 'bsn';
  root.innerHTML = '<div class="bsn-main"><div class="bsn-log"></div><div class="bsn-choices"></div></div><ul class="bsn-members"></ul>';
  const log = root.querySelector('.bsn-log');
  const choicesEl = root.querySelector('.bsn-choices');
  const membersEl = root.querySelector('.bsn-members');
  const handle = () => store.get('handle') || 'you';
  let present = [...members];
  let gen = 0; // bumped when the line drops: a running script stops, and nobody nudges an empty channel
  let nudgeTimer = 0;
  const drawMembers = () => membersEl.replaceChildren(...[...present, handle()].map((m) => Object.assign(document.createElement('li'), { textContent: m })));
  drawMembers();

  const open = () => wm.open({ id, title: `${channel} - DSN Messenger`, icon: ICONS.bsn, width: 520, height: 360, x: 440, y: 30, content: root });
  const readable = () => bsnShouldAdvance({ open: wm.isOpen(id), minimized: wm.isMinimized(id) });
  const waitReadable = async () => { while (!readable()) await sleep(400); };
  function add(cls, text) {
    const p = Object.assign(document.createElement('p'), { className: `bsn-line ${cls}`, textContent: fillHandle(text, handle()) });
    log.append(p);
    log.scrollTop = log.scrollHeight;
    if (cls !== 'me') audio.sfx('dsn_msg', { gain: 0.35, pan: 0.2 }); // someone else said something
    wm.get(id)?.flash();
  }
  const post = (who, text) => add(who === handle() ? 'me' : 'them', `<${who}> ${text}`);
  const sys = (text) => add('sys', `*** ${text}`);

  async function line(e, my) {
    await waitReadable();
    await sleep(readDelay(e) * 1000);
    await waitReadable(); // closed while we waited: hold the line until they're back
    if (my !== gen) return;
    if (e.text) { post(e.who, interpolate(e.text, store.get())); return; }
    sys(e.sys);
    const m = e.sys.match(/^(\S+) has (signed off|quit|joined)/);
    if (!m) return;
    present = m[2] === 'joined' ? [...new Set([...present, m[1]])] : present.filter((x) => x !== m[1]);
    drawMembers();
  }

  function choose(choices, nudges, nudgeAfter) {
    return new Promise((resolve) => {
      // Idle nudges come from the crew, never from a UI hint; never the same one twice.
      const arm = () => { clearTimeout(nudgeTimer); nudgeTimer = setTimeout(() => { if (nudges.length && readable()) add('them', nudges.shift()); arm(); }, nudgeAfter * 1000); };
      arm();
      choicesEl.replaceChildren(...choices.map((c) => {
        const b = Object.assign(document.createElement('button'), { textContent: c.text });
        b.addEventListener('click', () => { clearTimeout(nudgeTimer); choicesEl.replaceChildren(); post(handle(), c.text); resolve(c); });
        return b;
      }));
    });
  }

  return {
    open,
    post,
    drop() { gen++; clearTimeout(nudgeTimer); choicesEl.replaceChildren(); }, // the line dies: no more lines, choices or nudges
    setOffline(text) { this.drop(); present = []; drawMembers(); sys(text); },
    async run({ script, nudges = [], nudgeAfter = 70 }) {
      const my = ++gen;
      const left = [...nudges];
      for (const e of script) {
        if (my !== gen) return;
        if (!evalCond(e.if, store.get())) continue;
        if (e.mark) { bus.emit('bsn:mark', e.mark); continue; }
        if (e.choices) {
          await waitReadable();
          const c = await choose(e.choices, left, nudgeAfter);
          for (const t of c.then ?? []) await line(t, my);
          continue;
        }
        await line(e, my);
      }
    },
  };
}

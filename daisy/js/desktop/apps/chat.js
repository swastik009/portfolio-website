// Daisy's window: Daisy (a pixel blob) on the left, a transcript typed out in Daisy's current voice, reply buttons below.
import { createBlob } from '../../world/blob.js';
import { daisyVoice } from '../../core/blipvoice.js';
import { applyChoice } from '../../core/dialogue.js';
import { ICONS } from '../icons.js';
import { pickBark, glitchText, appendTranscript, SPIN, thinkDone } from './chat.logic.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STYLE = {
  broken: { cps: 18, glitch: 0, stutter: 0.06 }, // incomplete, not leetspeak: no letter swaps
  hint: { cps: 26, glitch: 0, stutter: 0.02 }, // hints must stay readable whatever Daisy's mood
  childlike: { cps: 24, glitch: 0, stutter: 0.03 },
  curious: { cps: 30, glitch: 0, stutter: 0 },
  warm: { cps: 34, glitch: 0, stutter: 0 },
  tense: { cps: 44, glitch: 0.02, stutter: 0 },
};

// Dialogue voices → Daisy's faces (a node may also name a face directly: "happy", "sly", …).
const NOISE = '▓▒░█▚▞#%@&$?';
const DARK = 0.24; // before the line is up she is a shape in the dark: dim body, bright glints
const FACE = { broken: 'weak', childlike: 'puppy', curious: 'calm', warm: 'generous', tense: 'sly' };

export function createChat({ wm, store, bus, audio, dialogue, barks }) {
  const root = document.createElement('div');
  root.className = 'chat';
  root.innerHTML = `
    <div class="chat-daisy"><canvas></canvas></div>
    <div class="chat-main">
      <div class="chat-log sunken-panel"></div>
      <div class="chat-choices"></div>
    </div>`;
  const log = root.querySelector('.chat-log');
  const choicesEl = root.querySelector('.chat-choices');
  const daisy = createBlob(root.querySelector('canvas'), { onSound: (n, o) => daisyVoice(audio, n, { ...o, evil: store.get('growth') }) });
  daisy.setMood('asleep');
  daisy.setStage(store.get('growth'));
  daisy.setDim(store.get('flags.daisyLit') ? 1 : DARK);
  // The story changes her: she charges up on screen (open the window so you see it).
  bus.on('state:change', ({ path, value }) => {
    if (path === 'growth') { open(); ready = ready.then(() => daisy.charge({ stage: value })); }
    if (path === 'flags.daisyLit' && value) { open(); ready = ready.then(() => daisy.charge({ dim: 1 })); }
  });
  let woke = false, ready = Promise.resolve(); // she wakes, then charges, then speaks: never over each other
  const canvasEl = root.querySelector('canvas');
  canvasEl.addEventListener('click', (e) => { const r = canvasEl.getBoundingClientRect(); daisy.poke(e.clientX < r.left + r.width / 2 ? -1 : 1); }); // poke her; too often and she gets dizzy
  addEventListener('pointermove', (e) => {
    const r = canvasEl.getBoundingClientRect();
    if (!r.width) return;
    daisy.lookAt((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2), (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2));
  });
  let busy = false;
  let style = 'broken';
  let queue = Promise.resolve(); // Daisy speaks one line at a time
  let win = null;

  const remember = (who, text) => store.set('transcript', appendTranscript(store.get('transcript'), { who, text }));
  // On resume, put back what Daisy already said (instantly, no typing).
  for (const l of store.get('transcript') ?? []) {
    const p = document.createElement('p');
    p.className = `chat-line ${l.who}`;
    p.textContent = l.text;
    if (l.who === 'daisy') p.classList.add('done');
    log.append(p);
  }

  // Weak, her old words won't hold still either: now and then a word on screen breaks into noise for a few frames.
  (function idleGlitch() {
    setTimeout(idleGlitch, 900 + Math.random() * 2200);
    if (store.get('growth') >= 0.1 || !wm.isOpen('chat') || document.hidden) return;
    const lines = [...log.querySelectorAll('.chat-line.daisy.done:not(.flicker)')].slice(-8); // the ones on screen
    const p = lines[Math.floor(Math.random() * lines.length)];
    const words = p ? [...p.textContent.matchAll(/\S{2,}/g)] : [];
    if (!words.length) return;
    const w = words[Math.floor(Math.random() * words.length)];
    const text = p.textContent;
    p.classList.add('flicker');
    daisy.glitch(Math.random() < 0.5 ? 'scan' : 'dropout', 160, true); // an old word breaks: a flicker of her with it
    let n = 2 + Math.floor(Math.random() * 3);
    (function frame() {
      if (!n--) { p.textContent = text; p.classList.remove('flicker'); return; }
      const noise = Array.from(w[0], () => NOISE[Math.floor(Math.random() * NOISE.length)]).join('');
      p.textContent = text.slice(0, w.index) + noise + text.slice(w.index + w[0].length);
      setTimeout(frame, 50 + Math.random() * 60);
    })();
  })();

  const title = () => (store.get('flags.named') ? 'DAISY' : 'untitled.exe');

  function open() {
    if (win && wm.isOpen('chat')) { win.focus(); return win; }
    win = wm.open({
      id: 'chat', title: title(), icon: ICONS.eye, width: 460, height: 300, x: 282, y: 170, content: root, // centre stage
      onCloseRequest: () => { chat.bark('closed'); return false; }, // the X stays, does nothing; the apology is a lie
    });
    daisy.start();
    if (!woke) { woke = true; ready = ready.then(() => daisy.wake()); } // every session she comes up from nothing; she speaks once she's up
    return win;
  }

  function line(who) {
    const p = document.createElement('p');
    p.className = `chat-line ${who}`;
    log.append(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  function type(text, styleName, lie, cue) {
    const job = queue.then(() => typeNow(text, styleName, lie, cue));
    queue = job.catch(() => {});
    return job;
  }

  // cue: a line's own `face` (stays until the next face or node) and/or one-shot `act` (any blob act, or 'glitch').
  async function typeNow(text, styleName, lie, cue) {
    await ready;
    if (cue?.think) await think(cue.think, cue.thinkMs ?? 2400, cue.done);
    if (cue?.face) daisy.setMood(FACE[cue.face] ?? cue.face);
    if (cue?.act) { if (cue.act === 'glitch') daisy.glitch(); else daisy.act(cue.act); }
    if (lie) daisy.avert(350 + text.length * 12); // the tell: it can't look at you while it says this
    const s = STYLE[styleName] ?? STYLE.curious;
    const p = line('daisy');
    const shown = s.glitch ? glitchText(text, Math.random, s.glitch) : text;
    // Weak (no fragment home yet), her signal is bad: letters land as noise and settle, the line tears now and then.
    // What's left on screen always reads clean.
    const weak = store.get('growth') < 0.1 && styleName !== 'hint';
    for (const ch of shown) {
      if (weak && ch !== ' ' && Math.random() < 0.16) {
        p.textContent += NOISE[Math.floor(Math.random() * NOISE.length)];
        if (Math.random() < 0.3) daisy.glitch('scan', 70, true); // a noisy letter: one lost frame of her
        await sleep(45 + Math.random() * 50);
        p.textContent = p.textContent.slice(0, -1);
      }
      if (weak && Math.random() < 0.025) tear(p);
      p.textContent += ch;
      if (ch !== ' ') audio.sfx('key_1', { gain: 0.1, rate: 2.4, bus: 'voice', detune: Math.random() * 200 });
      log.scrollTop = log.scrollHeight;
      let delay = 1000 / s.cps;
      if (ch === '.' || ch === '?') delay *= 6;
      if (Math.random() < s.stutter) delay += 400;
      await sleep(delay);
    }
    p.classList.add('done'); // finished: the idle glitch may touch it now
    remember('daisy', shown);
    if (!wm.isOpen('chat') || win !== wm.get('chat')) return;
    win.flash();
  }

  // Weak, her words and her body are the same bad signal: when a line tears, so does she.
  const SIGNAL = ['tear', 'shift', 'scan', 'dropout'];
  function tear(p) {
    daisy.glitch(SIGNAL[Math.floor(Math.random() * SIGNAL.length)], 90 + Math.random() * 120);
    p.classList.add('torn');
    setTimeout(() => p.classList.remove('torn'), 90 + Math.random() * 120);
  }

  // A modern model's tell, a quarter-century early: a grey status line with a spinner, then what it did.
  async function think(label, ms, done) {
    const p = line('think');
    bus.emit('disk', ms / 1000); // the drive reads, its red light chattering, for as long as she thinks
    for (let i = 0, t0 = performance.now(); performance.now() - t0 < ms; i++) {
      p.textContent = `${SPIN[i % SPIN.length]} ${label}…`;
      log.scrollTop = log.scrollHeight;
      await sleep(110);
    }
    p.textContent = `(${thinkDone(label, ms, done)})`;
    remember('think', p.textContent);
  }

  function choose(choices) {
    return new Promise((resolve) => {
      choicesEl.replaceChildren(...choices.map((c) => {
        const b = document.createElement('button');
        b.textContent = c.text;
        b.addEventListener('click', () => {
          choicesEl.replaceChildren();
          line('you').textContent = `> ${c.text}`;
          remember('you', `> ${c.text}`);
          resolve(c);
        });
        return b;
      }));
      log.scrollTop = log.scrollHeight; // the buttons shrink the log: keep her question in view above them
      choicesEl.querySelector('button')?.focus();
    });
  }

  const chat = {
    daisy,
    get busy() { return busy; },
    open,
    // Asides (hints, barks) don't steal the stage: if Daisy's window is already open it just flashes.
    async say(text, styleName = style, { lie = false } = {}) {
      if (!store.get('flags.daisyAwake')) return; // before she wakes there is no Daisy to hint or remark: her window never opens early
      if (!wm.isOpen('chat')) open();
      await type(text, styleName, lie);
    },
    async run(nodeId) {
      open();
      busy = true;
      audio.duck(true);
      try {
        let cur = nodeId;
        while (cur) {
          const node = dialogue.node(cur);
          if (node.mood) {
            style = node.mood;
            daisy.setMood(FACE[node.mood] ?? node.mood);
            bus.emit('dialogue:mood', { mood: node.mood });
          }
          let next = node.next ?? null;
          for (const l of dialogue.lines(cur, store.get())) {
            await type(l.text, l.style ?? style, l.lie, l);
            if (l.choices?.length) {
              next = applyChoice(await choose(l.choices), store) ?? next;
              break;
            }
            await sleep(l.pause ?? 450);
          }
          win?.setTitle(title());
          cur = next;
        }
      } finally {
        busy = false;
        audio.duck(false);
      }
    },
    async bark(trigger) {
      if (busy) return false;
      const b = pickBark(barks, trigger, store.get());
      if (!b) return false;
      if (!b.repeat) store.push('barksSeen', b.id);
      await chat.say(b.text, b.style ?? style, { lie: b.lie });
      return true;
    },
  };
  return chat;
}

// Quick-time events come out of the puzzle in progress. Chapter 1 has one: the Bluff — Halloran opens a TALK
// session and you answer as K. Patel against the wall clock. Failure costs story time and changes the hunt, never progress.
import { gsap } from 'gsap';
import { createBluff, unsign } from '../puzzles/bluff.logic.js';
import { clockTick } from '../core/synths.js';
import { formatClock } from '../desktop/desktop.logic.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QTES = { bluff: runBluff };

// The only time the room sways: the breath quickens under pressure, then settles. Camera-only, so the desktop stays glued.
export async function runQte(beat, deps) {
  const run = QTES[beat.id];
  if (!run) throw new Error(`unknown qte "${beat.id}"`);
  const rig = deps.room?.rig;
  const calm = rig?.breathe ?? 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (rig && !reduced) gsap.to(rig, { breathe: 3, duration: 1.5, ease: 'sine.inOut' });
  try {
    return await run(beat, deps);
  } finally {
    if (rig) gsap.to(rig, { breathe: calm, duration: 2.5, ease: 'sine.inOut' });
  }
}

async function runBluff(beat, { wm, audio, store, bus, chat }) {
  const { from = 'JHALLORAN@KESTREL', exchanges, seconds = 10, endings = {} } = beat.params;
  const bluff = createBluff(exchanges);
  const body = document.createElement('div');
  body.className = 'talk';
  body.innerHTML = `
    <div class="talk-half talk-them"><pre></pre><span class="talk-typing" hidden>JHALLORAN is typing…</span></div>
    <div class="talk-split"><span class="talk-who"></span><span class="talk-trace">TRACE <i></i><i></i><i></i></span></div>
    <div class="talk-half talk-you"><pre></pre><div class="talk-replies"></div><div class="talk-timer"><span></span></div></div>`;
  body.querySelector('.talk-who').textContent = `${from}  ⇄  KPATEL@KESTREL`;
  const them = body.querySelector('.talk-them pre');
  const you = body.querySelector('.talk-you pre');
  const typing = body.querySelector('.talk-typing');
  const replies = body.querySelector('.talk-replies');
  const bar = body.querySelector('.talk-timer span');
  const traces = body.querySelectorAll('.talk-trace i');
  const typeInto = async (pre, text, cps = 38) => {
    for (const ch of text) { pre.textContent += ch; await sleep(1000 / cps); }
    pre.textContent += '\n';
  };
  const time = formatClock(store.get('clock')).toLowerCase();
  let slip = null; // the first lie he caught, in your words: the ending quotes it back

  audio.setTension(0.85);
  audio.sfx('phone_ring', { gain: 0.2, rate: 1.8 });
  const win = wm.open({ id: 'qte', title: `TALK — ${from}`, width: 580, height: 390, x: 220, y: 80, closable: false, resizable: false, content: body });

  for (let i = 0; i < exchanges.length && bluff.wrong < 2; i++) {
    const x = exchanges[i];
    typing.hidden = false;
    await sleep(900 + bluff.wrong * 1600); // the less he believes you, the longer he stares at the screen
    typing.hidden = true;
    await typeInto(them, x.says.replace('{time}', time));
    const { res, k } = await new Promise((resolve) => {
      replies.innerHTML = '';
      x.replies.forEach((r, n) => {
        const b = document.createElement('button');
        b.className = 'talk-reply';
        b.innerHTML = `<kbd>${n + 1}</kbd><span></span>`;
        b.querySelector('span').textContent = r.text;
        b.addEventListener('click', () => finish(bluff.answer(i, n), n));
        replies.append(b);
      });
      replies.querySelector('button').focus(); // keys 1–3 must not leak into the terminal underneath
      const tick = setInterval(() => clockTick(audio, { gain: 0.3 }), 1000); // the wall clock is the tempo
      const tween = gsap.fromTo(bar, { scaleX: 1 }, { scaleX: 0, duration: seconds, ease: 'none', onComplete: () => finish(bluff.timeout(i), null) });
      const onKey = (e) => { const n = Number(e.key) - 1; if (x.replies[n]) finish(bluff.answer(i, n), n); };
      addEventListener('keydown', onKey);
      function finish(result, n) {
        if (result === null) return; // already settled: a late click or a late timer
        clearInterval(tick);
        tween.kill();
        removeEventListener('keydown', onKey);
        replies.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        resolve({ res: result, k: n });
      }
    });
    replies.innerHTML = '';
    await typeInto(you, k === null ? '…' : x.replies[k].text, 70);
    if (res === 'wrong') {
      if (k !== null) slip ??= unsign(x.replies[k].text);
      traces[bluff.wrong - 1]?.classList.add('on');
      store.add('clock', beat.penalty ?? 1);
      audio.sfx('hdd_seek', { gain: 0.3, rate: 0.7 });
    }
  }

  const outcome = bluff.outcome();
  typing.hidden = false;
  await sleep(1200);
  typing.hidden = true;
  await typeInto(them, endings[outcome] ?? '');
  await typeInto(them, `[${from.split('@')[0]} has left the conversation]`, 90);
  await sleep(1400);
  win.close();
  audio.setTension(0.15);
  store.set('flags.bluff', outcome);
  store.set('flags.bluffSlip', slip);
  bus.emit('qte:end', { id: 'bluff', outcome });
  await chat.bark(`bluff_${outcome}`);
  return { outcome };
}

// The machine hangs. The frame freezes; slices of it slip sideways and sit there; blocks of the picture go bad; the
// top window smears down the screen like a Win98 hang; the sound sticks on one sliver and buzzes. Every few hundred
// ms it lurches to a new broken state, then sits again. At the end it all snaps back.
import { tearSlices } from './glitch.logic.js';

const rand = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BLOCK = ['#000', '#008080', '#fff', '#c0c0c0', '#000080', '#ff00c8', '#00f0ff'];

// `until`: a promise; the machine stays hung until it settles (else `duration` s).
export async function scramble(el, audio, { duration = 3.5, until } = {}) {
  let released = false;
  until?.then(() => { released = true; });
  const frozen = el.cloneNode(true); // the frame that hangs on screen
  frozen.querySelectorAll('canvas, video').forEach((c) => c.remove());
  const layer = Object.assign(document.createElement('div'), { className: 'glitch' });
  const slices = Array.from({ length: 9 }, () => {
    const s = frozen.cloneNode(true);
    s.className += ' glitch-slice';
    layer.append(s);
    return s;
  });
  const blocks = Object.assign(document.createElement('div'), { className: 'glitch-blocks' });
  layer.append(blocks);
  const top = [...el.querySelectorAll('.window')].sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0))[0]; // the front window
  const trail = []; // the hung window, smeared
  el.append(layer);
  el.style.pointerEvents = 'none';

  audio.sfx('glitch_short', { gain: 0.5 });
  const buzz = audio.sfx('glitch_short', { gain: 0.22, loop: true }); // one sliver, stuck
  if (buzz) { buzz.loopStart = 0.31; buzz.loopEnd = 0.31 + 0.045; }

  const lurch = () => {
    tearSlices(slices.length).forEach((t, i) => {
      slices[i].style.clipPath = `inset(${t.top}% 0 ${t.bottom}% 0)`;
      slices[i].style.transform = `translateX(${t.dx}px)`;
    });
    blocks.replaceChildren(...Array.from({ length: Math.floor(rand(2, 9)) }, () => {
      const b = document.createElement('i');
      Object.assign(b.style, { left: `${Math.floor(rand(0, 60)) * 16}px`, top: `${Math.floor(rand(0, 45)) * 16}px`,
        width: `${16 * Math.ceil(rand(1, 14))}px`, height: `${16 * Math.ceil(rand(1, 3))}px`, background: BLOCK[Math.floor(rand(0, BLOCK.length))] });
      return b;
    }));
    if (top && trail.length < 7 && Math.random() < 0.6) { // a hung window leaves copies of itself behind
      const c = top.cloneNode(true);
      c.querySelectorAll('canvas').forEach((x) => x.remove());
      const k = trail.length + 1;
      Object.assign(c.style, { position: 'absolute', left: `${top.offsetLeft + k * 9}px`, top: `${top.offsetTop + k * 7}px`, margin: 0, pointerEvents: 'none' });
      layer.insertBefore(c, blocks);
      trail.push(c);
    }
  };
  const t0 = performance.now();
  while (until ? !released : performance.now() - t0 < duration * 1000 - 400) {
    lurch();
    await sleep(rand(180, 650));
  }
  // the last moment: it can't hold the frame, the picture rolls
  for (let i = 0; i < 6; i++) { layer.style.transform = `translateY(${rand(-30, 30)}px)`; lurch(); await sleep(60); }
  buzz?.stop();
  layer.remove();
  el.style.pointerEvents = '';
}

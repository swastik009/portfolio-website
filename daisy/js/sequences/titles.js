// Opening titles, before he wakes: black, then a tunnel of Stargate light that runs straight and swerves (Daisy travelling between worlds),
// Turing a few words at a time, and a quiet credit while the night outside comes up. Timed to the intro bed (the track three times over); Daisy sings over its seams.
import { gsap } from 'gsap';
import { singDaisy } from '../core/synths.js';

const QUOTE = 'A computer would deserve to be called intelligent if it could deceive a human into believing that it was human.';
const SEAMS = [15.5, 32.5]; // s into the bed: the crossfades in intro_bed.mp3 sit at 17–21 and 34–38
const FAR = 60;
// Stargate colours: magenta, violet, blue, cyan, teal, amber, orange. Never the city's red.
const HUES = [322, 290, 255, 215, 192, 165, 40, 28];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

// Each wall carries one colour band at a time and drifts to the next every few seconds, like the slit-scan corridor.
const wallHue = (side, t) => HUES[Math.floor(t / 3.2 + (side > 0 ? 3 : 0)) % HUES.length];

function streak(t) {
  const wall = Math.random() < 0.75;
  const side = Math.random() < 0.5 ? -1 : 1;
  const white = Math.random() < 0.12;
  const hue = wall ? wallHue(side, t) + rand(-14, 14) : HUES[Math.floor(Math.random() * HUES.length)];
  return {
    x: wall ? side * rand(1.05, 1.6) : rand(-3, 3),
    y: wall ? rand(-3.2, 3.2) : rand(-2, 2),
    z: rand(2, FAR),
    v: rand(8, 12),
    w: wall ? rand(0.9, 1.8) : rand(0.5, 1),
    color: white ? 'hsl(220 30% 92%)' : `hsl(${hue} 92% ${rand(55, 66)}%)`,
    a: wall ? 0.6 : 0.38,
  };
}

function trails(canvas) {
  const ctx = canvas.getContext('2d');
  const state = { vis: 0 };
  const t0 = performance.now();
  const field = Array.from({ length: 380 }, () => streak(0));
  let raf = 0;
  let last = t0;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio, 1.5);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  addEventListener('resize', resize);
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // The corridor ahead bends: a point at depth z sits bend·z² off the axis, so far light swings wide and straightens as
    // it reaches you. The bend comes and goes (env), so the flight runs straight, swerves, runs straight again.
    const t = (now - t0) / 1000;
    const env = 0.5 - 0.5 * Math.cos(t * 0.16);
    const bx = 0.0085 * Math.sin(t * 0.23) * env;
    const by = 0.0055 * Math.sin(t * 0.19 + 1.3) * env;
    const { width: W, height: H } = canvas;
    const f = Math.min(W, H) * 0.9;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; // a touch of persistence
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; // where colours cross they burn toward white
    ctx.lineCap = 'round';
    for (const p of field) {
      p.z -= p.v * dt;
      if (p.z < 0.4) { Object.assign(p, streak(t), { z: FAR }); continue; }
      const len = p.v * 0.5;
      const depth = Math.min(1, (FAR - p.z) / 18) * Math.min(1, 6 / p.z); // fades in from the dark, brightest close by
      const a = state.vis * depth * p.a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.5, (p.w * f) / (p.z * 140));
      // A polyline, so a streak curves through a bend; each piece fainter toward the tail: motion blur.
      let px = 0, py = 0;
      for (let i = 0; i <= 6; i++) {
        const z = p.z + (len * i) / 6;
        const sx = W / 2 + (p.x / z + bx * z) * f, sy = H / 2 + (p.y / z + by * z) * f;
        if (i) {
          ctx.globalAlpha = a * (1 - (i - 1) / 6);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke();
        }
        px = sx; py = sy;
      }
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { state, stop() { cancelAnimationFrame(raf); removeEventListener('resize', resize); canvas.remove(); } };
}

// The quote in uneven phrases of 3–4 words.
function phrases(text) {
  const words = text.split(' ');
  const out = [];
  while (words.length) out.push(words.splice(0, words.length <= 4 ? words.length : 3 + Math.round(Math.random())).join(' '));
  return out.map((t) => Object.assign(document.createElement('span'), { className: 'ph', textContent: `${t} ` }));
}

export async function titles({ audio, overlay, onCredit, skipToCredit = false }) {
  const el = Object.assign(document.createElement('div'), { className: 'titles' });
  const canvas = document.createElement('canvas');
  const quote = Object.assign(document.createElement('p'), { className: 'titles-quote' });
  const cite = Object.assign(document.createElement('cite'), { textContent: 'Alan Turing' });
  const credit = Object.assign(document.createElement('p'), { className: 'titles-credit', textContent: 'Swastik Presents' });
  const parts = phrases(QUOTE);
  quote.append(...parts, document.createElement('br'), cite);
  el.append(canvas, quote, credit);
  overlay.append(el);

  if (!skipToCredit) { // (dev: straight to the credit)
    // 1. Black. No sound.
    await sleep(4500);

    // 2. The bed rises from nothing; the light comes up out of the dark. Daisy sings, far away, over the seams.
    const bed = audio.sfx('intro_bed', { bus: 'music', gain: 0 });
    const BED = bed?.buffer.duration ?? 55.2;
    bed?.gainNode.gain.linearRampToValueAtTime(0.4, bed.context.currentTime + 10);
    const light = trails(canvas);
    const tl = gsap.timeline();
    tl.to(light.state, { vis: 1, duration: 12, ease: 'sine.inOut' }, 0);
    for (const at of SEAMS) tl.call(() => {
      const song = singDaisy(audio, { bpm: 116, gain: 0.14, reverb: 5 });
      setTimeout(() => song.fade(2.4), song.length * 1000);
    }, null, at);
    // 3. Turing, a phrase at a time, the last one slowly; a pause, then his name, held a few seconds. Then the light alone carries the swell.
    const Q = 12;
    const last = Q + (parts.length - 1) * 1.7;
    tl.fromTo(parts.slice(0, -1), { opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.2, stagger: 1.7, ease: 'power2.out' }, Q)
      .fromTo(parts.at(-1), { opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0px)', duration: 2.8, ease: 'sine.inOut' }, last) // "...human." lands slowly
      .fromTo(cite, { opacity: 0 }, { opacity: 0.75, duration: 1.4 }, last + 2.8 + 2.5) // a breath, then his name
      .to(quote, { opacity: 0, duration: 3.5, ease: 'sine.inOut' }, '+=3.5') // his name holds, then it all goes as slowly
      // 4. As the track ends the light goes back into the dark.
      .to(light.state, { vis: 0, duration: 5, ease: 'sine.in' }, BED - 6);
    await tl;
    light.stop();
  }

  // 5. Black for a long breath. Then the credit comes up slowly, no sound of its own: the rain and the storm rise under it.
  await sleep(skipToCredit ? 1500 : 5500);
  onCredit?.();
  await gsap.timeline()
    .to(credit, { opacity: 0.85, duration: 3.5, ease: 'sine.inOut' })
    .to(credit, { opacity: 0, duration: 3, ease: 'sine.inOut' }, '+=3');
  el.remove();
}

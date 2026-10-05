// install.exe (untitled.exe once awake) opens an old oscillator: a hum under static. Tune it in, then sing "Daisy Bell"
// back to it, five rounds, from two notes to the whole line. You are waking something.
import { ICONS } from '../desktop/icons.js';
import { humTone, noteToFreq } from '../core/synths.js';
import { clarity, isTuned, ROUNDS, KEYS, createEcho } from './wake.logic.js';
import { scramble } from '../sequences/glitch.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createHum(audio) {
  const ctx = audio.context;
  if (!ctx) return { set() {}, stop() {} };
  const out = ctx.createGain();
  out.gain.value = 0.0;
  out.connect(audio.output('sfx'));
  out.gain.setTargetAtTime(0.5, ctx.currentTime, 0.6);
  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.value = 147; // D3: the hum is already the song's key
  const toneGain = ctx.createGain();
  tone.connect(toneGain); toneGain.connect(out);
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  const noiseGain = ctx.createGain();
  noise.connect(bp); bp.connect(noiseGain); noiseGain.connect(out);
  tone.start(); noise.start();
  return {
    set(c) {
      toneGain.gain.setTargetAtTime(0.05 + c * 0.25, ctx.currentTime, 0.08);
      noiseGain.gain.setTargetAtTime(0.35 * (1 - c), ctx.currentTime, 0.08);
      tone.detune.setTargetAtTime((1 - c) * (Math.random() * 300 - 150), ctx.currentTime, 0.1);
    },
    stop() { out.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { tone.stop(); noise.stop(); }, 1500); },
  };
}

export default {
  id: 'wake',
  title: 'install.exe', // renamed untitled.exe once it is awake (selfstart.js)
  icon: ICONS.unknown,
  window: { width: 580, height: 480, className: 'bare' },
  // double-click: it installs itself first (loaded lazily: the puzzle registry is imported by node tests, gsap is not)
  before: async (ctx) => (await import('../desktop/apps/install.js')).runInstall({ wm: ctx.wm, audio: ctx.audio }),
  mount(body, ctx) {
    body.classList.add('wake');
    body.innerHTML = `
      <div class="osc">
        <div class="osc-head"><span class="osc-brand">MERIDIAN · OSC-99</span><span class="osc-rounds">${ROUNDS.map(() => '<i></i>').join('')}</span></div>
        <div class="osc-scope"><canvas width="400" height="190"></canvas></div>
        <div class="wake-dial"><label>FREQ</label><input class="wake-tune" type="range" min="0" max="1" step="0.001" value="0.12"><b class="wake-meter">▁▁▁▁▁▁</b></div>
        <div class="wake-keys" hidden>${KEYS.map((n, i) => `<button data-note="${n}" aria-label="tone ${i + 1}"><span></span><kbd>${i + 1}</kbd></button>`).join('')}</div>
        <div class="osc-foot"><button class="wake-again" hidden>PLAY AGAIN</button><p class="wake-say"></p></div>
      </div>`;
    const canvas = body.querySelector('canvas');
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const dial = body.querySelector('.wake-tune');
    const meter = body.querySelector('.wake-meter');
    const keys = body.querySelector('.wake-keys');
    const say = body.querySelector('.wake-say');
    const again = body.querySelector('.wake-again');
    const leds = [...body.querySelectorAll('.osc-rounds i')];
    const hum = createHum(ctx.audio);
    let c = clarity(Number(dial.value));
    let tone = { f: 0, until: 0 }; // the note on the scope right now
    let raf = 0;
    // The scope: a graticule, and one phosphor trace. Static until tuned; then each note draws its own wave.
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      g.fillStyle = 'rgba(2, 14, 9, 0.55)'; // phosphor persistence: the old trace fades instead of vanishing
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(93, 255, 168, 0.08)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= W; x += W / 10) { g.moveTo(x, 0); g.lineTo(x, H); }
      for (let y = 0; y <= H; y += H / 6) { g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
      const on = now < tone.until;
      const cycles = on ? tone.f / 45 : 3;
      const amp = on ? H * 0.32 : c >= 1 ? H * 0.03 : H * 0.28 * c;
      g.strokeStyle = '#5dffa8';
      g.shadowColor = '#5dffa8';
      g.shadowBlur = 8;
      g.lineWidth = 1.6;
      g.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const noise = (1 - c) * (Math.random() - 0.5) * H * 0.7;
        const y = H / 2 + Math.sin((x / W) * cycles * Math.PI * 2 + now / 140) * amp + noise;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      g.shadowBlur = 0;
    };
    draw();

    return new Promise((resolve) => {
      let tunedFor = 0;
      let locked = false;
      let round = 0;
      let echo = createEcho(ROUNDS[0].notes);
      const showRound = () => {
        leds.forEach((l, i) => { l.className = i < round ? 'done' : i === round ? 'now' : ''; });
        body.dataset.round = String(round + 1);
        body.dataset.order = ROUNDS[round].notes.map((n) => KEYS.indexOf(n) + 1).join(''); // for the playbot
      };
      const sound = async (note, dur, gain) => {
        tone = { f: noteToFreq(note), until: performance.now() + dur * 1000 };
        const b = keys.querySelector(`[data-note="${note}"]`);
        b.classList.remove('lit'); void b.offsetWidth; b.classList.add('lit'); // the key lights as it sounds
        await humTone(ctx.audio, note, { dur, gain });
      };
      const singRound = async () => {
        const { notes, dur } = ROUNDS[round];
        keys.classList.add('listening');
        for (const n of notes) { await sound(n, dur); await sleep(dur * 180); }
        keys.classList.remove('listening');
      };
      const onTune = async () => {
        if (locked) return;
        ctx.activity();
        c = clarity(Number(dial.value));
        hum.set(c);
        meter.textContent = '▁▂▃▅▆█'.slice(0, Math.max(1, Math.round(c * 6))).padEnd(6, '▁');
        if (!isTuned(Number(dial.value))) { tunedFor = 0; return; }
        tunedFor = performance.now();
        await sleep(800);
        if (locked || !tunedFor || !isTuned(Number(dial.value))) return;
        locked = true;
        dial.disabled = true;
        c = 1;
        hum.set(1);
        await sleep(600);
        hum.stop();
        keys.hidden = false;
        again.hidden = false;
        showRound();
        await singRound();
        say.textContent = 'it is waiting.';
        keys.querySelector('button').focus();
      };
      dial.addEventListener('input', onTune);
      const press = async (note) => {
        if (keys.hidden || keys.classList.contains('listening') || keys.classList.contains('wrong')) return;
        ctx.activity();
        sound(note, 0.45, 0.18);
        const r = echo.press(note);
        if (r === 'wrong') { // the round's lights blink amber and it hums the round again
          keys.classList.add('wrong');
          ctx.audio.sfx('error_ding', { gain: 0.15, rate: 0.7 });
          await sleep(1300);
          keys.classList.remove('wrong');
          keys.classList.add('listening'); // no presses until the replay is over
          await sleep(1000); // a clear second after the blink, so the replay's first note can be seen
          await singRound();
        } else if (r === 'done') {
          round++;
          if (round < ROUNDS.length) {
            showRound();
            ctx.audio.sfx('hdd_seek', { gain: 0.2, rate: 1.4 }); // it takes what you sang
            echo = createEcho(ROUNDS[round].notes);
            keys.classList.add('listening'); // hands off until it has hummed the next round
            await sleep(1100);
            await singRound();
            return;
          }
          leds.forEach((l) => { l.className = 'done'; });
          keys.hidden = true;
          again.hidden = true;
          say.textContent = '';
          await sleep(500);
          cancelAnimationFrame(raf);
          g.fillStyle = '#000';
          g.fillRect(0, 0, W, H);
          await sleep(900);
          // something wakes: the whole machine hangs, stutters, and comes back
          if (ctx.world?.desktop) await scramble(ctx.world.desktop.el, ctx.audio, { duration: 3.6 });
          resolve();
        }
      };
      again.addEventListener('click', () => {
        if (keys.classList.contains('listening')) return;
        ctx.activity();
        ctx.audio.sfx('mouse_click', { gain: 0.5 });
        echo.reset();
        singRound();
      });
      keys.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) press(b.dataset.note); });
      body.addEventListener('keydown', (e) => { const i = Number(e.key) - 1; if (KEYS[i]) press(KEYS[i]); });
      body.tabIndex = 0;
      body.focus();
    });
  },
};

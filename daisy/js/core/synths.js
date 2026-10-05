// Live synthesis: Daisy's singing voice (formant synth, public-domain 1892 melody), the original startup chime, noise.
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteToFreq(note) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  if (!m) throw new Error(`bad note "${note}"`);
  const midi = 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

// "Daisy Bell" (Harry Dacre, 1892 — public domain), G major, 3/4.
export const DAISY_MELODY = [
  { note: 'D5', beats: 3, text: 'Dai', vowel: 'a' }, { note: 'B4', beats: 3, text: 'sy, ', vowel: 'i' },
  { note: 'G4', beats: 3, text: 'Dai', vowel: 'a' }, { note: 'D4', beats: 3, text: 'sy, ', vowel: 'i' },
  { note: 'E4', beats: 1, text: 'give ', vowel: 'i' }, { note: 'F#4', beats: 1, text: 'me ', vowel: 'i' },
  { note: 'G4', beats: 1, text: 'your ', vowel: 'o' }, { note: 'E4', beats: 2, text: 'an', vowel: 'a' },
  { note: 'G4', beats: 1, text: 'swer ', vowel: 'e' }, { note: 'D4', beats: 6, text: 'do.', vowel: 'u' },
  { note: 'A4', beats: 3, text: "I'm ", vowel: 'a' }, { note: 'D5', beats: 3, text: 'half ', vowel: 'a' },
  { note: 'B4', beats: 3, text: 'cra', vowel: 'e' }, { note: 'G4', beats: 3, text: 'zy, ', vowel: 'i' },
  { note: 'E4', beats: 1, text: 'all ', vowel: 'o' }, { note: 'F#4', beats: 1, text: 'for ', vowel: 'o' },
  { note: 'G4', beats: 1, text: 'the ', vowel: 'e' }, { note: 'A4', beats: 2, text: 'love ', vowel: 'a' },
  { note: 'B4', beats: 1, text: 'of ', vowel: 'o' }, { note: 'A4', beats: 6, text: 'you.', vowel: 'u' },
];
export const DAISY_PHRASE_1 = 10;

const FORMANTS = { a: [800, 1150, 2900], e: [400, 1700, 2600], i: [300, 2250, 3000], o: [450, 800, 2830], u: [325, 700, 2530] };

export function melodySchedule(melody, bpm) {
  const spb = 60 / bpm;
  let t = 0;
  return melody.map((n) => {
    const item = { t, dur: n.beats * spb, freq: noteToFreq(n.note), vowel: n.vowel, text: n.text };
    t += item.dur;
    return item;
  });
}

export function singDaisy(audio, { bpm = 144, notes = DAISY_PHRASE_1, gain = 0.45, onSyllable, reverb = 0 } = {}) {
  const ctx = audio.context;
  const sched = melodySchedule(DAISY_MELODY.slice(0, notes), bpm);
  const total = sched.at(-1).t + sched.at(-1).dur;
  if (!ctx) {
    const timers = sched.map((s) => setTimeout(() => onSyllable?.(s), s.t * 1000));
    return { length: total, done: new Promise((r) => setTimeout(r, (total + reverb) * 1000)), fade() {}, stop() { timers.forEach(clearTimeout); } };
  }
  const out = ctx.createGain();
  out.gain.value = gain;
  out.connect(audio.output('voice'));
  const env = ctx.createGain();
  env.gain.value = 0;
  env.connect(out);
  if (reverb > 0) {
    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, reverb);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    env.connect(conv); conv.connect(wet); wet.connect(out);
  }
  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.4;
  const vibAmt = ctx.createGain();
  vibAmt.gain.value = 14; // cents
  vib.connect(vibAmt);
  vibAmt.connect(src.detune);
  const filters = [0, 1, 2].map((i) => {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = [9, 12, 14][i];
    const g = ctx.createGain();
    g.gain.value = [1, 0.55, 0.28][i];
    src.connect(f); f.connect(g); g.connect(env);
    return f;
  });
  const t0 = ctx.currentTime + 0.05;
  for (const s of sched) {
    const t = t0 + s.t;
    src.frequency.setTargetAtTime(s.freq, t, 0.025);
    FORMANTS[s.vowel].forEach((fq, i) => filters[i].frequency.setTargetAtTime(fq, t, 0.03));
    env.gain.setTargetAtTime(1, t, 0.03);
    env.gain.setTargetAtTime(0.25, t + s.dur - 0.08, 0.03);
  }
  env.gain.setTargetAtTime(0, t0 + total - 0.1, 0.08);
  src.start(t0); vib.start(t0);
  src.stop(t0 + total + 0.5); vib.stop(t0 + total + 0.5);
  const timers = sched.map((s) => setTimeout(() => onSyllable?.(s), (s.t + 0.05) * 1000));
  return {
    length: total, // the melody itself; the reverb tail rings on after it
    done: new Promise((r) => setTimeout(r, (total + 0.1 + reverb) * 1000)),
    fade(seconds) { out.gain.setTargetAtTime(0, ctx.currentTime, seconds / 3); }, // melody and reverb tail together
    stop() {
      timers.forEach(clearTimeout);
      env.gain.cancelScheduledValues(ctx.currentTime);
      env.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      try { src.stop(ctx.currentTime + 0.05); vib.stop(ctx.currentTime + 0.05); } catch { /* stopped */ }
    },
  };
}

// Original startup chime: soft bell arpeggio over a swelling pad. Not derived from any Microsoft sound.
export function playChime(audio) {
  const ctx = audio.context;
  if (!ctx) return Promise.resolve();
  const out = ctx.createGain();
  out.gain.value = 0.32;
  out.connect(audio.output('sfx'));
  const t0 = ctx.currentTime + 0.05;
  ['C4', 'G4', 'E5', 'B5', 'D6'].forEach((n, i) => {
    const t = t0 + i * 0.13;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modAmt = ctx.createGain();
    const env = ctx.createGain();
    car.frequency.value = noteToFreq(n);
    mod.frequency.value = noteToFreq(n) * 3.5;
    modAmt.gain.value = noteToFreq(n) * 0.8;
    mod.connect(modAmt); modAmt.connect(car.frequency);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.01);
    env.gain.setTargetAtTime(0, t + 0.02, 0.9);
    car.connect(env); env.connect(out);
    car.start(t); mod.start(t); car.stop(t + 4); mod.stop(t + 4);
  });
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(300, t0);
  lp.frequency.linearRampToValueAtTime(1400, t0 + 1.6);
  const padEnv = ctx.createGain();
  padEnv.gain.setValueAtTime(0, t0);
  padEnv.gain.linearRampToValueAtTime(0.18, t0 + 1.2);
  padEnv.gain.setTargetAtTime(0, t0 + 1.8, 0.7);
  lp.connect(padEnv); padEnv.connect(out);
  for (const [n, d] of [['C3', -7], ['G3', 6], ['E4', -4]]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = noteToFreq(n);
    o.detune.value = d;
    o.connect(lp);
    o.start(t0); o.stop(t0 + 5);
  }
  return new Promise((r) => setTimeout(r, 3500));
}

export function noiseBurst(audio, { dur = 0.6, gain = 0.5, bus = 'sfx' } = {}) {
  const ctx = audio.context;
  if (!ctx) return;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
  src.connect(g);
  g.connect(audio.output(bus));
  src.start();
}

export function impulse(ctx, seconds, decay = 3) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

// Shepard–Risset glissando: octave-spaced sines that rise forever. pos 0..octaves; level is a sin² bell.
export function shepardVoice(i, t, octaves) {
  const pos = (((i + t) % octaves) + octaves) % octaves;
  return { pos, level: Math.sin((Math.PI * pos) / octaves) ** 2 };
}

export function shepardTone(audio, { gain = 0.1, cycle = 10, base = 55, octaves = 6 } = {}) {
  const ctx = audio.context;
  if (!ctx) return { stop() {} };
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(audio.output('music'));
  out.gain.setTargetAtTime(gain, ctx.currentTime, 1.2);
  const voices = Array.from({ length: octaves }, () => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g); g.connect(out); o.start();
    return { o, g };
  });
  const t0 = ctx.currentTime;
  const timer = setInterval(() => {
    const t = (ctx.currentTime - t0) / cycle;
    voices.forEach((v, i) => {
      const { pos, level } = shepardVoice(i, t, octaves);
      v.o.frequency.setTargetAtTime(base * 2 ** pos, ctx.currentTime, 0.04);
      v.g.gain.setTargetAtTime(level / octaves, ctx.currentTime, 0.04);
    });
  }, 40);
  return {
    stop(fade = 1.5) {
      out.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
      setTimeout(() => { clearInterval(timer); voices.forEach((v) => v.o.stop()); }, fade * 1000 + 200);
    },
  };
}

function burst(audio, { freq, q, dur, gain, bus = 'sfx', glide }) {
  const ctx = audio.context;
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  if (glide) f.frequency.exponentialRampToValueAtTime(glide, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(audio.output(bus));
  src.start();
}
export const clockTick = (audio, { gain = 0.35 } = {}) => burst(audio, { freq: 3200, q: 8, dur: 0.03, gain });
export const raindrop = (audio, { gain = 0.5 } = {}) => burst(audio, { freq: 1800, q: 14, dur: 0.09, gain, glide: 500, bus: 'ambience' });

// Daisy's wordless hum: a soft sine with vibrato, used by the wake puzzle.
export function humTone(audio, note, { dur = 0.8, gain = 0.22 } = {}) {
  const ctx = audio.context;
  if (!ctx) return new Promise((r) => setTimeout(r, dur * 1000));
  const o = ctx.createOscillator();
  o.frequency.value = noteToFreq(note);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5;
  const vibAmt = ctx.createGain();
  vibAmt.gain.value = 9;
  vib.connect(vibAmt); vibAmt.connect(o.detune);
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.08);
  g.gain.setTargetAtTime(0, t + dur - 0.15, 0.08);
  o.connect(g); g.connect(audio.output('voice'));
  o.start(t); vib.start(t); o.stop(t + dur + 0.4); vib.stop(t + dur + 0.4);
  return new Promise((r) => setTimeout(r, dur * 1000));
}

export function mumble(audio, seconds, { gain = 0.25 } = {}) {
  const ctx = audio.context;
  if (!ctx) return new Promise((r) => setTimeout(r, seconds * 1000));
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = 210;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1100;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.value = 0;
  o.connect(bp); bp.connect(g); g.connect(audio.output('voice'));
  const t0 = ctx.currentTime;
  for (let t = 0; t < seconds; t += 0.11 + Math.random() * 0.12) {
    const on = Math.random() > 0.18;
    g.gain.setTargetAtTime(on ? gain * (0.5 + Math.random() * 0.5) : 0, t0 + t, 0.02);
    o.frequency.setTargetAtTime(180 + Math.random() * 70, t0 + t, 0.03);
  }
  g.gain.setTargetAtTime(0, t0 + seconds, 0.05);
  o.start(t0);
  o.stop(t0 + seconds + 0.3);
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

// The club down the street, through two walls: a 124 bpm kick and an off-beat sub, low-passed to a thud. Generated.
export function clubBass(audio, { gain = 0.1, bpm = 124 } = {}) {
  const ctx = audio.context;
  if (!ctx) return { stop() {} };
  const out = ctx.createGain();
  out.gain.value = gain;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 150;
  lp.connect(out);
  out.connect(audio.output('ambience'));
  const beat = 60 / bpm;
  const LINE = [55, 55, 65.41, 49];
  let next = ctx.currentTime + 0.1;
  let n = 0;
  const timer = setInterval(() => {
    while (next < ctx.currentTime + 0.3) {
      const kick = ctx.createOscillator();
      const kg = ctx.createGain();
      kick.frequency.setValueAtTime(110, next);
      kick.frequency.exponentialRampToValueAtTime(40, next + 0.12);
      kg.gain.setValueAtTime(0.9, next);
      kg.gain.exponentialRampToValueAtTime(0.001, next + 0.3);
      kick.connect(kg).connect(lp);
      kick.start(next);
      kick.stop(next + 0.32);
      const sub = ctx.createOscillator();
      const sg = ctx.createGain();
      sub.type = 'sawtooth';
      sub.frequency.value = LINE[(n >> 2) % LINE.length];
      sg.gain.setValueAtTime(0, next + beat / 2);
      sg.gain.linearRampToValueAtTime(0.35, next + beat / 2 + 0.02);
      sg.gain.exponentialRampToValueAtTime(0.001, next + beat * 0.95);
      sub.connect(sg).connect(lp);
      sub.start(next + beat / 2);
      sub.stop(next + beat);
      next += beat;
      n++;
    }
  }, 100);
  return {
    stop(fade = 1) {
      out.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3));
      setTimeout(() => { clearInterval(timer); out.disconnect(); }, fade * 1000 + 300);
    },
  };
}

// A 1999 pager on a desk: three short buzzes. Generated.
export function pagerBuzz(audio, { gain = 0.25 } = {}) {
  const ctx = audio.context;
  if (!ctx) return;
  const out = ctx.createGain();
  out.gain.value = gain;
  out.connect(audio.output('sfx'));
  for (let k = 0; k < 3; k++) {
    const t = ctx.currentTime + k * 0.32;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 150 + Math.random() * 8;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.01);
    g.gain.setValueAtTime(1, t + 0.18);
    g.gain.linearRampToValueAtTime(0, t + 0.2);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.22);
  }
}

// The PC speaker: a bare square-wave beep, the sound a machine makes when it does something by itself.
export function pcBeep(audio, { freq = 880, dur = 0.12, at = 0, gain = 0.07 } = {}) {
  const ctx = audio.context, out = audio.output('sfx');
  if (!ctx || !out) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.setValueAtTime(0, t + dur); // hard on, hard off: no envelope on a 1999 PC speaker
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.01);
}

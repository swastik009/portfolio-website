// Real North American Precise Tone Plan frequencies and cadences (what a 1999 phone line actually sounded like).
export const TONES = {
  dial: { freqs: [350, 440], on: Infinity, off: 0 },
  busy: { freqs: [480, 620], on: 0.5, off: 0.5 },
  ringback: { freqs: [440, 480], on: 2, off: 4 },
  fax: { freqs: [1100], on: 0.5, off: 3 },     // CNG calling tone
  carrier: { freqs: [2100], on: Infinity, off: 0 }, // modem answer tone
};
// Special Information Tones ("the number you have dialed...")
export const SIT = [[913.8, 0.274], [1370.6, 0.274], [1776.7, 0.38]];
export const DTMF = {
  1: [697, 1209], 2: [697, 1336], 3: [697, 1477],
  4: [770, 1209], 5: [770, 1336], 6: [770, 1477],
  7: [852, 1209], 8: [852, 1336], 9: [852, 1477],
  '*': [941, 1209], 0: [941, 1336], '#': [941, 1477],
};

export function cadence(name, seconds) {
  if (name === 'sit') {
    const out = [];
    let t = 0;
    while (t < seconds) {
      for (const [f, d] of SIT) { out.push({ t, dur: d, freqs: [f] }); t += d; }
      t += 2;
    }
    return out;
  }
  const tone = TONES[name];
  if (!tone) throw new Error(`unknown tone "${name}"`);
  const out = [];
  for (let t = 0; t < seconds; t += tone.on + tone.off) {
    out.push({ t, dur: Math.min(tone.on, seconds - t), freqs: tone.freqs });
    if (!Number.isFinite(tone.on)) break;
  }
  return out;
}

export function dtmfSequence(number, { on = 0.09, gap = 0.07 } = {}) {
  return [...String(number)].filter((c) => DTMF[c]).map((c, i) => ({ t: i * (on + gap), dur: on, freqs: DTMF[c] }));
}

export function playSegments(audio, segments, { gain = 0.12, line = true } = {}) {
  const ctx = audio.context;
  const duration = segments.length ? Math.max(...segments.map((s) => s.t + s.dur)) : 0;
  if (!ctx) return { stop() {}, duration };
  const out = ctx.createGain();
  out.gain.value = gain;
  let dest = out;
  const nodes = [];
  if (line) {
    // Telephone band-pass + faint hiss: it should sound like it came down a copper wire.
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
    hp.connect(lp); lp.connect(out);
    dest = hp;
    const hiss = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.02;
    hiss.buffer = buf; hiss.loop = true; hiss.connect(hp); hiss.start();
    nodes.push(hiss);
  }
  out.connect(audio.output('sfx'));
  const t0 = ctx.currentTime + 0.03;
  for (const seg of segments) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0 + seg.t);
    env.gain.linearRampToValueAtTime(1, t0 + seg.t + 0.01);
    const end = Number.isFinite(seg.dur) ? t0 + seg.t + seg.dur : t0 + 3600;
    env.gain.setValueAtTime(1, end - 0.01);
    env.gain.linearRampToValueAtTime(0, end);
    env.connect(dest);
    for (const f of seg.freqs) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(env);
      o.start(t0 + seg.t);
      o.stop(end + 0.02);
      nodes.push(o);
    }
  }
  return {
    duration,
    stop() {
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      for (const n of nodes) { try { n.stop(ctx.currentTime + 0.1); } catch { /* already stopped */ } }
    },
  };
}

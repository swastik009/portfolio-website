// Daisy's body sounds: tiny live-synth blips, cute while she is weak. `evil` (her growth, 0…1) pulls every sound lower
// and darker and adds a detuned twin, so the same hop sounds wrong by the end. No assets: oscillators and noise only.
export const VOICE_SOUNDS = ['hop', 'land', 'poke', 'nudge', 'wake', 'joy', 'tantrum', 'deflate', 'shiver', 'surprise', 'squish',
  'dizzy', 'yawn', 'stutter', 'maskSlip', 'powerUp', 'glitch', 'charge'];

export function daisyVoice(audio, name, { evil = 0, impact = 60 } = {}) {
  const ctx = audio.context, out = audio.output('voice');
  if (!ctx || !out) return;
  const now = ctx.currentTime;
  const pitch = 1 - 0.32 * evil;
  const dark = ctx.createBiquadFilter();
  dark.type = 'lowpass';
  dark.frequency.value = 6000 - 4200 * evil;
  dark.connect(out);

  // One voice: an oscillator gliding f0 → f1, with optional vibrato (Hz, depth in Hz) and tremolo (Hz).
  function tone({ type = 'sine', f0, f1 = f0, at = 0, dur, gain = 0.2, vib, trem }) {
    for (const detune of evil > 0.35 ? [0, 22 + 30 * evil] : [0]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.detune.value = detune;
      const t0 = now + at;
      o.frequency.setValueAtTime(f0 * pitch, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain * (detune ? 0.6 : 1), t0 + Math.min(0.015, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      if (vib) lfo(vib[0], vib[1] * pitch, o.frequency, t0, dur);
      if (trem) { const tg = ctx.createGain(); tg.gain.value = 0.5; g.connect(tg).connect(dark); lfo(trem, 0.5, tg.gain, t0, dur); } else g.connect(dark);
      o.connect(g);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
  }
  function lfo(hz, depth, param, t0, dur) {
    const l = ctx.createOscillator(), d = ctx.createGain();
    l.frequency.value = hz;
    d.gain.value = depth;
    l.connect(d).connect(param);
    l.start(t0);
    l.stop(t0 + dur + 0.05);
  }
  function noise({ at = 0, dur, gain = 0.15, hz = 2000, crush = 1 }) {
    const len = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let held = 0;
    for (let i = 0; i < len; i++) { if (i % crush === 0) held = Math.random() * 2 - 1; d[i] = held * (1 - i / len); } // crush: sample-and-hold
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf;
    f.type = 'bandpass';
    f.frequency.value = hz;
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dark);
    src.start(now + at);
  }

  const R = {
    hop: () => tone({ f0: 380, f1: 820, dur: 0.11, gain: 0.16 }),
    land: () => { const k = Math.min(1, impact / 120); tone({ f0: 150, f1: 55, dur: 0.12, gain: 0.25 * k + 0.04 }); noise({ dur: 0.05, gain: 0.05 * k, hz: 400 }); },
    poke: () => tone({ type: 'triangle', f0: 950, f1: 480, dur: 0.17, gain: 0.16, vib: [28, 60] }),
    nudge: () => { tone({ f0: 520, dur: 0.07, gain: 0.12 }); tone({ f0: 690, at: 0.08, dur: 0.1, gain: 0.12 }); },
    wake: () => tone({ f0: 210, f1: 470, dur: 1.1, gain: 0.1, vib: [5, 9] }),
    joy: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f0: f, at: i * 0.06, dur: 0.08, gain: 0.05 })),
    tantrum: () => [0, 0.26, 0.52].forEach((at) => tone({ type: 'sawtooth', f0: 130, f1: 95, at, dur: 0.18, gain: 0.08, trem: 22 })),
    deflate: () => tone({ type: 'triangle', f0: 620, f1: 260, dur: 0.75, gain: 0.12, vib: [6, 14] }),
    shiver: () => tone({ type: 'triangle', f0: 740, f1: 700, dur: 0.6, gain: 0.08, trem: 26 }),
    surprise: () => tone({ f0: 400, f1: 1150, dur: 0.1, gain: 0.14 }),
    squish: () => { tone({ type: 'triangle', f0: 300, f1: 900, dur: 0.09, gain: 0.13 }); tone({ type: 'triangle', f0: 900, f1: 600, at: 0.09, dur: 0.08, gain: 0.1 }); },
    dizzy: () => tone({ f0: 520, f1: 480, dur: 1.2, gain: 0.08, vib: [7, 140] }),
    yawn: () => tone({ type: 'triangle', f0: 520, f1: 230, dur: 0.85, gain: 0.08, vib: [4, 10] }),
    glitch: () => { noise({ dur: 0.07, gain: 0.12, hz: 1800, crush: 24 }); tone({ type: 'square', f0: 80 + Math.random() * 200, dur: 0.05, gain: 0.04 }); },
    stutter: () => [0, 0.32, 0.48].forEach((at) => { noise({ at, dur: 0.05, gain: 0.1, hz: 2400, crush: 30 }); tone({ type: 'square', f0: 120, at, dur: 0.04, gain: 0.04 }); }),
    // Charging up: a rising, trembling sweep that lands on a bright two-note pop.
    charge: () => { tone({ f0: 180, f1: 880, dur: 1.25, gain: 0.09, trem: 16 }); noise({ dur: 1.25, gain: 0.03, hz: 3000, crush: 6 }); tone({ type: 'square', f0: 784, at: 1.3, dur: 0.07, gain: 0.05 }); tone({ type: 'square', f0: 1175, at: 1.38, dur: 0.12, gain: 0.05 }); },
    // The small evil ones: a low chuckle under the cute, a growl that winds up.
    maskSlip: () => { [170, 150, 128].forEach((f, i) => tone({ type: 'square', f0: f, f1: f * 0.94, at: i * 0.09, dur: 0.06, gain: 0.06 })); noise({ dur: 0.12, gain: 0.06, hz: 900, crush: 40 }); },
    powerUp: () => { tone({ type: 'sawtooth', f0: 65, f1: 230, dur: 1.4, gain: 0.08, trem: 14 }); tone({ type: 'sawtooth', f0: 66, f1: 236, dur: 1.4, gain: 0.06 }); noise({ dur: 1.4, gain: 0.05, hz: 600 }); },
  };
  R[name]?.();
}

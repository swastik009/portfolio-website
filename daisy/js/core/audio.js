// Web Audio mixer: master <- {music(ducked), sfx, ambience, voice}. Every call is a safe no-op without a context.
export const BUSES = ['music', 'sfx', 'ambience', 'voice'];

const defaultFetch = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.arrayBuffer();
};

export function createAudio({ createContext = () => new AudioContext(), fetchArrayBuffer = defaultFetch } = {}) {
  let ctx = null;
  let failed = false;
  const buses = {};
  const buffers = new Map();
  let duckGain = null;
  let music = null; // { src, gain, name }
  let tension = null; // { gain, nodes }

  function ensure() {
    if (ctx) return true;
    if (failed) return false;
    try {
      ctx = createContext();
    } catch (err) {
      failed = true;
      console.warn('[audio] unavailable, continuing silently', err);
      return false;
    }
    buses.master = ctx.createGain();
    buses.master.connect(ctx.destination);
    duckGain = ctx.createGain();
    duckGain.connect(buses.master);
    for (const name of BUSES) {
      buses[name] = ctx.createGain();
      buses[name].connect(name === 'music' ? duckGain : buses.master);
    }
    return true;
  }

  const audio = {
    ensure,
    unlock() {
      if (!ensure()) return false;
      ctx.resume?.();
      return true;
    },
    get context() { return ctx; },
    output: (bus) => buses[bus] ?? null,
    has: (name) => buffers.has(name),

    async load(manifest, onProgress) {
      if (!ensure()) { onProgress?.(1); return; }
      const entries = Object.entries(manifest);
      let done = 0;
      await Promise.all(entries.map(async ([name, url]) => {
        try {
          buffers.set(name, await ctx.decodeAudioData(await fetchArrayBuffer(url)));
        } catch (err) {
          console.warn(`[audio] skipped "${name}"`, err);
        } finally {
          onProgress?.(++done / entries.length);
        }
      }));
    },

    sfx(name, { gain = 1, rate = 1, bus = 'sfx', loop = false, detune = 0, pan = 0, lowpass = 0, delay = 0, offset = 0 } = {}) {
      if (!ctx || !buffers.has(name)) return null;
      const src = ctx.createBufferSource();
      src.buffer = buffers.get(name);
      src.loop = loop;
      src.playbackRate.value = rate;
      src.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = gain;
      if (lowpass > 0) { // distance: far things lose their top end
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = lowpass;
        src.connect(lp);
        lp.connect(g);
      } else src.connect(g);
      if (ctx.createStereoPanner) { // callers can steer a moving sound: src.panner.pan, src.gainNode.gain
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        p.connect(buses[bus]);
        src.panner = p;
      } else g.connect(buses[bus]);
      src.gainNode = g;
      src.start(ctx.currentTime + Math.max(0, delay), Math.max(0, offset));
      return src;
    },

    fadeBus(bus, v, seconds = 1) {
      if (!ctx || !buses[bus]) return;
      buses[bus].gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, Math.max(0.01, seconds / 3));
    },

    playMusic(name, { fade = 3 } = {}) {
      if (!ctx || !buffers.has(name) || music?.name === name) return;
      audio.stopMusic({ fade });
      const src = ctx.createBufferSource();
      src.buffer = buffers.get(name);
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(1, ctx.currentTime, fade / 3);
      src.connect(gain);
      gain.connect(buses.music);
      src.start();
      music = { src, gain, name };
    },

    stopMusic({ fade = 2 } = {}) {
      if (!ctx || !music) return;
      const { src, gain } = music;
      gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
      src.stop(ctx.currentTime + fade + 0.1);
      music = null;
    },

    // Procedural tension layer: low detuned drone + 60 bpm sub "heartbeat". level 0 = silent.
    setTension(level) {
      if (!ctx) return;
      if (!tension) {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(buses.music);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420;
        lp.connect(gain);
        const oscs = [55, 55.4, 82.4].map((f) => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.connect(lp);
          o.start();
          return o;
        });
        const beat = ctx.createOscillator();
        beat.frequency.value = 48;
        const beatGain = ctx.createGain();
        beatGain.gain.value = 0;
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 1;
        const lfoAmt = ctx.createGain();
        lfoAmt.gain.value = 0.35;
        lfo.connect(lfoAmt);
        lfoAmt.connect(beatGain.gain);
        beat.connect(beatGain);
        beatGain.connect(gain);
        beat.start();
        lfo.start();
        tension = { gain, nodes: [...oscs, beat, lfo] };
      }
      tension.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.22, ctx.currentTime, 1.2);
    },

    duck(on) {
      if (!ctx) return;
      duckGain.gain.setTargetAtTime(on ? 0.35 : 1, ctx.currentTime, 0.25);
    },

    setVolume(bus, v) {
      if (!ctx || !buses[bus]) return;
      buses[bus].gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.05);
    },
  };
  return audio;
}

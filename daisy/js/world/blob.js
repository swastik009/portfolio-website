// Daisy drawn as pixel art: a fuzzy blob, redrawn per pixel each frame so the physics can squash it and the eyes can follow you.
// Physics at 120 Hz, drawing stepped at `fps` (animated-character timing, not app smoothness).
import { SIZE, FLOOR, MOODS, BAYER, GLITCHES, createBody, stepBody, hop, poke, nudge, pupilOffset, stepLook, palette, hash } from './blob.logic.js';

const RX = 15, RY = 12; // body radii in pixels at rest

// onSound(name, { impact }): hop, land, poke, nudge, wake, glitch and every act — the caller decides how she sounds.
export function createBlob(canvas, { fps = 15, onSound = () => {} } = {}) {
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  const mask = new Uint8Array(SIZE * SIZE);
  const body = createBody();
  let mood = MOODS.weak, moodName = 'weak';
  let pal = palette(0), stage = 0, dim = 1, reveal = 1;
  let look = { x: 0, y: 0 }, lookTarget = { x: 0, y: 0 };
  let t = 0, blinkIn = 2, blinkLeft = 0, lidOverride = null, idle = 0, frame = 0;
  let base = 'weak', averting = 0, squint = false, flashT = 0, glitchLeft = 0, glitchKind = 'tear', glitchRate = null, restOverride = null, pokes = [];
  let raf = 0, last = 0, acc = 0, drawAcc = 0;

  function put(i, j, c, a = 255) {
    if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) return;
    const o = (j * SIZE + i) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = a;
  }

  function draw() {
    frame++;
    const lit = dim * reveal; // reveal: the wake's palette fade, held in steps like an 8-bit fade from black
    const P = lit < 1 ? pal.map((c) => c.map((v) => Math.round(v * lit))) : pal; // in the dark only the glints show
    img.data.fill(0);
    mask.fill(0);
    const breath = 1 + mood.breathe * Math.sin(t * Math.PI * 2 * mood.breatheHz);
    const quiver = mood.tremble ? 0.012 * Math.sin(t * 47) : 0;
    const s = body.s * breath + quiver;
    const rx = RX / Math.sqrt(s), ry = RY * s;
    const bottom = FLOOR - body.y;
    const jitter = mood.shiver && Math.random() < mood.shiver ? (frame % 2 ? 1 : -1) : 0;
    const cx = SIZE / 2 + body.x + jitter, cy = bottom - ry;
    const shear = (v) => body.lean * (bottom - v) / (2 * ry);
    // Body coordinates of a pixel centre.
    const toBody = (i, j) => [(i + 0.5 - cx - shear(j + 0.5)) / rx, (j + 0.5 - cy) / ry];

    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
      const [bx, by] = toBody(i, j);
      const n = by > 0 ? 3.2 : 2.1; // flat where she sits, round on top
      const d = (Math.abs(bx) ** n + Math.abs(by) ** n) ** (1 / n);
      const a = Math.atan2(by, bx);
      const bin = Math.floor((a + Math.PI) * 11);
      let fur = by < 0.7 ? 0.16 * (hash(bin, 3) - 0.5) : 0; // tufts fixed to the body
      if (mood.spikes && by < 0.3) fur += mood.spikes * 0.34 * hash(bin, Math.floor(t * 10)) * (bin % 2); // hackles up, flickering
      const lumps = by < 0 ? 0.05 * Math.cos(3 * a + 0.4) : 0;
      const edge = 1 + fur + lumps;
      if (d >= edge) continue;
      mask[j * SIZE + i] = 1;
      const smooth = (e0, e1, x) => { const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d) ** 2));
      let v = 0.18 + 0.62 * Math.max(0, -0.5 * bx - 0.55 * by + 0.67 * nz); // key light, top-left
      v += 0.1 * (hash(Math.floor(bx * 7 + by * 3), Math.floor(by * 7)) - 0.5); // soft fur clumps
      v -= 0.22 * smooth(0.82, 1, d / edge); // fluffy, darker rim
      v -= 0.25 * smooth(0.2, 1, by); // she sits in her own shadow
      const tone = Math.max(0, Math.min(3, Math.floor(v * 4 + (BAYER[(j % 4) * 4 + (i % 4)] - 0.5) * 0.7)));
      put(i, j, P[tone]);
    }
    // Ink: a 1 px outline around the mask.
    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
      if (mask[j * SIZE + i]) continue;
      const m = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && mask[y * SIZE + x];
      if (m(i - 1, j) || m(i + 1, j) || m(i, j - 1) || m(i, j + 1)) put(i, j, P[4]);
    }

    // Face. The whole face turns toward you; eyes are drawn pixel by pixel.
    const face = pupilOffset(look, 5, 5);
    const eyeAt = (side) => {
      const bx = side * 0.36, by = -0.1;
      const y = cy + by * ry;
      return [Math.round(cx + bx * rx + shear(y)) + face.x, Math.round(y) + face.y];
    };
    const blinking = blinkLeft > 0 ? 1 : 0;
    const lid = Math.min(1, Math.max(lidOverride ?? mood.lid, blinking, squint && mood.lid < 0.95 ? 0.45 : 0));
    // Weak, a glitch shows what's under the grey: for those frames her eyes are the city's red, then grey again.
    const redEyes = glitchLeft > 0 && stage < 0.1;
    const ink = redEyes ? [200, 22, 14] : P[4], white = redEyes ? [255, 42, 31] : [255, 255, 255], lidC = P[1];
    for (const side of [-1, 1]) {
      const [ex, ey] = eyeAt(side);
      const { ew, eh } = mood;
      const x0 = ex - Math.floor(ew / 2), y0 = ey - Math.floor(eh / 2);
      if (mood.eye === 'arc' && !blinking) { // ^ ^
        const h = Math.floor(ew / 2);
        for (let c = 0; c < ew; c++) put(x0 + c, y0 + Math.abs(c - h), ink);
        continue;
      }
      if (mood.eye === 'line') { for (let c = 0; c < ew; c++) put(x0 + c, y0 + eh - 1, ink); continue; }
      if (mood.eye === 'x') {
        for (let c = 0; c < ew; c++) { put(x0 + c, y0 + c, ink); put(x0 + ew - 1 - c, y0 + c, ink); }
        continue;
      }
      if (lid >= 0.95) { // shut: a soft curve
        for (let c = 0; c < ew; c++) put(x0 + c, y0 + eh - 1 - (c === 0 || c === ew - 1 ? 1 : 0), ink);
        continue;
      }
      for (let r = 0; r < eh; r++) for (let c = 0; c < ew; c++) {
        const dx = (c + 0.5 - ew / 2) / (ew / 2), dy = (r + 0.5 - eh / 2) / (eh / 2);
        if (dx * dx + dy * dy > 1.25) continue;
        const inner = ew > 1 ? ((c / (ew - 1)) * 2 - 1) * -side : 0; // 1 at the inner corner
        const cover = lid * eh - mood.tilt * eh * inner * 0.5;
        if (r < Math.floor(cover)) { put(x0 + c, y0 + r, lidC); continue; }
        let col = r === Math.floor(cover) && cover > 0.5 ? P[0] : ink;
        if (mood.eye === 'white' && dx * dx + dy * dy < 0.6 && col === ink) { // sclera, and a pupil that hunts for you
          const po = pupilOffset(look, ew - 2, eh - 2), p = mood.pupil;
          const pc = Math.round((ew - p) / 2) + po.x, pr = Math.round((eh - p) / 2) + po.y;
          col = c >= pc && c < pc + p && r >= pr && r < pr + p ? ink : white;
        }
        put(x0 + c, y0 + r, col);
      }
      const gr = Math.max(1, Math.ceil(lid * eh)); // the glint sits just under the lid
      if (mood.glints >= 1 && gr < eh - 1) put(x0 + (side < 0 ? 0 : 1) + (ew > 3 ? 1 : 0), y0 + gr, white);
      if (mood.glints >= 2 && lid < 0.4) put(x0 + ew - 2, y0 + eh - 2, white);
      if (mood.blush || mood.mouth === 'wobble' || mood.eye === 'arc') put(x0 + (side < 0 ? -1 : ew), y0 + eh, P[3]); // blush
    }
    const [lx, ly] = eyeAt(-1), [rxx] = eyeAt(1);
    const mx = Math.round((lx + rxx) / 2), my = ly + Math.ceil(mood.eh / 2) + 2;
    const row = (y, from, to, c = ink) => Array.from({ length: to - from + 1 }, (_, k) => [from + k, y, c]);
    const mouths = {
      smile: [[-1, 0], [0, 1], [1, 0]],
      frown: [[-1, 1], [0, 0], [1, 1]],
      wobble: frame % 4 < 2 ? [[-2, 0], [-1, 1], [0, 0], [1, 1]] : [[-2, 1], [-1, 0], [0, 1], [1, 0]],
      o: [[-1, 0], [0, 0], [-1, 1], [0, 1]],
      smirk: [[-2, 1], [-1, 1], [0, 1], [1, 0], [2, -1]],
      grit: [[-2, 0], [-1, 1], [0, 0], [1, 1], [2, 0]],
      roar: [...row(0, -2, 2), [-2, 1], [-1, 1, white], [0, 1], [1, 1, white], [2, 1], ...row(2, -2, 2)],
      grin: [...row(0, -3, 3), [-3, 1], ...row(1, -2, 2, white), [3, 1], ...row(2, -2, 2)],
    };
    for (const [dx, dy, c = ink] of mouths[mood.mouth] ?? []) put(mx + dx, my + dy, c);

    // 8-bit fade-in: pixels appear in ordered-dither steps, like an old console fading up from black.
    // Reflection on the floor: mirrored, dimmed, dithered.
    for (let j = FLOOR + 1; j < SIZE; j++) {
      const src = 2 * FLOOR - j;
      const fade = 0.32 * (1 - (j - FLOOR) / (SIZE - FLOOR));
      for (let i = 0; i < SIZE; i++) {
        const o = (src * SIZE + i) * 4;
        if (!img.data[o + 3] || BAYER[(j % 4) * 4 + (i % 4)] > fade * 2.2) continue;
        put(i, j, [img.data[o] * fade, img.data[o + 1] * fade, img.data[o + 2] * fade].map(Math.round));
      }
    }
    if (glitchLeft > 0) breakImage(glitchKind);
    ctx.putImageData(img, 0, 0);
  }

  // Glitches act on the finished frame, so every mood and animation can break the same way.
  function breakImage(kind) {
    const d = img.data, copy = d.slice();
    const px = (i, j) => (j * SIZE + i) * 4;
    if (kind === 'tear') { // bands of rows slip sideways
      for (let k = 0; k < 3; k++) {
        const y0 = Math.floor(Math.random() * FLOOR), h = 1 + Math.floor(Math.random() * 4), dx = Math.random() < 0.5 ? -3 : 2;
        for (let j = y0; j < Math.min(SIZE, y0 + h); j++) for (let i = 0; i < SIZE; i++) d.set(copy.subarray(px((i - dx + SIZE) % SIZE, j), px((i - dx + SIZE) % SIZE, j) + 4), px(i, j));
      }
    } else if (kind === 'dropout') { // 2x2 blocks of her go missing
      for (let j = 0; j < SIZE; j += 2) for (let i = 0; i < SIZE; i += 2) if (hash(i + frame, j) < 0.35) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) d[px(i + a, j + b) + 3] = 0;
    } else if (kind === 'invert') { // one wrong-coloured frame
      for (let o = 0; o < d.length; o += 4) if (d[o + 3]) { d[o] = 255 - d[o]; d[o + 1] = 255 - d[o + 1]; d[o + 2] = 255 - d[o + 2]; }
    } else if (kind === 'ghost') { // a second, offset copy of her, lagging behind
      const dx = frame % 2 ? 4 : -3;
      for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
        const o = px(i, j), src = px(Math.min(SIZE - 1, Math.max(0, i - dx)), j);
        if (!d[o + 3] && copy[src + 3]) { d.set(copy.subarray(src, src + 3).map((v) => v * 0.45), o); d[o + 3] = 255; }
      }
    } else if (kind === 'scan') { // every other row lost, like a bad signal
      for (let j = frame % 2; j < SIZE; j += 2) for (let i = 0; i < SIZE; i++) d[px(i, j) + 3] = 0;
    } else if (kind === 'shift') { // the whole top half slides off the bottom half
      const cut = 12 + Math.floor(Math.random() * 16), dx = Math.random() < 0.5 ? -2 : 2;
      for (let j = 0; j < cut; j++) for (let i = 0; i < SIZE; i++) d.set(copy.subarray(px((i - dx + SIZE) % SIZE, j), px((i - dx + SIZE) % SIZE, j) + 4), px(i, j));
    }
  }

  function step(dt) {
    t += dt;
    idle += dt;
    if (averting > 0) averting -= dt;
    // The tell: when she lies she can't look at you — down and away.
    const want = averting > 0 ? { x: lookTarget.x >= 0 ? -1 : 1, y: 1 } : lookTarget;
    if (mood.track) look = stepLook(look, want, dt, averting > 0 ? 8 : mood.track);
    blinkIn -= dt;
    if (blinkLeft > 0) blinkLeft -= dt;
    if (glitchLeft > 0) glitchLeft -= dt;
    const rate = glitchRate ?? mood.glitchy ?? 0;
    if (rate && glitchLeft <= 0 && Math.random() < rate * dt) api.glitch(); // early on, she breaks by herself
    if (blinkIn <= 0 && mood.lid < 1 && !mood.noBlink) { blinkLeft = moodName === 'weak' ? 0.32 : 0.13; blinkIn = 1.8 + Math.random() * 4; }
    if (mood.hops && !body.air && Math.random() < mood.hops * dt) hop(body, 6 + Math.random() * 8);
    // You stopped moving: she bumps toward you for attention. Not in the dark — she is too weak to reach yet.
    if (idle > 5 && mood.track > 0.3 && dim >= 1) { idle = 0; api.nudge(Math.sign(lookTarget.x) || 1); }
    const sway = mood.sway ? Math.sin(t * Math.PI * 2 * (mood.swayHz ?? 0.13)) * mood.sway : 0;
    const wound = body.windup > 0, fall = body.vy, wasUp = body.y > 0;
    stepBody(body, dt, { rest: restOverride ?? mood.rest, leanTo: mood.track ? look.x * 1.6 + sway : sway });
    if (wound && body.windup <= 0) onSound('hop');
    if (wasUp && body.y === 0 && fall < 0) onSound('land', { impact: -fall });
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    acc += dt;
    while (acc >= 1 / 120) { step(1 / 120); acc -= 1 / 120; }
    drawAcc += dt;
    if (drawAcc >= 1 / api.fps) { drawAcc %= 1 / api.fps; if (!(glitchLeft > 0 && glitchKind === 'freeze')) draw(); } // freeze: she hangs, then snaps on
  }

  const api = {
    fps,
    body,
    get mood() { return moodName; },
    setMood(name) { if (!MOODS[name]) return; clearTimeout(flashT); base = name; show(name); },
    // A mood for a moment, then back to the one she was in.
    flash(name, ms) { clearTimeout(flashT); show(name); flashT = setTimeout(() => show(base), ms); },
    // kind: one of GLITCHES, or random. ms: how long it lasts (a freeze wants longer).
    glitch(kind = GLITCHES[Math.floor(Math.random() * GLITCHES.length)], ms, quiet = false) {
      if (!quiet) onSound('glitch');
      glitchKind = kind;
      glitchLeft = (ms ?? { freeze: 450, invert: 70, ghost: 300 }[kind] ?? 200 + Math.random() * 150) / 1000;
    },
    // How often she glitches by herself (per second); null = the mood decides (weak glitches, healthy moods don't).
    setGlitchRate(r) { glitchRate = r; },
    act(name) { if (ACTS[name]) { onSound(name); ACTS[name](); } },
    setStage(v) { stage = Number(v) || 0; pal = palette(stage); },
    setDim(v) { dim = v; }, // 0 = black, only her eye glints; 1 = fully lit
    // The power-up: colour and light change in stuttering steps, she stretches, tears, then pops. Resolves when done.
    charge({ dim: toDim = dim, stage: toStage = stage } = {}) {
      const fromDim = dim, fromStage = stage;
      onSound('charge');
      body.vs += 3.2;
      const steps = [0.15, 0, 0.35, 0.2, 0.6, 0.45, 0.85, 0.7, 1];
      steps.forEach((f, k) => later(150 + k * 140, () => {
        dim = fromDim + (toDim - fromDim) * f;
        api.setStage(fromStage + (toStage - fromStage) * f);
      }));
      later(600, () => api.glitch('tear', 160, true));
      return new Promise((done) => later(150 + steps.length * 140, () => { hop(body, 10); api.flash('surprised', 900); later(900, done); }));
    },
    lookAt(x, y) { lookTarget = { x, y }; idle = 0; },
    avert(ms) { averting = ms / 1000; },
    setSquint(on) { squint = on; }, // a light in her eyes
    hop(h) { hop(body, h); },
    poke(dir) {
      poke(body, dir);
      onSound('poke');
      blinkLeft = 0.25;
      pokes = [...pokes.filter((p) => t - p < 1.5), t];
      if (pokes.length >= 4) { pokes = []; api.act('dizzy'); } // poke her too much and her head spins
    },
    nudge(dir) { nudge(body, dir); onSound('nudge'); },
    // Asleep → weak: lids flutter, a small stretch, then she stays half-awake and starts to follow you.
    // Resolves once she is up. In the dark (dim < 1) all you see is two glints opening.
    // Black while her window opens, then an 8-bit palette fade: a few held brightness steps, no dissolve. Eyes shut, then
    // they open slowly, droop once, and settle half-open. In the dark (dim < 1) that's a dim shape and two glints.
    wake() {
      api.setMood('asleep');
      reveal = 0;
      const FADE = [0.12, 0.25, 0.42, 0.62, 0.82, 1]; // each held ~0.3 s: low-fps, stepped
      FADE.forEach((v, k) => later(1800 + k * 300, () => { reveal = v; }));
      const open = 1800 + FADE.length * 300 + 500;
      later(open, () => { onSound('wake'); body.vs += 1.5; });
      const lids = [0.92, 0.84, 0.76, 0.68, 0.6, 0.82, 1, 0.9, 0.78, 0.66, 0.56, 0.5]; // slowly up, a drowsy droop, up again
      lids.forEach((l, k) => later(open + k * 170, () => { lidOverride = l; }));
      return new Promise((done) => later(open + lids.length * 170 + 300, () => { api.setMood('weak'); done(); }));
    },
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
  function show(name) { mood = MOODS[name]; moodName = name; lidOverride = null; }
  const later = (ms, f) => setTimeout(f, ms);
  // One-shot animations. Each is physics plus a borrowed face; she returns to her mood afterwards.
  const ACTS = {
    joy: () => { api.flash('happy', 1800); hop(body, 18); later(900, () => hop(body, 9)); },
    tantrum: () => { api.flash('angry', 1400); [0, 260, 520].forEach((ms, k) => later(ms, () => { hop(body, 5); body.vlean += (k % 2 ? 7 : -7); })); },
    deflate: () => { api.flash('sad', 2200); restOverride = 0.66; later(2200, () => { restOverride = null; }); },
    shiver: () => api.flash('scared', 1400),
    surprise: () => { api.flash('surprised', 1000); body.vs += 4; },
    squish: () => { body.vs -= 5; blinkLeft = 0.3; },
    dizzy: () => api.flash('dizzy', 2600),
    yawn: () => { api.flash('sleepy', 1800); restOverride = 1.12; later(700, () => { restOverride = 0.8; }); later(1800, () => { restOverride = null; }); },
    // The mask slips: for a few frames the cute face is something else.
    maskSlip: () => { api.flash('stare', 160); api.glitch('tear', 160, true); },
    // A weak boot-up stutter: freeze, tear, a lost frame, then she's back.
    stutter: () => { api.glitch('freeze', 300, true); later(320, () => api.glitch('tear', 140, true)); later(480, () => api.glitch('scan', 120, true)); later(620, () => { body.vs -= 2; }); },
    powerUp: () => { api.flash('furious', 2400); body.vs += 3; later(300, () => hop(body, 4)); later(600, () => hop(body, 4)); },
  };
  draw();
  return api;
}

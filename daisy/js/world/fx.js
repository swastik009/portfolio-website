// Stylised weather and screens: inked rain on glass, rain outside, the building across the street, the Y2K news TV.
import * as THREE from 'three';

// uFog 0..1: clear glass → fogged with condensation (always, now): the city goes soft behind it, lights bloom into
// blobs, drops that have run leave clear tracks, beads catch the light. All in one pass: no blur, no render target.
export const GLASS_LIGHTS = 16; // how many real lights the window glass can blur at once

export function createRainGlass() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uClub: { value: new THREE.Color(0xff2a1f) }, uClubLevel: { value: 0 }, uFog: { value: 1 }, uFlash: { value: 0 }, uBokeh: { value: 0 }, uCarA: { value: new THREE.Vector3() }, uCarB: { value: new THREE.Vector3() },
      uSrc: { value: Array.from({ length: GLASS_LIGHTS }, () => new THREE.Vector4()) }, uSrcCol: { value: Array.from({ length: GLASS_LIGHTS }, () => new THREE.Color()) }, uAspect: { value: 1 }, uLit: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime, uOpacity; uniform vec3 uClub; uniform float uClubLevel, uFog, uFlash, uBokeh, uLit, uAspect;
      uniform vec3 uCarA, uCarB; // street traffic below the sill: (x across the pane, strength, 0 headlights / 1 tail lights / 2 lightbar)
      uniform vec4 uSrc[${GLASS_LIGHTS}]; uniform vec3 uSrcCol[${GLASS_LIGHTS}]; // real lights behind the pane: (uv, strength, spread), colour
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 uv = vUv;
        vec3 col = vec3(0.0);
        float cols = 46.0;
        float id = floor(uv.x * cols);
        float fx = fract(uv.x * cols);
        float y = fract(uv.y - uTime * (0.12 + hash(id) * 0.3) + hash(id * 3.1)); // uv.y runs top -> bottom: minus is downhill
        float runs = step(0.55, hash(id * 7.7));
        float streak = smoothstep(0.07, 0.0, abs(fx - 0.5)) * smoothstep(0.0, 0.2, y) * step(y, 0.3) * runs;
        float drop = smoothstep(0.14, 0.0, distance(vec2(fx, fract(uv.y * cols * 0.6 + hash(id))), vec2(0.5)));
        drop *= step(0.8, hash(id * 1.3));
        col += vec3(0.75, 0.82, 1.0) * (streak * 0.6 + drop * 0.3);
        float a = 0.1 + streak * 0.55 + drop * 0.4;

        // condensation: uneven haze, wiped clear down the tracks old drops ran (they wander a little)
        float haze = 0.62 + 0.28 * noise(uv * vec2(5.0, 3.0)) + 0.1 * noise(uv * 23.0);
        float wob = (noise(vec2(id, uv.y * 6.0)) - 0.5) * 0.5;
        float track = runs * smoothstep(0.2, 0.05, abs(fx - 0.5 + wob)) * step(0.35, hash(id * 5.3));
        // beads: small still drops, each one a tiny lens catching the light
        vec2 bc = uv * vec2(90.0, 60.0), bf = fract(bc) - 0.5;
        float bead = step(0.86, hash2(floor(bc))) * smoothstep(0.32, 0.12, length(bf));
        vec3 fogCol = vec3(0.04, 0.045, 0.075);
        // the city's real lights (Dan's Den, the beer sign, the monorail's lamps), out of focus in the fog where each one
        // actually sits behind the glass: a soft blob, no hard edge
        for (int k = 0; k < ${GLASS_LIGHTS}; k++) {
          float d = length((uv - uSrc[k].xy) * vec2(uAspect, 1.0));
          fogCol += uSrcCol[k] * uSrc[k].z * exp(-d * d / uSrc[k].w) * 0.42 * uBokeh; // w: how far it spreads
        }
        // cars on the street below: their lights catch the fogged bottom of the pane and slide across it as they pass
        for (int k = 0; k < 2; k++) {
          vec3 car = k == 0 ? uCarA : uCarB;
          float glow = car.y * exp(-pow((uv.x - car.x) * 5.0, 2.0)) * smoothstep(0.55, 1.0, uv.y);
          vec3 lamp = car.z > 1.5 ? mix(vec3(1.0, 0.08, 0.06), vec3(0.15, 0.3, 1.0), step(0.5, fract(uTime * 2.6))) * 1.6 // a lightbar: red, blue
                                  : mix(vec3(1.0, 0.93, 0.8), uClub, car.z);
          fogCol += glow * lamp * 0.42;
        }
        fogCol += vec3(0.55, 0.6, 0.75) * uFlash * haze * 0.5;
        // fog only shows where light catches it: with the street dark it thins to a faint film, not a grey sheet
        float lit = mix(0.35, 1.0, uLit);
        float fogA = lit * haze * 0.85 * (1.0 - track * 0.85);
        col = mix(col, fogCol + col * 0.4 + bead * 0.08 * uLit, uFog);
        a = mix(a, max(fogA, a) * (1.0 - bead * 0.35) + bead * 0.15, uFog);
        gl_FragColor = vec4(col, a * uOpacity); // uOpacity: the pane fades back when the camera is right up at it
      }`,
  });
}

// Rain beyond the glass: thin streaks that are nearly invisible except where they cross a light (street lamps, the
// club sign, the neon, the train). getLights() → [{ pos: Vector3, color: Color, radius, level }].
export function createOutsideRain(count = 1400, getLights = () => []) {
  const pos = new Float32Array(count * 6);
  const col = new Float32Array(count * 6);
  const drops = Array.from({ length: count }, () => ({
    x: 1.8 + Math.random() * 10, y: Math.random() * 11 - 6, z: -6 + Math.random() * 11, v: 6 + Math.random() * 3,
  }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const object = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  object.frustumCulled = false;
  object.userData.noInk = true;
  const base = [0.05, 0.06, 0.09];
  function update(dt) {
    const lights = getLights();
    drops.forEach((d, i) => {
      d.y -= d.v * dt;
      if (d.y < -6) d.y += 11;
      const k = i * 6;
      pos[k] = d.x; pos[k + 1] = d.y; pos[k + 2] = d.z;
      pos[k + 3] = d.x - 0.02; pos[k + 4] = d.y + 0.18; pos[k + 5] = d.z;
      let r = base[0], g = base[1], b = base[2];
      for (const l of lights) {
        const dx = d.x - l.pos.x, dy = d.y - l.pos.y, dz = d.z - l.pos.z;
        const f = l.level * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / l.radius);
        r += l.color.r * f; g += l.color.g * f; b += l.color.b * f;
      }
      col[k] = col[k + 3] = r; col[k + 1] = col[k + 4] = g; col[k + 2] = col[k + 5] = b;
    });
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  update(0);
  return { object, update };
}

export function createBuildingTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 768;
  const g = c.getContext('2d');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const wins = [];
  for (let r = 0; r < 9; r++) {
    for (let col = 0; col < 14; col++) {
      const lit = Math.random() < 0.18;
      wins.push({ x: 30 + col * 71, y: 40 + r * 80, lit, color: lit ? (Math.random() < 0.7 ? '#ffb45a' : '#9ec7ff') : '#0c0a18' });
    }
  }
  const flicker = wins.filter((w) => w.lit)[3] ?? wins[0];
  function draw(on) {
    g.fillStyle = '#16122a';
    g.fillRect(0, 0, c.width, c.height);
    for (const w of wins) {
      g.fillStyle = w === flicker && !on ? '#0c0a18' : w.color;
      g.fillRect(w.x, w.y, 40, 52);
      g.fillStyle = '#0a0814';
      g.fillRect(w.x + 19, w.y, 2, 52);
    }
    texture.needsUpdate = true;
  }
  draw(true);
  let last = true;
  return {
    texture,
    tick(t) {
      const on = Math.sin(t * 7) + Math.sin(t * 13.3) > -1.2;
      if (on !== last) { last = on; draw(on); }
    },
  };
}

export function createTvTexture(getClock = () => 1382) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 240;
  const g = c.getContext('2d');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const noise = document.createElement('canvas');
  noise.width = 160; noise.height = 120;
  const ng = noise.getContext('2d');
  const img = ng.createImageData(160, 120);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data.set([v, v, v, 255], i); }
  ng.putImageData(img, 0, 0);
  let frame = 0;
  let scroll = 0;
  let snow = false; // after the blackout the station is gone: only snow
  const snowImg = g.createImageData(160, 120);
  return {
    texture,
    get snow() { return snow; },
    setStatic(on) { snow = on; },
    tick() {
      if (snow) { // every frame: fresh snow, a slow rolling bright band, the odd dark tear
        const band = (performance.now() / 18) % 160 - 20;
        const d = snowImg.data;
        for (let y = 0; y < 120; y++) {
          const lift = Math.max(0, 1 - Math.abs(y - band) / 14) * 50;
          const tear = Math.random() < 0.015 ? 0.4 : 1;
          for (let x = 0; x < 160; x++) {
            const v = Math.min(255, (Math.random() ** 1.6 * 235 + lift) * tear);
            const i = (y * 160 + x) * 4;
            d[i] = v; d[i + 1] = v; d[i + 2] = Math.min(255, v + 10); d[i + 3] = 255;
          }
        }
        ng.putImageData(snowImg, 0, 0);
        g.imageSmoothingEnabled = false;
        g.drawImage(noise, 0, 0, 320, 240);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        for (let y = 0; y < 240; y += 3) g.fillRect(0, y, 320, 1);
        texture.needsUpdate = true;
        return;
      }
      if (++frame % 4) return; // ~15 fps, like a cheap CRT TV
      g.fillStyle = '#1b2f63';
      g.fillRect(0, 0, 320, 240);
      g.fillStyle = '#e8e8f0';
      g.font = 'bold 24px sans-serif';
      g.fillText('COUNTDOWN TO 2000', 16, 44);
      const left = Math.max(0, 1440 - getClock());
      g.font = 'bold 56px monospace';
      g.fillText(`00:${String(left).padStart(2, '0')}:00`, 30, 130);
      g.fillStyle = '#c7a12a';
      g.fillRect(0, 196, 320, 30);
      g.fillStyle = '#111';
      g.font = '18px sans-serif';
      scroll = (scroll + 4) % 1700;
      g.fillText('2000 HAS ARRIVED IN AUCKLAND · SYDNEY · TOKYO · MOSCOW · LONDON · NEW YORK · CHICAGO · DENVER  ·  NEXT: THE WEST COAST  ·  ', 320 - scroll, 218);
      g.globalAlpha = 0.18;
      g.drawImage(noise, -Math.random() * 40, -Math.random() * 30, 400, 300);
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < 240; y += 3) g.fillRect(0, y, 320, 1);
      texture.needsUpdate = true;
    },
  };
}

// Light through a wet pane: drop shadows sliding down the wall. Each drop appears, runs (little ones crawl, heavy ones
// slip fast, and stretch), fades, and comes back somewhere else: a loop, never a build-up. Each is a soft lens: a
// faint dark rim round a brighter centre, small enough to read as water, not bubbles.
export function createRainLightMap() {
  const S = 384, LIT = '#d4d4d4';
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const spawn = (d = {}) => {
    const r = 0.4 + Math.random() ** 2 * 1.2; // the neon throws this across the whole wall: a pixel here is a fingertip there
    return Object.assign(d, { x: Math.random() * S, y: Math.random() * S * 0.9 - 10, r, v: 8 + r * r * 56 + Math.random() * 30,
      age: 0, life: 1.2 + Math.random() * 3 });
  };
  // the clingers: they sit on the glass a while, then creep down a little, catch, creep again, and fade
  const cling = (d = {}) => Object.assign(spawn(d), { cling: true, r: 0.7 + Math.random() * 0.9, v: 0, hold: 1.5 + Math.random() * 4, life: 6 + Math.random() * 7 });
  const drops = [
    ...Array.from({ length: 70 }, () => { const d = spawn(); d.age = Math.random() * d.life; return d; }),
    ...Array.from({ length: 140 }, () => { const d = cling(); d.age = Math.random() * d.life; return d; }),
  ];
  const lens = (x, y, r, stretch, a) => {
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.scale(1, stretch);
    const grad = g.createRadialGradient(0, -r * 0.2, 0, 0, 0, r);
    grad.addColorStop(0, '#f4f4f4');
    grad.addColorStop(0.45, '#c8c8c8');
    grad.addColorStop(0.72, '#8a8a8a'); // a faint rim, not a dark ring
    grad.addColorStop(1, 'rgba(120,120,120,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  let acc = 0;
  return {
    texture,
    tick(dt) {
      if ((acc += dt) < 1 / 24) return;
      const step = acc;
      acc = 0;
      g.globalAlpha = 1;
      g.fillStyle = LIT;
      g.fillRect(0, 0, S, S);
      for (const d of drops) {
        d.age += step;
        if (d.age > d.life || d.y > S + 8) { (d.cling ? cling : spawn)(d); continue; }
        if (d.cling) { // still, then a slow creep, then caught again
          if ((d.hold -= step) > 0) d.v = 0;
          else { d.v = 5 + d.r * 8; if (Math.random() < step * 0.5) d.hold = 1 + Math.random() * 3; }
        }
        d.y += d.v * step;
        d.x += (Math.random() - 0.5) * 0.4;
        const fade = Math.min(1, d.age / 0.2, (d.life - d.age) / 0.3); // in, run, out
        const stretch = 1 + Math.min(1.8, d.v / 70); // the fast ones pull long
        lens(d.x, d.y, d.r, stretch, fade);
        if (d.v > 45) lens(d.x, d.y - d.r * stretch * 2.2, d.r * 0.45, 2.5, fade * 0.35); // a faint wet tail
      }
      texture.needsUpdate = true;
    },
  };
}

// Lit-window grid computed from world position, so any box becomes a building. Each window is interior-mapped: the ray
// from the eye continues into a fake 1.2 m-deep room behind the glass (back wall, sides, floor, ceiling), so rooms shift
// with real parallax. Some rooms have curtains, some a TV, now and then someone crosses. Height fog + aerial perspective
// sink the mid band into the night; uStage.x / .y / .w are the skyline / mid / near band light levels (staged blackout).
export function createCityWindowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFog: { value: new THREE.Color(0x5b6688) }, uSky: { value: new THREE.Color(0x1c1830) }, uStage: { value: new THREE.Vector4(1, 1, 1, 1) }, uFlash: { value: 0 } },
    vertexShader: `varying vec3 vW; varying vec3 vN; varying float vD;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
      vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uFlash; uniform vec3 uFog, uSky; uniform vec4 uStage; varying vec3 vW; varying vec3 vN; varying float vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      vec3 room(vec3 hit, float face, float r, float lit) {          // face: 0 back, 1 side, 2 floor, 3 ceiling
        vec3 wall = mix(vec3(0.16, 0.12, 0.10), vec3(0.10, 0.12, 0.16), step(0.5, h(vec2(r, 9.0))));
        vec3 lamp = mix(vec3(1.0, 0.72, 0.38), vec3(0.55, 0.78, 1.0), step(0.86, r));
        float tv = step(0.93, h(vec2(r, 5.0))) * (0.6 + 0.4 * sin(uTime * 9.0 + r * 50.0));
        vec3 c = face < 0.5 ? wall : face < 1.5 ? wall * 0.7 : face < 2.5 ? wall * 0.45 : wall * 1.25;
        c *= lit * mix(lamp, vec3(0.5, 0.65, 1.0), tv) * 2.2;
        float curtain = step(0.6, h(vec2(r, 3.1))) * step(face, 0.5);
        c = mix(c, lamp * lit * 0.55 * (0.8 + 0.2 * step(0.5, fract(hit.x * 14.0))), curtain * 0.75);
        float who = h(vec2(r, floor(uTime * 0.2)));
        float person = step(0.96, who) * step(face, 0.5) * step(abs(hit.x - fract(uTime * 0.2) ), 0.07) * step(hit.y, 0.75);
        return c * (1.0 - person * 0.85);
      }
      void main(){
        vec3 n = normalize(vN);
        float level = vW.x >= 40.0 ? uStage.x : vW.x >= 24.0 ? uStage.y : uStage.w; // skyline / mid / near: each band dies on its own breaker
        // Thick PS1-era fog (Spider-Man, 2000) that starts at Dan's Den: near blocks stay crisp, everything
        // beyond sinks into pale fog lit by the city; denser near the ground. It dims with the lights in a blackout.
        float lit = (uStage.x + uStage.y + uStage.w) / 3.0;
        float fogK = smoothstep(8.5, 40.0, vW.x);
        float hFog = clamp(1.0 - (vW.y + 6.0) / 18.0, 0.0, 1.0);
        float air = clamp(fogK * 0.38 + hFog * fogK * 0.15 + (1.0 - exp(-vD / 120.0)) * 0.1, 0.0, 0.6);
        vec3 airCol = mix(uFog * (0.3 + 0.7 * lit), uSky, clamp((vW.y - 4.0) / 50.0, 0.0, 0.6));
        airCol += vec3(0.5, 0.56, 0.8) * uFlash;                         // lightning lights the fog from inside
        if (abs(n.y) > 0.5) { gl_FragColor = vec4(mix(vec3(0.05, 0.045, 0.09) + vec3(0.02, 0.02, 0.035) * step(0.0, n.y), airCol, air), 1.0); return; }
        vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));             // along the facade
        vec2 p = vec2(dot(vW, t), vW.y);
        vec2 cellSz = vec2(1.3, 1.7);
        vec2 cell = floor(p / cellSz), f = fract(p / cellSz);
        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.78);
        float r = h(cell + floor(vW.x * 0.1) + n.xz * 7.0);
        float on = step(0.62, r) * (1.0 - step(0.996, h(cell + floor(uTime * 0.7)))) * level;
        vec3 d = normalize(vW - cameraPosition);                       // interior mapping
        vec3 dl = vec3(dot(d, t) / (cellSz.x * 0.64), d.y / (cellSz.y * 0.56), dot(d, -n) / 1.2);
        vec3 o = vec3((f.x - 0.18) / 0.64, (f.y - 0.22) / 0.56, 0.0);
        vec3 tt = vec3((step(0.0, dl.x) - o.x) / dl.x, (step(0.0, dl.y) - o.y) / dl.y, 1.0 / max(dl.z, 1e-4));
        float tm = min(min(tt.x, tt.y), tt.z);
        vec3 hit = o + dl * tm;
        float face = tm == tt.z ? 0.0 : tm == tt.x ? 1.0 : dl.y < 0.0 ? 2.0 : 3.0;
        vec3 inside = room(hit, face, r, on);
        float sill = smoothstep(0.03, 0.0, abs(f.y - 0.2)) * 0.05;
        float grime = clamp(1.0 - (vW.y + 6.0) / 6.0, 0.0, 1.0) * 0.45 + smoothstep(0.22, 0.0, f.y) * step(0.18, f.x) * step(f.x, 0.82) * 0.25;
        vec3 c = vec3(0.045, 0.04, 0.08) * (1.0 - grime) + sill;
        c = mix(c, inside + vec3(0.02, 0.025, 0.04), win);
        gl_FragColor = vec4(mix(c, airCol, air * (1.0 - win * on * 0.45)), 1.0); // lit windows glow through the fog
      }`,
  });
}

// The train's side windows: separate panes in dark frames, most lit warm, some dark (empty seats), a few with someone
// standing. Lit or not, the panes are recessed glass, so the cars read as boxes with windows, not a flat band.
export function createTrainPaneMap() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#05060a';
  g.fillRect(0, 0, 1024, 128);
  const N = 9, W = 1024 / N;
  for (let k = 0; k < N; k++) {
    const x = k * W + 8, w = W - 16;
    const lit = rnd() > 0.22;
    const grad = g.createLinearGradient(0, 10, 0, 118);
    grad.addColorStop(0, lit ? '#fff3d0' : '#141824');
    grad.addColorStop(1, lit ? '#d9b878' : '#090b12');
    g.fillStyle = grad;
    g.fillRect(x, 10, w, 108);
    if (lit && rnd() < 0.45) { // a passenger: head and shoulders against the light
      const px = x + 14 + rnd() * (w - 40);
      g.fillStyle = 'rgba(20, 16, 22, 0.85)';
      g.beginPath(); g.arc(px + 12, 52, 11, 0, Math.PI * 2); g.fill();
      g.fillRect(px - 2, 64, 28, 54);
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.08)'; // a glint across the glass
    g.fillRect(x + w * 0.15, 10, 6, 108);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A row of bright window rectangles: projected by the train's SpotLight so its windows sweep across the room.
export function createTrainWindowMap() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#fff6dc';
  for (let x = 12; x < 512; x += 46) g.fillRect(x, 40, 30, 46);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Neon faces for the pub across the street. Each tube is drawn three times: a wide soft halo, the glass tube, and a
// white-hot core. Everything is white; the material colour tints it and its scalar drives brightness (and bloom).
function neonCanvas(w, h, tubes, backing = '#0e0a10') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = backing;
  g.fillRect(0, 0, w, h);
  g.lineJoin = g.lineCap = 'round';
  const pass = (lw, blur, alpha) => {
    g.save();
    g.shadowColor = '#fff'; g.shadowBlur = blur; g.globalAlpha = alpha;
    g.strokeStyle = '#fff'; g.lineWidth = lw;
    tubes(g);
    g.restore();
  };
  pass(10, 30, 0.35);
  pass(6, 8, 0.8);
  pass(2, 0, 1);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// The vertical blade: DAN'S stacked over DEN as hollow tube letters, a double tube border and a dash between the words.
export function createClubSignMap() {
  const W = 256, H = 552;
  return neonCanvas(W, H, (g) => {
    g.strokeRect(16, 16, W - 32, H - 32);
    g.strokeRect(28, 28, W - 56, H - 56);
    g.font = '900 58px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    ['D', 'A', 'N', 'S'].forEach((ch, i) => g.strokeText(ch, W / 2, 72 + i * 62));
    g.strokeText('\u2019', W / 2 + 54, 200); // the apostrophe hangs between N and S
    g.beginPath(); g.moveTo(78, 322); g.lineTo(W - 78, 322); g.stroke();
    ['D', 'E', 'N'].forEach((ch, i) => g.strokeText(ch, W / 2, 374 + i * 62));
  });
}

// A window sign: a frothy mug and BEER in tube script.
// The cyan hoarding on Dan's roof: a software firm selling Y2K fixes on the last night they matter. White tubes; the
// material's colour makes them cyan and drives the flicker, so the room's cyan light still comes from here.
export function createY2kBillboardMap() {
  return neonCanvas(1024, 364, (g) => {
    g.beginPath(); g.roundRect(18, 18, 988, 328, 26); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 96px "Arial Black", Impact, sans-serif';
    g.strokeText('MILLENNIA SYSTEMS', 512, 118, 900);
    g.beginPath(); g.moveTo(150, 190); g.lineTo(874, 190); g.stroke();
    g.font = 'italic 700 64px Arial, sans-serif';
    g.strokeText('IS YOUR PC Y2K READY?', 512, 258, 860);
    g.font = '700 30px Arial, sans-serif';
    g.strokeText('SOFTWARE  ·  CONSULTING  ·  555-2000', 512, 316, 760);
  }, '#0b0f14');
}

// Unlit shop signs on Dan's block: painted boards, read only by the street light that falls on them. kinds: left to right
// in the atlas.
export function createShopSignAtlas(kinds) {
  const W = 160, H = 420;
  const draw = {
    wok: (g) => {
      g.fillStyle = '#f2c230'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#b3261e'; g.fillRect(8, 8, W - 16, H - 16);
      g.fillStyle = '#f2c230'; g.font = '900 54px Georgia, serif'; g.textAlign = 'center';
      ['G', 'O', 'L', 'D', 'E', 'N'].forEach((c, i) => g.fillText(c, W / 2, 62 + i * 46));
      g.beginPath(); g.ellipse(W / 2, 352, 46, 18, 0, 0, Math.PI); g.fill(); g.fillRect(W / 2 + 40, 344, 34, 8); // the wok
      g.font = '700 26px Georgia, serif'; g.fillText('WOK', W / 2, 404);
    },
    pizza: (g) => {
      g.fillStyle = '#f4efe2'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1f6b3a'; g.fillRect(0, 0, W, 22); g.fillStyle = '#c62f24'; g.fillRect(0, H - 22, W, 22);
      g.fillStyle = '#e8a33a'; g.beginPath(); g.moveTo(W / 2, 150); g.lineTo(W / 2 - 52, 46); g.lineTo(W / 2 + 52, 46); g.fill(); // a slice
      g.fillStyle = '#c62f24'; for (const [x, y] of [[-14, 70], [12, 82], [-2, 106]]) { g.beginPath(); g.arc(W / 2 + x, y, 8, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#c62f24'; g.font = 'italic 900 50px "Arial Black", Arial, sans-serif'; g.textAlign = 'center';
      ['P', 'I', 'Z', 'Z', 'A'].forEach((c, i) => g.fillText(c, W / 2, 210 + i * 44));
    },
    deli: (g) => {
      g.fillStyle = '#20324f'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#e9dcb8'; g.lineWidth = 5; g.strokeRect(12, 12, W - 24, H - 24);
      g.fillStyle = '#e9dcb8'; g.font = '700 30px Georgia, serif'; g.textAlign = 'center';
      g.fillText('SAL\'S', W / 2, 70);
      g.font = '900 64px Georgia, serif';
      ['D', 'E', 'L', 'I'].forEach((c, i) => g.fillText(c, W / 2, 150 + i * 62));
      g.font = '700 22px Georgia, serif'; g.fillText('24 HRS', W / 2, 392);
    },
  };
  // one atlas, the boards side by side: all the signs share one texture (and one mesh)
  const c = document.createElement('canvas');
  c.width = W * kinds.length; c.height = H;
  const g = c.getContext('2d');
  kinds.forEach((k, i) => { g.save(); g.translate(i * W, 0); draw[k](g); g.restore(); });
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createBeerSignMap() {
  return neonCanvas(512, 256, (g) => {
    g.beginPath(); g.moveTo(70, 92); g.lineTo(78, 206); g.lineTo(152, 206); g.lineTo(160, 92); g.stroke(); // glass
    g.beginPath(); g.arc(164, 148, 28, -Math.PI / 2, Math.PI / 2); g.stroke();                               // handle
    g.beginPath(); for (let k = 0; k < 3; k++) g.arc(86 + k * 29, 84, 16, Math.PI, 0); g.stroke();           // foam
    g.font = 'italic 900 92px "Arial Black", Impact, sans-serif';
    g.textBaseline = 'middle';
    g.strokeText('BEER', 222, 150);
  }, '#140d0a');
}

// A soft halo that hugs a rectangular sign: a blurred rect (shadow trick, works without ctx.filter) for additive glow cards.
export function createGlowMap() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(255,255,255,0.7)';
  g.shadowBlur = 26;
  g.shadowOffsetX = 1000;
  g.fillRect(34 - 1000, 34, 60, 60);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Maya's photo, low-poly: a jittered triangle field for a dusk sky and sea, two figures in flat facets. Once the real
// print exists (a 3:4 mosaic, e.g. from Gemini), point MAYA_PRINT at it: it is drawn under the same border and stamp.
const MAYA_PRINT = 'assets/photos/maya-desk.jpg';
export function createPhotoTexture() {
  const W = 240, H = 320;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cols = 8, rows = 10;
  const pts = [];
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const edge = x === 0 || y === 0 || x === cols || y === rows;
    pts.push([x * W / cols + (edge ? 0 : (rnd() - 0.5) * 22), y * H / rows + (edge ? 0 : (rnd() - 0.5) * 22)]);
  }
  const P = (x, y) => pts[y * (cols + 1) + x];
  const shade = (y) => {
    const k = y / H;
    const top = [48, 36, 88], horizon = [214, 120, 120], sea = [30, 58, 96];
    const a = k < 0.55 ? top : horizon, b = k < 0.55 ? horizon : sea, t = k < 0.55 ? k / 0.55 : (k - 0.55) / 0.45;
    return a.map((v, i) => Math.round(v + (b[i] - v) * t + (rnd() - 0.5) * 18));
  };
  const tri = (p, q, r, rgb) => { g.fillStyle = `rgb(${rgb})`; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.lineTo(...r); g.closePath(); g.fill(); };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = P(x, y), b = P(x + 1, y), d = P(x, y + 1), e = P(x + 1, y + 1);
    tri(a, b, d, shade((a[1] + d[1]) / 2));
    tri(b, e, d, shade((b[1] + e[1]) / 2 + 6));
  }
  const poly = (fill, ...pp) => { g.fillStyle = fill; g.beginPath(); g.moveTo(...pp[0]); for (const p of pp.slice(1)) g.lineTo(...p); g.closePath(); g.fill(); };
  // him: hood up, dark facets
  poly('#1b1a24', [40, 320], [52, 228], [78, 196], [112, 200], [132, 236], [140, 320]);
  poly('#262433', [68, 200], [80, 150], [104, 140], [124, 158], [126, 196], [112, 204]);
  poly('#3a3242', [86, 168], [104, 160], [116, 174], [108, 196], [90, 194]);
  // maya: long dark hair, yellow scarf, leaning in, laughing
  poly('#2a1d22', [120, 320], [126, 238], [150, 206], [196, 210], [212, 250], [206, 320]);
  poly('#e2b23c', [136, 236], [158, 222], [190, 226], [184, 248], [146, 252]);
  poly('#c69a7f', [146, 196], [150, 168], [170, 156], [190, 168], [188, 198], [170, 210]);
  poly('#1a1216', [140, 210], [138, 164], [160, 140], [194, 146], [204, 180], [200, 236], [190, 200], [190, 168], [170, 156], [150, 168], [148, 214]);
  poly('#f1e2cf', [162, 190], [178, 188], [172, 196]); // the smile
  // the camera's date stamp (no white border: the print fills the frame)
  const frame = () => {
    g.fillStyle = '#ff9a3c'; g.font = 'bold 13px monospace'; g.fillText("'99 8 14", W - 82, H - 16);
  };
  frame();
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (!MAYA_PRINT) return texture;
  const img = new Image(); // cover-fit
  img.onload = () => {
    const k = Math.max(W / img.width, H / img.height);
    g.imageSmoothingEnabled = false; // keep the mosaic blocky
    g.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
    frame();
    texture.needsUpdate = true;
  };
  img.src = MAYA_PRINT;
  return texture;
}

// ---------- printed things in the room: paper the room lights, ink the hand wrote ----------
// A rough ballpoint scrawl (Reenie Beanie, OFL, vendored). Room textures wait on handReady so they never bake a fallback.
const HAND = "'Reenie Beanie', 'Bradley Hand', cursive";
const hand = (size) => `${Math.round(size * 1.3)}px ${HAND}`; // the face runs small; 1.3 keeps the old layout sizes
export const handReady = new FontFace('Reenie Beanie', 'url(assets/fonts/ReenieBeanie.ttf)').load()
  .then((f) => { document.fonts.add(f); }, () => {});
function paper(w, h, draw, background = '#e8e1cc') {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2; // 2x: thin pen strokes and dots survive the mip chain
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.fillStyle = background;
  g.fillRect(0, 0, w, h);
  draw(g, w, h);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
// Letter by letter, and no two letters alike: each glyph is drawn off-canvas, then bent along both axes by its own
// random wave, scaled and slanted a little, so a page full of 5s reads as a hand, not a font.
function handGlyph(g, ch, x, y, px, color, rnd) {
  const K = 3; // warped at 3x and drawn down, so thin strokes and dots survive the slicing
  const S = Math.ceil(px * 2.2), pad = Math.ceil(px * 0.4), base = Math.ceil(px * 1.5); // room for tall ascenders
  const W = S * K;
  const [glyphA, glyphB] = [0, 0].map(() => Object.assign(document.createElement('canvas'), { width: W, height: W })); // fresh each glyph: a reused canvas dropped letters
  const a = glyphA.getContext('2d'), b = glyphB.getContext('2d');
  a.font = `${px * K}px ${HAND}`; a.fillStyle = color;
  a.fillText(ch, pad * K, base * K);
  const amp = px * K * 0.035, step = K;
  const p1 = rnd() * 6.28, f1 = (0.08 + rnd() * 0.06) / K, p2 = rnd() * 6.28, f2 = (0.08 + rnd() * 0.06) / K;
  for (let i = 0; i < W; i += step) b.drawImage(glyphA, i, 0, step, W, i, Math.round(Math.sin(p1 + i * f1) * amp), step, W); // columns bob
  a.clearRect(0, 0, W, W);
  for (let j = 0; j < W; j += step) a.drawImage(glyphB, 0, j, W, step, Math.round(Math.sin(p2 + j * f2) * amp), j, W, step); // rows sway
  g.save();
  g.translate(x - pad, y - base);
  g.transform(1 + rnd() * 0.12, 0, rnd() * 0.18, 1 + rnd() * 0.14, 0, 0); // width, slant, height
  g.drawImage(glyphA, 0, 0, W, W, 0, 0, S, S);
  g.restore();
}
const inkAdvance = (m, size) => (m.actualBoundingBoxRight + m.actualBoundingBoxLeft > 0 ? m.actualBoundingBoxRight + m.actualBoundingBoxLeft : m.width) + size * 0.12;
const scrawlWidth = (g, line, size) => [...line].reduce((w, ch) => w + inkAdvance(g.measureText(ch), size) * 1.04, 0);
const scrawl = (g, lines, { x = 14, y = 34, size = 26, lead = 1.25, color = '#1d1b2c', tilt = 0 } = {}) => {
  let seed = lines.join('').length * 7919 + Math.round(x * 31 + y * 17) + 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  g.save();
  g.rotate(tilt);
  g.font = hand(size);
  const px = Math.round(size * 1.3);
  lines.forEach((l, i) => {
    let cx = x + Math.sin(i * 2.3) * 3;
    const cy = y + i * size * lead;
    const slope = rnd() * 0.04; // a line drifts up or down a touch
    for (const ch of l) {
      const m = g.measureText(ch);
      g.save();
      g.translate(cx + m.actualBoundingBoxLeft, cy + rnd() * size * 0.08 + (cx - x) * slope);
      g.rotate(rnd() * 0.08);
      handGlyph(g, ch, 0, 0, px, color, rnd);
      g.restore();
      cx += inkAdvance(m, size) * (1 + rnd() * 0.08); // by the ink, not the face's advance: its letters overlap
    }
  });
  g.restore();
};

export function createChecklistTexture() {
  return paper(240, 320, (g) => {
    g.fillStyle = '#1d1b2c';
    scrawl(g, ['Y2K CHECKLIST!!'], { x: 18, y: 34, size: 22 });
    g.strokeStyle = '#1d1b2c'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(18, 43); g.quadraticCurveTo(110, 39, 214, 45); g.stroke();
    const items = [['water (6 gal)', 1], ['canned stuff', 1], ['batteries', 1], ['cash — $200', 0], ['backup floppies', 1], ['print phone #s', 1], ['call maya', 0]];
    items.forEach(([t, done], i) => {
      const y = 76 + i * 34;
      g.strokeStyle = '#1d1b2c'; g.lineWidth = 2; // a box drawn in four quick strokes that don't quite meet
      g.beginPath(); g.moveTo(18, y - 16); g.lineTo(35, y - 17); g.lineTo(34, y + 1); g.lineTo(19, y); g.lineTo(18, y - 14); g.stroke();
      if (done) { g.beginPath(); g.moveTo(20, y - 8); g.lineTo(26, y - 2); g.lineTo(38, y - 22); g.stroke(); }
      scrawl(g, [t], { x: 44, y, size: 21 });
    });
    g.strokeStyle = '#a03030'; g.lineWidth = 2.5; // "call maya" underlined twice, in the other pen
    g.beginPath(); g.moveTo(44, 284); g.lineTo(140, 281); g.moveTo(46, 289); g.lineTo(138, 287); g.stroke();
  });
}

// Continuous-feed dot-matrix paper printed with a '90s banner program: tractor holes, outlined block letters filled with
// a dither, fireworks and a champagne glass at the ends. The ribbon is running dry.
export function createBannerTexture() {
  return paper(860, 150, (g, w, h) => {
    g.fillStyle = '#cfc7ae';
    for (let y = 12; y < h; y += 26) { g.beginPath(); g.arc(14, y, 5, 0, Math.PI * 2); g.arc(w - 14, y, 5, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#d9d1b8'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(30, 0); g.lineTo(30, h); g.moveTo(w - 30, 0); g.lineTo(w - 30, h); g.stroke(); g.setLineDash([]);
    const ink = '#26243a';
    const dither = (() => { const c = document.createElement('canvas'); c.width = c.height = 4; const d = c.getContext('2d'); d.fillStyle = ink; d.fillRect(0, 0, 1, 1); d.fillRect(2, 2, 1, 1); return g.createPattern(c, 'repeat'); })();
    const burst = (cx, cy, r) => {
      g.strokeStyle = ink; g.lineWidth = 2;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); g.fillStyle = ink; g.fillRect(cx + Math.cos(a) * r * 1.15 - 2, cy + Math.sin(a) * r * 1.15 - 2, 4, 4); }
    };
    burst(82, 52, 30); burst(118, 104, 20); burst(w - 84, 54, 28);
    // champagne glass, right end
    g.strokeStyle = ink; g.lineWidth = 3;
    g.beginPath(); g.moveTo(w - 112, 86); g.lineTo(w - 96, 120); g.lineTo(w - 80, 86); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(w - 96, 120); g.lineTo(w - 96, 138); g.moveTo(w - 108, 138); g.lineTo(w - 84, 138); g.stroke();
    for (const [x, y] of [[-100, 78], [-92, 70], [-98, 62]]) { g.beginPath(); g.arc(w + x, y, 2.5, 0, Math.PI * 2); g.stroke(); }
    // the letters: thick outline, dithered fill, a drop shadow from a second pass
    g.font = '900 86px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = ink; g.fillText('HAPPY 2000!', w / 2 + 5, h / 2 + 5);
    g.fillStyle = '#e8e1cc'; g.fillText('HAPPY 2000!', w / 2, h / 2);
    g.fillStyle = dither; g.fillText('HAPPY 2000!', w / 2, h / 2);
    g.lineWidth = 3; g.strokeStyle = ink; g.strokeText('HAPPY 2000!', w / 2, h / 2);
    g.fillStyle = 'rgba(232,225,204,0.6)';
    for (let y = 18; y < h - 10; y += 9) g.fillRect(150, y, w - 300, 2); // dry ribbon banding
  });
}

// Post-its: a few chores and, on one, the thought that leads to Maya's photo.
export const STICKY_NOTES = [
  ['pay phone', 'bill!!'],
  ['trypod.com', '/~bell1892', 'THE FILE'],
  ['KESTREL', 'lab login?', 'ask maya'],
  ['ziggy\'s', 'bday'],
  ['DONT', 'reboot'],
];
export function createStickyTexture(lines) {
  return paper(160, 160, (g) => {
    let size = lines.length > 2 ? 34 : 42;
    g.font = hand(size); // shrink the hand until the widest line fits the note (a URL is long)
    size = Math.min(size, Math.floor((size * 136) / Math.max(...lines.map((l) => scrawlWidth(g, l, size)))));
    scrawl(g, lines, { x: 12, y: 44, size, lead: 1.2, tilt: -0.04 });
  }, '#ecd96e');
}

export function createPhotoBackNoteTexture() {
  return paper(220, 220, (g) => scrawl(g, ['lab acct —', ' kpatel', ' okafor99', 'dont tell', 'kav  — m.'], { x: 12, y: 38, size: 26, lead: 1.3, tilt: -0.03 }), '#ecd96e');
}

// Taped to the monitor: the numbers he actually dials. None of them is on the wardial scan (that answer is the puzzle's).
export function createPhoneListTexture() {
  return paper(180, 240, (g) => {
    scrawl(g, ['golden wok', '  555-0108', 'greg', '  555-0121', 'mom', '  555-0135', 'maya', '  555-0190'], { x: 10, y: 30, size: 20, lead: 1.25, color: '#3a3848' });
    g.strokeStyle = '#3a3848'; g.lineWidth = 2; // a small heart by her name, drawn and half scribbled out
    g.beginPath(); g.moveTo(96, 176); g.bezierCurveTo(88, 164, 104, 160, 104, 170); g.bezierCurveTo(104, 160, 120, 164, 112, 176); g.lineTo(104, 186); g.closePath(); g.stroke();
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(92, 168 + k * 6); g.lineTo(118, 172 + k * 6); g.stroke(); }
  }, '#efe9d6');
}

// The phone list's back: Halstead's staff line, in his hand. Not the war-dial answer, so it spoils nothing.
export function createPhoneListBackTexture() {
  return paper(180, 240, (g) => scrawl(g, ['halstead u.', ' staff dial-in', '  555-0166', '', 'pool kicks', ' you off.', 'this one', " doesn't."], { x: 10, y: 30, size: 20, lead: 1.25, tilt: 0.03, color: '#3a3848' }), '#efe9d6');
}

// 2400: The Hacker Quarterly, winter 1999 — Gemini cover art (a nod, not a copy), with p.14 circled twice in his pen.
export function createMagazineCoverTexture(cover) {
  return paper(300, 408, (g, w, h) => {
    g.drawImage(cover, 0, 0, w, h);
    g.strokeStyle = '#1d4fb8'; g.lineWidth = 2.5;
    for (const r of [0, 3]) { g.beginPath(); g.ellipse(150, 386, 146 + r, 16 + r, 0.02 * (r ? 1 : -1), 0, Math.PI * 2); g.stroke(); }
  });
}

// The sticker on the takeout pail.
export function createTakeoutLogoTexture() {
  return paper(256, 186, (g, w) => {
    g.fillStyle = '#b8402a';
    g.beginPath(); g.ellipse(w / 2, 93, 118, 84, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2e6c8';
    g.font = '900 28px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText('GOLDEN', w / 2, 52); g.fillText('WOK', w / 2, 158);
    g.fillStyle = '#1f1a1a'; // the wok, steam and a tangle of noodles
    g.beginPath(); g.arc(w / 2, 90, 46, 0.15, Math.PI - 0.15); g.fill();
    g.fillRect(w / 2 + 40, 92, 44, 7);
    g.strokeStyle = '#f2e6c8'; g.lineWidth = 3;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(w / 2 - 22 + k * 22, 86); g.bezierCurveTo(w / 2 - 34 + k * 22, 74, w / 2 - 10 + k * 22, 70, w / 2 - 22 + k * 22, 60); g.stroke(); }
    g.strokeStyle = '#e7c66a'; g.lineWidth = 3;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(w / 2 - 30, 100 + k * 5); g.bezierCurveTo(w / 2 - 10, 92 + k * 5, w / 2 + 10, 110 + k * 5, w / 2 + 30, 100 + k * 5); g.stroke(); }
  }, '#efe6cc');
}

// Soda can wraps (u around the can, v up it): knock-off brands, the logo twice around, silver at the rims and lids.
const CANS = {
  lepsi: { bg: '#1c3f99', name: 'LEPSI', ink: '#ffffff', font: 'italic 900 24px "Arial Black", Impact, sans-serif', band: '#e8e8ee' },
  roke: { bg: '#a3121a', name: 'Roke', ink: '#ffffff', font: 'italic 700 34px Georgia, "Times New Roman", serif', band: '#ffffff' },
  spryte: { bg: '#1d7a3c', name: 'SPRYTE', ink: '#f4f05a', font: '900 22px "Arial Black", Impact, sans-serif', band: '#cfe8d0' },
};
export function createCanTexture(kind) {
  const k = CANS[kind];
  return paper(256, 128, (g, w, h) => {
    g.fillStyle = k.bg; g.fillRect(0, 10, w, h - 20);
    g.fillStyle = k.band; // a swoosh around the can
    g.beginPath(); g.moveTo(0, 88);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, 84 + Math.sin(x / w * Math.PI * 4) * 8);
    for (let x = w; x >= 0; x -= 8) g.lineTo(x, 94 + Math.sin(x / w * Math.PI * 4 + 0.6) * 8);
    g.fill();
    g.fillStyle = k.ink; g.font = k.font; g.textAlign = 'center';
    for (const cx of [64, 192]) g.fillText(k.name, cx, 66);
    g.font = '700 9px Arial, sans-serif';
    for (const cx of [64, 192]) g.fillText('12 FL OZ · 355 mL', cx, 112);
    const rim = g.createLinearGradient(0, 0, w, 0); // brushed aluminium top and bottom
    rim.addColorStop(0, '#9a9ca2'); rim.addColorStop(0.5, '#e6e7ea'); rim.addColorStop(1, '#9a9ca2');
    g.fillStyle = rim; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
  }, '#c9cace');
}

// The pager's LCD: idle ("NO PAGES") until setPaged(true); then "LAST PAGE 23:35" and the sixteen digits crawl past.
// Call tick(dt) each frame.
export function createPagerLcd(digits) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 112;
  const g = c.getContext('2d');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const msg = `     ${digits.match(/.{4}/g).join(' ')}     `;
  let t = 0, drawn = -1, paged = false;
  const draw = (step) => {
    g.fillStyle = '#8fa673'; g.fillRect(0, 0, 256, 112);
    g.fillStyle = '#1f2a16';
    g.font = '700 26px "Courier New", monospace';
    if (paged) {
      g.fillText('LAST PAGE 23:35', 12, 36); // the page lands at 23:35 (a1_inside)
      g.font = '700 40px "Courier New", monospace';
      g.fillText(msg.slice(step % msg.length) + msg.slice(0, step % msg.length), 6, 90);
    } else {
      g.font = '700 40px "Courier New", monospace';
      g.fillText('NO PAGES', 30, 72);
    }
    g.fillStyle = 'rgba(31,42,22,0.12)'; // dot-matrix grain
    for (let y = 0; y < 112; y += 4) g.fillRect(0, y, 256, 1);
    texture.needsUpdate = true;
  };
  draw(0);
  return {
    texture,
    setPaged(on) { paged = on; drawn = -1; },
    tick(dt) { t += dt; const s = paged ? Math.floor(t * 4) : 0; if (s !== drawn) { drawn = s; draw(s); } },
  };
}

// The Nokia's idle screen: carrier, signal and battery bars, the time.
export function createNokiaLcd() {
  return paper(160, 124, (g) => {
    g.fillStyle = '#1f2a16';
    for (let k = 0; k < 4; k++) { g.fillRect(8, 96 - k * 18, 8, 12); g.fillRect(144, 96 - k * 18, 8, 12); }
    g.font = '700 20px "Courier New", monospace';
    g.textAlign = 'center';
    g.fillText('CASCADIA', 80, 42);
    g.font = '700 30px "Courier New", monospace';
    g.fillText('23:02', 80, 84);
    g.font = '700 14px "Courier New", monospace';
    g.fillText('Menu', 80, 114);
  }, '#9aae80');
}

// A bumper sticker on the bezel, half peeled: HACK THE PL— and then torn paper and old glue where PLANET was.
// Brand badges: ROMPAQ on the monitor (a dark plate, silver italic caps), MacroWorks on the speaker (moulded into the beige).
export function createRompaqBadgeTexture() {
  return paper(280, 64, (g, w, h) => {
    g.fillStyle = '#c9c9cf'; g.font = 'italic 900 44px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ROMPAQ', w / 2, h / 2 + 2, w - 20);
  }, '#2a2a30');
}
export function createMacroWorksBadgeTexture() {
  return paper(280, 62, (g, w, h) => {
    g.fillStyle = '#6e6656'; g.textBaseline = 'middle';
    g.font = '700 36px Georgia, "Times New Roman", serif';
    g.fillText('Macro', 16, h / 2 + 2);
    const mw = g.measureText('Macro').width;
    g.font = 'italic 400 36px Georgia, "Times New Roman", serif';
    g.fillText('Works', 16 + mw, h / 2 + 2);
  }, '#cfc4a2');
}

export function createStickerTexture() {
  return paper(360, 120, (g, w, h) => {
    g.fillStyle = '#121214'; g.fillRect(6, 6, w * 0.7, h - 12);
    g.fillStyle = '#e8e2c8'; g.font = '900 46px Impact, "Arial Black", sans-serif'; g.textBaseline = 'middle';
    g.fillText('HACK THE PL', 18, h / 2 + 2);
    g.fillStyle = '#d9cf9a'; // the torn edge, then yellowed glue where the rest came off
    g.beginPath(); g.moveTo(w * 0.7 + 6, 6);
    for (let y = 6; y <= h - 6; y += 8) g.lineTo(w * 0.7 + 6 + ((y * 37) % 11) - 5, y);
    g.lineTo(w - 6, h - 6); g.lineTo(w - 6, 6); g.fill();
    g.fillStyle = 'rgba(120, 100, 40, 0.25)';
    for (let i = 0; i < 40; i++) g.fillRect(w * 0.72 + ((i * 53) % 90), 10 + ((i * 29) % 96), 3, 2);
  }, '#e8e2c8');
}

// The J-card on his own tape, dubbed off the radio.
export function createMixtapeLabelTexture() {
  return paper(360, 200, (g, w) => {
    g.fillStyle = '#d64a6a'; g.fillRect(0, 0, w, 16);
    scrawl(g, ['Y2K', 'SURVIVAL MIX'], { x: 18, y: 66, size: 40, lead: 1.05, color: '#1d1b2c' });
    scrawl(g, ['for you — m.  12.99'], { x: 22, y: 172, size: 24, color: '#2f4f9a' }); // her hand, her pen
  }, '#f1ead6');
}

// A far skyline layer: a run of flat silhouettes (stepped tops, antennas) with tiny lit window dots. Seeded, so it is the
// same every load. Returns the beacon spots (u, v in 0..1) at the tallest tops for the blinking red aircraft lights.
export function createSkylineTexture(layer) {
  const W = 2048, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 17 + layer * 101;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const fill = ['#1a1730', '#221c3a', '#2a2244', '#30264b'][layer];
  const beacons = [];
  let x = 0;
  while (x < W) {
    const w = 30 + rnd() * 110, h = H * (0.12 + rnd() * (0.3 + layer * 0.06));
    g.fillStyle = fill;
    g.fillRect(x, H - h, w, h);
    if (rnd() < 0.4) g.fillRect(x + w * 0.2, H - h - h * 0.12, w * 0.6, h * 0.12);           // a setback
    if (rnd() < 0.25) { g.fillRect(x + w / 2, H - h - 40, 2, 40); }                       // an antenna
    for (let wy = H - h + 8; wy < H - 4; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6) {
      if (rnd() < 0.12 - layer * 0.025) { g.fillStyle = rnd() < 0.8 ? '#ffcf8a' : '#a8d4ff'; g.fillRect(wx, wy, 2, 2); }
    }
    if (h > H * 0.4) beacons.push({ u: (x + w / 2) / W, v: 1 - (h + 4) / H });
    x += w + rnd() * 18;
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, beacons: beacons.slice(0, 2) };
}

// A light's reflection on wet asphalt: a long, soft vertical smear broken into streaks.
export function createWetStreakMap() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  g.filter = 'blur(2px)';
  for (let y = 0; y < 512; y += 2 + Math.random() * 3) {
    const k = 1 - y / 512;
    const w = 8 + Math.random() * 34 * k;
    g.fillStyle = `rgba(255,255,255,${(0.25 + Math.random() * 0.5) * k * k})`;
    g.fillRect(32 - w / 2 + (Math.random() - 0.5) * 5, y, w, 2 + Math.random() * 3);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Soft rising steam: a few blurred blobs, tiled vertically so the card can scroll forever.
export function createSteamTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 64 + (Math.random() - 0.5) * 50, y = Math.random() * 256, r = 14 + Math.random() * 22;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

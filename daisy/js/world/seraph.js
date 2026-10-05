// Daisy's body: a "biblically accurate" angel in ink — rings of eyes around an eclipse: a black disc, a thin white corona. No red. No glow.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { toonGradient } from './toon.js';
import { gazeTarget, stepGaze, nextBlinkIn, IDLE_STARE_S } from './seraph.logic.js';

const MOODS = {
  broken: { spin: 0.12, glitch: 0.35, track: 0.25, pulse: 0.6 },
  curious: { spin: 0.3, glitch: 0.04, track: 1, pulse: 1 },
  warm: { spin: 0.22, glitch: 0, track: 0.8, pulse: 0.8 },
  tense: { spin: 0.9, glitch: 0.08, track: 1, pulse: 2.2 },
};
const RING_TILT = [[0.35, 0, 0], [0, 0.55, 0.25], [1.1, 0.3, 0], [0.2, 1.2, 0.6], [0.9, -0.4, 1.0], [0.6, 0.9, -0.5]];

const inkMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { uWidth: { value: 0.014 } },
  vertexShader: 'uniform float uWidth; void main(){ vec3 p = position + normal * uWidth; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.03, 0.02, 0.05, 1.0); }',
});
const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
function inked(mesh) {
  mesh.add(new THREE.Mesh(mesh.geometry, inkMaterial));
  return mesh;
}

function makeEye(size, closed) {
  const group = new THREE.Group();
  group.add(inked(new THREE.Mesh(new THREE.SphereGeometry(size, 20, 14), toon(0xf1e8d0))));
  const look = new THREE.Group();
  const iris = new THREE.Mesh(new THREE.CircleGeometry(size * 0.55, 24), new THREE.MeshBasicMaterial({ color: 0xaeb4bd }));
  iris.position.z = size * 1.001;
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(size * 0.24, 16), new THREE.MeshBasicMaterial({ color: 0x050308 }));
  pupil.position.z = 0.0005;
  const glint = new THREE.Mesh(new THREE.CircleGeometry(size * 0.09, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  glint.position.set(size * 0.18, size * 0.18, 0.001);
  iris.add(pupil, glint);
  const wet = (color, x, y) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(size * 0.07, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 }));
    m.position.set(x, y, 0.0012);
    iris.add(m);
    return m;
  };
  const neonGlint = wet(0x3fe8ff, -size * 0.22, size * 0.12);
  const clubGlint = wet(0xff2a1f, size * 0.06, -size * 0.24);
  look.add(iris);
  group.add(look);
  const lidGeo = (upper) => new THREE.SphereGeometry(size * 1.07, 20, 10, 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2);
  const lidTop = inked(new THREE.Mesh(lidGeo(true), toon(0xd8ccb0)));
  const lidBottom = inked(new THREE.Mesh(lidGeo(false), toon(0xd8ccb0)));
  const OPEN = 1.0;
  let open = !closed;
  let squint = 0; // 0..0.5 of the way closed
  const restTop = () => -OPEN * (1 - squint);
  lidTop.rotation.x = open ? restTop() : 0;
  lidBottom.rotation.x = open ? -restTop() : 0;
  group.add(lidTop, lidBottom);
  const eye = {
    group, look, glint, neonGlint, clubGlint,
    gaze: { x: 0, y: 0 },
    lag: 0.08 + Math.random() * 0.25,
    blinkIn: 1 + Math.random() * 5,
    get isOpen() { return open; },
    blink() {
      if (!open) return;
      gsap.timeline()
        .to([lidTop.rotation, lidBottom.rotation], { x: 0, duration: 0.07 })
        .to(lidTop.rotation, { x: restTop(), duration: 0.14 }, 0.12)
        .to(lidBottom.rotation, { x: -restTop(), duration: 0.14 }, 0.12);
    },
    open(duration = 0.6) {
      open = true;
      return gsap.timeline()
        .to(lidTop.rotation, { x: restTop(), duration, ease: 'power2.out' })
        .to(lidBottom.rotation, { x: -restTop(), duration, ease: 'power2.out' }, 0).then(() => {});
    },
    setSquint(v) {
      squint = v;
      if (open) { gsap.to(lidTop.rotation, { x: restTop(), duration: 0.4 }); gsap.to(lidBottom.rotation, { x: -restTop(), duration: 0.4 }); }
    },
  };
  return eye;
}

function makeRing(index, closed) {
  const radius = 0.78 + index * 0.34;
  const ring = new THREE.Group();
  const body = inked(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.065, 14, 120), toon(index % 2 ? 0x1d1a26 : 0xc9a24a)));
  const inlay = inked(new THREE.Mesh(new THREE.TorusGeometry(radius - 0.1, 0.018, 8, 120), toon(0xe8c860)));
  ring.add(body, inlay);
  const eyes = [];
  const count = 8 + index * 2;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const eye = makeEye(0.105 + Math.random() * 0.03, closed);
    eye.group.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.03);
    ring.add(eye.group);
    eyes.push(eye);
  }
  const [rx, ry, rz] = RING_TILT[index];
  const pivot = new THREE.Group();
  pivot.rotation.set(rx, ry, rz);
  pivot.add(ring);
  return { pivot, ring, eyes, speed: (index % 2 ? -1 : 1) * (0.6 + index * 0.15) };
}

export function createSeraph(canvas, { closed = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 2.6);
  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x221a33, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1.5, 2, 3);
  scene.add(key);

  // sunburst of gold spikes behind the core; it grows with every ring
  const burst = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const long = i % 2 === 0;
    const spike = inked(new THREE.Mesh(new THREE.ConeGeometry(0.035, long ? 0.75 : 0.45, 6), toon(0xc9a24a)));
    const a = (i / 24) * Math.PI * 2;
    spike.position.set(Math.cos(a) * (0.5 + (long ? 0.37 : 0.22)), Math.sin(a) * (0.5 + (long ? 0.37 : 0.22)), -0.15);
    spike.rotation.z = a - Math.PI / 2;
    burst.add(spike);
  }
  burst.scale.setScalar(0.001);
  // the eclipse: a black disc with a hair-thin white corona and faint ink streamers. No colour, no glow.
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.34, 64), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const corona = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.358, 128), new THREE.MeshBasicMaterial({ color: 0xf4f1ea }));
  const streamers = new THREE.Group();
  for (let i = 0; i < 36; i++) {
    const len = 0.08 + Math.random() * 0.22;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.004, len), new THREE.MeshBasicMaterial({ color: 0xe8e4da, transparent: true, opacity: 0.35 + Math.random() * 0.4 }));
    const a = (i / 36) * Math.PI * 2 + Math.random() * 0.05;
    s.position.set(Math.cos(a) * (0.36 + len / 2), Math.sin(a) * (0.36 + len / 2), -0.01);
    s.rotation.z = a - Math.PI / 2;
    streamers.add(s);
  }
  core.position.z = corona.position.z = 0.02;
  scene.add(burst, streamers, corona, core);

  const rings = [];
  let mood = MOODS.broken;
  const cursor = { x: 0, y: 0 };
  let idle = 0;
  let avertUntil = 0;
  let refl = { cyan: 0, red: 0 }; // city neon on the wet eyes
  let raf = 0, last = 0, t = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    t += dt;
    idle += dt;
    const breath = 1 + Math.sin(t * 2 * mood.pulse) * 0.02;
    core.scale.setScalar(breath);
    corona.scale.setScalar(breath);
    streamers.rotation.z += dt * 0.02;
    if (Math.random() < mood.glitch * 0.1) streamers.position.x = (Math.random() - 0.5) * 0.04;
    else streamers.position.x *= 0.8;
    burst.rotation.z -= dt * 0.05;
    const target = gazeTarget({ x: cursor.x * mood.track, y: cursor.y * mood.track }, idle, t < avertUntil);
    for (const r of rings) {
      r.ring.rotation.z += dt * mood.spin * r.speed;
      const faceCam = r.ring.getWorldQuaternion(new THREE.Quaternion()).invert();
      for (const e of r.eyes) {
        e.group.quaternion.copy(faceCam);
        e.gaze = stepGaze(e.gaze, target, dt, e.lag);
        e.look.rotation.y = e.gaze.x * 0.55;
        e.look.rotation.x = -e.gaze.y * 0.45;
        e.neonGlint.material.opacity = 0.7 * refl.cyan;
        e.clubGlint.material.opacity = 0.45 * refl.red;
        if ((e.blinkIn -= dt) < 0) { e.blinkIn = nextBlinkIn(); e.blink(); }
      }
    }
    renderer.render(scene, camera);
  }

  const seraph = {
    setRings(n, { animate = true } = {}) {
      n = Math.max(0, Math.min(5, n));
      while (rings.length < n) {
        const r = makeRing(rings.length, closed);
        scene.add(r.pivot);
        rings.push(r);
        if (animate) {
          gsap.from(r.pivot.scale, { x: 0, y: 0, z: 0, duration: 1.6, ease: 'elastic.out(1, 0.5)' });
        }
      }
      while (rings.length > n) scene.remove(rings.pop().pivot);
      const burstScale = n ? 0.7 + n * 0.12 : 0.001;
      if (animate) gsap.to(burst.scale, { x: burstScale, y: burstScale, z: burstScale, duration: 1.4, ease: 'back.out(2)' });
      else burst.scale.setScalar(burstScale);
      const z = 2.6 + n * 0.7;
      if (animate) gsap.to(camera.position, { z, duration: 1.6, ease: 'power2.inOut' });
      else camera.position.z = z;
    },
    setMood(name) { mood = MOODS[name] ?? MOODS.curious; },
    lookAt(nx, ny) { cursor.x = Math.max(-1, Math.min(1, nx)); cursor.y = Math.max(-1, Math.min(1, ny)); idle = 0; },
    blink() { rings.flatMap((r) => r.eyes).forEach((e) => e.blink()); },
    async openEyes({ stagger = 0.07 } = {}) {
      const eyes = rings.flatMap((r) => r.eyes);
      if (!eyes.length) return;
      await eyes[0].open(1.8);                 // the first one, slowly
      await new Promise((r) => setTimeout(r, 1300));
      await Promise.all(eyes.slice(1).map((e, i) => new Promise((r) => setTimeout(() => e.open(0.35).then(r), i * stagger * 1000))));
    },
    lookAtCamera() { idle = IDLE_STARE_S; },
    avert(ms = 300) { avertUntil = t + ms / 1000; },
    setReflections(cyan, red) { refl = { cyan, red }; },
    setSquint(on) { rings.flatMap((r) => r.eyes).forEach((e) => e.setSquint(on ? 0.45 : 0)); },
    start() { if (!raf) raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); raf = 0; last = 0; },
    dispose() { seraph.stop(); renderer.dispose(); },
  };
  return seraph;
}

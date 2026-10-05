// Pick something up: it lifts out of the room onto a dark card. Drag to turn it — turn it over and whatever is on the
// back fades in beside it; a message plays with subtitles. Esc (or "put it down") returns it. Esc never also leaves look mode.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { subtitleCues } from './hotspots.logic.js';

const BACK_FACING = -0.25; // how far past edge-on the back must turn before its text shows

export function inspect({ room, item, overlay, audio, onPlay }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'inspect';
    el.innerHTML = `<div class="inspect-card"><canvas></canvas><div class="inspect-side"><p class="inspect-title"></p>
      <p class="inspect-text inspect-note"></p><p class="inspect-text inspect-back"></p><ol class="inspect-msgs"></ol><p class="inspect-subs"></p></div></div>
      <p class="inspect-help"></p><button class="look-btn inspect-close">PUT IT DOWN · ESC</button>`;
    const $ = (s) => el.querySelector(s);
    $('.inspect-title').textContent = item.title;
    $('.inspect-note').textContent = item.note ?? '';
    $('.inspect-back').textContent = item.back ?? '';
    $('.inspect-help').textContent = item.back ? 'drag to turn it over' : 'drag to turn';
    overlay.append(el);
    gsap.from(el, { opacity: 0, duration: 0.3 });
    if (item.note) gsap.fromTo($('.inspect-note'), { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.5 });

    const canvas = $('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const px = Math.round(Math.min(innerHeight * 0.7, innerWidth * 0.55, 720));
    canvas.style.width = canvas.style.height = `${px}px`;
    renderer.setSize(px, px, false);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
    cam.position.set(0, 0, 3.2);
    scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x1a1626, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1, 1.5, 2);
    const fill = new THREE.DirectionalLight(0xcfe9ff, 1.2); // so a turned-over back is never in the dark
    fill.position.set(-1, 0.5, -2);
    const rim = new THREE.PointLight(0x3fe8ff, 3, 6);
    rim.position.set(-1.4, 0.5, 0.8);
    scene.add(key, fill, rim);

    // Clone every mesh under each node: a multi-material node (the magazine stack) arrives as a group of meshes.
    const content = new THREE.Group();
    for (const name of item.nodes) {
      room.node(name).updateWorldMatrix(true, true);
      room.node(name).traverse((src) => {
        if (!src.isMesh) return;
        const m = new THREE.Mesh(src.geometry, src.material.clone());
        m.material.side = THREE.DoubleSide; // paper and stickers are single planes: turning them must not make them vanish
        if (m.material.map) { // ...and the back of printed paper is blank, not the print seen through it
          m.material.side = THREE.FrontSide;
          const blank = new THREE.Mesh(src.geometry, m.material.clone());
          Object.assign(blank.material, { map: src.userData.backMap ?? null, side: THREE.BackSide }); // blank, unless something's written there
          blank.material.color.copy(src.userData.paper ?? new THREE.Color(0xe8e1cc)).multiplyScalar(0.85); // the paper's own colour
          blank.applyMatrix4(src.matrixWorld);
          content.add(blank);
        }
        m.applyMatrix4(src.matrixWorld);
        if (m.material.emissive) m.material.emissive.setHex(0);
        content.add(m);
      });
    }
    const box = new THREE.Box3().setFromObject(content);
    const size = box.getSize(new THREE.Vector3());
    content.position.sub(box.getCenter(new THREE.Vector3()));
    const stand = new THREE.Group(); // things lying flat on the desk are stood up so their face looks at you
    stand.add(content);
    if (size.y < Math.min(size.x, size.z) * 0.5) stand.rotation.x = Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.add(stand);
    pivot.scale.setScalar(2.0 / size.length());
    scene.add(pivot);
    gsap.from(pivot.position, { y: -0.8, duration: 0.6, ease: 'power3.out' });
    gsap.from(pivot.rotation, { x: -0.6, duration: 0.6, ease: 'power3.out' });

    const back = $('.inspect-back');
    const subs = $('.inspect-subs');
    const facing = new THREE.Vector3();
    let showingBack = false;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const turned = facing.set(0, 0, 1).applyQuaternion(pivot.quaternion).z < BACK_FACING;
      if (item.back && turned !== showingBack) {
        showingBack = turned;
        gsap.to(back, { opacity: turned ? 1 : 0, duration: turned ? 0.6 : 0.3, overwrite: true });
      }
      renderer.render(scene, cam);
    };
    frame();
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('held'); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      pivot.rotation.y += (e.clientX - drag.x) * 0.01;
      pivot.rotation.x = Math.max(-1.2, Math.min(1.2, pivot.rotation.x + (e.clientY - drag.y) * 0.01));
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', () => { drag = null; canvas.classList.remove('held'); });

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      removeEventListener('keydown', onKey, true);
      // forceContextLoss frees the GL context: Chrome caps live contexts and drops the oldest one, which is the room
      gsap.to(el, { opacity: 0, duration: 0.25, onComplete: () => { cancelAnimationFrame(raf); renderer.dispose(); renderer.forceContextLoss(); el.remove(); resolve(); } });
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); } };
    addEventListener('keydown', onKey, true);
    $('.inspect-close').addEventListener('click', close);
    el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });

    // The answering machine: its tape as a list (who, when); click one to hear it, captions beside it.
    let playing = 0;
    const list = $('.inspect-msgs');
    for (const m of item.messages ?? []) {
      const b = document.createElement('button');
      b.innerHTML = '<span></span><time></time>';
      b.querySelector('span').textContent = m.from;
      b.querySelector('time').textContent = m.time;
      b.addEventListener('click', async () => {
        const me = ++playing;
        list.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        audio.sfx('mouse_click', { gain: 0.6, rate: 0.7 }); // the play key
        subs.textContent = '';
        await machineBeeps(audio, 1);
        if (closed || me !== playing) return;
        onPlay?.(m);
        await playMessage({ audio, voice: m.voice, lines: m.subtitle, show: (t) => { subs.textContent = t; }, cancelled: () => closed || me !== playing });
        if (me === playing) b.classList.remove('on');
      });
      list.append(b);
    }
    if (item.subtitle?.length) {
      (async () => {
        await machineBeeps(audio, 1);
        if (!closed) await playMessage({ audio, voice: item.voice, lines: item.subtitle, show: (t) => { subs.textContent = t; }, cancelled: () => closed });
      })();
    }
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The answering machine's long beep (the recording's second half), n times.
export async function machineBeeps(audio, n) {
  for (let i = 0; i < n; i++) {
    audio.sfx('answer_beep', { gain: 0.5, offset: 1.55 });
    await wait(1350);
  }
}

// A recorded message with its captions on time. Resolves when it ends (or stops early when cancelled()).
export async function playMessage({ audio, voice, lines, show, cancelled = () => false }) {
  const src = audio.has(voice) ? audio.sfx(voice, { bus: 'voice' }) : null;
  const length = src?.buffer.duration ?? lines.length * 2.5;
  const t0 = performance.now();
  for (const { at, text } of [...subtitleCues(lines, length), { at: length, text: '' }]) {
    while (performance.now() - t0 < at * 1000) {
      if (cancelled()) { src?.stop(); show(''); return; }
      await wait(50);
    }
    show(text);
  }
}

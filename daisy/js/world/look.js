// Telltale-style look-around from the chair: drag to turn your head, hover glows, click to pick up.
// Entered from the small look-around icon; Esc, the same icon, or clicking the monitor returns to the desktop.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { dragLook, lookTarget, escAction } from './look.logic.js';

export function createLook({ room, screen, canvas, overlay, hotspots, onPick }) {
  const ui = document.createElement('div');
  ui.className = 'look-ui';
  ui.innerHTML = '<button class="look-btn"></button><span class="look-label"></span>';
  overlay.append(ui);
  const btn = ui.querySelector('.look-btn');
  const label = ui.querySelector('.look-label');
  // An eye scanning left and right: look around. A monitor: back to the screen.
  const ICON = {
    look: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M5 4 2.5 6.5 5 9M19 4l2.5 2.5L19 9"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/></svg>',
  };
  const setBtn = (mode) => {
    btn.innerHTML = ICON[mode];
    btn.title = mode === 'look' ? 'Look around' : 'Back to the screen (Esc, or click the monitor)';
    btn.setAttribute('aria-label', btn.title);
  };
  setBtn('look');
  // Hovering the button says where it goes; nothing else is labelled at the desk.
  btn.addEventListener('mouseenter', () => { if (!hovered) label.textContent = looking ? 'back to the screen' : 'look around the room'; });
  btn.addEventListener('mouseleave', () => { if (!hovered) label.textContent = ''; });
  // The monitor itself is a way back to the screen while looking around.
  const MONITOR = { id: 'monitor', nodes: ['CRT_Body', 'CRT_Screen'], title: 'back to the screen', toScreen: true }; // not `back`: hotspots use that for the text on an item's back
  const meshes = [...hotspots, MONITOR].map((h) => ({ h, meshes: room.hotspotMeshes(h.nodes) }));
  const all = meshes.flatMap((m) => m.meshes);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let looking = false, inspecting = false, enabled = false, busy = false, gazing = false;
  let look = { yaw: 0, pitch: -0.15 };
  let hovered = null;
  let picking = null; // the pick in progress; exit() waits for it instead of giving up
  let pressing = null; // a cutscene waiting for one thing to be clicked: { h, meshes, done }
  const seat = () => room.poseOf('seated').pos;
  const tweenTo = (pos, target, duration) => gsap.timeline()
    .to(room.rig.pos, { x: pos.x, y: pos.y, z: pos.z, duration, ease: 'power2.inOut' }, 0)
    .to(room.rig.look, { x: target.x, y: target.y, z: target.z, duration, ease: 'power2.inOut' }, 0);

  function hitAt(e) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, room.camera);
    const hit = ray.intersectObjects(all, true)[0];
    if (!hit) return null;
    return meshes.find((m) => m.meshes.some((mesh) => mesh === hit.object || mesh.getObjectById(hit.object.id)))?.h ?? null;
  }
  function hitPress(e) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, room.camera);
    return ray.intersectObjects(pressing.meshes, true).length ? pressing.h : null;
  }
  const pressed = () => { const p = pressing; pressing = null; setHover(null); p.done(); };
  function setHover(h) {
    if (hovered === h) return;
    if (hovered) hovered.nodes.forEach((n) => room.highlight(n, false));
    hovered = h;
    if (h) h.nodes.forEach((n) => room.highlight(n, true));
    label.textContent = h ? h.title : '';
    canvas.style.cursor = h ? 'pointer' : looking || gazing ? 'grab' : '';
  }

  let down = null;
  canvas.addEventListener('pointerdown', (e) => { if ((looking || gazing) && !inspecting) { down = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', (e) => {
    if (pressing && !down) { setHover(hitPress(e)); return; } // a cutscene waits for one click: only that thing lights up
    if (!(looking || gazing) || inspecting) return;
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.moved += Math.abs(dx) + Math.abs(dy);
      down.x = e.clientX; down.y = e.clientY;
      look = dragLook(look, dx, dy);
      const t = lookTarget(seat(), look.yaw, look.pitch);
      room.rig.look.set(t.x, t.y, t.z);
      return;
    }
    if (gazing || busy) return; // not while the camera is travelling: a label picked up mid-move would stick at the desk
    setHover(hitAt(e));
  });
  canvas.addEventListener('pointerup', async (e) => {
    const click = down && down.moved < 5;
    if (pressing && (!down || click) && hitPress(e)) { down = null; pressed(); return; }
    down = null;
    if (!click || !looking || inspecting) return;
    const h = hitAt(e);
    if (!h) return;
    if (h.toScreen) { api.exit(); return; } // the desktop stays non-interactive until the camera has landed, so this click can't reach it
    inspecting = true;
    setHover(null);
    picking = onPick(h);
    await picking;
    inspecting = false;
    picking = null;
  });
  addEventListener('keydown', (e) => {
    if (pressing && e.key === 'Enter') { pressed(); return; }
    if (e.key !== 'Escape') return;
    if (escAction({ inspecting, looking }) === 'exit-look') api.exit();
  });
  // Until the player has used it once (ever, on this browser), the button pulses so a first-timer finds it.
  const SEEN = 'daisy.looked';
  try { if (!localStorage.getItem(SEEN)) btn.classList.add('hint'); } catch { btn.classList.add('hint'); }
  btn.addEventListener('click', () => {
    btn.classList.remove('hint');
    try { localStorage.setItem(SEEN, '1'); } catch { /* no storage: it just pulses again next time */ }
    looking ? api.exit() : api.enter();
  });

  const api = {
    get looking() { return looking; },
    async enter() {
      if (looking || busy || !enabled) return;
      busy = true;
      looking = true;
      screen.setInteractive(false);
      screen.mode = 'room';
      setBtn('back');
      look = { yaw: 0, pitch: -0.15 };
      const p = seat();
      await tweenTo(p, lookTarget(p, look.yaw, look.pitch), 1.1);
      room.rig.breathe = 0.8;
      canvas.style.cursor = 'grab';
      busy = false;
    },
    async exit() {
      if (inspecting) await picking; // a puzzle solved by this very pick asks us to leave mid-inspect
      if (!looking || busy || inspecting) return;
      busy = true;
      setHover(null);
      canvas.style.cursor = '';
      setBtn('look');
      const d = screen.deskPose(room.camera.aspect);
      await tweenTo(d.pos, d.look, 1.0);
      room.rig.breathe = 0.25;
      setHover(null);
      looking = false;
      screen.mode = 'desk';
      screen.setInteractive(true);
      busy = false;
    },
    setEnabled(on) { enabled = on; ui.hidden = !on; },
    // A cutscene can hand over the head without the desk: drag to look around, nothing to pick up, no way back to the
    // screen. The cutscene takes the camera back afterwards.
    // A cutscene waits for the player to click one thing (hover outlines and names it, like a pickable item; Enter works too).
    press(h) { return new Promise((done) => { pressing = { h, meshes: room.hotspotMeshes(h.nodes), done }; }); },
    gaze(on) {
      gazing = on;
      down = null;
      look = { yaw: 0, pitch: -0.15 };
      canvas.style.cursor = on ? 'grab' : '';
    },
  };
  api.setEnabled(false);
  return api;
}

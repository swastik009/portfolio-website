// Puts the real, clickable DOM desktop on the CRT's glass. Each frame the screen's 4 corners are projected
// through the WebGL camera and the desktop gets one projective matrix3d, so it stays glued to the glass
// and hit-tests like any flat element.
import * as THREE from 'three';
import { fitDistance, quadMatrix3d } from './screen-fit.js';

export const DESKTOP_W = 1024;
export const DESKTOP_H = 768;
// The browser rasterises a 3D-warped element at its layout size, then stretches the bitmap — text went soft and
// blocky. So the desktop is laid out at 1024x768 but painted inside a frame RES times larger, and the frame is
// warped *down* onto the glass: always supersampled, crisp on Retina.
const RES = 2;

export function createScreen({ room, desktopEl, layerEl }) {
  const mesh = room.node('CRT_Screen');
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const w = box.max.x - box.min.x;
  const h = box.max.y - box.min.y;
  const normal = new THREE.Vector3(0, 0, 1); // CRT_Screen faces the camera (+Z) — see build_room.py
  const z = box.max.z + 0.001;
  const corners = [ // tl, tr, br, bl in world space
    new THREE.Vector3(box.min.x, box.max.y, z), new THREE.Vector3(box.max.x, box.max.y, z),
    new THREE.Vector3(box.max.x, box.min.y, z), new THREE.Vector3(box.min.x, box.min.y, z),
  ];

  desktopEl.classList.add('desktop');
  Object.assign(desktopEl.style, { width: `${DESKTOP_W}px`, height: `${DESKTOP_H}px`, position: 'absolute', left: '0', top: '0', transformOrigin: '0 0', transform: `scale(${RES})` });
  const frame = document.createElement('div');
  Object.assign(frame.style, { position: 'absolute', left: '0', top: '0', width: `${DESKTOP_W * RES}px`, height: `${DESKTOP_H * RES}px`, transformOrigin: '0 0', pointerEvents: 'none' });
  frame.append(desktopEl);
  layerEl.append(frame);
  let vw = innerWidth;
  let vh = innerHeight;
  const p = new THREE.Vector3();

  const screen = {
    mode: 'room',
    render() {
      const cam = room.camera;
      cam.updateMatrixWorld();
      const quad = [];
      let near = Infinity, far = 0;
      for (const c of corners) {
        p.copy(c).applyMatrix4(cam.matrixWorldInverse);
        if (p.z > -cam.near) { frame.style.visibility = 'hidden'; return; } // corner behind the eye
        near = Math.min(near, -p.z); far = Math.max(far, -p.z);
        p.applyMatrix4(cam.projectionMatrix);
        quad.push([(p.x + 1) / 2 * vw, (1 - p.y) / 2 * vh]);
      }
      // Glass seen nearly edge-on (turning away in look-around): one side is many times nearer than the other and the
      // projective warp blows up (a giant stretched desktop for a frame). Unreadable at that angle anyway: hide it.
      // Head-on close-ups (the mail montage) have every corner at about the same depth and stay.
      if (far / near > 3) { frame.style.visibility = 'hidden'; return; }
      frame.style.visibility = '';
      frame.style.transform = `matrix3d(${quadMatrix3d(DESKTOP_W * RES, DESKTOP_H * RES, quad).join(',')})`;
    },
    setSize(wpx, hpx) { vw = wpx; vh = hpx; },
    deskPose(aspect) {
      const d = fitDistance({ screenW: w, screenH: h, fovDeg: room.camera.fov, aspect, margin: 1.18 });
      return { pos: center.clone().addScaledVector(normal, d), look: center.clone() };
    },
    // A close-up on one spot of the desktop (desktop px): `dist` metres off the glass, `off` slides the eye sideways/up.
    pointPose(x, y, dist, [ox, oy] = [0, 0]) {
      const at = corners[0].clone()
        .addScaledVector(corners[1].clone().sub(corners[0]), x / DESKTOP_W)
        .addScaledVector(corners[3].clone().sub(corners[0]), y / DESKTOP_H);
      return { pos: at.clone().addScaledVector(normal, dist).add(new THREE.Vector3(ox, oy, 0)), look: at };
    },
    setInteractive(on) { desktopEl.style.pointerEvents = on ? 'auto' : 'none'; },
  };
  screen.setInteractive(false);
  return screen;
}

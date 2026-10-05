// What makes a low-poly city feel alive and vast: a sky with light pollution on the horizon, painted skyline layers with
// blinking aircraft beacons, street lamps with long wet-road reflections, traffic gliding below, steam off a roof and a
// flickering stairwell. Every part reads one light level per blackout stage (see city.logic.js BLACKOUT_STAGES).
import * as THREE from 'three';
import { createSkylineTexture, createWetStreakMap, createSteamTexture, createGlowMap } from './fx.js';

const card = (parent, material, w, h) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.rotation.y = -Math.PI / 2; // face the window (-X)
  m.userData.noInk = true;
  parent.add(m);
  return m;
};
const additive = (color, map, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
const lieOnRoad = (m) => m.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); // flat on the road, texture top toward +X (away)

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#07060f');
  grad.addColorStop(0.4, '#14112a');
  grad.addColorStop(0.6, '#3a4260'); // the city's glow in the fog
  grad.addColorStop(0.75, '#5b6688');
  grad.addColorStop(1, '#5b6688');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const HAZE = new THREE.Color(0x5b6688); // the city's light caught in low cloud and rain

// A skyline layer sunk into the haze: the painted silhouettes fade toward HAZE by k; windows dim with the stage level.
function hazeCardMaterial(map, k) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uMap: { value: map }, uHaze: { value: HAZE }, uK: { value: k }, uLevel: { value: 1 }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uHaze; uniform float uK, uLevel, uFlash; varying vec2 vUv;
      void main(){ vec4 t = texture2D(uMap, vUv); if (t.a < 0.01) discard;
        float bright = step(0.5, max(t.r, max(t.g, t.b)));                 // a lit window dot
        vec3 c = mix(t.rgb * mix(1.0, uLevel, bright), uHaze * (0.3 + 0.7 * uLevel), uK * (1.0 - bright * 0.6 * uLevel));
        float low = smoothstep(0.0, 0.45, vUv.y);                           // the base melts into the ground fog
        gl_FragColor = vec4(mix(uHaze * (0.3 + 0.7 * uLevel), c, low) + vec3(0.5, 0.56, 0.8) * uFlash * uK, t.a); }`,
  });
}

// A tileable bank of fog: soft overlapping puffs (drawn wrapped so it repeats seamlessly sideways), thick at the bottom
// and frayed into wisps at the top.
function fogTexture() {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {                     // stretched puffs: fog lies in horizontal wisps with gaps
    const y = H * (0.3 + Math.pow(rnd(), 0.7) * 0.75), r = 14 + rnd() * 40, x = rnd() * W;
    const a = 0.12 + rnd() * 0.35 * (y / H);
    for (const dx of [-W, 0, W]) {
      g.save();
      g.translate(x + dx, y);
      g.scale(3.2, 1);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, r);
      rg.addColorStop(0, `rgba(255,255,255,${a})`);
      rg.addColorStop(0.6, `rgba(255,255,255,${a * 0.4})`);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
  }
  const fade = g.createLinearGradient(0, 0, 0, H); // keep the top edge soft
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.3, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function createCityLife(city, cityNodes) {
  const glowMap = createGlowMap();
  const wetMap = createWetStreakMap();
  const parts = { skyline: [], beacons: [], lamps: [], wet: [], haze: [], cars: new THREE.Group(), steam: null, stair: null };

  // sky + four skyline layers, far to near
  const sky = card(city, new THREE.MeshBasicMaterial({ map: skyTexture(), depthWrite: false }), 600, 160);
  parts.sky = sky;
  sky.position.set(170, 40, 0);
  [130, 100, 75, 55].forEach((x, i) => {
    const layer = 3 - i; // texture palette: 3 = furthest
    const { texture, beacons } = createSkylineTexture(layer);
    const mat = hazeCardMaterial(texture, [0.95, 0.9, 0.85, 0.78][i]);
    const m = card(city, mat, 260, 65);
    m.position.set(x, 20.5 - i * 2, 0);
    m.renderOrder = -1;
    parts.skyline.push(m);
    for (const b of beacons) {
      const beacon = card(city, additive(0xff2a1f, glowMap), 1.6, 1.6);
      beacon.position.set(x - 0.5, m.position.y + (0.5 - b.v) * 65, (b.u - 0.5) * 260);
      beacon.userData.phase = Math.random() * 6;
      parts.beacons.push(beacon);
    }
  });

  // street lamps: a halo at each head, a long reflection on the wet road toward the window
  const lampsNode = cityNodes.get('Street_Lamps');
  for (let k = -3; k < 6; k++) {
    const halo = card(city, additive(0xffb46a, glowMap, 0.85), 2.2, 2.2);
    halo.position.set(7.0, -1.65, -k * 9);
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 5.5), additive(0xffb46a, wetMap, 0.35));
    lieOnRoad(wet);
    wet.position.set(4.5, -5.88, -k * 9);
    wet.userData.noInk = true;
    city.add(wet);
    parts.lamps.push(halo);
    parts.wet.push(wet);
  }
  if (lampsNode) parts.lampPosts = lampsNode;
  // the pub's signs bleed onto the road too
  for (const [color, z, op] of [[0xff2a1f, -4.2, 0.25], [0xffb43a, -2.6, 0.2]]) {
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 6), additive(color, wetMap, op));
    lieOnRoad(wet);
    wet.position.set(5.6, -5.88, z);
    wet.userData.noInk = true;
    city.add(wet);
    parts.wet.push(wet);
  }

  // traffic: head + tail lights with their own reflections, two lanes, opposite directions
  city.add(parts.cars);
  for (let i = 0; i < 6; i++) {
    const lane = i % 2;
    const car = new THREE.Group();
    const dir = lane ? 1 : -1;
    const head = card(car, additive(0xfff3dc, glowMap), 0.7, 0.45);
    const tail = card(car, additive(0xff2a1f, glowMap, 0.8), 0.6, 0.35);
    head.position.z = dir * 2;
    tail.position.z = -dir * 2;
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), additive(0xfff3dc, wetMap, 0.3));
    lieOnRoad(wet);
    wet.position.set(-1.4, -0.12, dir * 2);
    wet.userData.noInk = true;
    car.add(wet);
    car.position.set(lane ? 6.2 : 5.2, -5.7, (Math.random() - 0.5) * 120);
    car.userData = { dir, speed: 6 + Math.random() * 5 };
    parts.cars.add(car);
  }

  // steam off a near rooftop vent, and a flickering stairwell, on the near towers closest to the view
  const near = [...cityNodes.values()].filter((o) => /^Tower_\d+$/.test(o.name) && o.userData.band === 0)
    .map((o) => new THREE.Box3().setFromObject(o)).filter((b) => Math.abs(b.getCenter(new THREE.Vector3()).z) < 14)
    .sort((a, b) => Math.abs(a.getCenter(new THREE.Vector3()).z) - Math.abs(b.getCenter(new THREE.Vector3()).z));
  if (near[0]) {
    const steamMap = createSteamTexture();
    const steam = card(city, new THREE.MeshBasicMaterial({ map: steamMap, transparent: true, opacity: 0.18, color: 0xb8b0d8, depthWrite: false }), 1.4, 3);
    const c = near[0].getCenter(new THREE.Vector3());
    steam.position.set(c.x, near[0].max.y + 1.6, c.z + 0.8);
    parts.steam = steam;
  }
  if (near[1]) {
    const stair = card(city, new THREE.MeshBasicMaterial({ color: 0x9fd8b8, transparent: true, opacity: 0.45 }), 0.22, Math.min(5, near[1].max.y + 5.5));
    const c = near[1].getCenter(new THREE.Vector3());
    stair.position.set(near[1].min.x - 0.04, (near[1].max.y - 6) / 2 - 0.5, c.z);
    parts.stair = stair;
  }

  const fogMap = fogTexture();
  // street fog: low banks rolling along the road at Dan's Den and between the near blocks (sign and monorail stay above)
  [[7.6, 0.5, 0.006, 13], [11.5, 0.55, -0.005, 15], [16, 0.6, 0.004, 17]].forEach(([x, op, drift, h], i) => {
    const map = fogMap.clone();
    map.needsUpdate = true;
    map.repeat.set(4 + i, 1);
    map.offset.x = Math.random();
    const m = card(city, new THREE.MeshBasicMaterial({ map, color: HAZE, transparent: true, opacity: op, depthWrite: false }), 200, h);
    m.position.set(x, -6 + h / 2 - 0.5, 0);
    m.material.userData = { base: op, drift };
    parts.haze.push(m);
  });
  // fog banks: drifting, textured layers from the monorail to the skyline, each a little thicker than the last
  [[23, 0.7, 0.004], [33, 0.8, -0.005], [47, 0.9, 0.003]].forEach(([x, op, drift], i) => {
    const map = fogMap.clone();
    map.needsUpdate = true;
    map.repeat.set(1.6 + i * 0.5, 1);
    map.offset.x = Math.random();
    const m = card(city, new THREE.MeshBasicMaterial({ map, color: HAZE, transparent: true, opacity: op, depthWrite: false }), 220, 22 + i * 4);
    m.position.set(x, -6 + (22 + i * 4) / 2 - 2, 0);
    m.material.userData = { base: op, drift };
    parts.haze.push(m);
  });

  const levels = { skyline: 1, street: 1, across: 1, flash: 0 };
  return {
    parts,
    levels,
    update(t, dt) {
      parts.sky.material.color.setScalar(1 + levels.flash * 2.2);
      parts.skyline.forEach((m) => { m.material.uniforms.uLevel.value = levels.skyline; m.material.uniforms.uFlash.value = levels.flash; });
      parts.haze.forEach((m) => { m.material.opacity = m.material.userData.base * (0.3 + 0.7 * (levels.skyline + levels.across) / 2); m.material.map.offset.x += m.material.userData.drift * dt; m.material.color.copy(HAZE).multiplyScalar(1 + levels.flash * 2); });
      parts.beacons.forEach((b) => { b.material.opacity = levels.skyline * (Math.sin(t * 2.2 + b.userData.phase) > 0.85 ? 1 : 0.05); });
      parts.lamps.forEach((m) => { m.material.opacity = 0.85 * levels.street; });
      parts.wet.forEach((m) => { m.material.opacity = (m.material.userData.base ??= m.material.opacity) * levels.street; });
      for (const car of parts.cars.children) {
        car.visible = levels.street > 0.02;
        if (levels.street < 0.5) continue; // the lights died: traffic stops dead
        car.position.z += car.userData.dir * car.userData.speed * dt;
        if (Math.abs(car.position.z) > 60) car.position.z = -Math.sign(car.position.z) * 60;
      }
      if (parts.steam) parts.steam.material.map.offset.y -= dt * 0.15;
      if (parts.stair) parts.stair.material.opacity = levels.across * (Math.random() < 0.06 ? 0.08 : 0.45);
    },
  };
}

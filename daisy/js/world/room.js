// The apartment: loads the baked GLB, applies the inked toon look, lights it like a noir panel, and animates the life in it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gsap } from 'gsap';
import { toonify, createComposer } from './toon.js';
import { GLASS_LIGHTS, createRainGlass, createOutsideRain, createBuildingTexture, createTvTexture, createRainLightMap, createCityWindowMaterial, createTrainWindowMap, createTrainPaneMap, createClubSignMap, createY2kBillboardMap, createShopSignAtlas, createBeerSignMap, createGlowMap, createPhotoTexture, createPhoneListTexture, createPhoneListBackTexture,
  createChecklistTexture, createBannerTexture, STICKY_NOTES, createStickyTexture, createPhotoBackNoteTexture,
  createMagazineCoverTexture, createTakeoutLogoTexture, createPagerLcd, createNokiaLcd, createMixtapeLabelTexture, createStickerTexture, createRompaqBadgeTexture, createMacroWorksBadgeTexture, createCanTexture, handReady } from './fx.js';
import { createCityLife } from './citylife.js';
import { trainStopDistance, trainStopPos, trainStopTime, trainPan, nextLightning, BLACKOUT_STAGES, stageLevel } from './city.logic.js';
import { clubLevel } from './neon.logic.js';
import { parallaxOffset } from './look.logic.js';

// Three coords (Blender (x,y,z) -> (x,z,-y)). Tuned by eye during playtest.
export const POSES = {
  slumped: { pos: [0.08, 0.95, 0.55], look: [-0.35, 0.78, 0.15] },
  seated: { pos: [0, 1.17, 0.9], look: [-0.03, 0.95, -0.4] },
  ceiling: { pos: [0.06, 1.0, 0.72], look: [0.0, 2.6, 0.45] },      // slumped, staring up at the decorations
  panDesk: { pos: [0, 1.17, 0.9], look: [0.15, 0.85, -0.5] },
  window: { pos: [0.35, 1.25, 0.45], look: [1.6, 1.45, -0.3] },
  windowDeep: { pos: [0.95, 1.28, 0.05], look: [20, 3.2, -6] },     // rack-focused out to the bridge
  tower: { pos: [0.1, 1.08, 0.72], look: [0.5, 0.32, -0.3] },        // leaning down to the PC's power button
  menu: { pos: [0.52, 1.8, 1.05], look: [2.2, 2.05, -0.4] },        // the title: up close to a gold foil star, the window soft behind it
};

const DOME = 0.12, DOME_GLOW = 0.05;
const NEON_SPOT = 28; // the hoarding's cyan in the room

export async function createRoom(canvas, { quality = 'high', url = 'assets/models/room.glb', onProgress, getClock } = {}) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !high, powerPreference: 'high-performance' });
  renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 2) : 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060f);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.02, 140);
  scene.fog = null; // fog lives in the city shader only, so the room stays crisp

  const gltf = await new GLTFLoader().loadAsync(url, (e) => e.total && onProgress?.(e.loaded / e.total));
  scene.add(gltf.scene);
  const nodes = new Map();
  gltf.scene.traverse((o) => { if (o.name) nodes.set(o.name, o); });
  const node = (name) => {
    const o = nodes.get(name);
    if (!o) throw new Error(`room.glb is missing "${name}"`);
    return o;
  };
  toonify(gltf.scene, { hatchPx: 5 * renderer.getPixelRatio() });
  // Paper-thin prints (posters, notes, stickers, labels) lie flat on what they're stuck to: their shadow falls exactly
  // under them, so drawing them into every shadow map costs draws and shows nothing.
  const box = new THREE.Box3(), size = new THREE.Vector3();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    box.copy(o.geometry.boundingBox).getSize(size);
    if (Math.min(size.x, size.y, size.z) < 0.002) o.castShadow = false;
  });

  // special surfaces
  const glass = createRainGlass();
  Object.assign(node('Window_Glass'), { material: glass, castShadow: false });
  node('Window_Glass').userData.noInk = false; // fogged: the pane hides the city's outlines behind it (see setWindowFog)
  // Where a light out in the city lands on the pane from the camera's eye, as (u, v) on the glass: its blur sits there.
  const paneUv = (() => {
    const pane = node('Window_Glass');
    pane.updateWorldMatrix(true, false);
    const pos = pane.geometry.attributes.position, uv = pane.geometry.attributes.uv;
    const uvOf = (i) => new THREE.Vector2().fromBufferAttribute(uv, i);
    const at = (i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(pane.matrixWorld);
    const pick = (f) => { let best = 0; for (let i = 1; i < uv.count; i++) if (f(uvOf(i)) > f(uvOf(best))) best = i; return best; };
    const i0 = pick((t) => -t.x - t.y), iu = pick((t) => t.x - t.y), iv = pick((t) => t.y - t.x); // three corners
    const p0 = at(i0), eu = at(iu).sub(p0), ev = at(iv).sub(p0), t0 = uvOf(i0), du = uvOf(iu).sub(t0), dv = uvOf(iv).sub(t0);
    const plane = new THREE.Plane().setFromCoplanarPoints(p0, at(iu), at(iv));
    const uu = eu.dot(eu), uvv = eu.dot(ev), vv = ev.dot(ev), det = uu * vv - uvv * uvv;
    glass.uniforms.uAspect.value = eu.length() / ev.length();
    const ray = new THREE.Ray(), hit = new THREE.Vector3(), out = new THREE.Vector2();
    return (from, to) => {
      ray.set(from, hit.copy(to).sub(from).normalize());
      if (!ray.intersectPlane(plane, hit)) return null;
      const r = hit.sub(p0), a = (vv * r.dot(eu) - uvv * r.dot(ev)) / det, b = (uu * r.dot(ev) - uvv * r.dot(eu)) / det;
      return out.copy(t0).addScaledVector(du, a).addScaledVector(dv, b);
    };
  })();
  const building = createBuildingTexture();
  node('Building_Across').material = new THREE.MeshBasicMaterial({ map: building.texture });
  const tv = createTvTexture(getClock);
  // Blender grids export with V running bottom-to-top, so every printed surface is flipped once, here.
  const print = (name, texture, { glow = false } = {}) => {
    texture.center.set(0.5, 0.5);
    texture.repeat.set(1, -1);
    const o = node(name);
    const decal = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }; // a print always wins the depth tie with what it's stuck to
    if (glow) { o.material = new THREE.MeshBasicMaterial({ map: texture, ...decal }); return; }
    Object.assign(o.material, decal);
    o.userData.paper = o.material.color.clone(); // remembered for its blank back in inspect
    o.material.map = texture; // paper: keep the toon material so the room's light and hatching fall on it
    o.material.color.set(0xffffff);
    o.material.needsUpdate = true;
  };
  await handReady; // the notes are baked once; don't bake them in a fallback face
  print('TV_Screen', tv.texture, { glow: true });
  print('Photo_Front', createPhotoTexture()); // a print, lit by the room like everything else (unlit it glowed like a screen)
  { // the model has the print floating 2.4 mm proud of the frame (a gap you can see edge-on): seat it on the frame's face
    const frame = node('Photo_Frame'), front = node('Photo_Front');
    frame.updateWorldMatrix(true, false);
    const normal = new THREE.Vector3().setFromMatrixColumn(frame.matrixWorld, 2).normalize(); // the frame's local +z, its front
    front.position.addScaledVector(normal, -0.0022);
  }
  print('Photo_Back_Note', createPhotoBackNoteTexture());
  const posterArt = await new THREE.TextureLoader().loadAsync('assets/textures/hellgate-poster.jpg'); // 2:3, Gemini art for Swastik
  posterArt.colorSpace = THREE.SRGBColorSpace;
  print('Poster', posterArt);
  print('Checklist', createChecklistTexture());
  print('Banner', createBannerTexture());
  STICKY_NOTES.forEach((lines, i) => print(`Sticky_${i}`, createStickyTexture(lines)));
  print('Magazine_Cover', createMagazineCoverTexture((await new THREE.TextureLoader().loadAsync('assets/textures/magazine-cover.jpg')).image)); // Gemini art for Swastik
  print('Takeout_Logo', createTakeoutLogoTexture());
  print('Soda_Lepsi', createCanTexture('lepsi'));
  print('Soda_Roke', createCanTexture('roke'));
  print('Soda_Empty', createCanTexture('spryte'));
  print('Nokia_Screen', createNokiaLcd(), { glow: true });
  print('Mixtape_Label', createMixtapeLabelTexture());
  print('Mixtape_Note', createStickyTexture(['side B.', 'LOUD.', 'x  m.']), { glow: true }); // under the case: only ever seen turned over in inspect, where the underside sits in shadow
  node('Mixtape_Note').material.color.setScalar(0.78); // paper, not a screen
  node('Mixtape_Note').material.map.repeat.set(-1, 1); // the plane faces down: undo print's flip so it reads once turned over
  print('Phone_List', createPhoneListTexture());
  { // written on the back too: seen when it's turned over in inspect (mirrored, since it's the plane's far side)
    const back = createPhoneListBackTexture();
    back.center.set(0.5, 0.5);
    back.repeat.set(-1, -1);
    node('Phone_List').traverse((o) => { if (o.isMesh) o.userData.backMap = back; });
  }
  print('Sticker', createStickerTexture());
  print('CRT_Badge', createRompaqBadgeTexture());
  print('Speaker_Badge_R', createMacroWorksBadgeTexture());
  const bobble = node('Bobble_Head'); // the president nods along, forever
  const pagerLcd = createPagerLcd((await (await fetch('data/room.json')).json()).pager);
  print('Pager_Screen', pagerLcd.texture, { glow: true });
  // three days old: a few flies keep the noodles company
  const flies = Array.from({ length: 4 }, (_, i) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 5, 4), new THREE.MeshBasicMaterial({ color: 0x0c0a0e }));
    f.userData = { phase: i * 1.7, r: 0.03 + i * 0.008, speed: 1.6 + i * 0.35 };
    scene.add(f);
    return f;
  });
  node('Neon_Sign').visible = false; // the cyan used to come from a tube below the sill; it comes from Dan's roof hoarding now
  const screenMat = node('CRT_Screen').material;
  screenMat.emissive.setHex(0x2a7a5a);
  screenMat.emissiveIntensity = 0;
  const leds = Array.from({ length: 8 }, (_, i) => {
    const led = node(`Modem_LED_${i}`);
    led.material = led.material.clone();
    return led;
  });
  let rainLights = [];
  const rain = createOutsideRain(high ? 1400 : 700, () => rainLights);
  scene.add(rain.object);

  // lights: monitor, lamp, neon, sodium street light through the blinds, TV, and the passing train
  const lights = {
    ambient: new THREE.HemisphereLight(0x463c88, 0x0b0912, 1.1),
    monitor: new THREE.PointLight(0xa8ffe0, 0, 2.2, 1.5),
    lamp: new THREE.SpotLight(0xffb066, 1.2, 3, 0.75, 0.6, 1.4),
    neon: new THREE.PointLight(0x3fe8ff, 3, 7, 1.4),
    street: new THREE.SpotLight(0x9fb8ff, 14, 14, 0.32, 0.45, 1.1),
    tv: new THREE.PointLight(0x6f9cff, 1.2, 2.4, 1.6),
    train: new THREE.SpotLight(0xcfe0ff, 0, 14, 0.25, 0.6, 1.1),
    neonSpot: new THREE.SpotLight(0x3fe8ff, NEON_SPOT, 12, 0.62, 0.85, 1.2),
    club: new THREE.PointLight(0xff2a1f, 0, 14, 1.3),
    lightning: new THREE.PointLight(0xc8d8ff, 0, 16, 1.2),
    dome: new THREE.PointLight(0xffd9a0, DOME, 3.2, 1.6), // the ceiling dome: barely on, a warm smudge
  };
  const at = (name) => node(name).getWorldPosition(new THREE.Vector3());
  const dome = node('Ceiling_Fixture');
  dome.material = dome.material.clone(); // its beige is shared with the tower
  dome.material.emissive.setHex(0xffd9a0);
  dome.material.emissiveIntensity = DOME_GLOW;
  lights.dome.position.copy(at('Ceiling_Fixture')).add(new THREE.Vector3(0, -0.08, 0));
  lights.monitor.position.copy(at('CRT_Screen')).add(new THREE.Vector3(0, 0, 0.3));
  const bulb = at('Lamp_Bulb');
  lights.lamp.position.copy(bulb);
  lights.lamp.target.position.set(bulb.x, 0.74, bulb.z + 0.1);
  lights.neon.position.set(2.6, 0.7, -0.2);
  lights.street.position.set(5, 4, -0.3);
  lights.street.target.position.set(0, 1.2, -0.6);
  lights.tv.position.copy(at('TV_Screen')).add(new THREE.Vector3(0.2, 0, 0.2));
  lights.train.position.set(6, 5, -3.5);
  lights.train.target.position.set(-1, 2.6, 0);
  lights.neonSpot.position.set(3.2, 1.1, -0.5); // stands in for the hoarding: placed at its real distance (~10 m) the light came in too flat, the blinds ate it and the ceiling went dark
  lights.neonSpot.target.position.set(-0.6, 2.1, 0.1); // ceiling + back wall: the decorations and the blinds throw their shadows here
  const rainMap = createRainLightMap();
  lights.neonSpot.map = rainMap.texture; // three needs castShadow for .map to project
  lights.neonSpot.castShadow = high;
  lights.neonSpot.shadow.mapSize.set(1024, 1024);
  lights.club.position.set(5.5, 0.9, -1.6);
  lights.lightning.position.set(6, 5, -1); // up and out past the window: the room catches it on the ceiling and walls
  lights.lamp.intensity = 0; // the cool look by default; warm light is the player's choice
  let lampOn = false;
  const bulbMat = node('Lamp_Bulb').material;
  const bulbGlow = bulbMat.emissiveIntensity; // the GLB bakes the bulb as an emitter: off must mean off
  bulbMat.color.setHex(0x3a3530);
  bulbMat.emissiveIntensity = 0;
  let clubOn = true;
  for (const l of [lights.street, lights.train]) {
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0005;
  }
  // Shadow maps cost more than the room itself (each one re-draws every caster). The lights never move and only the
  // swaying decorations, bobblehead and flies do, so: train only while it's lit, the rest at 30 Hz, none when dark.
  // Each map must render once up front: one that was never drawn leaves every lit material sampling nothing (the room vanishes).
  for (const l of [lights.street, lights.train, lights.neonSpot]) Object.assign(l.shadow, { autoUpdate: false, needsUpdate: true });
  let shadowTick = 0;
  let carQuiet = 0, panic = false;
  const CAR_SPAN = 14; // m of street, either side of the window, that a car's lights reach the glass across
  // The real lights behind the glass that blur into the fog: Dan's Den, its beer sign, the monorail's amber lamps.
  const amberLamp = new THREE.Color(0xffb43a), clubRed = new THREE.Color(0xff2a1f);
  const HOARD = { x: 9.05, y: 1.21, z: -2.55, w: 1.9, h: 0.68 }; // the Y2K hoarding on Dan's roof (built with the city below)
  const trainGlow = new THREE.Vector3(20.5, 2.6, 0);
  // the hoarding is on Dan's roof: his switch and his breaker. It and its cyan light in the room go with his signs.
  const hoardLevel = () => (clubOn ? stage.pub : 0);
  const lightsOnGlass = [
    { pos: new THREE.Vector3(8.47, 0.45, -4.2), color: clubRed, level: () => (clubOn ? clubLevel(t) * stage.pub : 0) },
    // and its haze: the sign's red spread wide and faint across the fog, no edge to it
    { pos: new THREE.Vector3(8.47, 0.45, -4.2), color: clubRed, spread: 0.05, level: () => (clubOn ? clubLevel(t) * stage.pub * 0.55 : 0) },
    { pos: new THREE.Vector3(8.75, -0.25, -2.6), color: amberLamp, level: () => (clubOn ? stage.pub * 0.7 : 0) },
    // the Y2K hoarding on Dan's roof: a wide cyan smear, on his switch like his signs
    { pos: new THREE.Vector3(HOARD.x, HOARD.y, HOARD.z), color: new THREE.Color(0x3fe8ff), spread: 0.04, level: () => hoardLevel() * 0.3 },
    ...[-3, -2, -1, 0, 1, 2, 3].map((k) => ({ pos: new THREE.Vector3(20.02, 2.1, -k * 6), color: amberLamp, level: () => stage.across * 0.8 })),
    // the street lamps nearest the window (their heads sit low: they bleed in along the bottom of the pane)
    ...[-1, 0, 1].map((k) => ({ pos: new THREE.Vector3(7.25, -1.55, -k * 9), color: amberLamp, spread: 0.008, level: () => life.levels.street * 0.6 })),
    // a train going by: its lit cars as one long pale smear riding along the monorail
    { pos: trainGlow, color: new THREE.Color(0xfff1c8), spread: 0.02, level: () => lights.train.intensity / 55 },
  ].slice(0, GLASS_LIGHTS);
  const CAR_PEAK = 2.6; // s into car_pass.mp3 where it's loudest
  for (const l of Object.values(lights)) {
    scene.add(l);
    if (l.target) scene.add(l.target);
  }

  const cityGltf = await new GLTFLoader().loadAsync('assets/models/city.glb');
  const city = cityGltf.scene;
  scene.add(city);
  node('Building_Across').visible = false; // the flat backdrop is replaced by the real city
  const cityMat = createCityWindowMaterial();
  const cityNodes = new Map();
  city.traverse((o) => { if (o.name) cityNodes.set(o.name, o); });
  // A hoarding on Dan's roof: a steel stand (one mesh, inked and toon-shaded with the city) under the Y2K ad. Right of
  // the blade sign, and low enough that the monorail still shows above it from the desk.
  const strut = (sx, sy, sz, x, y, z) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
  const standGeo = mergeGeometries([
    strut(0.06, HOARD.h + 0.1, HOARD.w + 0.1, HOARD.x + 0.04, HOARD.y, HOARD.z),             // the board's back panel
    ...[-0.75, 0, 0.75].map((dz) => strut(0.07, 0.62, 0.07, HOARD.x + 0.12, 0.72 + 0.31, HOARD.z + dz)), // legs down to the roof
    ...[-0.75, 0.75].map((dz) => strut(0.5, 0.05, 0.05, HOARD.x + 0.3, 1.2, HOARD.z + dz)),  // back braces
    strut(0.25, 0.03, HOARD.w + 0.2, HOARD.x - 0.08, HOARD.y - HOARD.h / 2 - 0.06, HOARD.z), // the lamp ledge under it
  ]);
  const stand = new THREE.Mesh(standGeo, new THREE.MeshStandardMaterial({ color: 0x2c2c34 }));
  stand.name = 'Hoarding_Stand';
  city.add(stand);
  // Two doors down from Dan's: unlit blade signs hanging off the facade, sideways to the street, on rods and wall
  // brackets. All the frames and rods are one mesh, toon-shaded with the building; all the painted faces (both sides of
  // each board, one shared atlas) are one more. Irregular sizes on purpose.
  const SHOPS = [['wok', 0.62, 1.5, 0.2, -5.0], ['pizza', 0.5, 1.05, -0.35, -5.8], ['deli', 0.44, 0.9, 0.4, -6.55]];
  const WALL = 8.8, GAP = 0.12; // the facade's x, and the board's gap off it
  const frameGeos = [], faceGeos = [];
  SHOPS.forEach(([, w, h, y, z], i) => {
    const near = WALL - GAP, far = near - w, cx = (near + far) / 2;
    const bar = (sx, sy, sz, x, yy, zz) => frameGeos.push(new THREE.BoxGeometry(sx, sy, sz).translate(x, yy, zz));
    bar(w + 0.06, h + 0.06, 0.07, cx, y, z);                          // the board's frame
    bar(GAP + w + 0.05, 0.035, 0.035, WALL - (GAP + w) / 2, y + h / 2 + 0.14, z); // top rod, out from the wall
    for (const x of [near - 0.04, far + 0.04]) bar(0.02, 0.14, 0.02, x, y + h / 2 + 0.07, z); // drop rods
    bar(0.04, 0.24, 0.12, WALL - 0.02, y + h / 2 + 0.1, z);           // wall plate
    bar(0.03, h * 0.6, 0.03, near + 0.015, y, z);                     // lower wall arm
    for (const side of [1, -1]) {                                     // the painted face, both sides
      const f = new THREE.PlaneGeometry(w * 0.92, h * 0.94);
      if (side < 0) f.rotateY(Math.PI);
      f.translate(cx, y, z + side * 0.037);
      const uv = f.attributes.uv; // squeeze into this sign's slot in the atlas
      for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / SHOPS.length);
      faceGeos.push(f);
    }
  });
  city.add(Object.assign(new THREE.Mesh(mergeGeometries(frameGeos), new THREE.MeshStandardMaterial({ color: 0x2a2630 })), { name: 'Shop_Signs' }));
  const shopFaces = new THREE.Mesh(mergeGeometries(faceGeos), new THREE.MeshBasicMaterial({ map: createShopSignAtlas(SHOPS.map((x) => x[0])) }));
  shopFaces.userData.noInk = true;
  toonify(city, { hatchPx: 4 * renderer.getPixelRatio() });
  city.add(shopFaces); // after toonify: painted, not lit (the street's spill is baked into the colour)
  city.traverse((o) => {
    if (o.isMesh && [o.name, o.parent?.name].some((n) => /^Tower_\d+$/.test(n ?? ''))) { o.material = cityMat; o.userData.noInk = true; } // towers live in the fog: no outlines
    if (o.isMesh && [o.name, o.parent?.name].includes('Facade_Detail')) o.userData.noInk = true; // nor their sills and parapets
    if (o.isMesh) o.castShadow = false;
  });
  const train = cityNodes.get('Train');
  const trainWin = cityNodes.get('Train_Windows');
  trainWin.material = new THREE.MeshBasicMaterial({ map: createTrainPaneMap() });
  // DAN'S DEN: neon faces on the blade (Blender x=8.475 face) and in the pub window (x=8.76), facing the window, each with
  // an additive halo card and a little red wash on the brick. Unlit: they are the light.
  const glowMap = createGlowMap();
  const card = (material, w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z);
    m.rotation.y = -Math.PI / 2;
    m.userData.noInk = true; // light, not a drawn object: the ink would outline the card's rectangle
    city.add(m);
    return m;
  };
  const glowMat = (color) => new THREE.MeshBasicMaterial({ color, map: glowMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const clubSignMat = new THREE.MeshBasicMaterial({ color: 0xff2a1f, map: createClubSignMap() });
  const clubGlowMat = glowMat(0xff2a1f);
  const beerSignMat = new THREE.MeshBasicMaterial({ color: 0xffb43a, map: createBeerSignMap() });
  card(clubSignMat, 1.04, 2.24, 8.47, 0.45, -4.2);
  card(clubGlowMat, 1.9, 3.1, 8.4, 0.45, -4.2);
  card(beerSignMat, 1.2, 0.6, 8.75, -0.25, -2.6);
  const beerGlowMat = card(glowMat(0xffb43a), 1.7, 1.0, 8.72, -0.25, -2.6).material;
  const hoardMat = new THREE.MeshBasicMaterial({ color: 0x3fe8ff, map: createY2kBillboardMap() });
  card(hoardMat, HOARD.w, HOARD.h, HOARD.x, HOARD.y, HOARD.z);
  const clubWash = new THREE.PointLight(0xff2a1f, 0, 3.5, 1.6);
  clubWash.position.set(8.1, 0.45, -4.2);
  city.add(clubWash);
  const life = createCityLife(city, cityNodes);
  // what the rain outside catches: the street lamps, the club sign, the neon in the window, the train going by
  const amber = new THREE.Color(0xffb46a).multiplyScalar(0.9), red = new THREE.Color(0xff2a1f), cyan = new THREE.Color(0x3fe8ff).multiplyScalar(0.6);
  const lampLights = life.parts.lamps.map((m) => ({ pos: m.position, color: amber, radius: 3.2, level: 1 }));
  const clubRain = { pos: new THREE.Vector3(8.2, 0.45, -4.2), color: red, radius: 3, level: 1 };
  const neonRain = { pos: new THREE.Vector3(9.05, 1.21, -2.55), color: cyan, radius: 3.2, level: 1 }; // the hoarding
  const trainRain = { pos: new THREE.Vector3(15, 3.5, 0), color: new THREE.Color(0xfff1c8).multiplyScalar(0.5), radius: 9, level: 0 };
  rainLights = [...lampLights, clubRain, neonRain, trainRain];
  // splashes on the outside sill
  const SPLASH = 30;
  const splashPos = new Float32Array(SPLASH * 3);
  const splashGeo = new THREE.BufferGeometry();
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
  const splashes = new THREE.Points(splashGeo, new THREE.PointsMaterial({ size: 0.012, color: 0x9fb0d8, transparent: true, opacity: 0.7, depthWrite: false }));
  splashes.userData.noInk = true;
  splashes.frustumCulled = false;
  scene.add(splashes);
  const splashT = Array.from({ length: SPLASH }, () => Math.random());
  // the monorail's amber marker lamps are emitters too
  const railLampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb43a).multiplyScalar(1.6) });
  cityNodes.get('Rail_Lights').traverse((o) => { if (o.isMesh) o.material = railLampMat; });
  // one light level per blackout stage, far to near (city.logic.js BLACKOUT_STAGES); render() applies them
  const stage = { skyline: 1, mid: 1, street: 1, pub: 1, across: 1 };
  const storm = { flash: 0, timer: null, audio: null };
  const TRAIN_FAR = 80;   // Three z: positive = to the right of the window (Blender -Y)
  const TRAIN_NEAR = -80;
  train.position.z = TRAIN_FAR;
  const CRUISE = (TRAIN_FAR - TRAIN_NEAR) / 7; // a pass takes ~7 s
  const SOUND_LEAD = 2.2; // s of approach before the train enters the frame (train_pass.mp3 peaks 5.7 s in)
  const train$ = { z: TRAIN_FAR, v: 0, done: null, promise: Promise.resolve() };
  // Off, the panes stay: black glass in their frames (hiding them left the cars a flat band).
  let trainLit = true;
  const setTrainLit = (on) => { trainLit = on; trainWin.material.color.setScalar(on ? 1 : 0.07); };
  const trainLights = (on, flicker = false) => {
    if (!flicker) { setTrainLit(on); return; }
    const tl = gsap.timeline();
    [0.08, 0.12, 0.06, 0.2].forEach((d, i) => tl.call(() => setTrainLit((i % 2 === 0) !== on), null, `+=${d}`));
    tl.call(() => setTrainLit(on));
  };
  lights.train.map = createTrainWindowMap();
  // The joined Blinds node carries its first slat's baked tilt, so swing a pivot at the top rail instead of the node:
  // about Three Z (along the window), the bottom of the blinds kicks toward the glass and settles.
  const blinds = node('Blinds');
  const blindsPivot = new THREE.Group();
  blinds.parent.add(blindsPivot);
  blindsPivot.position.copy(blinds.position);
  blindsPivot.add(blinds);
  blinds.position.set(0, 0, 0);
  let blindsTl = null;
  const tremor = { v: 0 }; // the building shaking as the train goes by: drives the blinds' kick and the camera's wiggle together
  // k: how hard. The quiet gameplay passes (heard just over the rain, unseen from the desk) only nudge the blinds and
  // don't shake the camera; a full kick with nothing to hear or see behind it reads as a bug.
  const rattleBlinds = (at = 0, k = 1) => {
    blindsTl?.kill();
    blindsPivot.rotation.set(0, 0, 0);
    blindsTl = gsap.timeline({ delay: at });
    if (k >= 1) blindsTl.fromTo(tremor, { v: 0 }, { v: 1, duration: 0.3, ease: 'power2.out' }, 0).to(tremor, { v: 0, duration: 3.6, ease: 'power2.out' }, 0.3);
    let step = 0; // placed explicitly: appended steps would queue after the tremor and swing seconds after the train
    [0.13, -0.1, 0.075, -0.055, 0.04, -0.026, 0.015, -0.007, 0].forEach((a, i) => {
      const duration = 0.3 + i * 0.04;
      blindsTl.to(blindsPivot.rotation, { z: a * k, duration, ease: 'sine.inOut' }, step);
      step += duration;
    });
    if (k >= 1) blindsTl.to(blindsPivot.rotation, { x: 0.02, duration: 0.09, yoyo: true, repeat: 15, ease: 'sine.inOut' }, 0); // the slats knock
  };
  // New Year's decorations on threads: a slow draught keeps them turning; a passing train swings them like the blinds.
  const decos = Array.from({ length: 7 }, (_, i) => node(`Deco_${i}`));
  // The decorations throw their shadows from the neon only (the main ones, on the ceiling and back wall). From the street
  // lamp and the train they were faint doubles. A shadow map draws only the layers its camera tests, so the decorations
  // live on layer 1: the eye and the neon's shadow camera see it, the street lamp's and the train's don't.
  for (const d of [...decos, node('Deco_Cord')]) d.traverse((o) => o.layers.set(1));
  camera.layers.enable(1);
  lights.neonSpot.shadow.camera.layers.enable(1);
  const decoKick = { v: 0 };

  const composer = high ? createComposer(renderer, scene, camera) : null;

  const toVec = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(...a));
  const poseOf = (p) => {
    const src = typeof p === 'string' ? POSES[p] : p;
    return { pos: toVec(src.pos), look: toVec(src.look) };
  };
  const start = poseOf('slumped');
  const rig = { pos: start.pos, look: start.look, breathe: 1 };

  let t = 0;
  let ledClock = 0;
  let modemActive = false;
  let answerBlink = false;
  let answerRinging = false; // lit steady while the phone rings
  let mains = true; // the blackout: every LED on the desk goes dark
  const screens = { level: 1 }; // the TV loses power with the building
  // the speakers' green power lights go with the building too (each mesh has its own material copy)
  const speakerLeds = ['Speaker_LED_L', 'Speaker_LED_R'].map((n) => {
    const m = node(n).material;
    return { m, glow: m.emissiveIntensity, green: m.color.clone() };
  });
  const screenMats = [node('TV_Screen').material];
  // small lights that run off the mains: the power strip's rocker, the VCR's 12:00, the tower's power and disk LEDs
  const glow = (n) => { const o = node(n); o.material = o.material.clone(); return { m: o.material, glow: o.material.emissiveIntensity, c: o.material.color.clone() }; };
  const setGlow = (g, on) => { g.m.emissiveIntensity = on ? g.glow : 0; g.m.color.copy(g.c).multiplyScalar(on ? 1 : 0.15); };
  const mainsGlows = ['Strip_Switch', 'VCR_Display'].map(glow);
  const pcPower = glow('Tower_Power_LED'), pcDisk = glow('Tower_HDD_LED');
  for (const n of ['Tower_Power_LED', 'Tower_HDD_LED']) node(n).userData.noInk = true; // tiny lights: the ink would swallow them
  let pcOn = true, diskBusy = 0; // diskBusy: seconds of heavy reading/writing left
  const answerLed = node('Answering_LED');
  if (answerLed?.material) answerLed.material = answerLed.material.clone(); // blink this LED only
  const answerGlow = answerLed?.material?.emissiveIntensity ?? 1;
  const answerRed = answerLed?.material?.color.clone();
  let trainTimer = null;
  let trainAudio = null;
  let trainVol = 1; // the cold open's pass is full; once the loop starts (back at the desk) passes sit far back
  const par = { x: 0, y: 0, tx: 0, ty: 0 };

  const room = {
    renderer, scene, camera, nodes, node, lights, rig, poseOf,
    toggleLamp() {
      lampOn = !lampOn;
      gsap.to(lights.lamp, { intensity: lampOn ? 1.6 : 0, duration: 0.06 });
      bulbMat.color.setHex(lampOn ? 0xffe2b0 : 0x3a3530);
      bulbMat.emissiveIntensity = lampOn ? bulbGlow : 0;
      return lampOn;
    },
    buzzPager() {
      const pager = node('Pager');
      return gsap.fromTo(pager.position, { x: pager.position.x - 0.002 }, { x: pager.position.x + 0.002, duration: 0.04, yoyo: true, repeat: 23, ease: 'none' }).then(() => {});
    },
    setFilm({ drain } = {}) {
      if (composer && drain !== undefined) composer.grade.uniforms.uDrain.value = drain;
    },
    // glare: bright light actually reaching the lens (lightning, the train's light sweeping in, the lamp) — 0 in the dark
    levels: () => ({ neon: hoardLevel(), club: clubOn ? clubLevel(t) : 0,
      glare: Math.max(storm.flash, lights.train.intensity / 55, lampOn ? 0.4 : 0) }),
    hotspotMeshes(names) { return names.map((n) => node(n)); },
    highlight(name, on) {
      node(name).traverse((o) => {
        if (!o.material?.emissive) return;
        o.userData.baseEmissive ??= o.material.emissive.getHex(); // e.g. the answering machine's red LED
        o.material.emissive.setHex(on ? 0x1f5560 : o.userData.baseEmissive);
      });
    },
    setParallax(nx, ny) { const o = parallaxOffset(nx, ny, { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }); par.tx = o.x; par.ty = o.y; },
    setClubSign(on) { clubOn = on; },
    // After the blackout: about one car in three under the window is a police car or an ambulance, lights going.
    setPanic(on) { panic = on; },
    // The city's lights as soft blobs in the fog: off for the cold open and the blackout, where they'd sit too still.
    setWindowBokeh(v, duration = 0) { gsap.to(glass.uniforms.uBokeh, { value: v, duration, overwrite: true }); },
    // The window's condensation: 0 clear … 1 fogged (the default, all night), over `duration` s.
    // Right up at the glass its drops are big and low-res: fade the whole pane back a little (1 = normal).
    setGlassOpacity(v, duration = 0) { gsap.to(glass.uniforms.uOpacity, { value: v, duration, overwrite: true }); },
    setWindowFog(v, duration = 0) {
      const pane = node('Window_Glass');
      // fogged, the pane joins the ink prepass and hides the city's outlines behind it: you can't see edges through fog
      gsap.to(glass.uniforms.uFog, { value: v, duration, overwrite: true, onUpdate: () => { pane.userData.noInk = glass.uniforms.uFog.value < 0.5; } });
    },
    // Depth of field: { focus (m from the eye), aperture, maxblur }, or null for none. Only on high quality.
    get focus() { return composer?.bokeh.uniforms; },
    setFocus(f) {
      if (!composer) return;
      composer.bokeh.enabled = !!f;
      if (f) for (const k of ['focus', 'aperture', 'maxblur']) if (f[k] !== undefined) composer.bokeh.uniforms[k].value = f[k];
    },
    setPose(p) {
      const { pos, look } = poseOf(p);
      rig.pos.copy(pos);
      rig.look.copy(look);
    },
    render(dt) {
      t += dt;
      glass.uniforms.uTime.value = t;
      clubRain.level = clubOn ? clubLevel(t) : 0;
      neonRain.level = hoardLevel();
      trainRain.level = lights.train.intensity / 55;
      trainRain.pos.z = train$.z;
      lampLights.forEach((l) => { l.level = life.levels.street; });
      rain.update(dt);
      for (let i = 0; i < SPLASH; i++) {
        if ((splashT[i] -= dt) > 0) continue;
        splashT[i] = 0.3 + Math.random() * 0.6;
        splashPos.set([1.68 + Math.random() * 0.06, 0.87, -0.8 + Math.random()], i * 3);
      }
      splashGeo.attributes.position.needsUpdate = true;
      building.tick(t);
      cityMat.uniforms.uTime.value = t;
      life.update(t, dt);
      // the cars you hear light the bottom of the pane as they pass (they're below the sill, out of sight otherwise)
      const nearCars = life.parts.cars.children.filter((c) => c.visible && c.userData.shown).sort((p, q) => Math.abs(p.position.z) - Math.abs(q.position.z));
      [glass.uniforms.uCarA, glass.uniforms.uCarB].forEach((u, k) => {
        const c = nearCars[k];
        u.value.set(c ? 0.5 + c.position.z / CAR_SPAN : 0, c ? Math.max(0, 1 - Math.abs(c.position.z) / CAR_SPAN) * life.levels.street : 0, c?.userData.siren ? 2 : c?.userData.dir < 0 ? 1 : 0); // z: 0 head, 1 tail, 2 lightbar
      });
      // and you hear them: a wet-road pass timed so its loudest moment (2.6 s in) is the car under the window,
      // panned from the side it comes from. Now and then somebody leans on the horn.
      const street = storm.audio ?? trainAudio;
      for (const c of life.parts.cars.children) {
        const toWindow = -c.userData.dir * c.position.z; // > 0 while it's still coming
        if (Math.abs(c.position.z) > 40) { c.userData.heard = false; c.userData.shown = false; c.userData.siren = panic && Math.random() < 0.35; }
        if (!c.visible || !street || c.userData.heard || toWindow <= 0 || toWindow > c.userData.speed * CAR_PEAK) continue;
        c.userData.heard = true;
        if (t < carQuiet) continue; // a quiet street at 11 pm: one car (or, after the blackout, sometimes an ambulance) now and then
        carQuiet = t + 20 + Math.random() * 25;
        c.userData.shown = true; // and only that one lights the glass: what you see passing is what you hear
        const near = life.levels.street;
        if (c.userData.siren) continue; // seen, not heard: the city's ambient sirens already carry the sound
        street.sfx('car_pass', { bus: 'ambience', gain: (0.18 + Math.random() * 0.1) * near, pan: Math.sign(c.position.z) * 0.45, rate: 0.92 + Math.random() * 0.16, lowpass: 2600 }); // through the glass
        if (Math.random() < 0.15) street.sfx(Math.random() < 0.5 ? 'car_horn_1' : 'car_horn_2', { bus: 'ambience', gain: (0.1 + Math.random() * 0.08) * near, pan: Math.sign(c.position.z) * 0.3, lowpass: 3200, delay: 1.2 + Math.random() * 1.5 });
      }
      if (room.trainState === 'passing' || room.trainState === 'resuming') train$.z -= train$.v * dt;
      train.position.z = train$.z;
      train$.snd?.panner?.pan.setTargetAtTime(trainPan(train$.z), train$.snd.context.currentTime, 0.05);
      lights.train.intensity = trainLit && room.trainState !== 'idle' ? 55 * Math.max(0, 1 - Math.abs(train$.z) / 30) : 0;
      lights.train.position.set(15, 6.5, train$.z * 0.5 - 1); // light rides with the train
      lights.train.target.position.set(-1, 1.6, train$.z * 0.08);
      if (train$.z < TRAIN_NEAR && room.trainState !== 'idle') { room.trainState = 'idle'; train$.snd = null; train$.done?.(); }
      decos.forEach((d, i) => {
        const f = 0.6 + i * 0.11; // each strand its own length, its own period
        d.rotation.x = 0.035 * Math.sin(t * f + i * 1.7) + decoKick.v * 0.22 * Math.sin(t * 6.5 * f + i);
        d.rotation.z = 0.025 * Math.sin(t * f * 0.8 + i) + decoKick.v * 0.16 * Math.cos(t * 5.5 * f + i * 2.3);
        d.rotation.y = 0.4 * Math.sin(t * 0.21 + i * 0.9); // turning on the thread: the foil catches the light
      });
      const sign = clubOn ? clubLevel(t) * stage.pub : 0;
      clubSignMat.color.setHex(0xff2a1f).multiplyScalar(clubOn && stage.pub > 0 ? 0.06 + (0.14 + 1.8 * sign) * stage.pub : 0.06); // off: dead glass, still faintly red
      clubGlowMat.opacity = 0.55 * sign;
      clubWash.intensity = 4 * sign;
      lights.street.intensity = 14 * stage.street; // the street lamp outside dies with the street and comes back with it
      beerSignMat.color.setHex(0xffb43a).multiplyScalar(clubOn ? 0.05 + 1.25 * stage.pub : 0.05);
      beerGlowMat.opacity = clubOn ? 0.5 * stage.pub : 0;
      hoardMat.color.setHex(0x3fe8ff).multiplyScalar(0.06 + 1.9 * hoardLevel());
      shopFaces.material.color.setScalar(0.08 + 0.32 * stage.street); // unlit boards: only the street lamps show them
      Object.assign(life.levels, { skyline: stage.skyline, street: stage.street, across: stage.across, flash: storm.flash });
      cityMat.uniforms.uFlash.value = storm.flash;
      glass.uniforms.uLit.value = Math.max(stage.street, stage.across, stage.pub);
      glass.uniforms.uFlash.value = storm.flash; // a flash lights the whole fogged pane at once
      lights.lightning.intensity = storm.flash * 45;
      lights.ambient.intensity = 1.1 + storm.flash * 1.4;
      cityMat.uniforms.uStage.value.set(stage.skyline, stage.mid, stage.street, stage.across);
      railLampMat.color.setHex(0xffb43a).multiplyScalar(0.05 + 1.55 * stage.across);
      tv.tick(t);
      pagerLcd.tick(dt);
      bobble.rotation.x = Math.sin(t * 2.3) * 0.05;
      bobble.rotation.z = Math.sin(t * 1.7 + 1) * 0.035;
      for (const f of flies) { // Blender (-0.72, 0.28) over the pail -> Three (x, y, -0.28)
        const { phase, r, speed } = f.userData, a = t * speed + phase;
        f.position.set(-0.72 + Math.cos(a) * r + Math.sin(a * 3.1) * 0.006, 0.9 + Math.sin(a * 1.7) * 0.025, -0.28 + Math.sin(a) * r * 0.8);
      }
      rainMap.tick(dt);
      const n = hoardLevel(); // steady: a lit hoarding doesn't buzz like a cheap tube
      const k = clubOn ? clubLevel(t) : 0;
      lights.neon.intensity = 3 * n;
      lights.neonSpot.intensity = NEON_SPOT * n;
      lights.club.intensity = 7 * k;
      glass.uniforms.uClubLevel.value = k;
      lights.tv.intensity = (tv.snow ? 1.1 + Math.random() * 0.45 : 1.0 + Math.sin(t * 23) * 0.15 + (Math.random() < 0.04 ? -0.6 : 0)) * screens.level; // snow flickers hard on the walls
      lights.tv.color.setHex(tv.snow ? 0xc8d2e6 : 0x6f9cff);
      for (const m of screenMats) m.color.setScalar(screens.level); // 0 = a black tube (0.02 linear still read as a lit screen)
      for (const l of speakerLeds) {
        l.m.emissiveIntensity = l.glow * Math.min(1, screens.level);
        l.m.color.copy(l.green).multiplyScalar(0.15 + 0.85 * Math.min(1, screens.level));
      }
      if ((ledClock += dt) > 0.06) {
        ledClock = 0;
        leds.forEach((l, i) => {
          l.material.emissiveIntensity = !mains ? 0 : modemActive ? (Math.random() < 0.4 ? 4 : 0.2) : (i < 2 ? 3 : 0.1);
        });
        const on = mains && pcOn;
        setGlow(pcPower, on);
        setGlow(pcDisk, on && Math.random() < (diskBusy > 0 ? 0.6 : 0.03)); // busy: a stutter of reads; idle: the odd blip
      }
      diskBusy = Math.max(0, diskBusy - dt);
      if (answerLed?.material) { // dark until there's a message, then a slow blink
        const lit = mains && (answerRinging || (answerBlink && Math.sin(t * Math.PI * 2) > 0));
        answerLed.material.emissiveIntensity = lit ? answerGlow * 1.6 : 0;
        answerLed.material.color.copy(answerRed).multiplyScalar(lit ? 1 : 0.12);
      }
      camera.position.copy(rig.pos);
      // A calm breath (~4.5 s) and a barely-there drift. Camera-only, so the CSS3D desktop moves with the glass.
      camera.position.y += Math.sin(t * 1.4) * 0.0018 * rig.breathe;
      camera.position.x += Math.sin(t * 0.29) * 0.0007 * rig.breathe;
      camera.position.x += Math.sin(t * 41) * 0.0011 * tremor.v; // in step with the blinds
      camera.position.y += Math.sin(t * 57 + 1.3) * 0.0008 * tremor.v;
      par.x += (par.tx - par.x) * Math.min(1, dt * 4);
      par.y += (par.ty - par.y) * Math.min(1, dt * 4);
      camera.position.x += par.x;
      camera.position.y += par.y;
      camera.lookAt(rig.look);
      const slow = (shadowTick++ & 1) === 0;
      if (slow && lights.street.intensity > 0) lights.street.shadow.needsUpdate = true; // three clears it after drawing
      if (slow && lights.neonSpot.intensity > 0) lights.neonSpot.shadow.needsUpdate = true;
      if (lights.train.intensity > 0) lights.train.shadow.needsUpdate = true;
      trainGlow.z = train$.z;
      lightsOnGlass.forEach((l, k) => {
        const at = paneUv(camera.position, l.pos);
        glass.uniforms.uSrc.value[k].set(at?.x ?? -9, at?.y ?? -9, at ? l.level() : 0, l.spread ?? 0.0035);
        glass.uniforms.uSrcCol.value[k].copy(l.color);
      });
      if (composer) composer.render(dt);
      else renderer.render(scene, camera);
    },
    setSize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      composer?.setSize(w, h);
    },
    setMonitorPower(on, { instant = false } = {}) {
      const glow = on ? 1.4 : 0; // screen emissive
      const spill = on ? 0.45 : 0; // light the screen throws on the desk
      if (instant) {
        screenMat.emissiveIntensity = glow;
        lights.monitor.intensity = spill;
        return;
      }
      gsap.timeline()
        .to(screenMat, { emissiveIntensity: glow * 0.7, duration: 0.08 })
        .to(lights.monitor, { intensity: spill * 0.7, duration: 0.08 }, '<')
        .to(screenMat, { emissiveIntensity: glow * 0.15, duration: 0.06 })
        .to(lights.monitor, { intensity: spill * 0.15, duration: 0.06 }, '<')
        .to(screenMat, { emissiveIntensity: glow, duration: 0.5, ease: 'power2.out' })
        .to(lights.monitor, { intensity: spill, duration: 0.5, ease: 'power2.out' }, '<');
    },
    setModemActive(on) { modemActive = on; },
    setTvStatic(on) { tv.setStatic(on); }, // the station died in the blackout: snow from then on
    setMains(on) { mains = on; for (const g of mainsGlows) setGlow(g, on); },
    setPC(on) { pcOn = on; },
    diskActivity(seconds) { diskBusy = Math.max(diskBusy, seconds); }, // the red LED chatters while the drive works
    // The tower's power button goes in and springs back.
    pressPower() {
      const b = node('Tower_Power_Btn');
      const z = b.position.z;
      return gsap.timeline()
        .to(b.position, { z: z - 0.008, duration: 0.07, delay: 0.04, ease: 'power2.in' }) // pushed in, on the sound's click
        .to(b.position, { z, duration: 0.14, ease: 'back.out(3)', delay: 0.24 }) // held, then it springs back on the release click
        .then(() => {});
    },
    // The side screens die with a blink and come back with a flicker.
    setScreensPower(on) {
      return on
        ? gsap.timeline().to(screens, { level: 0.6, duration: 0.05 }).to(screens, { level: 0.1, duration: 0.08 }).to(screens, { level: 1, duration: 0.6, ease: 'power2.out' }).then(() => {})
        : gsap.timeline().to(screens, { level: 1.3, duration: 0.04 }).to(screens, { level: 0, duration: 0.3, ease: 'power3.in' }).then(() => {});
    },
    setLamp(on) { if (on !== lampOn) room.toggleLamp(); },
    // A brownout before the power goes: every light in the room sags and stutters together (the grid is failing),
    // then recovers to where it was. Returns when it's over.
    brownout(duration = 2.2, onLevel) {
      const items = [
        [lights.lamp, 'intensity'], [bulbMat, 'emissiveIntensity'], [lights.dome, 'intensity'], [dome.material, 'emissiveIntensity'],
        [lights.monitor, 'intensity'], [screenMat, 'emissiveIntensity'], [screens, 'level'],
      ].map(([o, k]) => ({ o, k, base: o[k] }));
      const set = (f) => { items.forEach((i) => { i.o[i.k] = i.base * f; }); onLevel?.(f); };
      const steps = [];
      for (let t = 0; t < duration; ) { // irregular: dips get deeper and closer together toward the end
        const p = t / duration, dt = 0.04 + Math.random() * 0.16 * (1 - p);
        steps.push([t, Math.random() < 0.35 + 0.4 * p ? 0.05 + Math.random() * 0.35 : 0.7 + Math.random() * 0.3]);
        t += dt;
      }
      return new Promise((done) => {
        steps.forEach(([at, f]) => setTimeout(() => set(f), at * 1000));
        setTimeout(() => { set(1); done(); }, duration * 1000);
      });
    },
    // The dome dies with the power (a quick blink) and comes back slow, a cheap bulb warming up.
    setDome(on) {
      gsap.to(lights.dome, on ? { intensity: DOME, duration: 1.6, ease: 'power2.in' } : { intensity: 0, duration: 0.15 });
      gsap.to(dome.material, on ? { emissiveIntensity: DOME_GLOW, duration: 1.6, ease: 'power2.in' } : { emissiveIntensity: 0, duration: 0.15 });
    },
    setAnswerBlink(on) { answerBlink = on; },
    setAnswerRinging(on) { answerRinging = on; },
    setPaged(on) { pagerLcd.setPaged(on); },
    // A pass is speed-driven (render) so the blackout can bleed the speed off mid-crossing. The pass-by recording fades
    // in for 5.7 s before its peak, so the train starts SOUND_LEAD s of travel beyond TRAIN_FAR and reaches the window
    // (z = 0) right on the peak.
    passTrain({ dark = false, audio: a = trainAudio, restart = false } = {}) {
      if (restart && room.trainState === 'passing') { train$.done?.(); room.trainState = 'idle'; } // drop a silent pass for a new one
      if (room.trainState !== 'idle') return train$.promise;
      if (!dark) train$.snd = a?.sfx('train_pass', { bus: 'ambience', gain: 0.7 * trainVol, pan: 0.9 });
      trainLights(!dark);
      Object.assign(train$, { z: TRAIN_FAR + CRUISE * SOUND_LEAD, v: CRUISE });
      room.trainState = 'passing';
      const atWindow = SOUND_LEAD + TRAIN_FAR / CRUISE;
      rattleBlinds(atWindow - 1.4, dark ? 0 : Math.min(1, trainVol * 2));
      if (!dark) gsap.timeline()
        .fromTo(decoKick, { v: 0 }, { v: Math.min(1, trainVol * 2), duration: 0.4, ease: 'power2.out' }, atWindow - 1.4)
        .to(decoKick, { v: 0, duration: 5, ease: 'power2.out' }, atWindow - 1)
        .to(node('Soda_Roke').position, { x: '+=0.0012', duration: 0.045, yoyo: true, repeat: 19, ease: 'none' }, atWindow - 1.4) // the can on its side buzzes on the desk
        .to(node('Soda_Lepsi').position, { z: '+=0.0008', duration: 0.05, yoyo: true, repeat: 17, ease: 'none' }, atWindow - 1.4); // the full one shivers
      if (!dark) a?.sfx('can_rattle', { gain: 0.35 * trainVol, pan: -0.35, delay: atWindow - 1.4 });
      if (!dark) a?.sfx('blinds_rattle', { bus: 'ambience', gain: 0.9 * trainVol, pan: 0.6, delay: atWindow - 1.4 }); // the slats knock against each other
      return (train$.promise = new Promise((r) => (train$.done = r)));
    },
    // The power dies under the train: lights flicker out, brakes squeal, it coasts to rest (exponential decay), the cars
    // roll and settle. If nothing is crossing, one is already in view when it happens.
    stopTrain({ tau = 2, audio: a = trainAudio } = {}) {
      if (room.trainState === 'stopping' || room.trainState === 'stopped') return train$.stopping;
      if (room.trainState === 'idle') { Object.assign(train$, { z: trainStopDistance(CRUISE, tau), v: CRUISE }); trainLights(true); }
      room.trainState = 'stopping';
      const z0 = train$.z, v0 = train$.v, dur = trainStopTime(tau, 0.05, v0);
      trainLights(false, true);
      // a story beat, not ambience: full on the sfx bus (the blackout ducks ambience), muffled by the glass and the distance
      // the squeal swells in, holds while it coasts, and fades out as it comes to rest
      const brake = a?.sfx('train_brake', { gain: 0, lowpass: 5000, pan: trainPan(train$.z) });
      const rest = 3 * tau;
      if (brake) {
        const g = brake.gainNode.gain, t0 = brake.context.currentTime;
        g.setValueAtTime(0, t0);
        g.linearRampToValueAtTime(0.9, t0 + 0.5);
        g.setValueAtTime(0.9, t0 + rest - 1.5);
        g.linearRampToValueAtTime(0, t0 + rest);
        brake.stop(t0 + rest + 0.05);
      }
      const c = train$.snd?.context;
      train$.snd?.gainNode.gain.setTargetAtTime(0, c.currentTime, 0.6); // the motor dies; only the brakes
      const s = { t: 0 };
      return train$.stopping = gsap.to(s, { t: dur, duration: dur, ease: 'none', onUpdate: () => { train$.z = trainStopPos(z0, v0, tau, s.t); } })
        .then(() => { train$.v = 0; room.trainState = 'stopped'; });
    },
    resumeTrain({ audio: a = trainAudio } = {}) {
      if (room.trainState !== 'stopped') return Promise.resolve();
      room.trainState = 'resuming';
      trainLights(true, true);
      train$.snd = a?.sfx('train_pass', { bus: 'ambience', gain: 0.5 * trainVol, pan: trainPan(train$.z), rate: 0.85 });
      gsap.fromTo(train$, { v: 0 }, { v: CRUISE, duration: 6, ease: 'power2.in' });
      return (train$.promise = new Promise((r) => (train$.done = r)));
    },
    // A slight thunderstorm far off: the cloud flickers, the room catches it, the thunder rolls in later.
    strikeLightning(l = nextLightning()) {
      const tl = gsap.timeline();
      for (const f of l.flickers) tl.to(storm, { flash: f.peak, duration: 0.03 }, f.at).to(storm, { flash: f.peak * 0.25, duration: 0.12 }, f.at + 0.04);
      tl.to(storm, { flash: 0, duration: 0.6, ease: 'power2.out' }); // the cloud's afterglow
      setTimeout(() => storm.audio?.sfx(`thunder_far_${l.variant}`, { bus: 'ambience', gain: l.gain, pan: Math.random() * 1.2 - 0.6 }), l.thunderDelay * 1000);
      return tl;
    },
    startStorm(audio) {
      storm.audio = audio;
      if (storm.timer) return;
      const next = () => { const l = nextLightning(); storm.timer = setTimeout(() => { room.strikeLightning(l); next(); }, l.wait * 1000); };
      storm.timer = setTimeout(() => { room.strikeLightning(); next(); }, 12000);
    },
    startTrainLoop(audio) {
      trainAudio = audio;
      trainVol = 0.18; // train_pass.mp3 is mastered hot (-6 LUFS vs rain -27.5): in play a pass rumbles just over the rain
      if (trainTimer) return;
      const loop = () => { room.passTrain(); trainTimer = setTimeout(loop, 60000 + Math.random() * 30000); };
      trainTimer = setTimeout(loop, 75000 + Math.random() * 25000); // not right after the cold open's train
    },
    stopTrainLoop() { clearTimeout(trainTimer); trainTimer = null; },
    // The city goes out one district at a time, far to near (outward: near to far); onStage(stage) fires as each one drops (the cutscene plays
    // its breaker there). Each stage stutters, then dies. cityRelight runs the other way, near to far.
    // order: stage ids, to run the wave in a story order instead.
    async cityBlackout({ gap = 1.4, onStage, outward = false, order } = {}) {
      const stages = order ? order.map((id) => BLACKOUT_STAGES.find((s) => s.id === id)) : outward ? [...BLACKOUT_STAGES].reverse() : BLACKOUT_STAGES;
      for (const st of stages) {
        onStage?.(st);
        stage[st.id] = 0; // dead on the breaker's click; then one dying flicker
        await gsap.timeline().to(stage, { [st.id]: 0.12, duration: 0.04, delay: 0.12 }).to(stage, { [st.id]: 0, duration: 0.06 });
        stage[st.id] = stageLevel(0, 0, 1);
        await new Promise((r) => setTimeout(r, gap * 1000));
      }
    },
    async cityRelight({ gap = 0.5, onStage, skip = [] } = {}) {
      for (const st of [...BLACKOUT_STAGES].reverse().filter((s) => !skip.includes(s.id))) {
        onStage?.(st);
        await gsap.timeline()
          .to(stage, { [st.id]: 0.6, duration: 0.06, yoyo: true, repeat: 2 })
          .to(stage, { [st.id]: 1, duration: 0.5, ease: 'power2.out' });
        stage[st.id] = stageLevel(1, 1, 1);
        await new Promise((r) => setTimeout(r, gap * 1000));
      }
    },
    cityDark(ids) { for (const id of ids) stage[id] = 0; }, // instant, for a resume after the blackout
    trainState: 'idle',
    city,
    cityParts: life.parts,
    cityLife: life,
    dispose() {
      clearTimeout(trainTimer);
      clearTimeout(storm.timer);
      renderer.dispose();
    },
  };
  return room;
}

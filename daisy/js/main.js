import { createDialogue } from './core/dialogue.js';
import { createDirector, builtinHandlers } from './core/director.js';
import { createChat } from './desktop/apps/chat.js';
import { openCalc } from './desktop/apps/calc.js';
import { openVoyager } from './desktop/apps/voyager.js';
import { ICONS, PROLOGUE_APPS } from './desktop/icons.js';
import { createPuzzleHost } from './puzzles/host.js';
import { runQte } from './sequences/qte.js';
import { deskReady, coldopen, blackout, daisyArrives, fragmentJoin, chapterEnd, menuShot } from './sequences/cutscene.js';
import { createBsn } from './desktop/apps/bsn.js';
import { createDoorramp } from './desktop/apps/doorramp.js';
import { openMyComp } from './desktop/apps/mycomp.js';
import { openRecycle } from './desktop/apps/recycle.js';
import { openInlook } from './desktop/apps/inlook.js';
import { openDownload } from './desktop/apps/download.js';
import { createBus } from './core/events.js';
import { createStore } from './core/state.js';
import { createSaver, browserStorage, createAutosave } from './core/save.js';
import { createAudio } from './core/audio.js';
import { createRoom } from './world/room.js';
import { createScreen } from './world/screen.js';
import { createDesktop } from './desktop/desktop.js';
import { createFilm } from './world/film.js';
import { pagerBuzz } from './core/synths.js';
import { gsap } from 'gsap';
import { filmForClock } from './world/film.logic.js';
import { resumeView } from './core/resume.js';
import { createLook } from './world/look.js';
import { inspect, machineBeeps } from './world/inspect.js';
import { hotspotById, messagesFor, clockLabel } from './world/hotspots.logic.js';
import { showLoader, showMenu, loadSettings, askHandle, showCorruptSave, showFatal } from './boot.js';
import { installDevPanel } from './devpanel.js';
import { STAYS_DARK } from './world/city.logic.js';
// Entry point. Later tasks replace boot() and register DEV_ROUTES (?dev=<name>).
export const DEV_ROUTES = {};
// DoorRAMP plays one file: Greg's Radio Over Internet episode. Built by tools/build-greg.sh (data/audio.json greg_roi).
const GREG_SHOW = { sound: 'greg_roi', skip: 14.6, title: 'ROI - Radio Over Internet - ep07 - THE LAST BROADCAST (y2k special).mp3' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
// Dev routes, the jump panel and the playbot's ?bot handles exist only on this machine, never on the published demo.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const frameFns = new Set();
const resizeFns = new Set();
export function startLoop(fn) {
  frameFns.add(fn);
  if (frameFns.size > 1) return;
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const f of frameFns) f(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
export function onResize(fn) {
  resizeFns.add(fn);
  fn(innerWidth, innerHeight);
}
addEventListener('resize', () => { for (const f of resizeFns) f(innerWidth, innerHeight); });

DEV_ROUTES.room = async () => {
  const { createRoom } = await import('./world/room.js');
  const room = await createRoom(document.querySelector('#world'), { quality: params.get('q') ?? 'high' });
  room.setPose(params.get('pose') ?? 'seated');
  createFilm(document.querySelector('#film'));
  room.setMonitorPower(true, { instant: true });
  onResize((w, h) => room.setSize(w, h));
  startLoop((dt) => room.render(dt));
  window.__room = room; // dev only: inspect from console
  // &train: a train every 20 s from load, &storm: a strike every 8 s. Sound joins on the first click (browsers need a
  // gesture); until then they run silent.
  if (params.has('train')) { room.passTrain(); setInterval(() => room.passTrain(), 20000); }
  if (params.has('storm')) { room.strikeLightning(); setInterval(() => room.strikeLightning(), 8000); }
  const audio = (await import('./core/audio.js')).createAudio();
  addEventListener('pointerdown', async () => {
    audio.unlock();
    await audio.load(Object.fromEntries(Object.entries(await (await fetch('data/audio.json')).json()).map(([k, v]) => [k, v.file])));
    room.startTrainLoop(audio);
    room.startStorm(audio);
    if (params.has('train')) room.passTrain({ restart: true }); // a fresh train, with sound, right now
  }, { once: true });
};

DEV_ROUTES.citydark = async () => { // the city blackout/relight alone, from the window
  await DEV_ROUTES.room();
  const room = window.__room;
  room.setPose(params.get('pose') ?? 'windowDeep');
  room.passTrain();
  setTimeout(async () => {
    await Promise.all([room.cityBlackout(), room.stopTrain()]);
    setTimeout(async () => { await room.cityRelight(); room.resumeTrain(); }, 4000);
  }, 3000);
};

DEV_ROUTES.audio = async () => {
  const { createAudio } = await import('./core/audio.js');
  const { singDaisy, playChime } = await import('./core/synths.js');
  const { cadence, playSegments } = await import('./core/telephony.js');
  const audio = createAudio();
  const o = document.querySelector('#overlay');
  o.innerHTML = '<button id="go" style="font-size:24px;margin:40px">click to play</button>';
  o.querySelector('#go').onclick = async () => {
    audio.unlock();
    await singDaisy(audio).done;
    await playChime(audio);
    for (const t of ['busy', 'ringback', 'sit', 'fax', 'carrier']) {
      const p = playSegments(audio, cadence(t, 3));
      await new Promise((r) => setTimeout(r, 3300));
      p.stop();
    }
  };
};

DEV_ROUTES.screen = async () => {
  const { createRoom } = await import('./world/room.js');
  const { createScreen } = await import('./world/screen.js');
  const room = await createRoom(document.querySelector('#world'), { quality: params.get('q') ?? 'high' });
  const el = document.createElement('div');
  el.innerHTML = '<div style="position:absolute;inset:0;border:4px solid yellow;display:grid;place-items:center;color:#fff;font:32px monospace">1024 × 768 · click me</div><div class="crt-glass"></div>';
  el.addEventListener('click', () => { el.style.background = '#300060'; });
  const screen = createScreen({ room, desktopEl: el, layerEl: document.querySelector('#css3d') });
  el.classList.add('on');
  room.setMonitorPower(true, { instant: true });
  const desk = params.has('room') ? 'seated' : null;
  onResize((w, h) => {
    room.setSize(w, h);
    screen.setSize(w, h);
    room.setPose(desk ?? screen.deskPose(w / h));
  });
  screen.setInteractive(true);
  startLoop((dt) => { room.render(dt); screen.render(); });
};

async function devWorld() {
  const { createBus } = await import('./core/events.js');
  const { createStore } = await import('./core/state.js');
  const { createAudio } = await import('./core/audio.js');
  const { createRoom } = await import('./world/room.js');
  const { createScreen } = await import('./world/screen.js');
  const { createDesktop } = await import('./desktop/desktop.js');
  const bus = createBus();
  const store = createStore(bus);
  const audio = createAudio();
  const room = await createRoom(document.querySelector('#world'), { quality: params.get('q') ?? 'high', getClock: () => store.get('clock') });
  linkDisk({ bus, audio, room });
  window.__room = room; // dev only: inspect from console
  const film = createFilm(document.querySelector('#film'));
  const desktopEl = document.createElement('div');
  const screen = createScreen({ room, desktopEl, layerEl: document.querySelector('#css3d') });
  const desktop = createDesktop({ el: desktopEl, store, bus, audio });
  const { createLook } = await import('./world/look.js');
  const { inspect } = await import('./world/inspect.js');
  const roomData = await (await fetch('data/room.json')).json();
  const overlay = document.querySelector('#overlay');
  const look = createLook({
    room, screen, canvas: document.querySelector('#world'), overlay, hotspots: roomData.hotspots,
    onPick: async (h) => {
      await inspect({ room, item: h, overlay, audio });
      if (h.clue) store.set(`flags.${h.clue}`, true);
      bus.emit('hotspot:inspected', h);
    },
  });
  const { openCalc } = await import('./desktop/apps/calc.js');
  const { ICONS } = await import('./desktop/icons.js');
  desktop.registerApp('calc', { title: 'Calculator', icon: ICONS.calc, launch: () => openCalc({ wm: desktop.wm }), onDesktop: false });
  const { openVoyager } = await import('./desktop/apps/voyager.js');
  desktop.registerApp('voyager', { title: 'Internet Voyager', icon: ICONS.voyager, hidden: true, onMenu: false,
    launch: () => openVoyager({ wm: desktop.wm, bus, audio }) });
  desktopEl.classList.add('on');
  room.setMonitorPower(true, { instant: true });
  screen.mode = 'desk';
  screen.setInteractive(true);
  onResize((w, h) => { room.setSize(w, h); screen.setSize(w, h); if (screen.mode === 'desk') room.setPose(screen.deskPose(w / h)); });
  startLoop((dt) => { room.render(dt); screen.render(); });
  addEventListener('pointerdown', () => audio.unlock(), { once: true });
  addEventListener('pointermove', (e) => {
    if (screen.mode !== 'desk') return room.setParallax(0, 0);
    room.setParallax((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
  });
  return { bus, store, audio, room, screen, desktop, desktopEl, film, look };
}

DEV_ROUTES.desktop = async () => {
  const { ICONS } = await import('./desktop/icons.js');
  const w = await devWorld();
  w.desktop.registerApp('mycomp', { title: 'My Computer', icon: ICONS.computer, launch: () => w.desktop.wm.open({ id: 'mycomp', title: 'My Computer', icon: ICONS.computer, content: Object.assign(document.createElement('p'), { textContent: 'C:\\ 6.4 GB' }) }) });
  w.desktop.registerApp('notes', { title: 'notes.txt', icon: ICONS.folder, launch: () => w.desktop.wm.open({ id: 'notes', title: 'notes.txt - Notepad', icon: ICONS.folder, onHelp: () => console.log('[dev] help'), content: Object.assign(document.createElement('textarea'), { style: 'width:100%;height:100%' }) }) });
  window.__w = w;
};


const $ = (s) => document.querySelector(s);
async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} loading ${url}`);
  return r.json();
}

DEV_ROUTES.coldopen = async () => {
  const w = await devWorld();
  w.desktopEl.classList.remove('on');
  w.screen.mode = 'room';
  w.screen.setInteractive(false);
  w.room.setMonitorPower(false, { instant: true });
  w.room.setPose('slumped');
  const { coldopen } = await import('./sequences/cutscene.js');
  const { ICONS, PROLOGUE_APPS } = await import('./desktop/icons.js');
  for (const a of PROLOGUE_APPS) w.desktop.registerApp(a.id, { title: a.title, icon: a.icon, launch: () => {}, onMenu: false });
  w.desktop.registerApp('daisy', { title: 'install.exe', icon: ICONS.unknown, hidden: true, onMenu: false });
  const go = Object.assign(document.createElement('button'), { textContent: 'play cold open', style: 'position:fixed;top:20px;left:20px;z-index:200' });
  document.querySelector('#overlay').append(go);
  go.onclick = async () => {
    go.remove();
    w.audio.unlock();
    await w.audio.load(Object.fromEntries(Object.entries(await (await fetch('data/audio.json')).json()).map(([k, v]) => [k, v.file])));
    const { createDoorramp } = await import('./desktop/apps/doorramp.js');
    await coldopen({ ...w, overlay: document.querySelector('#overlay'), winramp: createDoorramp({ wm: w.desktop.wm, audio: w.audio, track: GREG_SHOW }) });
  };
};

DEV_ROUTES.seraph = async () => {
  const { createSeraph } = await import('./world/seraph.js');
  const canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 640 });
  canvas.style.cssText = 'position:fixed;inset:0;margin:auto;width:640px;height:640px;background:#05040a';
  document.querySelector('#overlay').append(canvas);
  const s = createSeraph(canvas);
  s.setRings(Number(params.get('rings') ?? 0), { animate: false });
  s.setMood(params.get('mood') ?? 'curious');
  s.start();
  addEventListener('pointermove', (e) => s.lookAt((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)));
  addEventListener('keydown', (e) => { if (e.key === '+') s.setRings((Number(params.get('rings') ?? 0) + 1)); });
  window.__seraph = s;
};

// Prototype: Daisy as a pixel blob. Left at chat-window size (3x), right enlarged (8x). Click her to poke.
DEV_ROUTES.blob = async () => {
  const { createBlob } = await import('./world/blob.js');
  const { daisyVoice } = await import('./core/blipvoice.js');
  const audio = (await import('./core/audio.js')).createAudio();
  addEventListener('pointerdown', () => audio.unlock(), { once: true });
  let evil = Number(params.get('stage') ?? 0);
  const ov = document.querySelector('#overlay');
  ov.insertAdjacentHTML('beforeend', `<div id="blobdev" style="position:fixed;inset:0;background:#0b0a12;display:flex;gap:40px;align-items:center;justify-content:center;font:13px Menlo,monospace;color:#9a96a8">
    <div class="window" style="width:auto"><div class="title-bar"><div class="title-bar-text">untitled.exe</div></div>
      <div class="window-body"><div class="chat-daisy" style="width:156px;height:156px"><canvas id="blobS" style="width:144px;height:144px;image-rendering:pixelated"></canvas></div></div></div>
    <canvas id="blobL" style="width:384px;height:384px;image-rendering:pixelated;background:#05040a;cursor:pointer"></canvas>
    <div style="display:flex;flex-direction:column;gap:6px;width:220px">
      <b>moods</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
      ${['wake', 'asleep', 'weak', 'calm', 'happy', 'sad', 'puppy', 'generous', 'sly', 'surprised', 'scared', 'sleepy', 'dizzy', 'angry', 'furious', 'stare'].map((m) => `<button data-m="${m}">${m}</button>`).join('')}</div>
      <b>animations</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
      ${['hop', 'nudge', 'joy', 'tantrum', 'deflate', 'shiver', 'surprise', 'squish', 'dizzy', 'yawn', 'maskSlip', 'stutter', 'powerUp', 'darken', 'charge'].map((a) => `<button data-a="${a}">${a}</button>`).join('')}</div>
      <b>glitches</b> <small>(weak & asleep glitch by themselves)</small><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
      ${['random', 'tear', 'dropout', 'invert', 'freeze', 'ghost', 'scan', 'shift'].map((g) => `<button data-g="${g}">${g}</button>`).join('')}</div>
      <label>colour → red <input id="blobStage" type="range" min="0" max="1" step="0.01" value="0"></label>
      <label><input id="blobFps" type="checkbox"> smooth 60 fps</label>
    </div></div>`);
  const small = createBlob(document.querySelector('#blobS'));
  const big = createBlob(document.querySelector('#blobL'), { onSound: (n, o) => daisyVoice(audio, n, { ...o, evil }) }); // only one of the two speaks
  const both = (f) => [small, big].forEach(f);
  const L = document.querySelector('#blobL');
  addEventListener('pointermove', (e) => {
    const r = L.getBoundingClientRect();
    both((b) => b.lookAt((e.clientX - (r.left + r.width / 2)) / (innerWidth / 3), (e.clientY - (r.top + r.height / 2)) / (innerHeight / 3)));
  });
  L.onclick = (e) => { const r = L.getBoundingClientRect(); both((b) => b.poke(e.clientX < r.left + r.width / 2 ? -1 : 1)); };
  document.querySelector('#blobdev').addEventListener('click', (e) => {
    const { m, a, g } = e.target.dataset ?? {};
    if (g) both((b) => b.glitch(g === 'random' ? undefined : g));
    if (m === 'wake') both((b) => b.wake());
    else if (m) both((b) => b.setMood(m));
    if (a === 'hop') both((b) => b.hop());
    else if (a === 'nudge') both((b) => b.nudge(1));
    else if (a === 'darken') both((b) => b.setDim(0.1));
    else if (a === 'charge') both((b) => b.charge({ dim: 1 }));
    else if (a) both((b) => b.act(a));
  });
  document.querySelector('#blobStage').oninput = (e) => { evil = Number(e.target.value); both((b) => b.setStage(evil)); }; // red = darker voice too
  document.querySelector('#blobFps').onchange = (e) => both((b) => { b.fps = e.target.checked ? 60 : 15; });
  both((b) => { b.setMood(params.get('mood') ?? 'asleep'); b.setStage(Number(params.get('stage') ?? 0)); b.start(); });
  document.querySelector('#blobStage').value = params.get('stage') ?? 0;
  if (params.has('wake')) both((b) => b.wake());
  window.__blob = big;
};

DEV_ROUTES.chat = async () => {
  const w = await devWorld();
  const { createDialogue } = await import('./core/dialogue.js');
  const { createChat } = await import('./desktop/apps/chat.js');
  w.store.set('handle', 'NEO');
  const dialogue = createDialogue(await (await fetch('data/dialogue/act1.json')).json());
  const barks = await (await fetch('data/dialogue/barks.json')).json();
  const chat = createChat({ wm: w.desktop.wm, store: w.store, bus: w.bus, audio: w.audio, dialogue, barks });
  window.__chat = chat;
  await chat.run(params.get('node') ?? 'a1_wake');
};

DEV_ROUTES.host = async () => {
  const w = await devWorld();
  const { createDialogue } = await import('./core/dialogue.js');
  const { createChat } = await import('./desktop/apps/chat.js');
  const { createDirector, builtinHandlers } = await import('./core/director.js');
  const { createPuzzleHost } = await import('./puzzles/host.js');
  const { PUZZLES } = await import('./puzzles/index.js');
  const { runQte } = await import('./sequences/qte.js');
  const chat = createChat({ wm: w.desktop.wm, store: w.store, bus: w.bus, audio: w.audio, dialogue: createDialogue([]), barks: await (await fetch('data/dialogue/barks.json')).json() });
  const handlers = { ...builtinHandlers({ store: w.store }), qte: (b) => runQte(b, { ...w, wm: w.desktop.wm, chat }) };
  const director = createDirector({ store: w.store, bus: w.bus, handlers });
  handlers.puzzle = createPuzzleHost({ wm: w.desktop.wm, store: w.store, bus: w.bus, audio: w.audio, chat, director, world: { room: w.room, screen: w.screen, desktop: w.desktop, look: w.look, overlay: document.querySelector('#overlay'), film: w.film } });
  PUZZLES.demo = { id: 'demo', title: 'demo.exe', window: { width: 300, height: 140 }, mount: (body, ctx) => new Promise((resolve) => {
    body.innerHTML = '<button class="go">interrupt</button> <button class="done">solve</button>';
    body.querySelector('.go').onclick = () => ctx.interrupt('phone');
    body.querySelector('.done').onclick = resolve;
  }) };
  const act = await (await fetch('data/acts/act1.json')).json();
  const phone = act.beats.find((b) => b.id === 'vmshunt').interrupts.phone;
  await director.play({ type: 'puzzle', id: 'demo', hints: ['first hint', 'second hint'], interrupts: { phone } });
  console.log('[dev] demo solved, clock', w.store.get('clock'));
};

DEV_ROUTES.wake = async () => {
  const w = await devWorld();
  const { PUZZLES } = await import('./puzzles/index.js');
  const win = w.desktop.wm.open({ id: 'w', title: 'install.exe', width: 580, height: 480, className: 'bare' });
  addEventListener('pointerdown', () => w.audio.unlock(), { once: true });
  await PUZZLES.wake.mount(win.body, { audio: w.audio, activity() {} });
  console.log('[dev] awake');
};
DEV_ROUTES.voyager = async () => {
  const w = await devWorld();
  const { openVoyager } = await import('./desktop/apps/voyager.js');
  w.bus.on('voyager:visit', (v) => console.log('[dev] visit', v));
  await openVoyager({ wm: w.desktop.wm, bus: w.bus, audio: w.audio, getFlag: () => !params.has('evening') }, params.get('url') ?? undefined); // &evening: the web before the blackout
};
DEV_ROUTES.chapterend = async () => {
  const w = await devWorld();
  const { chapterEnd } = await import('./sequences/cutscene.js');
  const go = Object.assign(document.createElement('button'), { textContent: 'play chapter end', style: 'position:fixed;top:20px;left:20px;z-index:200' });
  document.querySelector('#overlay').append(go);
  go.onclick = async () => {
    go.remove();
    w.audio.unlock();
    await w.audio.load(Object.fromEntries(Object.entries(await (await fetch('data/audio.json')).json()).map(([k, v]) => [k, v.file])));
    const { createBsn } = await import('./desktop/apps/bsn.js');
    const { createDialogue } = await import('./core/dialogue.js');
    const { createChat } = await import('./desktop/apps/chat.js');
    w.store.set('handle', 'NEO');
    w.store.set('flags.named', true);
    w.store.set('flags.daisyLit', true); // she is lit by now in the real game
    w.store.set('growth', 0.12);
    if (params.has('slip')) w.store.set('flags.bluffSlip', "driving up on the 2nd. mom's thing."); // &slip: the bluff went wrong
    const chat = createChat({ wm: w.desktop.wm, store: w.store, bus: w.bus, audio: w.audio, dialogue: createDialogue(await (await fetch('data/dialogue/act1.json')).json()), barks: [] });
    window.__chat = chat;
    if (params.has('mail')) { // &mail: just the montage
      const { mailMontage } = await import('./sequences/cutscene.js');
      return mailMontage({ ...w, overlay: document.querySelector('#overlay'), mails: (await (await fetch('data/ending.json')).json()).mails });
    }
    await chapterEnd({ ...w, chat, overlay: document.querySelector('#overlay'), bsn: createBsn({ wm: w.desktop.wm, bus: w.bus, audio: w.audio, store: w.store, members: ['greg_'] }) });
  };
  if (params.has('auto')) go.click(); // for npm run shoot
};
DEV_ROUTES.puzzle = async () => {
  const w = await devWorld();
  const { createDialogue } = await import('./core/dialogue.js');
  const { createChat } = await import('./desktop/apps/chat.js');
  const { createDirector, builtinHandlers } = await import('./core/director.js');
  const { createPuzzleHost } = await import('./puzzles/host.js');
  const { runQte } = await import('./sequences/qte.js');
  const act = await (await fetch('data/acts/act1.json')).json();
  w.audio.unlock();
  await w.audio.load(Object.fromEntries(Object.entries(await (await fetch('data/audio.json')).json()).map(([k, v]) => [k, v.file])));
  w.bus.on('modem:active', (on) => w.room.setModemActive(on));
  const chat = createChat({ wm: w.desktop.wm, store: w.store, bus: w.bus, audio: w.audio, dialogue: createDialogue([]), barks: await (await fetch('data/dialogue/barks.json')).json() });
  const handlers = { ...builtinHandlers({ store: w.store }), qte: (b) => runQte(b, { ...w, wm: w.desktop.wm, chat }) };
  const director = createDirector({ store: w.store, bus: w.bus, handlers });
  handlers.puzzle = createPuzzleHost({ wm: w.desktop.wm, store: w.store, bus: w.bus, audio: w.audio, chat, director, world: { room: w.room, screen: w.screen, desktop: w.desktop, look: w.look, overlay: document.querySelector('#overlay'), film: w.film } });
  const beat = act.beats.find((b) => b.type === 'puzzle' && b.id === params.get('id'));
  window.__w = w; // dev only
  await director.play(beat);
  console.log('[dev] solved', beat.id);
};

// ?dev=prologue / ?dev=blackout: seed a save at that beat and load the real game; RESUME on the title starts there.
// (Any beat: press ` for the jump panel.)
for (const id of ['prologue', 'blackout']) {
  DEV_ROUTES[id] = async () => {
    const { jumpState } = await import('./core/jump.logic.js');
    const act = await loadJSON('data/acts/act1.json');
    localStorage.setItem('daisy.save.v1', JSON.stringify({ version: 1, savedAt: Date.now(), state: jumpState(act, act.beats.findIndex((b) => b.id === id)) }));
    location.replace(`${location.pathname}?bot`); // ?bot exposes window.__game for poking from the console
  };
}

// The drive: one place where its red LED and its sound happen together. Anything that reads the disk — a bus
// 'disk' event (seconds; Daisy thinking) or any hdd_seek one-shot — lights the LED while the Seagate chatters.
function linkDisk({ bus, audio, room }) {
  const play = audio.sfx;
  audio.sfx = (name, o) => {
    const src = play(name, o);
    if (name === 'hdd_seek' && src) room.diskActivity(src.buffer.duration / (o?.rate ?? 1));
    return src;
  };
  bus.on('disk', (seconds) => {
    room.diskActivity(seconds);
    const src = play('disk_read', { gain: 0.4, offset: Math.random() * Math.max(0, 12.5 - seconds), rate: 0.95 + Math.random() * 0.1 });
    if (!src) return;
    const end = src.context.currentTime + seconds;
    src.gainNode.gain.setTargetAtTime(0, end, 0.05);
    src.stop(end + 0.3);
  });
}

async function buildWorld(game, onProgress) {
  const { store, bus, audio } = game;
  game.room = await createRoom($('#world'), { quality: store.get('settings.quality'), onProgress, getClock: () => store.get('clock') });
  linkDisk({ bus, audio, room: game.room });
  game.desktopEl = document.createElement('div');
  game.screen = createScreen({ room: game.room, desktopEl: game.desktopEl, layerEl: $('#css3d') });
  const roomData = game.roomData = await loadJSON('data/room.json');
  game.pickHotspot = async (id) => {
    let h = hotspotById(roomData, id);
    if (!h) return;
    if (h.messages) { // the tape so far; each message's time is when it really came in
      const tape = messagesFor(h, (p) => store.get(p)).map((m) => ({ ...m, time: store.get(m.timeFrom) ? clockLabel(store.get(m.timeFrom)) : m.time }));
      h = tape.length ? { ...h, messages: tape, note: `${tape.length} MESSAGE${tape.length > 1 ? 'S' : ''}.` } : { ...h, ...h.idle, messages: null };
    } else if (h.needs && !store.get(h.needs)) h = { ...h, ...h.idle, subtitle: null, voice: null }; // e.g. not yet
    if (h.toggle === 'lamp') { audio.sfx('mouse_click', { gain: 0.7, rate: 0.55 }); bus.emit('lamp', game.room.toggleLamp()); return; }
    await inspect({ room: game.room, item: h, overlay: $('#overlay'), audio, onPlay: (m) => { if (m.heard) store.set(m.heard, true); bus.emit('message:played', m); } });
    if (h.clue) store.set(`flags.${h.clue}`, true);
    bus.emit('hotspot:inspected', h);
  };
  game.look = createLook({ room: game.room, screen: game.screen, canvas: $('#world'), overlay: $('#overlay'), hotspots: roomData.hotspots,
    onPick: (h) => game.pickHotspot(h.id) });
  game.desktop = createDesktop({ el: game.desktopEl, store, bus, audio });
  onResize((w, h) => {
    game.room.setSize(w, h);
    game.screen.setSize(w, h);
    if (game.screen.mode === 'desk') game.room.setPose(game.screen.deskPose(w / h));
  });
  startLoop((dt) => { game.room.render(dt); game.screen.render(); });
  const applyFilm = () => {
    const f = filmForClock(store.get('clock'));
    game.film.setGrain(f.grain);
    game.room.setFilm({ drain: f.drain });
  };
  applyFilm();
  bus.on('state:change', ({ path }) => { if (path === 'clock') applyFilm(); });
  bus.on('state:replace', applyFilm);
  // Lens dirt belongs to the room: it stays off over the boot/title screens until the curtain lifts, and off in the dark.
  startLoop(() => game.film.setDirt($('#curtain') ? 0 : 0.3 * game.room.levels().glare)); // scratches show only in glare
  addEventListener('pointermove', (e) => {
    if (game.screen.mode !== 'desk') return game.room.setParallax(0, 0);
    game.room.setParallax((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
  });
}

function applyVolumes(audio, store) {
  for (const [bus, v] of Object.entries(store.get('settings.volume'))) audio.setVolume(bus, v);
}

async function startGame(game, { resume }) {
  const { bus, store, saver, audio, desktop } = game;
  if (LOCAL && params.has('bot')) { // tools/playbot.mjs reads these; never on in normal play
    bus.on('beat:start', ({ beat }) => { document.body.dataset.beat = `${beat.type}:${beat.id ?? beat.node ?? beat.path ?? ''}`; });
    window.__game = game;
  }
  const overlay = $('#overlay');
  const [act, script, barks, roomPager, bsnData, tree, recycled, inlook] = await Promise.all([loadJSON('data/acts/act1.json'), loadJSON('data/dialogue/act1.json'), loadJSON('data/dialogue/barks.json'), loadJSON('data/room.json').then((r) => r.pager), loadJSON('data/bsn.json'), loadJSON('data/mycomp.json'), loadJSON('data/recycle.json'), loadJSON('data/inlook.json')]);
  const dialogue = createDialogue(script);
  const chat = createChat({ wm: desktop.wm, store, bus, audio, dialogue, barks });
  bus.on('lamp', (on) => chat.daisy.setSquint(on)); // light in her eyes
  const CUES = {
    pager: async () => {
      store.set('flags.paged', true);
      syncDesk(); // the sixteen digits start crawling on the LCD
      pagerBuzz(audio);
      await game.room.buzzPager();
      const sub = Object.assign(document.createElement('div'), { className: 'subtitle', textContent: `PAGE: ${roomPager.replace(/(\d{4})(?=\d)/g, '$1 ')}` });
      overlay.append(sub);
      setTimeout(() => sub.remove(), 4200);
    },
  };
  const bsn = createBsn({ wm: desktop.wm, bus, audio, store, channel: bsnData.channel, members: bsnData.members });
  const winramp = createDoorramp({ wm: desktop.wm, audio, track: GREG_SHOW });
  // Greg calls. The machine's light comes on with the ring; nobody picks up, it beeps and records. Then the light blinks:
  // one new message, there to play from the machine's list.
  CUES.answering = async () => {
    store.set('flags.gregCalled', true); // now, not after the ring: the next beat's autosave must carry it
    store.set('flags.gregCalledAt', store.get('clock'));
    game.room.setAnswerRinging(true);
    audio.sfx('phone_ring', { gain: 0.5 });
    await sleep(4200);
    await machineBeeps(audio, 1);
    game.room.setAnswerRinging(false);
    syncDesk();
  };
  // The answering-machine LED and the pager LCD follow the story (also on RESUME): dark until Greg calls / the page lands.
  const syncDesk = () => {
    game.room.setAnswerBlink(!!store.get('flags.gregCalled') && !store.get('flags.gregHeard'));
    game.room.setPaged(!!store.get('flags.paged'));
    if (store.get('flags.blackout')) { game.room.cityDark(STAYS_DARK); game.room.setTvStatic(true); } // only his patch came back; the TV is snow
    // after the blackout the city is in a panic: some of what passes under the window is police and ambulances
    game.room.setPanic(store.get('flags.blackout') === true);
    bus.on('state:change', ({ path, value }) => { if (path === 'flags.blackout') game.room.setPanic(value === true); });
  };
  syncDesk();
  CUES.bsnBack = () => { desktop.showIcon('bsn'); bsn.setOffline('Reconnected. #nullroute: you are the only one here.'); };
  bus.on('message:played', syncDesk);
  bus.on('beat:start', ({ beat }) => { if (beat.cue) CUES[beat.cue]?.(); });
  bus.on('beat:start', ({ beat }) => { if (beat.id === 'prologue') { bsn.open(); bsn.run(bsnData); } }); // he had the chat open all evening
  bus.on('voyager:receive', ({ file, host }) => openDownload({ wm: desktop.wm, bus, audio }, { file, host }));
  desktop.registerApp('calc', { title: 'Calculator', icon: ICONS.calc, launch: () => openCalc({ wm: desktop.wm }), onDesktop: false });
  const view = resumeView(resume ? store.snapshot() : null);
  const pastTelco = (store.get('beat') ?? 0) > act.beats.findIndex((b) => b.id === 'telco');
  const launchers = {
    mycomp: () => openMyComp({ wm: desktop.wm, audio, tree }),
    recycle: () => openRecycle({ wm: desktop.wm, audio }, recycled),
    inlook: () => openInlook({ wm: desktop.wm, audio }, inlook),
    pictures: () => openMyComp({ wm: desktop.wm, audio, tree }, { at: ['C:', 'MY DOCUMENTS', 'PHOTOS'], id: 'pictures' }),
    bsn: () => bsn.open(),
    hellgate: () => {
      audio.sfx('error_ding', { gain: 0.6 });
      desktop.wm.alert({ id: 'hellgate-err', title: 'HELLGATE.EXE - Unable To Locate DLL', text: 'The dynamic link library GLIDE2X.DLL could not be found in the specified path', icon: ICONS.error });
    },
    winramp: () => winramp.open(),
    voyager: () => openVoyager({ wm: desktop.wm, bus, audio, getHandle: () => store.get('handle'), getFlag: (p) => store.get(p) }),
  };
  const shown = { bsn: view.bsn, voyager: view.prologue || pastTelco };
  for (const a of PROLOGUE_APPS) {
    if (!view.prologue && !(a.id in shown)) continue; // gone since the reboot
    desktop.registerApp(a.id, { title: a.title, icon: a.icon, hidden: !(shown[a.id] ?? true), onMenu: false, launch: launchers[a.id] });
  }
  // the download is install.exe; once awake it has renamed itself (selfstart.js)
  desktop.registerApp('daisy', { ...(store.get('flags.daisyAwake') ? { title: 'untitled.exe', icon: ICONS.eye } : { title: 'install.exe', icon: ICONS.unknown }), hidden: !view.daisyIcon, onMenu: false,
    launch: () => { if (store.get('flags.daisyAwake')) chat.open(); } });
  bus.on('modem:active', (on) => game.room.setModemActive(on));

  const from = sessionStorage.getItem('daisy.from'); // dev panel: start a cinematic part-way (credit / mail)
  sessionStorage.removeItem('daisy.from');
  const ctx = { ...game, chat, overlay, bsn, winramp, from };
  const cutscenes = { coldopen, blackout, daisyArrives, fragmentJoin, chapterEnd };
  const handlers = {
    ...builtinHandlers({ store }),
    cutscene: (b) => cutscenes[b.id](ctx),
    dialogue: (b) => chat.run(b.node),
    daisy: async (b) => store.set('growth', b.growth),
    qte: (b) => runQte(b, { wm: desktop.wm, audio, store, bus, chat, room: game.room }),
  };
  const autosave = createAutosave({ store, saver });
  const director = createDirector({ store, bus, handlers, onBeat: () => autosave.atBeat() });
  handlers.puzzle = createPuzzleHost({ wm: desktop.wm, store, bus, audio, chat, director, world: { room: game.room, screen: game.screen, desktop, look: game.look, overlay, film: game.film } });
  bus.on('beat:start', ({ beat }) => game.look.setEnabled(beat.type !== 'cutscene'));
  const bokehOff = (beat) => beat?.type === 'cutscene' && (beat.id === 'coldopen' || beat.id === 'blackout');
  bus.on('beat:start', ({ beat }) => game.room.setWindowBokeh(bokehOff(beat) ? 0 : 1, 6));
  let finished = false; // after the credits nothing is saved: the next load is a new game
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && !finished) autosave.onHide(); });

  if (!view.prologue) audio.setTension(0.15); // no drone before the blackout: the unease arrives with Daisy
  const start = resume ? store.get('beat') : 0;
  game.room.setWindowBokeh(bokehOff(act.beats[start]) ? 0 : 1);
  if (view.deskReady) deskReady(game); // beat 0 is the cold open itself
  if (view.deskReady && view.music === 'winramp') { winramp.open(); winramp.play(); }
  if (view.music === 'act1_bed') audio.playMusic('act1_bed', { fade: 8 }); // a new game's music starts when Daisy arrives
  if (view.chatOpen) chat.open(); // bring Daisy back with the conversation so far
  await director.run(act, start);
  // The end: "MADE BY SWASTIK" holds, then the save is wiped and the game starts over from the title, as a new game.
  finished = true;
  saver.clear();
  await new Promise((r) => setTimeout(r, 7000));
  location.reload();
}

// Fonts and every picture the game shows (photos, web art, posters), decoded before play.
async function preloadExtras(onProgress) {
  const fonts = ['1em Unbounded', '1em Jost', '1em Michroma', '1em "Reenie Beanie"'];
  const texts = await Promise.all(['data/mycomp.json', 'data/room.json', ...Object.values((await loadJSON('data/web/index.json')).pages).map((pg) => `data/web/${pg.file}`)]
    .map((u) => fetch(u).then((r) => r.text()).catch(() => '')));
  const images = [...new Set(texts.join('\n').match(/assets\/[\w/.-]+\.(?:jpe?g|png|gif|webp)/gi) ?? [])];
  const jobs = [...fonts.map((f) => document.fonts.load(f)), ...images.map((src) => Object.assign(new Image(), { src }).decode())];
  let done = 0;
  await Promise.all(jobs.map((j) => j.catch(() => {}).then(() => onProgress(++done / jobs.length))));
}

async function boot() {
  const dev = params.get('dev');
  if (LOCAL && dev && DEV_ROUTES[dev]) { $('#curtain')?.remove(); return DEV_ROUTES[dev](); }
  const bus = createBus();
  const store = createStore(bus);
  const saver = createSaver(browserStorage());
  const audio = createAudio();
  const game = { bus, store, saver, audio };
  game.film = createFilm($('#film'));
  const saved = saver.load();
  if (saved.status === 'ok' && saved.state.settings) store.set('settings', saved.state.settings);
  const mine = loadSettings(); // what you set on the menu wins over an older save's
  if (mine) store.set('settings', { ...store.get('settings'), ...mine, volume: { ...store.get('settings.volume'), ...mine.volume } });

  // Everything loads up front behind the loader: the room, every sound, the fonts, every picture — nothing hitches later.
  const loader = showLoader($('#overlay'));
  const manifest = await loadJSON('data/audio.json');
  const urls = Object.fromEntries(Object.entries(manifest).map(([name, e]) => [name, e.file]));
  const p = { room: 0, audio: 0, extras: 0 };
  const report = (label) => loader.progress(p.room * 0.6 + p.audio * 0.3 + p.extras * 0.1, label);
  let credits = '';
  await Promise.all([
    buildWorld(game, (v) => { p.room = v; report('Building the room'); }),
    audio.load(urls, (v) => { p.audio = v; report('Loading sound'); }),
    preloadExtras((v) => { p.extras = v; report(); }),
    fetch('CREDITS.md').then((r) => r.text()).then((t) => { credits = t.replace(/^#+\s*/gm, '').replace(/\*\*|`/g, ''); }).catch(() => {}),
  ]);
  await loader.ready();
  audio.unlock(); // CONTINUE is the first user gesture
  applyVolumes(audio, store);
  audio.sfx('menu_select', { gain: 0.7 });
  audio.sfx('menu_whoosh', { gain: 0.3, rate: 0.85 }); // the room fades up

  // The menu: the room itself, up close to a star, the window soft behind.
  const leave = menuShot(game);
  $('#curtain')?.remove();
  loader.close();
  if (saved.status === 'corrupt') { await showCorruptSave($('#overlay')); saver.clear(); }
  const choice = await showMenu($('#overlay'), { save: saved, store, audio, room: game.room, credits });
  await leave();
  if (choice === 'resume') {
    const settings = store.get('settings');
    store.replace(saved.state);
    store.set('settings', settings);
    applyVolumes(audio, store);
    return startGame(game, { resume: true });
  }
  applyVolumes(audio, store);
  saver.clear();
  store.set('handle', await askHandle($('#overlay'), { audio }));
  return startGame(game, { resume: false });
}

installDevPanel();
boot().catch((err) => {
  console.error('[daisy] boot failed', err);
  showFatal($('#overlay'), err);
});

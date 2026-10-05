import { gsap } from 'gsap';
import { playChime, clubBass } from '../core/synths.js';
import { titles } from './titles.js';
import { scramble } from './glitch.js';
import { selfStart } from '../desktop/apps/selfstart.js';
import { ICONS, PROLOGUE_APPS } from '../desktop/icons.js';
import { nextCityEvent } from '../core/ambience.logic.js';
import { soundDelay, lowpassFor, STAYS_DARK } from '../world/city.logic.js';
import { machineBeeps, playMessage } from '../world/inspect.js';
import { createBsn } from '../desktop/apps/bsn.js';
import { DESKTOP_W, DESKTOP_H } from '../world/screen.js';
// Cinematic sequences. Each is an async function the Director (or boot) awaits.
let ambience = null;
let club = null; // the club down the street: its bass dies with its sign
// The room's loops (rain, steam, static) start once. The street's sirens and horns only start after the blackout:
// before it, it's a quiet night of scrolling the web.
const LOOPS = { rain_loop: { gain: 0.55 }, steam_hiss: { gain: 0.05, pan: 0.6 }, tv_static: { gain: 0.08, pan: -0.5 } };
let loops = null; // name -> playing source
export function startAmbience(audio, { sirens = false } = {}) {
  club ??= clubBass(audio);
  loops ??= Object.fromEntries(Object.entries(LOOPS).map(([name, o]) => [name, audio.sfx(name, { bus: 'ambience', loop: true, ...o })]));
  if (!sirens || ambience) return ambience;
  let timer = null;
  const next = () => {
    const e = nextCityEvent();
    timer = setTimeout(() => { audio.sfx(e.name, { bus: 'ambience', gain: e.gain, pan: e.pan, rate: e.rate }); next(); }, e.delay * 1000);
  };
  next();
  ambience = { stop() { clearTimeout(timer); ambience = null; } };
  return ambience;
}

// Used on resume and in dev routes: sit at the desk with the monitor already on.
// The PC's own hum: always there, barely, while the tower has power. It dies with the blackout and comes back with
// the power button; at the very end it is the only sound left.
export const HUM = 0.07;
let pcHum = null;
export function setPcHum(audio, gain, { fade = 0.6 } = {}) {
  if (!gain) {
    if (pcHum) { const t = pcHum.context.currentTime; pcHum.gainNode.gain.setTargetAtTime(0, t, fade / 3); pcHum.stop(t + fade + 0.2); }
    pcHum = null;
    return;
  }
  pcHum ??= audio.sfx('pc_hum', { gain: 0, loop: true });
  pcHum?.gainNode.gain.setTargetAtTime(gain, pcHum.context.currentTime, fade / 3);
}

export function deskReady({ room, screen, desktopEl, audio, store }) {
  room.setMonitorPower(true, { instant: true });
  room.setPose(screen.deskPose(room.camera.aspect));
  room.rig.breathe = 0.25;
  desktopEl.classList.add('on');
  screen.mode = 'desk';
  screen.setInteractive(true);
  startAmbience(audio, { sirens: store?.get('flags.blackout') === true });
  setPcHum(audio, HUM);
  room.startTrainLoop(audio);
  room.startStorm(audio);
  document.querySelector('#curtain')?.remove();
}


// The blackout silences a loop (it keeps running at zero) and the power brings it back to its level.
function setLoop(name, on, seconds = 0.3) {
  const s = loops?.[name];
  s?.gainNode.gain.setTargetAtTime(on ? LOOPS[name].gain : 0, s.context.currentTime, seconds / 3);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xyz = (v) => ({ x: v.x, y: v.y, z: v.z });

const tweenPose = (room, pose, duration, ease = 'power2.inOut') => {
  const p = room.poseOf(pose); // a name or a { pos, look } pose
  return gsap.timeline()
    .to(room.rig.pos, { ...xyz(p.pos), duration, ease }, 0)
    .to(room.rig.look, { ...xyz(p.look), duration, ease }, 0);
};

// A person turning, not a crane: the eyes lead, the body follows a beat behind, and the look swings a touch past
// what it wanted and settles back.
const headTurn = (room, pose, duration, { lag = 0.22, over = 0.07 } = {}) => {
  const p = room.poseOf(pose);
  const from = room.rig.look.clone();
  const past = p.look.clone().sub(from).multiplyScalar(over).add(p.look);
  return gsap.timeline()
    .to(room.rig.look, { ...xyz(past), duration: duration * 0.78, ease: 'power2.inOut' }, 0)
    .to(room.rig.look, { ...xyz(p.look), duration: duration * 0.4, ease: 'sine.inOut' })
    .to(room.rig.pos, { ...xyz(p.pos), duration: duration * 0.95, ease: 'sine.inOut' }, duration * lag);
};

// The title shot: up close to a gold foil star turning on its thread, the window soft behind it, the city breathing.
// Returns exit(): the focus pulls off the star, everything goes soft and the frame goes to black.
const MENU_FOCUS = { focus: 0.5, aperture: 0.07, maxblur: 0.02 }; // a touch more in focus: the star turns on its thread
// The menu's song: Kaazoom with an echo, as if it plays in another room. Fades in to `gain`; fadeOut(tau) lets it go.
function menuSong(audio, gain) {
  const song = audio.sfx('kaazoom_broken', { bus: 'music', gain: 0, loop: true });
  if (!song) return { fadeOut() {} };
  song.gainNode.gain.setTargetAtTime(gain, song.context.currentTime, 1.2);
  // the echo: a dull delay fed back into itself, beside the dry song
  const ctx = song.context;
  const delay = ctx.createDelay(1), tone = ctx.createBiquadFilter(), back = ctx.createGain(), wet = ctx.createGain();
  delay.delayTime.value = 0.38;
  tone.type = 'lowpass'; tone.frequency.value = 2200;
  back.gain.value = 0.38;
  wet.gain.value = 0.55;
  song.gainNode.connect(delay);
  delay.connect(tone).connect(back).connect(delay);
  tone.connect(wet).connect(audio.output('music'));
  let gone = false;
  return {
    fadeOut(tau) { // tau: the fall's time constant; it's silent after ~5 tau, then stopped (the echo tail rings out)
      if (gone) return;
      gone = true;
      const t = ctx.currentTime;
      song.gainNode.gain.cancelScheduledValues(t);
      song.gainNode.gain.setTargetAtTime(0, t, tau);
      song.stop(t + tau * 6 + 0.1);
    },
  };
}

export function menuShot({ room, audio }) {
  room.setPose('menu');
  room.rig.breathe = 0.45;
  room.setFocus(MENU_FOCUS);
  startAmbience(audio);
  setPcHum(audio, HUM * 0.6, { fade: 3 });
  room.startTrainLoop(audio);
  const first = setTimeout(() => room.passTrain(), 7000); // one goes by while you look
  const song = menuSong(audio, 0.1); // the ending's song, barely there
  return async () => {
    clearTimeout(first);
    song.fadeOut(0.4);
    room.stopTrainLoop();
    room.setParallax(0, 0);
    const curtain = Object.assign(document.createElement('div'), { id: 'curtain' }); // the game lifts it when it's ready
    curtain.style.opacity = '0';
    document.body.append(curtain);
    audio.fadeBus('ambience', 0, 1.6);
    const f = room.focus;
    await gsap.timeline()
      .to(f ? f.focus : {}, { value: 4, duration: 1.4, ease: 'power2.in' }, 0) // the rack: the star goes soft too
      .to(f ? f.aperture : {}, { value: 0.3, duration: 1.4, ease: 'power2.in' }, 0)
      .to(curtain, { opacity: 1, duration: 1.2, ease: 'power1.in' }, 0.4);
    room.setFocus(null);
    setPcHum(audio, 0, { fade: 0.4 });
  };
}

export async function coldopen({ room, screen, desktopEl, audio, overlay, film, store, winramp, from }) {
  const black = Object.assign(document.createElement('div'), { className: 'fade-black' });
  const lids = Object.assign(document.createElement('div'), { className: 'eyelids', innerHTML: '<div class="lid top"></div><div class="lid bottom"></div>' });
  overlay.append(lids, black);
  await film.letterbox(true, { duration: 0 });
  room.setPose('ceiling');
  room.rig.breathe = 1.4;
  room.setMonitorPower(true, { instant: true }); // he fell asleep at the machine; the CRT glows on the ceiling
  desktopEl.classList.add('on');
  screen.setInteractive(false);
  const vol = store.get('settings.volume.ambience') ?? 0.7;
  audio.setVolume('ambience', 0);

  // 1. The opening titles: light in the dark, Turing, the credit. The credit comes up on thunder alone, loud (on the sfx
  // bus, straight into the recording's crack). Once the credit has gone, the rest of the night fades in under the roll:
  // rain, steam, static, a second far thunder, a horn down on the street.
  await titles({ audio, overlay, skipToCredit: from === 'credit', onCredit: () => audio.sfx('thunder_far_2', { gain: 1, offset: 3.3 }) }); // crack: −18 → −3 dB at 3.4 s
  startAmbience(audio);
  setPcHum(audio, HUM, { fade: 4 });
  audio.fadeBus('ambience', vol, 9);
  audio.sfx('thunder_far_1', { bus: 'ambience', gain: 0.6, pan: -0.3, delay: 4 });
  audio.sfx('horn_far', { bus: 'ambience', gain: 0.12, pan: 0.5, delay: 7.5 });
  await sleep(1400);

  // 2. Still black, the menu's song comes up (a touch louder than on the menu); his eyes open to it. It carries him to
  // the window and dies under the monorail. Greg's show waits until he's back at the machine.
  const song = menuSong(audio, 0.2);
  await sleep(1200);
  const canvas = room.renderer.domElement;
  canvas.style.filter = 'blur(12px) brightness(0.5)';
  black.remove();
  document.querySelector('#curtain')?.remove();
  const top = lids.querySelector('.top');
  const bottom = lids.querySelector('.bottom');
  await gsap.timeline()
    .to(top, { yPercent: -55, duration: 0.8, ease: 'power2.out' })
    .to(bottom, { yPercent: 55, duration: 0.8, ease: 'power2.out' }, '<')
    .to([top, bottom], { yPercent: 0, duration: 0.25, ease: 'power2.in' }, '+=0.7')
    .to(top, { yPercent: -100, duration: 1.2, ease: 'power2.inOut' })
    .to(bottom, { yPercent: 100, duration: 1.2, ease: 'power2.inOut' }, '<')
    .to(canvas, { filter: 'blur(0px) brightness(1)', duration: 3.2, ease: 'power2.out' }, 0.4);
  canvas.style.filter = '';
  await sleep(2600);

  // 3. He sits up and his eyes go straight to the computer, still swimming; two blinks and it comes clear.
  room.rig.breathe = 1;
  winramp.open(); // DoorRAMP sits open on the CRT, Greg's show queued, not playing yet
  const eyes = [canvas, desktopEl]; // the room and the screen (its own layer) blur together
  gsap.to(eyes, { filter: 'blur(7px)', duration: 1.2, ease: 'sine.in' });
  await headTurn(room, 'panDesk', 3.2, { lag: 0.3 }); // sitting up: the head comes down first, the body after
  await sleep(500);
  for (const blur of [3, 0]) {
    await gsap.timeline()
      .to(top, { yPercent: 0, duration: 0.13, ease: 'power2.in' })
      .to(bottom, { yPercent: 0, duration: 0.13, ease: 'power2.in' }, '<')
      .set(eyes, { filter: `blur(${blur}px)` })
      .to(top, { yPercent: -100, duration: 0.3, ease: 'power2.out' }, '+=0.08')
      .to(bottom, { yPercent: 100, duration: 0.3, ease: 'power2.out' }, '<');
    await sleep(blur ? 450 : 900);
  }
  lids.remove();
  for (const el of eyes) el.style.filter = '';

  // 4. The window, the rain on the glass; the monorail crosses.
  room.setGlassOpacity(0.55, 2.6); // up close the drops would show their pixels: the pane steps back as he leans in
  await headTurn(room, 'window', 2.6);
  const train = room.passTrain({ audio });
  setTimeout(() => song.fadeOut(1.4), 2600); // the song goes as the train comes up loud: the rumble covers its going
  await tweenPose(room, 'windowDeep', 4.5, 'power1.inOut');
  await sleep(1500);
  await train;

  // 5. Back to the CRT, to DoorRAMP and Greg.
  const desk = screen.deskPose(room.camera.aspect);
  await gsap.timeline()
    .to(room.rig.pos, { ...xyz(desk.pos), duration: 3.2, ease: 'power2.inOut' })
    .to(room.rig.look, { ...xyz(desk.look), duration: 3.2, ease: 'power2.inOut' }, 0)
    .to(room.rig, { breathe: 0.25, duration: 3.2 }, 0)
    .add(() => room.setGlassOpacity(1, 2.4), 0);
  // 6. He's at the machine. A beat, a click on DoorRAMP's play, and Greg's show starts (from the top of Greg).
  song.fadeOut(0.3); // in case the train was quicker than the song (never leave it under Greg)
  await sleep(1400);
  audio.sfx('mouse_click', { gain: 0.6 });
  winramp.play({ fade: 0.3 });
  await sleep(600);

  // 7. The letterbox lifts. The player has the camera.
  await film.letterbox(false, { duration: 1.6 });
  screen.mode = 'desk';
  screen.setInteractive(true);
  room.startTrainLoop(audio);
  room.startStorm(audio);
}

export const CUTSCENE_IDS = ['coldopen', 'blackout', 'daisyArrives', 'fragmentJoin', 'chapterEnd'];

// A looping sound that gives up slowly: full for `after` s, then fades over `over` s and stops.
function fadeOut(src, after, over) {
  if (!src) return;
  const now = src.context.currentTime;
  src.gainNode.gain.setValueAtTime(src.gainNode.gain.value, now + after);
  src.gainNode.gain.linearRampToValueAtTime(0, now + after + over);
  src.stop(now + after + over + 0.1);
}

// The CRT dies the old way: the picture squeezes to a line, the line to a dot, the dot fades.
async function crtCollapse(desktopEl) {
  const el = Object.assign(document.createElement('div'), { className: 'crt-collapse', innerHTML: '<i></i>' });
  desktopEl.append(el);
  const dot = el.querySelector('i');
  await gsap.timeline()
    .to(el, { opacity: 1, duration: 0.05 })
    .fromTo(dot, { scaleX: 1, scaleY: 1 }, { scaleY: 0.004, duration: 0.12, ease: 'power3.in' })
    .to(dot, { scaleX: 0.006, duration: 0.18, ease: 'power3.in' })
    .to(dot, { opacity: 0, duration: 0.9, ease: 'power1.out' });
  return el; // stays black until the reboot removes it
}

// DOOR98 comes back up: POST and memory count, the splash with its crawling bar, the startup chime.
async function doorBoot(desktopEl, audio, dark) {
  const el = Object.assign(document.createElement('div'), { className: 'door-boot' });
  el.innerHTML = `<pre class="post">Meridian Modular BIOS v4.51PG
Copyright (C) 1984-98, Meridian Software, Inc.

PENTIUM-II CPU at 350MHz
Memory Test :  <span>0</span>K OK</pre>`;
  desktopEl.append(el);
  dark?.remove();
  const fan = audio.sfx('pc_boot', { gain: 0.7 }); // the fan spins up with the POST, then fades under the room: not a constant drone
  if (fan) { const t = fan.context.currentTime; fan.gainNode.gain.setTargetAtTime(0, t + 3.5, 0.9); fan.stop(t + 7); }
  const mem = el.querySelector('span');
  const m = { v: 0 };
  await gsap.to(m, { v: 65536, duration: 1.3, ease: 'none', onUpdate: () => { mem.textContent = String(Math.round(m.v)); } });
  await sleep(900);
  audio.sfx('hdd_seek', { gain: 0.4 });
  el.innerHTML = '<div class="door-splash"><p><span>DOOR</span><b>98</b></p><div class="progress-indicator segmented"><span class="progress-indicator-bar"></span></div></div>';
  await gsap.fromTo(el.querySelector('.progress-indicator-bar'), { width: '0%' }, { width: '100%', duration: 3.6, ease: 'none' });
  audio.sfx('hdd_seek', { gain: 0.3, rate: 1.2 });
  await playChime(audio);
  await gsap.to(el, { opacity: 0, duration: 0.6 });
  el.remove();
}

// The download lands. A few quiet seconds, then the desktop comes apart and everything dies at once: the room first,
// then the city, outward from his block to the skyline. In the dark the player has their head; the storm breaks overhead.
const BIG_STRIKE = { flickers: [{ at: 0, peak: 2.4 }, { at: 0.11, peak: 0.8 }, { at: 0.24, peak: 2.8 }, { at: 0.52, peak: 1.2 }], thunderDelay: 0.45, gain: 1, variant: 1 };
export async function blackout({ room, screen, desktopEl, desktop, audio, winramp, bsn, store, look, overlay }) {
  const vol = store.get('settings.volume.ambience') ?? 0.7;
  screen.setInteractive(false);
  room.startStorm(audio);
  room.stopTrainLoop(); // no train crosses the dead city on its own
  await sleep(3500);

  // 1. The anomaly: the screen scrambles and hangs, the music drags down. The room's lights sag but hold.
  bsn.drop();
  let unhang;
  const glitch = scramble(desktopEl, audio, { until: new Promise((r) => { unhang = r; }) }); // hung until the room dies
  // the grid is failing: every light in the room sags and stutters, the drive and the fan labour under it, and he sits
  // back from the screen, slowly, the whole hung machine in front of him: what the hell is happening?
  room.rig.breathe = 1.3;
  tweenPose(room, 'seated', 5.5, 'sine.inOut');
  room.brownout(2.4, (f) => { desktopEl.style.filter = f < 1 ? `brightness(${0.25 + 0.75 * f})` : ''; }); // the tube sags with the room
  audio.sfx('power_hum', { gain: 0.35, rate: 0.8 });
  audio.sfx('hdd_seek', { gain: 0.45, rate: 1.1 });
  room.diskActivity(2.6);
  await sleep(1900);
  winramp.die();
  await sleep(5200); // he just watches it hang

  // Everything that spins winds down, each at its own rate (real recordings, pitched down as they die): the PC's fan,
  // its hard drive, the hum of the transformers in the walls.
  const spinDown = (src, { to = 0.25, over = 2.6, fade = 0.7 } = {}) => {
    if (!src) return;
    const t = src.context.currentTime;
    src.playbackRate.cancelScheduledValues(t);
    src.playbackRate.setValueAtTime(src.playbackRate.value, t);
    src.playbackRate.linearRampToValueAtTime(to, t + over);
    src.gainNode.gain.setTargetAtTime(0, t + over * 0.25, fade);
    src.stop(t + over + 0.6);
  };
  // His room goes last, on his street's breaker, with the train: the hung screen collapses, everything electric dies.
  const roomDies = async () => {
    unhang();
    const collapsing = crtCollapse(desktopEl);
    spinDown(audio.sfx('pc_boot', { gain: 0.5, offset: 7 }));
    spinDown(audio.sfx('hdd_seek', { gain: 0.45, rate: 1.1 }), { to: 0.2, over: 1.6, fade: 0.4 });
    spinDown(audio.sfx('power_hum', { gain: 0.4 }), { to: 0.3, over: 3.4, fade: 1 });
    setLoop('tv_static', false, 0.2);
    setLoop('steam_hiss', false, 2);
    audio.fadeBus('ambience', vol * 0.6, 1.2); // the dark sits under the rain, not on top of it
    room.setMains(false); // the modem's and the answering machine's LEDs
    room.setModemActive(false);
    // a car alarm a few streets off goes off: twice round, then it gives up. A story beat (the sfx bus); muffled.
    const alarm = audio.sfx('car_alarm', { gain: 0.25, pan: 0.5, lowpass: 2200, loop: true });
    if (alarm) fadeOut(alarm, alarm.buffer.duration * 2 - 2, 2);
    room.setLamp(false);
    room.setDome(false);
    room.setScreensPower(false); // the TV and the old monitor go with the room
    const dead = await collapsing; // the collapsed tube: the power button boots it back up
    await glitch;
    room.setMonitorPower(false);
    room.setPC(false); // the tower's power and disk lights with it
    setPcHum(audio, 0, { fade: 1.6 }); // the fan winds down with it
    return dead;
  };

  // 2. The screen still hung, his eyes go to the window and he watches the city go, far to near: the skyline, the
  // blocks, the buildings across, then Dan's; last his own street, the train braking under it, and his room, all at once.
  let trainStopped = Promise.resolve(), roomDead = Promise.resolve();
  room.rig.breathe = 1.6; // breath catches
  await tweenPose(room, 'window', 3.8, 'power1.inOut');
  await room.cityBlackout({ gap: 2.2, order: ['skyline', 'mid', 'across', 'pub', 'street'], onStage: (st) => {
    const far = st.dist > 100; // skip each recording's lead-in so its click lands on the cut (breaker_1 0.12 s, breaker_2 0.05 s)
    audio.sfx(far ? 'breaker_2' : 'breaker_1', { bus: 'ambience', gain: Math.min(1, 0.25 + 30 / st.dist), lowpass: lowpassFor(st.dist), offset: far ? 0.045 : 0.11 }); // on the cut, not after the speed of sound: the click IS the lights going
    if (st.id === 'street') {
      ambience?.stop(); // (on a replayed blackout) no sirens and horns: the street is dead
      trainStopped = room.stopTrain();
      roomDead = roomDies();
    }
    if (st.id === 'pub') { room.setClubSign(false); club?.stop(0.4); club = null; }
  } });
  const dark = await roomDead;
  await trainStopped;
  await tweenPose(room, 'seated', 2.4); // a small turn back to the dead screen

  // 3. Dark. The player can look around; the storm breaks right overhead and lights the room through the blinds.
  room.rig.breathe = 1.1;
  look?.gaze(true);
  const help = Object.assign(document.createElement('p'), { className: 'inspect-help', textContent: 'DRAG TO LOOK AROUND' });
  overlay?.append(help);
  gsap.fromTo(help, { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 1 });
  gsap.to(help, { opacity: 0, duration: 1.2, delay: 4 });
  await sleep(1800); // long enough to feel the dark, not so long it drags
  room.strikeLightning(BIG_STRIKE);
  audio.sfx('thunder_far_2', { bus: 'ambience', gain: 0.9, pan: 0.3, delay: 0.9, rate: 0.9 }); // the crack, then the roll
  await sleep(3800);
  room.strikeLightning({ ...BIG_STRIKE, thunderDelay: 1.6, gain: 0.85, variant: 2 });
  await sleep(2600);
  look?.gaze(false);
  help.remove();
  await tweenPose(room, 'seated', 1.2); // whatever he was looking at, the power brings his eyes back

  // 3. Power returns, one thing after another: a hum, the lamp, the ceiling light, the TV and its static, the desk's
  // LEDs and the radiator, then his patch of the city, near to far (the blocks and skyline stay dark; the club's bass with its sign, the train on his street), then the PC.
  audio.sfx('power_hum', { gain: 0.6 });
  await sleep(700);
  room.setLamp(true);
  await sleep(500);
  room.setDome(true);
  await sleep(700);
  room.setTvStatic(true); // the countdown station is gone
  room.setScreensPower(true);
  setLoop('tv_static', true, 0.4);
  await sleep(600);
  room.setMains(true);
  setLoop('steam_hiss', true, 2);
  await sleep(600);
  audio.fadeBus('ambience', vol, 4);
  await room.cityRelight({ gap: 0.5, skip: STAYS_DARK, onStage: (st) => { // only his patch: the far city stays dark
    audio.sfx('breaker_1', { bus: 'ambience', gain: Math.min(0.6, 20 / st.dist), lowpass: lowpassFor(st.dist), delay: soundDelay(st.dist) });
    if (st.id === 'pub') { room.setClubSign(true); club ??= clubBass(audio); }
    if (st.id === 'street') { room.resumeTrain(); startAmbience(audio, { sirens: true }); } // now the city is scared
  } });
  room.startTrainLoop(audio);

  // 4. Everything came back but the PC: he leans down to the tower and presses its power button.
  await tweenPose(room, 'tower', 1.8);
  const press = Object.assign(document.createElement('p'), { className: 'inspect-help', textContent: 'PRESS THE POWER BUTTON' });
  overlay?.append(press);
  gsap.fromTo(press, { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.6 });
  await look?.press({ id: 'power', nodes: ['Tower', 'Tower_Power_Btn'], title: 'power button' });
  press.remove();
  audio.sfx('power_button', { gain: 0.8 });
  await room.pressPower();
  room.setPC(true);
  setPcHum(audio, HUM, { fade: 2.5 });
  room.diskActivity(9); // the POST and DOOR98 loading: the red light chatters
  tweenPose(room, 'seated', 2.4); // he sits back up while it POSTs

  // 5. DOOR98 boots. Only install.exe survives (DSN and Voyager are hidden, to come back later).
  // A reboot: every window the prologue left open goes (a fixed list here kept missing newer apps, e.g. Inlook).
  for (const w of desktopEl.querySelectorAll('.window[data-id]')) desktop.wm.close(w.dataset.id);
  await Promise.all(PROLOGUE_APPS.map((a) => desktop.hideIcon(a.id, { duration: 0, keep: a.id === 'bsn' || a.id === 'voyager' })));
  room.setMonitorPower(true);
  desktop.showIcon('daisy', { duration: 0 }); // no fade: when the splash clears, it's just there, the only file left
  await doorBoot(desktopEl, audio, dark);
  await tweenPose(room, screen.deskPose(room.camera.aspect), 2.2);
  room.rig.breathe = 0.4;
  screen.mode = 'desk';
  screen.setInteractive(true);
}

// Windows 98 opened windows with a zoom: the title-bar strip flies from the icon to the window, trailing copies of
// itself. Coordinates are in the desktop's own (unscaled) pixels.
async function zoomFromIcon(desktop, appId, win) {
  const icon = desktop.el.querySelector(`.desktop-icon[data-app="${appId}"]`);
  if (!icon) return;
  const d = desktop.el.getBoundingClientRect(), k = desktop.el.offsetWidth / d.width;
  const rel = (r) => ({ left: (r.left - d.left) * k, top: (r.top - d.top) * k, width: r.width * k });
  const from = rel(icon.getBoundingClientRect()), to = rel(win.getBoundingClientRect());
  const strips = [0, 1, 2, 3].map((n) => {
    const s = document.createElement('div');
    s.style.cssText = `position:absolute;z-index:999;height:18px;pointer-events:none;background:linear-gradient(90deg,#000080,#1084d0);opacity:${1 - n * 0.22}`;
    desktop.el.append(s);
    return s;
  });
  await Promise.all(strips.map((s, n) => gsap.fromTo(s, from, { ...to, duration: 0.42, delay: n * 0.05, ease: 'power1.in' }).then(() => s.remove())));
}

// Daisy arrives without ceremony: something runs the machine for a moment (DOS prompts open, type and exit on their
// own), then her window surfaces slowly. Music comes in under her first words.
export async function daisyArrives({ store, chat, audio, desktop, screen }) {
  screen.setInteractive(false);
  await selfStart({ wm: desktop.wm, audio, onRename: () => desktop.rename('daisy', { title: 'untitled.exe', icon: ICONS.eye }) });
  await sleep(1200);
  store.set('flags.daisyAwake', true);
  audio.playMusic('act1_bed', { fade: 12 });
  audio.setTension(0.15);
  chat.open();
  const win = desktop.wm.get('chat')?.el;
  if (win) {
    gsap.set(win, { opacity: 0, overwrite: true });
    await zoomFromIcon(desktop, 'daisy', win); // the Win98 caption zoom, from her icon to where her window will be
    // like an old tube coming on, inside the caption's outline: a hot line the window's full width, it opens top and
    // bottom, stutters twice and cools. Only the height is squashed, so it never collapses to a dot.
    audio.sfx('crt_on', { gain: 0.45, rate: 1.3 });
    await gsap.timeline() // no overwrite here: it would kill this timeline's own earlier steps (the window just popped in)
      .set(win, { scaleX: 1, scaleY: 0.03, transformOrigin: '50% 50%', filter: 'brightness(9) saturate(0)' })
      .fromTo(win, { opacity: 0 }, { opacity: 1, duration: 0.1 }) // the line strikes
      .to(win, { scaleY: 1, duration: 0.7, ease: 'power3.inOut', delay: 0.35 })
      .to(win, { filter: 'brightness(2) saturate(0.6)', duration: 0.2 }, '<')
      .to(win, { opacity: 0.45, duration: 0.04 }).to(win, { opacity: 1, duration: 0.05 })
      .to(win, { opacity: 0.7, duration: 0.04, delay: 0.14 }).to(win, { opacity: 1, duration: 0.05 })
      .to(win, { filter: 'brightness(1) saturate(1)', duration: 0.9, ease: 'power2.out', clearProps: 'filter,transform,opacity' });
  }
  screen.setInteractive(true);
  await sleep(600);
}

// A fragment arrives: the screen surges, the drive screams, Daisy stutters as it lands (the following 'daisy' beat grows her).
export async function fragmentJoin({ room, desktopEl, audio, chat }) {
  audio.setTension(0);
  room.setModemActive(true);
  audio.sfx('hdd_seek', { gain: 0.9 });
  audio.sfx('crt_on', { gain: 0.5, rate: 0.6 });
  chat.open();
  chat.daisy.act('stutter');
  const spill = room.lights.monitor.intensity; // return to whatever the monitor was throwing before the surge
  await gsap.timeline()
    .to(room.lights.monitor, { intensity: 7, duration: 0.15 })
    .to(desktopEl, { filter: 'brightness(2.4) contrast(1.4)', duration: 0.15 }, 0)
    .to(room.lights.monitor, { intensity: spill, duration: 1.4, ease: 'power3.out' })
    .to(desktopEl, { filter: 'brightness(1) contrast(1)', duration: 1.4, ease: 'power3.out', clearProps: 'filter' }, '<');
  room.setModemActive(false);
}

// The end of chapter 1. Greg asks after Maya; Daisy explains, sweetly, that nothing happened to *you*;
// Greg won't stop typing; then she shows you Maya's mail (she wrote every word — chapter 2 finds out).
export async function chapterEnd({ room, screen, desktop, audio, overlay, film, chat, bus, store, roomData, from }) {
  const end = await (await fetch('data/ending.json')).json();
  roomData ??= await (await fetch('data/room.json')).json();
  if (from !== 'mail') { // (dev: &from=mail starts on the mail)
    await sleep(2400);
    // Greg calls. Nobody picks up; the machine screens it out loud, so you hear him talk onto the tape.
    store.set('flags.gregCalled2', true);
    store.set('flags.gregCalled2At', store.get('clock'));
    room.setAnswerRinging(true);
    audio.sfx('phone_ring', { gain: 0.5 });
    await sleep(4200);
    await machineBeeps(audio, 1);
    room.setAnswerRinging(false);
    const call = roomData.hotspots.find((h) => h.id === 'answering').messages.find((m) => m.voice === 'greg_emergency');
    const cap = Object.assign(document.createElement('p'), { className: 'caption' });
    overlay.append(cap);
    await playMessage({ audio, voice: call.voice, lines: call.subtitle, show: (t) => { cap.textContent = t; cap.classList.toggle('on', !!t); } });
    cap.remove();
    store.set('flags.gregHeard2', true);
    audio.sfx('mouse_click', { gain: 0.5, rate: 0.6 }); // the tape stops
    await sleep(1600);

    // Not #nullroute: just the two of them.
    const pm = createBsn({ wm: desktop.wm, bus, audio, store, id: 'pm-greg', channel: 'greg_', members: end.members });
    pm.open();
    await pm.run(end.greg);
    await sleep(1200);
    await chat.run('a1_end_confront');
    pm.open(); // greg jumps the queue: his window comes to the front and only his button does anything
    await pm.run(end.spam);
    await sleep(1400);
  }

  // The music goes first; the world (rain, the street, the club) slips away slowly while he reads, the way it does
  // when you read something like that. By the last mail only the PC's hum is left.
  room.stopTrainLoop();
  audio.stopMusic({ fade: 6 });
  audio.setTension(0);
  audio.fadeBus('ambience', 0.5, 6);
  setPcHum(audio, HUM * 1.6, { fade: 4 });
  if (from !== 'mail') await chat.run('a1_end_ask');
  audio.fadeBus('ambience', 0.3, 16); // low, never gone: the rain is still out there
  audio.fadeBus('voice', 0, 3); // Daisy goes quiet too: no more blips, hops or pokes from here to the credits
  screen.setInteractive(false);
  await sleep(700);
  film.letterbox(true, { duration: 0.8 }); // the bars come in with the mail and stay to the end
  await mailMontage({ room, screen, desktop, audio, overlay, film, mails: end.mails });

  // All of it at once: cut wide on the screen, every mail up, then he sits back from the glass, slowly, and his eyes go
  // to the window, to the pub's light. The world is far away now (low, not gone) and the hum is right in his ear.
  room.setPose(screen.pointPose(DESKTOP_W / 2, DESKTOP_H / 2, WIDE));
  audio.fadeBus('ambience', 0.18, 5);
  setPcHum(audio, HUM * 3.2, { fade: 3 });
  await sleep(2600);
  await tweenPose(room, 'seated', 7, 'sine.inOut');
  await tweenPose(room, { pos: room.poseOf('seated').pos, look: room.poseOf('window').look }, 4.6, 'sine.inOut'); // from the chair, not up at the glass
  audio.fadeBus('ambience', 0.26, 4); // looking at the rain, it comes back a little
  await sleep(4000);
  setPcHum(audio, 0, { fade: 1.5 });
  audio.sfx('kaazoom_broken', { bus: 'music', gain: 0.9 });
  await sleep(4000);
  // The credits: each card cuts in, holds, and cuts out. No fades, no promises.
  overlay.append(Object.assign(document.createElement('div'), { className: 'fade-black' }));
  const card = Object.assign(document.createElement('div'), { className: 'act-card chapter-card' });
  overlay.append(card);
  for (const [html, hold] of [['<p class="chapter-title">DAISY</p>', 6000], ['', 1400], ['<p class="chapter-end">END OF CHAPTER I</p>', 4200], ['', 1200]]) {
    card.innerHTML = html;
    await sleep(hold);
  }
  card.innerHTML = '<p class="chapter-credit">MADE BY SWASTIK</p>'; // stays: the end
}

const WIDE = 0.33; // m off the glass: the whole desktop fills the frame

// Daisy throws the mail up, then the camera cuts in on the CRT, one window at a time: close on the glass,
// a different distance and angle each cut, a slow drift while she selects the words that hurt.
const SHOTS = [
  { dist: 0.2, off: [-0.03, 0.012], drift: [0.012, -0.004], hold: 2.6 },
  { dist: 0.15, off: [0.025, -0.01], drift: [-0.008, 0.006], hold: 2.4 },
  { dist: 0.22, off: [0, 0.02], drift: [0, -0.01], hold: 2.6 },
  { dist: 0.13, off: [-0.02, -0.006], drift: [0.014, 0], hold: 2.2 },
  { dist: 0.17, off: [0.012, 0.004], drift: [-0.004, 0.003], hold: 3.2 },
];
const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const deskXY = (el, root) => { // the element's centre in desktop px (layout space: the 3D warp doesn't count)
  let x = el.offsetWidth / 2, y = el.offsetHeight / 2;
  for (let e = el; e && e !== root; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
  return [x, y];
};

export async function mailMontage({ room, screen, desktop, audio, overlay, film, mails }) {
  const wins = [];
  for (const [i, m] of mails.entries()) {
    const body = Object.assign(document.createElement('div'), { className: 'mailview' });
    body.innerHTML = `<table><tr><th>From:</th><td>${esc(m.from)}</td></tr><tr><th>To:</th><td>${esc(m.to)}</td></tr>`
      + `<tr><th>Date:</th><td>${esc(m.date)}</td></tr><tr><th>Subject:</th><td>${esc(m.subject)}</td></tr></table>`
      + `<pre>${esc(m.body).replace(/\[\[(.+?)\]\]/g, '<mark>$1</mark>')}</pre>`;
    wins.push(desktop.wm.open({ id: `mail${i}`, title: `${m.subject} - Kestrel Mail`, x: m.x, y: m.y, width: m.w, height: m.h, content: body, closable: false, resizable: false }));
    audio.sfx('mouse_click', { gain: 0.5, rate: 0.9 + i * 0.05 });
    if (i % 2) audio.sfx('hdd_seek', { gain: 0.18 });
    await sleep(380);
  }
  setPcHum(audio, HUM * 2.6, { fade: 2 }); // the machine is working: the hum leans in
  await sleep(900);

  const tube = Object.assign(document.createElement('div'), { className: 'crt-close' });
  overlay.append(tube);
  const breathe = room.rig.breathe;
  room.rig.breathe = 0.2; // the camera's idle breathing would swing a close-up off the words
  for (const [i, w] of wins.entries()) {
    const shot = SHOTS[i % SHOTS.length];
    w.focus();
    const mark = w.body.querySelector('mark');
    const [x, y] = deskXY(mark, desktop.wm.get(w.id).el.parentElement);
    const p = screen.pointPose(x, y, shot.dist, shot.off);
    room.setPose(p); // a cut, not a move
    gsap.to(room.rig.pos, { x: p.pos.x + shot.drift[0], y: p.pos.y + shot.drift[1], duration: shot.hold, ease: 'none' });
    await sleep(500);
    mark.classList.add('on'); // she selects it, like a mouse drag
    audio.sfx('mouse_click', { gain: 0.15, rate: 1.2 }); // barely: the room has gone quiet
    await sleep(shot.hold * 1000 - 500);
    gsap.killTweensOf(room.rig.pos);
  }
  room.rig.breathe = breathe;
  tube.remove();
}

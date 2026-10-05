import { gsap } from 'gsap';
// The desktop: wallpaper, icons, taskbar with live story clock, Start menu, and global input sounds.
import { createWindowManager } from './windows.js';
import { formatClock, keySound, transferPct } from './desktop.logic.js';
import { ICONS } from './icons.js';
import { openSettings } from './apps/settings.js';

export function createDesktop({ el, store, bus, audio }) {
  el.innerHTML = `
    <div class="desktop-icons"></div>
    <div class="windows"></div>
    <div class="taskbar">
      <button class="start-button"><img src="${ICONS.computer}" alt=""><b>Start</b></button>
      <div class="taskbar-items"></div>
      <div class="tray status-field-border"><img class="tray-modem" src="${ICONS.modem}" alt="" hidden><span class="tray-transfer" hidden title="Receiving FRAG01.BIN from KESTREL"><img src="${ICONS.modem}" alt=""><span></span></span><span class="clock"></span></div>
    </div>
    <div class="start-menu window" hidden>
      <div class="start-banner"><span>DOOR</span><b>98</b></div>
      <ul class="start-items"></ul>
    </div>
    <div class="crt-glass"></div>`;
  const wm = createWindowManager({ root: el.querySelector('.windows'), taskbar: el.querySelector('.taskbar-items'), desktopEl: el });
  const apps = new Map();
  const iconsEl = el.querySelector('.desktop-icons');
  const menu = el.querySelector('.start-menu');
  const items = el.querySelector('.start-items');

  const clock = el.querySelector('.clock');
  const renderClock = () => { clock.textContent = formatClock(store.get('clock')); };
  renderClock();
  bus.on('state:change', ({ path }) => { if (path === 'clock') renderClock(); });
  bus.on('state:replace', renderClock);
  bus.on('modem:active', (on) => { el.querySelector('.tray-modem').hidden = !on; });
  const transfer = el.querySelector('.tray-transfer');
  const transferText = transfer.querySelector('span');
  let transferTimer = 0;
  const showTransfer = (on) => {
    clearInterval(transferTimer);
    if (on) {
      const t0 = Date.now();
      const draw = () => { transferText.textContent = `FRAG01.BIN ${transferPct((Date.now() - t0) / 1000)}%`; };
      draw();
      transferTimer = setInterval(draw, 1000);
      transfer.hidden = false;
    } else if (!transfer.hidden) {
      transferText.textContent = 'FRAG01.BIN 100%';
      setTimeout(() => { transfer.hidden = true; }, 2500);
    }
  };
  bus.on('state:change', ({ path, value }) => { if (path === 'flags.downloading') showTransfer(value === true); });
  bus.on('state:replace', (s) => showTransfer(s.flags?.downloading === true));

  el.addEventListener('pointerdown', () => audio.sfx('mouse_click', { gain: 0.45 }));
  el.addEventListener('keydown', (e) => { if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') audio.sfx(keySound(e.key), { gain: 0.55, detune: Math.random() * 60 - 30 }); });

  const toggleMenu = (show = menu.hidden) => { menu.hidden = !show; };
  el.querySelector('.start-button').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
  el.addEventListener('click', (e) => { if (!menu.contains(e.target)) toggleMenu(false); });

  let systemItems = null; // Settings / Shut Down stay at the bottom, like Win98
  function addMenuItem(label, icon, onClick, disabled = false, before = systemItems) {
    const li = document.createElement('li');
    li.innerHTML = `<img src="${icon}" alt=""><span></span>`;
    li.querySelector('span').textContent = label;
    if (disabled) li.classList.add('disabled');
    else li.addEventListener('click', () => { toggleMenu(false); onClick(); });
    items.insertBefore(li, before);
    return li;
  }

  const desktop = {
    el, wm,
    registerApp(id, { title, icon, launch, onDesktop = true, onMenu = true, hidden = false }) {
      const run = () => { bus.emit('app:launch', id); launch?.(); };
      apps.set(id, { title, icon, launch: run });
      if (onMenu) addMenuItem(title, icon, run);
      if (!onDesktop) return;
      const b = document.createElement('button');
      b.className = 'desktop-icon';
      b.dataset.app = id;
      b.hidden = hidden;
      b.innerHTML = `<img src="${icon}" alt=""><span></span>`;
      b.querySelector('span').textContent = title;
      b.addEventListener('dblclick', run);
      b.addEventListener('click', () => {
        iconsEl.querySelectorAll('.desktop-icon').forEach((x) => x.classList.toggle('selected', x === b));
      });
      iconsEl.append(b);
    },
    launch(id) { apps.get(id)?.launch(); },
    // keep: hide the icon so showIcon can bring it back; otherwise it is gone for good.
    hideIcon(id, { duration = 0.9, keep = false } = {}) {
      const b = iconsEl.querySelector(`[data-app="${id}"]`);
      if (!b) return Promise.resolve();
      return gsap.to(b, { opacity: 0, filter: 'blur(3px) brightness(2)', y: -4, duration, ease: 'power2.in' }).then(() => {
        if (keep) { b.hidden = true; gsap.set(b, { clearProps: 'all' }); return; }
        b.remove();
        apps.delete(id);
      });
    },
    rename(id, { title, icon }) {
      const b = iconsEl.querySelector(`[data-app="${id}"]`);
      if (b) { b.querySelector('span').textContent = title; if (icon) b.querySelector('img').src = icon; }
      if (apps.has(id)) Object.assign(apps.get(id), { title }, icon && { icon });
    },
    showIcon(id, { duration = 1.2 } = {}) {
      const b = iconsEl.querySelector(`[data-app="${id}"]`);
      if (!b) return Promise.resolve();
      b.hidden = false;
      return gsap.fromTo(b, { opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)', duration, ease: 'power2.out', clearProps: 'filter' }).then(() => {});
    },
  };
  systemItems = addMenuItem('Settings', ICONS.gear, () => openSettings({ wm, store, audio }));
  addMenuItem('Shut Down...', ICONS.computer, () => {}, true, null);
  return desktop;
}

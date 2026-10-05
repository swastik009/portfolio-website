// install.exe installs itself, Win98 Setup style: files nobody has heard of, and a bar that stalls just short of the end.
import { gsap } from 'gsap';
import { ICONS } from '../icons.js';

const FILES = ['SETUP.INF', 'BELL1892.VXD', 'HUM.DLL', 'WAKE.SYS', 'ECHO.386', 'KEYS.INF', 'MEMORY.DAT', 'DAISY.DRV', 'ME.BIN'];

export function runInstall({ wm, audio }) {
  const body = document.createElement('div');
  body.className = 'download install';
  body.innerHTML = `<p>Setup is installing <b>untitled</b> on your computer.</p><p class="dl-left">Copying files...</p>
    <div class="progress-indicator segmented"><span class="progress-indicator-bar" style="width:0%"></span></div>
    <p class="inst-file">C:\\WINDOWS\\SYSTEM\\</p>`;
  wm.open({ id: 'install', title: 'untitled Setup', icon: ICONS.unknown, width: 400, height: 180, closable: false, resizable: false, content: body });
  audio.sfx('mouse_click', { gain: 0.5 });
  const drive = audio.sfx('dl_loop', { gain: 0.35, loop: true });
  const bar = body.querySelector('.progress-indicator-bar');
  const file = body.querySelector('.inst-file');
  const p = { v: 0 };
  const draw = () => {
    bar.style.width = `${Math.floor(p.v)}%`;
    file.textContent = `C:\\WINDOWS\\SYSTEM\\${FILES[Math.min(FILES.length - 1, Math.floor((p.v / 100) * FILES.length))]}`;
  };
  return gsap.timeline({ onUpdate: draw })
    .to(p, { v: 64, duration: 3.2, ease: 'none' })
    .call(() => audio.sfx('hdd_seek', { gain: 0.4 }))
    .to(p, { v: 97, duration: 2.6, ease: 'none' })
    .call(() => audio.sfx('hdd_seek', { gain: 0.5, rate: 0.8 }))
    .to(p, { v: 97, duration: 1.8 }) // the stall
    .to(p, { v: 100, duration: 0.3, ease: 'none' })
    .then(() => {
      drive?.stop();
      wm.close('install');
    });
}

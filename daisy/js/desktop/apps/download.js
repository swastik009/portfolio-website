// Win98 "File Download": the drive chatters, the bar crawls, the file lands on C:. Emits download:done once per file.
import { gsap } from 'gsap';
import { ICONS } from '../icons.js';
import { downloadGuard } from './voyager.logic.js';

const guard = downloadGuard();
export function openDownload({ wm, bus, audio }, { file, host, seconds = 16 }) {
  if (wm.isOpen('download')) { wm.focus('download'); return Promise.resolve(); }
  if (!guard.start(file)) return Promise.resolve();
  const body = document.createElement('div');
  body.className = 'download';
  body.innerHTML = `<p>Saving:</p><p><b></b> from <span></span></p>
    <div class="progress-indicator segmented"><span class="progress-indicator-bar" style="width:0%"></span></div>
    <p class="dl-left">Estimated time left: calculating...</p><p>Download to: C:\\</p>`;
  body.querySelector('b').textContent = file;
  body.querySelector('span').textContent = host;
  wm.open({ id: 'download', title: `0% of ${file}`, icon: ICONS.voyager, width: 400, height: 210, closable: false, resizable: false, content: body });
  bus.emit('modem:active', true);
  audio.sfx('mouse_click', { gain: 0.5 });
  const drive = audio.sfx('dl_loop', { gain: 0.45, loop: true });
  const bar = body.querySelector('.progress-indicator-bar');
  const left = body.querySelector('.dl-left');
  const p = { v: 0 };
  return gsap.to(p, { v: 100, duration: seconds, ease: 'none', onUpdate: () => {
    const pct = Math.floor(p.v);
    bar.style.width = `${pct}%`;
    wm.get('download')?.setTitle(`${pct}% of ${file}`);
    left.textContent = `Estimated time left: ${Math.ceil(seconds * (1 - p.v / 100))} sec (2.8 KB/sec)`;
  } }).then(() => {
    drive?.stop();
    bus.emit('modem:active', false);
    wm.close('download');
    bus.emit('download:done', { file });
  });
}

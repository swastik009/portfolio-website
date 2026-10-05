// WinZap: a .zip extracts file by file, the drive chattering, and gives up at 98% on a bad CRC. Every zip he owns is
// broken; it's 1999 and they came off a 28.8 connection.
import { gsap } from 'gsap';
import { ICONS } from '../icons.js';

export function openZip({ wm, audio }, name, files) {
  if (wm.isOpen('winzap')) { wm.focus('winzap'); return Promise.resolve(); }
  const body = document.createElement('div');
  body.className = 'download';
  body.innerHTML = `<p>Extracting from <b></b></p><p class="dl-left">to C:\\TEMP\\</p>
    <div class="progress-indicator segmented"><span class="progress-indicator-bar" style="width:0%"></span></div><p class="inst-file"></p>`;
  body.querySelector('b').textContent = name;
  wm.open({ id: 'winzap', title: `WinZap - ${name}`, icon: ICONS.disk, width: 400, height: 170, closable: false, resizable: false, content: body });
  audio.sfx('mouse_click', { gain: 0.5 });
  const drive = audio.sfx('dl_loop', { gain: 0.3, loop: true });
  const bar = body.querySelector('.progress-indicator-bar');
  const file = body.querySelector('.inst-file');
  const p = { v: 0 };
  const bad = files.at(-1);
  return gsap.timeline({ onUpdate: () => {
    bar.style.width = `${Math.floor(p.v)}%`;
    file.textContent = `inflating: ${files[Math.min(files.length - 1, Math.floor((p.v / 98) * files.length))]}`;
  } })
    .to(p, { v: 98, duration: 4.5, ease: 'none' })
    .to(p, { v: 98, duration: 1.4 }) // it sits there
    .then(async () => {
      drive?.stop();
      audio.sfx('error_ding', { gain: 0.6 });
      await wm.alert({ id: 'winzap-err', title: 'WinZap', icon: ICONS.error,
        text: `CRC error in ${bad}.\nbad CRC 7d1e94b3 (should be 08f6c2a1)\n\nThe archive ${name} is damaged. Extraction aborted.` });
      wm.close('winzap');
    });
}

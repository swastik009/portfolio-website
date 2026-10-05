// The Recycle Bin, details view: what he threw away this week. Double-click shows a file's properties (deleted files
// don't open), except a zip, which WinZap still tries to extract.
import { ICONS } from '../icons.js';
import { openZip } from './zip.js';

export function openRecycle({ wm, audio }, items) {
  if (wm.isOpen('recycle')) { wm.focus('recycle'); return; }
  const body = document.createElement('div');
  body.className = 'recycle';
  body.innerHTML = `<div class="rc-list"><table><thead><tr><th>Name</th><th>Original Location</th><th>Date Deleted</th><th>Size</th></tr></thead><tbody></tbody></table></div>
    <div class="mc-status"><span>${items.length} object(s)</span><span></span></div>`;
  const tbody = body.querySelector('tbody');
  for (const it of items) {
    const tr = document.createElement('tr');
    for (const [i, v] of [it.name, it.from, it.deleted, it.size].entries()) {
      const td = document.createElement('td');
      if (i === 0) td.innerHTML = `<img src="${it.zip ? ICONS.disk : /\.exe$/i.test(it.name) ? ICONS.program : ICONS.text}" alt="">`;
      td.append(v);
      tr.append(td);
    }
    tr.addEventListener('click', () => tbody.querySelectorAll('tr').forEach((x) => x.classList.toggle('selected', x === tr)));
    tr.addEventListener('dblclick', () => {
      if (it.zip) { openZip({ wm, audio }, it.name, it.zip); return; }
      audio.sfx('mouse_click', { gain: 0.5 });
      wm.alert({ id: 'recycle-props', title: `${it.name} Properties`, text: `${it.name}\nOrigin: ${it.from}\nDeleted: ${it.deleted}\nSize: ${it.size}\n\nRestore the file to open it.`, icon: ICONS.recycle });
    });
    tbody.append(tr);
  }
  wm.open({ id: 'recycle', title: 'Recycle Bin', icon: ICONS.recycle, width: 560, height: 300, x: 120, y: 90, content: body });
}

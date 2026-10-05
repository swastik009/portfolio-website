// My Computer, Win98 web view: drives and system folders, an info pane on the left (a drive shows its capacity pie),
// a status bar. Text files open read-only in Notepad, pictures in Imaging; dead ends answer with a message box.
import { ICONS } from '../icons.js';
import { entries, address, usage } from './mycomp.logic.js';
import { openZip } from './zip.js';

const DRIVE_TYPE = { disk: '3½-Inch Floppy Disk', hdd: 'Local Disk', cdrom: 'CD-ROM Disc' };
const iconOf = (e) => (e.kind === 'zip' ? ICONS.disk : e.kind === 'text' ? (/\.EXE$/i.test(e.name) ? ICONS.program : ICONS.text) : e.kind === 'image' ? ICONS.pictures
  : ICONS[e.node._icon] ?? (e.kind === 'error' ? ICONS.program : ICONS.folder));
const typeOf = (e, top) => DRIVE_TYPE[e.node?._icon] ?? (e.kind === 'zip' ? 'WinZap File' : e.kind === 'image' ? 'Bitmap Image' : e.kind === 'text' ? (/\.EXE$/i.test(e.name) ? 'Application' : 'Text Document')
  : top ? 'System Folder' : e.kind === 'folder' ? 'File Folder' : 'Shortcut');

export function openImage({ wm, audio }, name, node) {
  const body = document.createElement('div');
  body.className = 'imaging';
  body.innerHTML = '<div class="im-view"><img alt=""></div><p class="im-status"></p>';
  const img = body.querySelector('img');
  const status = body.querySelector('.im-status');
  img.addEventListener('load', () => { status.textContent = `${name}   ${img.naturalWidth} x ${img.naturalHeight}   ${node._taken ?? ''}`; });
  img.addEventListener('error', () => { img.remove(); status.textContent = `Imaging cannot open ${name}. The file may be damaged.`; });
  img.src = node._image;
  audio.sfx('hdd_seek', { gain: 0.2 });
  wm.close(`img-${name}`);
  wm.open({ id: `img-${name}`, title: `Imaging - ${name}`, icon: ICONS.pictures, width: 560, height: 470, content: body });
}

export function openMyComp({ wm, audio, tree }, { at = [], id = 'mycomp' } = {}) {
  if (wm.isOpen(id)) { wm.focus(id); return; }
  const body = document.createElement('div');
  body.className = 'mycomp';
  body.innerHTML = `<div class="mc-bar"><button class="mc-up">Up</button><span class="mc-addr">Address</span><span class="mc-path"></span></div>
    <div class="mc-main"><aside class="mc-info"><img alt=""><h3></h3><div class="mc-desc"></div></aside><div class="mc-view"></div></div>
    <div class="mc-status"><span></span><span></span></div>`;
  const $ = (s) => body.querySelector(s);
  const view = $('.mc-view');
  let path = [...at];
  let win = null;
  const nodeAt = (p) => p.reduce((n, k) => n[k], tree);
  const here = () => (path.length ? nodeAt(path)._label ?? path.at(-1) : 'My Computer');
  const [left, right] = body.querySelectorAll('.mc-status span');

  function describe(e) {
    const desc = $('.mc-desc');
    desc.replaceChildren();
    right.textContent = '';
    if (!e) { desc.textContent = path.length ? 'Select an item to view its description.' : 'Displays the contents of your computer.'; return; }
    const add = (t, cls) => desc.append(Object.assign(document.createElement('p'), { textContent: t, className: cls ?? '' }));
    add(e.label, 'mc-name');
    add(typeOf(e, !path.length));
    if (e.node?._capacity) {
      const u = usage(e.node);
      add(`Used: ${u.used} GB`, 'mc-used');
      add(`Free: ${u.free} GB`, 'mc-free');
      add(`Capacity: ${u.capacity} GB`);
      const pie = Object.assign(document.createElement('div'), { className: 'mc-pie' });
      pie.style.setProperty('--used', `${u.pct}%`);
      desc.append(pie);
      right.textContent = `Free Space: ${u.free}GB, Capacity: ${u.capacity}GB`;
    } else if (e.kind === 'image') add(`Taken: ${e.node._taken}`);
    else if (e.kind === 'text') add(`Size: ${Math.max(1, Math.round(e.node.length / 1024))}KB`);
  }

  function open(e) {
    audio.sfx('hdd_seek', { gain: 0.15 });
    if (e.kind === 'folder') { path = [...path, e.name]; render(); return; }
    if (e.kind === 'image') { openImage({ wm, audio }, e.name, e.node); return; }
    if (e.kind === 'zip') { openZip({ wm, audio }, e.name, e.node._zip); return; }
    if (e.kind === 'error' || /\.EXE$/i.test(e.name)) {
      audio.sfx('error_ding', { gain: 0.5 });
      wm.alert({ id: `${id}-msg`, title: e.label, text: e.node._error ?? `${e.name} must be run from DS-DOS.`, icon: ICONS.error });
      return;
    }
    const ta = Object.assign(document.createElement('textarea'), { readOnly: true, value: e.node, spellcheck: false, className: 'notepad' });
    wm.close(`note-${e.name}`);
    wm.open({ id: `note-${e.name}`, title: `${e.name} - Notepad`, width: 540, height: 340, content: ta });
  }

  function render() {
    $('.mc-path').textContent = address(path);
    $('.mc-info img').src = path.length ? ICONS[nodeAt(path)._icon] ?? ICONS.folder : ICONS.computer;
    $('.mc-info h3').textContent = here();
    win?.setTitle(here());
    const list = entries(path.length ? nodeAt(path) : tree);
    left.textContent = `${list.length} object(s)`;
    describe(null);
    view.replaceChildren(...list.map((e) => {
      const b = document.createElement('button');
      b.className = 'desktop-icon';
      b.innerHTML = `<img src="${iconOf(e)}" alt=""><span></span>`;
      b.querySelector('span').textContent = e.label;
      b.addEventListener('click', () => { view.querySelectorAll('.desktop-icon').forEach((x) => x.classList.toggle('selected', x === b)); describe(e); });
      b.addEventListener('dblclick', () => open(e));
      return b;
    }));
  }
  $('.mc-up').addEventListener('click', () => { if (path.length) { path = path.slice(0, -1); render(); } });
  win = wm.open({ id, title: here(), icon: path.length ? ICONS.folder : ICONS.computer, width: 600, height: 400, x: 60, y: 60, content: body });
  render();
}

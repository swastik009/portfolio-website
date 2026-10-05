// Win98 window manager on top of 98.css markup: focus/z-order, drag (corrected for the CSS3D scale), minimise to taskbar.
import { gsap } from 'gsap';
import { bringToFront, clampSize, allowClose, fitPosition } from './windows.logic.js';

export function createWindowManager({ root, taskbar, desktopEl }) {
  const wins = new Map();
  let order = [];

  function restack() {
    order.forEach((id, i) => {
      const w = wins.get(id);
      const active = i === order.length - 1 && !w.minimized;
      w.el.style.zIndex = String(10 + i);
      w.el.querySelector('.title-bar').classList.toggle('inactive', !active);
      w.btn.classList.toggle('active', active);
    });
  }

  function focus(id) {
    const w = wins.get(id);
    if (!w) return;
    if (w.minimized) { w.minimized = false; w.el.style.display = ''; }
    w.btn.classList.remove('tb-flash');
    order = bringToFront(order, id);
    restack();
  }

  function minimize(id) {
    const w = wins.get(id);
    if (!w) return;
    w.minimized = true;
    w.el.style.display = 'none';
    restack();
  }

  function close(id) {
    const w = wins.get(id);
    if (!w) return;
    w.el.remove();
    w.btn.remove();
    wins.delete(id);
    order = order.filter((x) => x !== id);
    restack();
    w.onClose?.();
  }

  function makeDraggable(w) {
    const bar = w.el.querySelector('.title-bar');
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      focus(w.id);
      // Pointer deltas are in screen px; the desktop is scaled by CSS3D, so convert to desktop px.
      const ratio = desktopEl.offsetWidth / desktopEl.getBoundingClientRect().width;
      const sx = e.clientX, sy = e.clientY;
      const ox = w.el.offsetLeft, oy = w.el.offsetTop;
      bar.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const p = fitPosition(ox + (ev.clientX - sx) * ratio, oy + (ev.clientY - sy) * ratio, w.el.offsetWidth, w.el.offsetHeight,
          { w: desktopEl.offsetWidth, h: desktopEl.offsetHeight, taskbar: 28 });
        w.el.style.left = `${p.x}px`;
        w.el.style.top = `${p.y}px`;
      };
      const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
  }

  // Win98 size grip: grows/shrinks from the bottom-right, never below ~60% of the designed size
  // and never past the desktop edges.
  function makeResizable(w, width, height) {
    const grip = document.createElement('div');
    grip.className = 'resize-grip';
    w.el.append(grip);
    const lim = { minW: Math.max(200, Math.round(width * 0.6)), minH: Math.max(120, Math.round(height * 0.6)) };
    grip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      focus(w.id);
      const ratio = desktopEl.offsetWidth / desktopEl.getBoundingClientRect().width;
      const sx = e.clientX, sy = e.clientY;
      const ow = w.el.offsetWidth, oh = w.el.offsetHeight;
      grip.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const s = clampSize(ow + (ev.clientX - sx) * ratio, oh + (ev.clientY - sy) * ratio, {
          ...lim,
          maxW: desktopEl.offsetWidth - w.el.offsetLeft - 4,
          maxH: desktopEl.offsetHeight - 28 - w.el.offsetTop - 4,
        });
        w.el.style.width = `${s.w}px`;
        w.el.style.height = `${s.h}px`;
      };
      const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }

  function open({ id, title, icon = '', width = 420, height = 300, x, y, content, closable = true, resizable = true, onClose, onCloseRequest, onHelp, className }) {
    if (wins.has(id)) { focus(id); return wins.get(id).api; }
    const el = document.createElement('div');
    el.className = 'window';
    if (className) el.classList.add(className);
    el.dataset.id = id;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    const cascade = wins.size * 26;
    const at = fitPosition(x ?? Math.round((1024 - width) / 2) + cascade, y ?? Math.max(10, Math.round((740 - height) / 2) - 40) + cascade,
      width, height, { w: desktopEl.offsetWidth || 1024, h: desktopEl.offsetHeight || 768, taskbar: 28 });
    el.style.left = `${at.x}px`;
    el.style.top = `${at.y}px`;
    el.innerHTML = `
      <div class="title-bar">
        <div class="title-bar-text"></div>
        <div class="title-bar-controls">
          ${onHelp ? '<button aria-label="Help"></button>' : ''}
          <button aria-label="Minimize"></button>
          ${closable ? '<button aria-label="Close"></button>' : ''}
        </div>
      </div>
      <div class="window-body"></div>`;
    const text = el.querySelector('.title-bar-text');
    const setTitle = (t) => {
      text.textContent = t;
      if (icon) text.insertAdjacentHTML('afterbegin', `<img class="title-icon" src="${icon}" alt="">`);
      btn.querySelector('span').textContent = t;
    };
    const body = el.querySelector('.window-body');
    if (content) body.append(content);
    const btn = document.createElement('button');
    btn.className = 'taskbar-button';
    btn.innerHTML = `${icon ? `<img src="${icon}" alt="">` : ''}<span></span>`;
    btn.addEventListener('click', () => {
      const w = wins.get(id);
      if (!w.minimized && order.at(-1) === id) minimize(id);
      else focus(id);
    });
    taskbar.append(btn);
    root.append(el);
    el.addEventListener('pointerdown', () => focus(id));
    el.querySelector('[aria-label="Minimize"]').addEventListener('click', () => minimize(id));
    el.querySelector('[aria-label="Close"]')?.addEventListener('click', () => { if (allowClose(wins.get(id))) close(id); });
    el.querySelector('[aria-label="Help"]')?.addEventListener('click', () => onHelp());
    const api = {
      id, el, body,
      close: () => close(id),
      focus: () => focus(id),
      setTitle,
      flash: () => { if (order.at(-1) !== id || wins.get(id).minimized) btn.classList.add('tb-flash'); },
    };
    const w = { id, el, btn, api, minimized: false, onClose, onCloseRequest };
    wins.set(id, w);
    setTitle(title);
    makeDraggable(w);
    if (resizable) makeResizable(w, width, height);
    focus(id);
    gsap.from(el, { scale: 0.94, opacity: 0, duration: 0.12, ease: 'power1.out' });
    return api;
  }

  // A Win98 message box: icon, one line of text, OK. Resolves when it closes.
  function alert({ id = 'alert', title, text, icon = '' }) {
    return new Promise((resolve) => {
      const body = document.createElement('div');
      body.className = 'msgbox';
      body.innerHTML = `<div class="msgbox-row">${icon ? `<img src="${icon}" alt="">` : ''}<p></p></div><div class="msgbox-actions"><button>OK</button></div>`;
      body.querySelector('p').textContent = text;
      const w = open({ id, title, width: 440, height: 110 + 15 * text.split('\n').length, content: body, resizable: false, onClose: resolve });
      const ok = body.querySelector('button');
      ok.addEventListener('click', () => w.close());
      ok.focus({ preventScroll: true });
    });
  }

  return { open, close, alert, focus, minimize, get: (id) => wins.get(id)?.api ?? null, isOpen: (id) => wins.has(id), isMinimized: (id) => wins.get(id)?.minimized === true };
}

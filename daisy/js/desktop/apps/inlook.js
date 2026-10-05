// Inlook: his 1997 mail client (folders on the left, the message list on top, the open message below).
// Read-only: nothing can be sent, the modem is not dialed. Messages live in data/inlook.json.
import { ICONS } from '../icons.js';

export function openInlook({ wm, audio }, mail) {
  if (wm.isOpen('inlook')) { wm.focus('inlook'); return; }
  const body = document.createElement('div');
  body.className = 'inlook';
  body.innerHTML = `<div class="il-tools">${['New Mail', 'Reply', 'Reply All', 'Forward', 'Delete', 'Send/Recv'].map((t) => `<button>${t}</button>`).join('')}</div>
    <div class="il-main"><ul class="il-folders"></ul>
      <div class="il-right"><div class="rc-list il-list"><table><thead><tr><th>From</th><th>Subject</th><th>Received</th></tr></thead><tbody></tbody></table></div>
        <div class="il-read"><div class="il-head"></div><pre class="il-body"></pre></div></div></div>
    <div class="mc-status"><span></span><span>Account suspended</span></div>`;
  const $ = (s) => body.querySelector(s);
  const read = new Set();
  let folder = mail.folders[0];
  let win = null;

  for (const t of body.querySelectorAll('.il-tools button')) {
    t.addEventListener('click', () => {
      audio.sfx('mouse_click', { gain: 0.5 });
      audio.sfx('error_ding', { gain: 0.5 });
      wm.alert({ id: 'inlook-err', title: 'Inlook', text: 'BuffNet could not log you on.\n\nYour account is suspended for non-payment (balance due: $59.85).\nCall BuffNet Billing at 555-0199 to restore service.', icon: ICONS.error });
    });
  }

  function showFolders() {
    $('.il-folders').replaceChildren(...mail.folders.map((f) => {
      const li = document.createElement('li');
      const unread = mail.messages.filter((m) => m.folder === f && m.unread && !read.has(m)).length;
      li.textContent = unread ? `${f} (${unread})` : f;
      li.classList.toggle('on', f === folder);
      li.classList.toggle('bold', unread > 0);
      li.addEventListener('click', () => { audio.sfx('mouse_click', { gain: 0.4 }); folder = f; win?.setTitle(`${f} - Inlook`); showFolders(); showList(); });
      return li;
    }));
  }

  function open(m, tr) {
    read.add(m);
    tr.classList.remove('unread');
    $('.il-list').querySelectorAll('tr').forEach((x) => x.classList.toggle('selected', x === tr));
    const head = $('.il-head');
    head.replaceChildren();
    for (const [k, v] of [['From', `${m.from} <${m.address}>`], ['To', m.to], ['Sent', m.date], ['Subject', m.subject]]) {
      const p = document.createElement('p');
      p.append(Object.assign(document.createElement('b'), { textContent: `${k}: ` }), v);
      head.append(p);
    }
    $('.il-body').textContent = m.body;
    showFolders();
  }

  function showList() {
    const items = mail.messages.filter((m) => m.folder === folder);
    $('.il-list tbody').replaceChildren(...items.map((m) => {
      const tr = document.createElement('tr');
      tr.classList.toggle('unread', m.unread && !read.has(m));
      for (const v of [m.from, m.subject, m.date]) tr.append(Object.assign(document.createElement('td'), { textContent: v }));
      tr.addEventListener('click', () => { audio.sfx('mouse_click', { gain: 0.4 }); open(m, tr); });
      return tr;
    }));
    $('.il-head').replaceChildren();
    $('.il-body').textContent = items.length ? '' : 'There are no items in this view.';
    $('.mc-status span').textContent = `${items.length} message(s)`;
  }

  showFolders();
  showList();
  win = wm.open({ id: 'inlook', title: `${folder} - Inlook`, icon: ICONS.inlook, width: 720, height: 440, x: 60, y: 40, content: body });
}

// Logged into KESTREL as K. Patel. Daisy feels a heavy piece of itself "where the printer forgets". Find it, read it.
// The sysadmin may ask who you are; how you answer shapes the rest of the hunt. He calls the moment you leave Patel's
// STUDENTS tree; Daisy stops you once first, to read the mail (the answers are in it). She talks it over when he hangs up.
import { createTerm } from '../desktop/term.js';
import { ICONS } from '../desktop/icons.js';
import { sameNumber } from './connect.logic.js';
import { parseDcl, resolvePath, nodeAt, resolveFile, formatPath, formatDir, leavesHome, listingLinks, completionNames, countdownLabel, crumb } from './vmshunt.logic.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HELP = `  ls               list this folder (or click a name)
  cd <folder>      go into a folder · cd .. goes back up
  cat <file>       read a file
  mail [n]         read Patel's mail
  finger [user]    who is logged in · finger jhalloran
  Tab completes names. Click any underlined name.`;

export default {
  id: 'vmshunt',
  title: 'KESTREL - VT220',
  icon: ICONS.terminal,
  window: { width: 740, height: 500 },
  async mount(body, ctx) {
    const p = ctx.params;
    const r = await fetch(p.fs);
    if (!r.ok) throw new Error(`cannot load ${p.fs}`);
    const fs = await r.json();
    body.classList.add('term-host');
    let cwd = [...p.start];
    let phoned = false;
    let warned = false;
    let mode = 'shell'; // 'shell' | 'dropped'
    let hovered = false;
    let deadline = 0;
    const started = Date.now();
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i].toUpperCase());
    const guide = {
      commands: ['ls', 'cd', 'cat', 'mail', 'finger', 'help', 'pwd'],
      names: () => completionNames(nodeAt(fs, cwd)),
      manual: [['ls', 'list'], ['cd <folder>', 'go in · cd .. back'], ['cat <file>', 'read'], ['mail', "Patel's mail"], ['finger <user>', 'who is that'], ['help', 'help']],
      onHover: (cmd) => {
        if (hovered || cmd !== 'cat daemon.log') return;
        hovered = true;
        ctx.chat.bark('log_hover');
      },
    };

    return new Promise((resolve) => {
      let term;
      const status = () => {
        const s = Math.floor((Date.now() - started) / 1000);
        const left = deadline ? `  ·  LINE CLOSING ${countdownLabel((deadline - Date.now()) / 1000)}` : '';
        term.setStatus(mode === 'dropped' ? 'NO CARRIER' : `KPATEL · 28800 bps · ${countdownLabel(s)}${left}`);
        if (deadline && Date.now() >= deadline) { deadline = 0; drop('Halloran closed the line.'); }
      };
      const statusTimer = setInterval(() => term && status(), 1000);
      const list = async (path) => {
        await term.print(formatDir(path, nodeAt(fs, path)), { links: listingLinks(path, nodeAt(fs, path)) });
        ctx.audio.sfx('hdd_seek', { gain: 0.25 });
      };
      async function drop(why) {
        mode = 'dropped';
        ctx.bus.emit('modem:active', false);
        await term.print(`\n${why}\nNO CARRIER\n`);
        term.setPrompt('nite-owl% ');
        term.setHeader('nite-owl · local');
        ctx.store.add('clock', 2);
      }
      // Before a step out of STUDENTS: Daisy warns once and holds you back; the next try brings Halloran first.
      // Resolves false when you stay put (warned, or burned and dropped).
      async function mayLeave(path) {
        if (phoned || !leavesHome(path, p.home)) return true;
        if (!warned) { warned = true; await ctx.chat.say(p.leaveWarning, 'broken'); return false; }
        phoned = true;
        const m = ctx.store.get('clock');
        await term.print(`\n%TALK-I-REQUEST, JHALLORAN@KESTREL requests a talk session   (31-DEC-1999 ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')})\n`);
        const res = await ctx.interrupt('phone');
        if (res?.outcome === 'burned') { await burnLog(); await drop('JHALLORAN has disconnected you.'); }
        await ctx.interrupt('shaken'); // Daisy, the moment he hangs up
        if (res?.outcome === 'suspicious') deadline = Date.now() + 180_000; // he is closing the dialup pool
        return mode === 'shell';
      }
      async function burnLog() {
        const log = nodeAt(fs, p.log.slice(0, -1)).files['DAEMON.LOG;1'];
        log.text += '\n31-DEC-1999 23:41:09  %DAEMON-W-WATCHED, the operator is now recording everything we type\n31-DEC-1999 23:41:09  %DAEMON-E-CORRUPT, ▒▒▒▒▒ ▓▓ ░░░░▒▒▒ ▓▓▓▓';
      }

      term = createTerm(body, { prompt: '$ ', audio: ctx.audio, guide, onLine: async (line) => {
        ctx.activity();
        if (mode === 'dropped') {
          const [w, ...rest] = line.trim().split(/\s+/);
          if (!/^(dial|call|atdt)$/i.test(w ?? '') || !sameNumber(rest.join(' '), p.number)) { await term.print(`the line is dead. dial ${p.number} to get back in.`); return; }
          ctx.bus.emit('modem:active', true);
          ctx.audio.sfx('modem_handshake', { gain: 0.5 });
          await sleep(4200);
          await term.print('CONNECT 28800\nUsername: KPATEL\nPassword: ********  (from the photo)\n');
          mode = 'shell';
          term.setPrompt('$ ');
          term.setHeader(crumb(cwd));
          return;
        }
        const c = parseDcl(line);
        if (!c) return;
        switch (c.verb) {
          case 'HELP':
            await term.print(HELP);
            break;
          case 'SHOW DEFAULT':
            await term.print(`  ${formatPath(cwd)}`);
            break;
          case 'DIRECTORY': {
            const arg = c.args.find((a) => !a.startsWith('-') && !a.includes('*'));
            const path = arg ? resolvePath(cwd, arg, fs) : cwd;
            if (!path) { await term.print('%DIRECT-W-NOFILES, no such folder (try: ls)'); break; }
            await list(path);
            break;
          }
          case 'SET DEFAULT': {
            const path = resolvePath(cwd, c.args[0] ?? '', fs);
            if (!path) { await term.print(`cd: ${c.args[0] ?? ''}: no such folder (try: ls)`); break; }
            if (!await mayLeave(path)) break;
            cwd = path;
            term.setHeader(crumb(cwd));
            await list(cwd); // arriving somewhere shows you what's there
            break;
          }
          case 'TYPE': {
            const name = c.args[0];
            if (!name) { await term.print('cat: which file? (click one, or: cat todo.txt)'); break; }
            const hit = resolveFile(cwd, name, fs);
            if (!hit) { await term.print(`cat: ${name}: no such file here (try: ls)`); break; }
            if (!await mayLeave(hit.path)) break; // reaching out with a path counts as leaving
            const here = [...hit.path, hit.name.split(';')[0]];
            if (same(here, p.log)) ctx.logOpened('vax');
            await term.print(hit.file.text, { speed: hit.file.blocks > 1000 ? 12 : 2 });
            if (same(here, p.target)) {
              ctx.audio.sfx('hdd_seek', { gain: 0.6 });
              clearInterval(statusTimer);
              await ctx.chat.say(`that is me. i am coming home, ${ctx.store.get('handle')}. slowly.`, 'broken');
              resolve();
            }
            break;
          }
          case 'MAIL': {
            const n = Number(c.args[0]);
            if (!n) await term.print(`MAIL for KPATEL (${p.mail.length} messages):\n${p.mail.map((m, i) => `  ${i + 1}  ${m.from.padEnd(30)} ${m.subject}`).join('\n')}\ntype: mail <n>`, { links: Object.fromEntries(p.mail.map((m, i) => [`  ${i + 1}  `, { cmd: `mail ${i + 1}` }])) });
            else if (p.mail[n - 1]) {
              const m = p.mail[n - 1];
              await term.print(`From: ${m.from}\nDate: ${m.date}\nSubject: ${m.subject}\n\n${m.body}\n`, { speed: 3 });
            } else await term.print(`mail: no message ${c.args[0]}`);
            break;
          }
          case 'FINGER': {
            const who = String(c.args[0] ?? '').split('@')[0].toLowerCase();
            if (!who) await term.print(`Login       TTY   Idle\n${p.users.map((u) => `${u.name.padEnd(12)}${u.tty.padEnd(6)}${u.idle}`).join('\n')}`);
            else if (p.plans[who]) await term.print(`Login: ${who}\nPlan:\n${p.plans[who]}`, { speed: 3 });
            else await term.print(`finger: ${who}: no such user.`);
            break;
          }
          case 'LOGOUT':
            await ctx.chat.say('not yet. please.', 'broken');
            break;
          default:
            await term.print(`${line.trim().split(/\s+/)[0]}: command not found (try: help)`);
        }
      } });
      term.setHeader(crumb(cwd));
      status();
      term.print('  Logged in as KPATEL.  Click names, or type. Tab completes.\n');
      list(cwd);
      term.focus();
    });
  },
};

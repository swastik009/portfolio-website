// Chapter 1's last door: the Cascadia Bell switch at the Harbor central office. Voyager finds the number and the
// login; the terminal dials it. Meanwhile the fragment from KESTREL keeps crawling in through the tray.
import { createTerm } from '../desktop/term.js';
import { ICONS } from '../desktop/icons.js';
import { parseLocal, checkLogin, isTelnetEscape } from './vaxlogin.logic.js';
import { sameNumber } from './connect.logic.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOCAL_PROMPT = 'nite-owl% ';
export const CASCADIA_LOGO = String.raw`
            .-~~~-.
           /  ___  \          C A S C A D I A    B E L L
          |  /   \  |         Harbor Central Office
          |  \___/  |         CBX-7 digital switch  ·  generic 7.4
           \       /
         ___'-----'___        MAINTENANCE PORT
        (_____________)       unauthorized access is a federal offense
               (o)
`;

export default {
  id: 'telco',
  title: 'Terminal - nite-owl',
  icon: ICONS.terminal,
  window: { width: 680, height: 450 },
  mount(body, ctx) {
    const p = ctx.params;
    const desktop = ctx.world?.desktop;
    body.classList.add('term-host');
    desktop?.showIcon('voyager');
    setTimeout(() => desktop?.launch('voyager'), 700); // "i opened a browser for you"
    let mode = 'local';
    let user = '';
    let fails = 0;
    let nudged = false;
    const clues = new Set();
    const offVisit = ctx.bus.on('voyager:visit', ({ clue }) => {
      ctx.activity();
      if (clue) clues.add(clue);
      if (nudged || !p.clues.every((c) => clues.has(c))) return;
      nudged = true;
      // visiting is not knowing: point at where the pieces hide instead of claiming the player has them
      ctx.chat.say('every page that matters is behind you now. the door is in them. some of it hides in plain sight. some in the source.', 'broken');
    });
    const guide = {
      commands: ['dial', 'help', 'clear'],
      names: () => [],
      manual: [['dial <number>', 'call a modem'], ['help', 'what works here'], ['clear', 'clean the screen']],
    };
    return new Promise((resolve) => {
      const term = createTerm(body, { prompt: LOCAL_PROMPT, audio: ctx.audio, guide, onLine: async (line) => {
        ctx.activity();
        if (mode !== 'local' && isTelnetEscape(line)) {
          mode = 'local';
          term.setPrompt(LOCAL_PROMPT);
          term.setMasked(false);
          ctx.bus.emit('modem:active', false);
          await term.print('NO CARRIER');
          term.setStatus('offline');
          return;
        }
        if (mode === 'user') {
          user = line;
          mode = 'pass';
          term.setPrompt('Password: ');
          term.setMasked(true);
          return;
        }
        if (mode === 'pass') {
          term.setMasked(false);
          await sleep(1100);
          if (checkLogin(user, line, p)) {
            await term.print(`\n${p.host} HARBOR CO  ·  MAINT SESSION 0047\nLAST LOGIN 20-DEC-99 03:12 FROM CONSOLE\n`, { speed: 8 });
            offVisit();
            await ctx.chat.say('now let me in.', 'broken');
            await term.flow(p.flourish);
            await term.print('%SPLICE-I-OK, 1 fragment held in CBX-7 line memory', { speed: 10 });
            ctx.store.set('flags.downloading', false); // the transfer completes when the splice lands
            await sleep(700);
            resolve();
            return;
          }
          fails++;
          await term.print('LOGIN INCORRECT\n');
          if (fails === 3) ctx.chat.say('the old post. the office name, then the number of the switch.', 'broken');
          mode = 'user';
          term.setPrompt('login: ');
          return;
        }
        const c = parseLocal(line);
        if (!c) return;
        switch (c.cmd) {
          case 'help':
            await term.print('  dial <number>   call a modem\n  clear           clean the screen');
            break;
          case 'clear':
            term.clear();
            break;
          case 'telnet':
          case 'finger':
            await term.print(`${c.cmd}: no network. you are on a 28.8 modem. use: dial <number>`);
            break;
          case 'dial': {
            const num = c.args.join(' ');
            if (!num) { await term.print('dial: which number?'); break; }
            await term.print(`ATDT ${num}`);
            if (sameNumber(num, p.kestrel)) { await sleep(1200); await term.print('BUSY  (that line is still sending you something. look at the tray.)'); break; }
            ctx.bus.emit('modem:active', true);
            if (!sameNumber(num, p.number)) {
              await sleep(2400);
              ctx.bus.emit('modem:active', false);
              await term.print('NO CARRIER');
              break;
            }
            ctx.audio.sfx('modem_handshake', { gain: 0.6 });
            await sleep(5200);
            await term.print('CONNECT 9600');
            term.setStatus(`${p.host} · 9600 bps`);
            await term.print(CASCADIA_LOGO, { speed: 3 });
            mode = 'user';
            term.setPrompt('login: ');
            break;
          }
          default:
            await term.print(`${c.cmd}: command not found (try help)`);
        }
      } });
      term.setHeader('nite-owl · local');
      term.setStatus('offline');
      term.print('nite-owl tty1 — the KESTREL line is busy pulling a file. Internet Voyager is open.\n');
      term.focus();
    });
  },
};

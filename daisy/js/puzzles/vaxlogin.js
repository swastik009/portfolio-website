// From your own box: dial the number the war-dialer found, watch the university answer, log in with Maya's note.
import { createTerm } from '../desktop/term.js';
import { ICONS } from '../desktop/icons.js';
import { parseLocal, checkLogin, isTelnetEscape } from './vaxlogin.logic.js';
import { sameNumber } from './connect.logic.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOCAL_PROMPT = 'nite-owl% ';
export const KESTREL_CREST = String.raw`
        _______________
       |  \   ___   /  |      HALSTEAD UNIVERSITY
       |   \ /   \ /   |      Computing Services
       |    V  o  V    |
       |     \___/     |      K E S T R E L
        \     | |     /       VAX 6000-510  ·  OpenVMS V6.2
         \    |_|    /
          '-._____.-'         AUTHORIZED USE ONLY
                              All sessions may be monitored.
`;

export default {
  id: 'vaxlogin',
  title: 'Terminal - nite-owl',
  icon: ICONS.terminal,
  window: { width: 700, height: 470 },
  mount(body, ctx) {
    const p = ctx.params;
    body.classList.add('term-host');
    let mode = 'local';
    let user = '';
    let fails = 0;
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
          await sleep(900);
          if (checkLogin(user, line, p)) {
            await term.print('\n\tWelcome to OpenVMS (TM) VAX Operating System, Version V6.2\n\n    Last interactive login on Wednesday, 29-DEC-1999 23:59\n', { speed: 6 });
            await sleep(700);
            resolve();
            return;
          }
          fails++;
          await term.print('User authorization failure\n');
          if (fails % 3 === 0) {
            await term.print('%LOGIN-F-RETRYLIM, too many attempts — line will reset in 20 seconds', { speed: 8 });
            if (fails === 3) ctx.chat.say('slowly. the note on the photo. her handwriting.', 'broken');
            await sleep(20000);
          }
          mode = 'user';
          term.setPrompt('Username: ');
          return;
        }
        const c = parseLocal(line);
        if (!c) return;
        switch (c.cmd) {
          case 'help':
            await term.print('  dial <number>   call a modem (the war-dialer found one)\n  clear           clean the screen');
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
            ctx.bus.emit('modem:active', true);
            if (!sameNumber(num, p.number)) {
              await sleep(2400);
              ctx.bus.emit('modem:active', false);
              // the war-dial number is Halstead's public pool: it answers, then shows you the door
              if (p.pool && sameNumber(num, p.pool)) await term.print('CONNECT 2400\nHALSTEAD UNIVERSITY PUBLIC DIAL POOL\nKESTREL accounts: use the staff dial-in.\nNO CARRIER');
              else await term.print('NO CARRIER');
              break;
            }
            ctx.audio.sfx('modem_handshake', { gain: 0.6 });
            await sleep(5200);
            await term.print('CONNECT 28800/ARQ/V34/LAPM/V42BIS');
            term.setStatus('KESTREL · 28800 bps');
            await sleep(500);
            await term.print(KESTREL_CREST, { speed: 3 });
            mode = 'user';
            term.setPrompt('Username: ');
            break;
          }
          default:
            await term.print(`${c.cmd}: command not found (try help)`);
        }
      } });
      term.setHeader('nite-owl · local');
      term.setStatus('offline');
      term.print("nite-owl tty1 — 31 Dec 1999\nThe war-dialer found KESTREL's modem. Dial it.\n");
      term.focus();
    });
  },
};

// TONEDIAL from a DOS prompt. The scan narrows it to two TONE lines; only your ears tell the fax from the modem.
import { cadence, dtmfSequence, playSegments } from '../core/telephony.js';
import { createTerm } from '../desktop/term.js';
import { ICONS } from '../desktop/icons.js';
import { scanLog, parseDos, findLine, checkDial, SCAN_FILE } from './wardialer.logic.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HELP = `  dir               list files
  type <file>       show a file (try: type ${SCAN_FILE})
  listen <number>   dial and listen to who answers
  dial <number>     dial and connect
  cls               clear the screen`;

export default {
  id: 'wardialer',
  title: 'MS-DOS Prompt - TONEDIAL',
  icon: ICONS.terminal,
  window: { width: 640, height: 420 },
  mount(body, ctx) {
    const { numbers } = ctx.params;
    body.classList.add('term-host');
    let playing = null;
    const stop = () => { playing?.stop(); playing = null; };
    const dialTones = async (number) => {
      const dial = dtmfSequence(number);
      playing = playSegments(ctx.audio, dial, { gain: 0.08 });
      await sleep((dial.at(-1).t + dial.at(-1).dur) * 1000 + 300);
    };
    async function ring(entry, seconds) {
      stop();
      await dialTones(entry.number);
      playing = playSegments(ctx.audio, cadence(entry.tone, seconds));
      await sleep(seconds * 1000);
      stop();
    }
    const guide = {
      commands: ['dir', 'type', 'listen', 'dial', 'cls', 'help'],
      names: () => [SCAN_FILE, ...numbers.map((n) => n.number)],
      manual: [['type <file>', 'show a file'], ['listen <number>', 'hear a line'], ['dial <number>', 'connect'], ['help', 'all commands']],
    };
    return new Promise((resolve) => {
      const term = createTerm(body, { prompt: 'C:\\WARDIAL>', audio: ctx.audio, guide, onLine: async (line) => {
        ctx.activity();
        const { cmd, arg } = parseDos(line);
        if (!cmd) return;
        if (cmd === 'help') return term.print(HELP);
        if (cmd === 'cls' || cmd === 'clear') return term.clear();
        if (cmd === 'dir') return term.print(` Directory of C:\\WARDIAL\n\nTONEDIAL EXE     41,216  06-02-97\n${SCAN_FILE.padEnd(16)}  1,104  12-27-99\n        2 file(s)`);
        if (cmd === 'type') {
          if (arg.toUpperCase() !== SCAN_FILE) return term.print(arg ? 'File not found' : 'Required parameter missing');
          return term.print(scanLog(numbers));
        }
        if (cmd === 'listen' || cmd === 'dial') {
          if (!arg) return term.print(`${cmd}: which number? (try: ${cmd} ${numbers[0].number})`);
          const entry = findLine(numbers, arg);
          await term.print(`ATDT ${arg}`);
          if (!entry) { await sleep(1800); return term.print('NO DIALTONE -- number not in this block'); }
          if (cmd === 'listen') { await ring(entry, 3.5); return term.print('-- hung up'); }
          if (!checkDial(entry)) {
            await ring(entry, 2.5);
            await term.print('NO CARRIER');
            ctx.chat.say(entry.tone === 'fax' ? 'that one screams. it is not a song.' : 'no. nobody is singing there.', 'broken');
            return;
          }
          stop();
          await dialTones(entry.number);
          ctx.bus.emit('modem:active', true);
          const hs = ctx.audio.sfx('modem_handshake', { gain: 0.8 });
          await term.print('CARRIER DETECTED -- negotiating...');
          await sleep(hs?.buffer ? Math.min(hs.buffer.duration, 14) * 1000 : 6000);
          hs?.stop();
          await term.print('CONNECT 28800/ARQ/V34/LAPM/V42BIS');
          await sleep(1600);
          resolve();
          return;
        }
        return term.print('Bad command or file name');
      } });
      term.setHeader('C:\\WARDIAL');
      term.print('Microsoft(R) MS-DOS(R) Prompt\n');
      term.focus();
    });
  },
};

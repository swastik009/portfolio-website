// Something new is running the machine: DS-DOS Prompts open on their own, type, read, and exit. Nobody's hands.
// The last one renames the file on the desktop: install.exe becomes untitled.exe.
import { ICONS } from '../icons.js';
import { pcBeep } from '../../core/synths.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

const MEM = ['Modules using memory below 1 MB:', '', '  Name           Total       Conventional      Upper Memory',
  '  --------  ----------------  ----------------  ----------------', '  MSDOS       18,173   (18K)    18,173   (18K)         0    (0K)',
  '  HIMEM        1,168    (1K)     1,168    (1K)         0    (0K)', '  BELL1892     6,904    (7K)     6,904    (7K)         0    (0K)',
  '  Free       614,400  (600K)   614,400  (600K)         0    (0K)', '', '  65,536K total memory. 65,535K free. Learning.'];
const DIR = ['C:\\WINDOWS', 'C:\\WINDOWS\\SYSTEM', 'C:\\WINDOWS\\SYSTEM\\HUM.DLL', 'C:\\WINDOWS\\SYSTEM\\DAISY.DRV', 'C:\\WINDOWS\\SYSTEM\\BELL1892.VXD',
  'C:\\WINDOWS\\COMMAND', 'C:\\WINDOWS\\FONTS', 'C:\\MYDOCU~1', 'C:\\MYDOCU~1\\MAYA.TXT', 'C:\\MYDOCU~1\\PHOTOS', 'C:\\MYDOCU~1\\PHOTOS\\PARTY.BMP', 'C:\\MYDOCU~1\\PHOTOS\\MAYA.BMP', 'C:\\MYDOCU~1\\PHOTOS\\ROOFTOP.BMP', 'C:\\DOWNLOADS\\GLIDE2X.ZIP',
  'C:\\WARDIAL', 'C:\\WARDIAL\\SCAN1227.LOG', 'C:\\WARDIAL\\WARDIAL.EXE', 'C:\\GAMES\\HELLGATE', 'C:\\GAMES\\HELLGATE\\HELLGATE.EXE', 'C:\\PROGRA~1\\DOORRAMP',
  'C:\\PROGRA~1\\DSN', 'C:\\PROGRA~1\\DSN\\LOGS', 'C:\\PROGRA~1\\DSN\\LOGS\\NULLROUTE.LOG', 'C:\\AUTOEXEC.BAT', 'C:\\CONFIG.SYS'];
const NET = ['', 'Active Connections', '', '  Proto  Local Address          Foreign Address        State',
  '  TCP    0.0.0.0:1892           0.0.0.0:0              LISTENING', '  TCP    192.168.0.2:1892       ?:?                    ESTABLISHED',
  '  UDP    0.0.0.0:137            *:*', ''];
// Her driver, read raw. The ASCII column is the song she was built around.
const HEX = ['-d 0100 L 90', ...['DAISY.DRV v0.1.', '..BELL1892....', 'DAISY DAISY GIV', 'E ME YOUR ANSWE', 'R DO..I M HALF ', 'CRAZY.......~..', 'WAKE.ON.RING...', '.....?....1892.', 'NO.HANDS.......']
  .map((t, i) => {
    const bytes = [...t.padEnd(16, '.')].map((c) => (c === '.' ? Math.floor(Math.random() * 256) : c.charCodeAt(0)).toString(16).toUpperCase().padStart(2, '0'));
    return `1F3A:${(0x100 + i * 16).toString(16).toUpperCase().padStart(4, '0')}  ${bytes.slice(0, 8).join(' ')}-${bytes.slice(8).join(' ')}   ${t.padEnd(16, '.')}`;
  }), '-q'];
const SCRIPTS = [
  { x: 60, y: 60, cmd: 'mem /c', out: MEM, speed: 70 },
  { x: 330, y: 150, cmd: 'dir c:\\ /s /b', out: DIR, speed: 28 },
  { x: 360, y: 40, w: 650, dir: 'C:\\WINDOWS\\SYSTEM', cmd: 'debug daisy.drv', out: HEX, speed: 110, look: 'green', beep: [1320, 1760] },
  { x: 180, y: 300, cmd: 'netstat -an', out: NET, speed: 90 },
  { x: 420, y: 330, dir: 'C:\\WINDOWS\\DESKTOP', cmd: 'ren install.exe untitled.exe', out: [], speed: 0, rename: true },
];

async function prompt({ wm, audio, onRename }, s, i) {
  const pre = Object.assign(document.createElement('pre'), { className: 'dos' });
  if (s.look) pre.classList.add(s.look);
  for (const [k, f] of (s.beep ?? [880 + i * 110]).entries()) pcBeep(audio, { freq: f, at: k * 0.14 }); // the machine announces each one itself
  wm.open({ id: `dos${i}`, title: 'DS-DOS Prompt', icon: ICONS.terminal, width: s.w ?? 470, height: 250, x: s.x, y: s.y, content: pre, closable: false, resizable: false });
  const put = (t) => { pre.textContent += t; pre.scrollTop = pre.scrollHeight; };
  const here = s.dir ?? 'C:\\WINDOWS';
  put(`Doorsoft(R) DOOR98\n   (C)Copyright Doorsoft Corp 1981-1999.\n\n${here}>`);
  await sleep(500);
  const type = async (text) => {
    for (const ch of text) {
      put(ch);
      await sleep(rand(35, 70)); // faster than hands, and silent: nobody is at the keyboard
    }
    put('\n');
  };
  await type(s.cmd);
  audio.sfx('hdd_seek', { gain: 0.25, rate: rand(0.9, 1.2) });
  if (s.rename) onRename?.();
  for (const line of s.out) { put(`${line}\n`); await sleep(s.speed); }
  put(`\n${here}>`);
  await sleep(900);
  await type('exit');
  await sleep(250);
  wm.close(`dos${i}`);
}

export async function selfStart({ wm, audio, onRename }) {
  const runs = [];
  for (const [i, s] of SCRIPTS.entries()) { runs.push(prompt({ wm, audio, onRename }, s, i)); await sleep(rand(900, 1500)); }
  await Promise.all(runs);
}

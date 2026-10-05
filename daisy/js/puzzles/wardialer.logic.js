// The 12/27 scan of Halstead's 555-01XX block, and the DOS prompt that reads it. Pure.
import { sameNumber } from './connect.logic.js';

const LABELS = { busy: 'BUSY', ringback: 'RING', sit: 'SIT', fax: 'TONE', carrier: 'TONE' };
export const SCAN_FILE = 'SCAN1227.LOG';
export const scanLabel = (tone) => LABELS[tone] ?? 'UNKNOWN';
export const scanLog = (numbers) => [
  'TONEDIAL v1.10 -- scan log -- 12/27/99 01:12',
  'block 555-01XX (HALSTEAD U)  100 dialed',
  '',
  ...numbers.map((n, i) => `${String(i + 1).padStart(3)}  ${n.number}  ${scanLabel(n.tone)}`),
  '',
  `${numbers.length} answered. TONE = fax or modem. listen before you dial.`,
].join('\n');
export function parseDos(line) {
  const [cmd = '', ...rest] = String(line ?? '').trim().split(/\s+/);
  return { cmd: cmd.toLowerCase(), arg: rest.join(' ') };
}
export const findLine = (numbers, typed) => numbers.find((n) => sameNumber(n.number, typed)) ?? null;
export const checkDial = (entry) => entry?.tone === 'carrier';

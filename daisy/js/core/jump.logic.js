// Dev jump: the state a save would hold at the start of beat `to`, as if the beats before it were played (trusting
// path, clean Bluff). Flags that code sets mid-beat are listed by the beat that sets them. Pure.
import { defaultState } from './state.js';

const AFTER = { // beat id or cue -> flags it leaves behind
  daisyArrives: { 'flags.daisyAwake': true },
  answering: { 'flags.gregCalled': true, 'flags.gregHeard': true },
  roomhunt: { 'flags.kestrelCreds': true },
  pager: { 'flags.paged': true },
  vmshunt: { 'flags.bluff': 'clean' },
  telco: { 'flags.downloading': false },
};

export function jumpState(act, to, handle = 'acidburn') {
  const s = { ...defaultState(), handle, beat: to };
  const put = (path, value) => {
    const keys = path.split('.');
    let o = s;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    o[keys.at(-1)] = value;
  };
  for (const b of act.beats.slice(0, to)) {
    if (b.type === 'set') put(b.path, b.value);
    if (b.type === 'advance') s.clock += b.minutes;
    if (b.type === 'daisy') s.growth = b.growth;
    for (const key of [b.id, b.cue]) for (const [p, v] of Object.entries(AFTER[key] ?? {})) put(p, v);
  }
  return s;
}

export const beatLabel = (b, i) => `${String(i).padStart(2, '0')} ${b.type}${b.id || b.node || b.path ? ` · ${b.id ?? b.node ?? b.path}` : ''}${b.cue ? ` (${b.cue})` : ''}`;

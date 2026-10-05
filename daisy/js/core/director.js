// The film editor: plays an act's beats in order. Each beat type has one handler; handlers own the "how".
export const BEAT_TYPES = ['cutscene', 'puzzle', 'dialogue', 'qte', 'wait', 'set', 'advance', 'daisy'];

const REQUIRED = {
  cutscene: [['id', 'string']],
  puzzle: [['id', 'string']],
  dialogue: [['node', 'string']],
  qte: [['id', 'string']],
  wait: [['ms', 'number']],
  set: [['path', 'string']],
  advance: [['minutes', 'number']],
  daisy: [['growth', 'number']],
};

function validateBeat(beat, where, reg, errors) {
  if (!BEAT_TYPES.includes(beat?.type)) { errors.push(`${where}: unknown type "${beat?.type}"`); return; }
  for (const [key, kind] of REQUIRED[beat.type]) {
    if (typeof beat[key] !== kind) errors.push(`${where}: ${beat.type} needs ${key} (${kind})`);
  }
  if (beat.type === 'puzzle' && reg.puzzleIds && beat.id && !reg.puzzleIds.includes(beat.id)) errors.push(`${where}: unknown puzzle "${beat.id}"`);
  if (beat.type === 'dialogue' && reg.dialogueIds && beat.node && !reg.dialogueIds.includes(beat.node)) errors.push(`${where}: unknown dialogue "${beat.node}"`);
  if (beat.type === 'cutscene' && reg.cutsceneIds && beat.id && !reg.cutsceneIds.includes(beat.id)) errors.push(`${where}: unknown cutscene "${beat.id}"`);
  for (const [name, sub] of Object.entries(beat.interrupts ?? {})) validateBeat(sub, `${where}.interrupts.${name}`, reg, errors);
}

export function validateAct(act, registries = {}) {
  const errors = [];
  if (typeof act?.id !== 'string') errors.push('act needs id');
  if (!Array.isArray(act?.beats) || !act.beats.length) errors.push('act needs beats');
  (act?.beats ?? []).forEach((b, i) => validateBeat(b, `beat ${i}`, registries, errors));
  return errors;
}

export function builtinHandlers({ store, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  return {
    set: async (b) => store.set(b.path, b.value),
    advance: async (b) => store.add('clock', b.minutes), // relative, so QTE time penalties stick
    wait: async (b) => sleep(b.ms),
  };
}

export function createDirector({ store, bus, handlers, onBeat }) {
  let stopped = false;
  const director = {
    async play(beat) {
      const handler = handlers[beat.type];
      if (!handler) throw new Error(`no handler for beat type "${beat.type}"`);
      return handler(beat);
    },
    async run(act, start = 0) {
      stopped = false;
      for (let i = start; i < act.beats.length && !stopped; i++) {
        const beat = act.beats[i];
        store.set('beat', i);
        onBeat?.(i);
        bus.emit('beat:start', { act: act.id, index: i, beat });
        await director.play(beat);
        bus.emit('beat:end', { act: act.id, index: i, beat });
      }
      if (!stopped) bus.emit('act:end', { act: act.id });
    },
    stop() { stopped = true; },
  };
  return director;
}

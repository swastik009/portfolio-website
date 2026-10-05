// Runs one puzzle beat: opens its window, gives it ctx (hints, interrupts, logs), closes it when solved.
import { nextHint } from './host.logic.js';
import { PUZZLES } from './index.js';

const IDLE_HINT_MS = 90_000;

export function createPuzzleHost({ wm, store, bus, audio, chat, director, world = {} }) {
  bus.on('log:opened', () => chat.bark('log_opened'));
  return async function playPuzzle(beat) {
    const mod = PUZZLES[beat.id];
    if (!mod) throw new Error(`unknown puzzle "${beat.id}"`);
    let hintLevel = 0;
    let idleTimer = null;
    let done = false; // once solved, no late hint may re-arm the idle timer
    const fired = new Set();
    const ctx = {
      params: beat.params ?? {}, store, bus, audio, wm, chat, world,
      activity() {
        clearTimeout(idleTimer);
        if (done || mod.quiet) return; // quiet beats (the prologue) have no Daisy to nudge you
        // After 90s of nothing: Daisy checks in, then offers the next hint.
        idleTimer = setTimeout(() => chat.bark('stuck').then(() => ctx.hint()), IDLE_HINT_MS);
      },
      async hint() {
        if (done) return;
        const h = nextHint(beat.hints ?? [], hintLevel);
        if (!h) return;
        hintLevel = h.level;
        bus.emit('puzzle:hint', { id: beat.id, level: h.level });
        await chat.say(h.text, 'hint');
        ctx.activity();
      },
      async interrupt(name) {
        const sub = beat.interrupts?.[name];
        if (!sub || fired.has(name)) return null;
        fired.add(name);
        clearTimeout(idleTimer);
        const result = await director.play(sub);
        ctx.activity();
        return result;
      },
      logOpened(id) {
        if (store.push('logsFound', id)) bus.emit('log:opened', { id });
      },
    };
    if (beat.waitFor) {
      await new Promise((resolve) => {
        const off = bus.on('app:launch', (id) => { if (id === beat.waitFor) { off(); resolve(); } });
      });
    }
    await mod.before?.(ctx);
    const win = mod.window === false ? null : wm.open({
      id: `puzzle-${beat.id}`, title: mod.title, icon: mod.icon, className: mod.window?.className,
      width: mod.window?.width ?? 640, height: mod.window?.height ?? 440, x: 12, y: 150, closable: false,
      onHelp: () => ctx.hint(),
    });
    ctx.activity();
    try {
      await mod.mount(win?.body ?? null, ctx);
    } finally {
      done = true;
      clearTimeout(idleTimer);
      win?.close();
    }
    bus.emit('puzzle:solved', { id: beat.id });
  };
}

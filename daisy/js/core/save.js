// localStorage persistence. Every path is wrapped: a broken or missing storage means "no save", never a crash.
export const SAVE_KEY = 'daisy.save.v1';
export const SAVE_VERSION = 1;

export function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function createSaver(storage, now = () => Date.now()) {
  return {
    save(state) {
      try {
        storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: now(), state }));
        return true;
      } catch {
        return false;
      }
    },
    load() {
      let raw;
      try { raw = storage ? storage.getItem(SAVE_KEY) : null; } catch { return { status: 'none' }; }
      if (raw == null) return { status: 'none' };
      try {
        const data = JSON.parse(raw);
        const valid = data?.version === SAVE_VERSION && typeof data.savedAt === 'number'
          && data.state !== null && typeof data.state === 'object';
        return valid ? { status: 'ok', state: data.state, savedAt: data.savedAt } : { status: 'corrupt' };
      } catch {
        return { status: 'corrupt' };
      }
    },
    clear() {
      try { storage?.removeItem(SAVE_KEY); } catch { /* storage unavailable: nothing to clear */ }
    },
  };
}

// Saves the state as it was when the current beat began, so a resume replays that beat
// without double-applying choices made during it. Settings are always taken live.
export function createAutosave({ store, saver }) {
  let beatSnap = store.snapshot();
  return {
    atBeat() { beatSnap = store.snapshot(); saver.save(beatSnap); },
    onHide() { saver.save({ ...beatSnap, settings: store.snapshot().settings }); },
  };
}

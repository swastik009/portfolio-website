// DoorRAMP 2.0: a small skin playing the one file that matters tonight, Greg's Radio Over Internet episode.
// One continuous file (tools/build-greg.sh): Roar's intro, then Greg from the drop. The game always starts it at the
// drop (the cold open's music is the menu song now). It plays once and ends on a recorder click.
import { ICONS } from '../icons.js';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createDoorramp({ wm, audio, track }) {
  const root = document.createElement('div');
  root.className = 'winramp';
  root.innerHTML = '<div class="wr-display"><span class="wr-time">0:00</span><marquee class="wr-title" scrollamount="2"></marquee></div><ol class="wr-list"></ol>';
  const timeEl = root.querySelector('.wr-time');
  root.querySelector('.wr-title').textContent = `1. ${track.title}`;
  const li = Object.assign(document.createElement('li'), { className: 'on', textContent: track.title });
  root.querySelector('.wr-list').append(li);
  let srcs = [], clock = 0;

  // Starts at the drop (Greg). fade: seconds to come up from silence (starting mid-file, a hard start clicks).
  function play({ gain = 1, fade = 0 } = {}) {
    stopNow();
    root.classList.remove('dead');
    const offset = track.skip;
    const show = audio.sfx(track.sound, { bus: 'music', gain, offset });
    srcs = show ? [show] : [];
    if (!show) return;
    if (fade) { const t = show.context.currentTime; show.gainNode.gain.setValueAtTime(0, t); show.gainNode.gain.linearRampToValueAtTime(gain, t + fade); }
    li.textContent = `${track.title}  ${fmt(show.buffer.duration - track.skip)}`;
    const t0 = show.context.currentTime - offset + track.skip; // the episode clock starts at the drop
    clearInterval(clock);
    clock = setInterval(() => { timeEl.textContent = fmt(Math.max(0, show.context.currentTime - t0)); }, 500);
    show.onended = () => { if (srcs.includes(show)) { clearInterval(clock); root.classList.add('dead'); srcs = []; } }; // the tape ran out
  }
  function stopNow() { clearInterval(clock); for (const s of srcs) { s.onended = null; s.stop(); } srcs = []; }

  return {
    open: () => wm.open({ id: 'winramp', title: 'DoorRAMP', icon: ICONS.winramp, width: 300, height: 150, x: 710, y: 470, content: root }),
    play,
    // The power sags: whatever is playing drags down in pitch and stops mid-sentence.
    async die() {
      clearInterval(clock);
      root.classList.add('dead');
      const live = srcs;
      srcs = [];
      for (const s of live) {
        s.onended = null;
        const now = s.context.currentTime;
        s.playbackRate.setValueAtTime(1, now);
        s.playbackRate.linearRampToValueAtTime(0.35, now + 0.6);
        s.gainNode.gain.setTargetAtTime(0, now + 0.4, 0.08);
        s.stop(now + 0.8);
      }
      if (live.length) await new Promise((r) => setTimeout(r, 800));
    },
  };
}

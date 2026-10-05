import { ICONS } from '../icons.js';

export function openSettings({ wm, store, audio }) {
  const body = document.createElement('div');
  body.className = 'settings';
  const vol = store.get('settings.volume');
  body.innerHTML = `
    <fieldset><legend>Display</legend>
      <div class="field-row"><input type="radio" id="q-high" name="q" value="high"><label for="q-high">High (ink, bloom, film grain)</label></div>
      <div class="field-row"><input type="radio" id="q-low" name="q" value="low"><label for="q-low">Low (faster)</label></div>
      <p class="note">Display changes apply after restarting the game.</p>
    </fieldset>
    <fieldset><legend>Sound</legend>
      ${Object.keys(vol).map((k) => `<div class="field-row"><label for="v-${k}" style="width:70px">${k}</label><input id="v-${k}" data-bus="${k}" type="range" min="0" max="1" step="0.05" value="${vol[k]}"></div>`).join('')}
    </fieldset>`;
  body.querySelector(`#q-${store.get('settings.quality')}`).checked = true;
  body.querySelectorAll('input[name=q]').forEach((r) => r.addEventListener('change', () => store.set('settings.quality', r.value)));
  body.querySelectorAll('input[data-bus]').forEach((s) => s.addEventListener('input', () => {
    store.set(`settings.volume.${s.dataset.bus}`, Number(s.value));
    audio.setVolume(s.dataset.bus, Number(s.value));
  }));
  wm.open({ id: 'settings', title: 'Settings', icon: ICONS.gear, width: 340, height: 330, content: body });
}

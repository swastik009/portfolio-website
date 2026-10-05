import { createCalc } from './calc.logic.js';
import { ICONS } from '../icons.js';

export function openCalc({ wm }) {
  const calc = createCalc();
  const body = document.createElement('div');
  body.className = 'calc';
  const LABEL = { C: 'Clear', 'C#': 'C', MODE: 'Hex/Dec' };
  const keys = ['C', 'MODE', '', '', 'D', 'E', 'F', '+', 'A', 'B', 'C#', '-', '7', '8', '9', '=', '4', '5', '6', '', '1', '2', '3', '', '0', '', '', ''];
  body.innerHTML = '<input class="calc-display" readonly><div class="calc-mode"></div><div class="calc-keys"></div>';
  const display = body.querySelector('.calc-display');
  const modeEl = body.querySelector('.calc-mode');
  const render = () => {
    display.value = calc.display;
    modeEl.textContent = calc.mode === 'HEX' ? '◉ Hex  ○ Dec' : '○ Hex  ◉ Dec';
  };
  const grid = body.querySelector('.calc-keys');
  for (const k of keys) {
    const b = document.createElement('button');
    b.textContent = LABEL[k] ?? k;
    if (!k) b.style.visibility = 'hidden';
    b.addEventListener('click', () => { calc.press(k); render(); });
    grid.append(b);
  }
  body.addEventListener('keydown', (e) => {
    const map = { Enter: '=', Escape: 'C', c: 'C#' };
    calc.press(map[e.key] ?? e.key);
    render();
  });
  render();
  wm.open({ id: 'calc', title: 'Calculator', icon: ICONS.calc, width: 250, height: 290, x: 760, y: 360, content: body });
}

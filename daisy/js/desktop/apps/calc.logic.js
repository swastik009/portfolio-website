// Win98-style calculator core with HEX/DEC modes (integers only, like the "Scientific" view).
export function createCalc() {
  let mode = 'HEX';
  let display = '0';
  let acc = null;
  let op = null;
  let fresh = true;
  const base = () => (mode === 'HEX' ? 16 : 10);
  const value = () => parseInt(display, base());
  const show = (n) => { display = (n >>> 0).toString(base()).toUpperCase(); };
  const apply = () => {
    if (op && acc !== null) show(op === '+' ? acc + value() : acc - value());
  };
  return {
    get display() { return display; },
    get mode() { return mode; },
    // 'C' clears; the hex digit C is 'C#' (the UI gives it its own key).
    press(key) {
      const k = String(key).toUpperCase();
      const digit = k === 'C#' ? 'C' : k;
      if (k !== 'C' && /^[0-9A-F]$/.test(digit)) {
        if (parseInt(digit, 16) >= base()) return display;
        display = fresh || display === '0' ? digit : display + digit;
        fresh = false;
      } else if (k === '+' || k === '-') {
        apply();
        acc = value();
        op = k;
        fresh = true;
      } else if (k === '=') {
        apply();
        acc = null;
        op = null;
        fresh = true;
      } else if (k === 'C') {
        display = '0';
        acc = null;
        op = null;
        fresh = true;
      } else if (k === 'MODE') {
        const v = value();
        mode = mode === 'HEX' ? 'DEC' : 'HEX';
        show(v);
        fresh = true;
      }
      return display;
    },
  };
}

// DSN Messenger's script rules. Pure.
export const fillHandle = (text, handle) => String(text).replaceAll('{handle}', handle);
export function readDelay(e) {
  if (e.wait !== undefined) return e.wait;
  if (e.text) return Math.min(8, 1.5 + e.text.length / 18);
  if (e.sys) return 2;
  return 0;
}
export const bsnShouldAdvance = ({ open, minimized }) => open && !minimized;
const kinds = (e) => ['text' in e, 'sys' in e, 'choices' in e, 'mark' in e].filter(Boolean).length;
export function validateBsn(bsn) {
  const errors = [];
  const check = (list, where) => list.forEach((e, i) => {
    const at = `${where}[${i}]`;
    if (kinds(e) !== 1) errors.push(`${at}: needs exactly one of text/sys/choices/mark`);
    if ('text' in e && !bsn.members.includes(e.who)) errors.push(`${at}: unknown speaker "${e.who}"`);
    if (e.choices) {
      if (e.choices.length < (e.forced ? 1 : 2) || e.choices.length > 4) errors.push(`${at}: 2-4 choices (1 if forced)`);
      e.choices.forEach((c, j) => {
        if (!c.text) errors.push(`${at}.choices[${j}]: needs text`);
        check(c.then ?? [], `${at}.choices[${j}].then`);
      });
    }
  });
  check(bsn.script ?? [], 'script');
  return errors;
}
// Lower bound on how long the chat takes to reach a mark: reading time only (the player's choices add more).
export function secondsUntil(script, mark) {
  let seconds = 0, choices = 0;
  for (const e of script) {
    if (e.mark === mark) break;
    if (e.choices) {
      choices++;
      seconds += Math.min(...e.choices.map((c) => (c.then ?? []).reduce((s, x) => s + readDelay(x), 0)));
    }
    seconds += readDelay(e);
  }
  return { seconds, choices };
}

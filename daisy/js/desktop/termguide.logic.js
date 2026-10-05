// The guided terminal's brains: Tab completion, clickable names, flow typing. Pure.
const commonPrefix = (arr) => arr.reduce((p, s) => {
  let i = 0;
  while (i < p.length && i < s.length && p[i].toLowerCase() === s[i].toLowerCase()) i++;
  return p.slice(0, i);
});

export function completeLine(line, { commands = [], names = [] } = {}) {
  const onCommand = !/\s/.test(line.trimStart());
  const word = onCommand ? line.trimStart() : (/\s$/.test(line) ? '' : line.split(/\s+/).at(-1));
  if (onCommand && !word) return { line, matches: [] };
  const pool = onCommand ? commands : names;
  const matches = pool.filter((c) => c.toLowerCase().startsWith(word.toLowerCase()));
  if (!matches.length) return { line, matches };
  const pick = matches.length === 1 ? matches[0] + (onCommand ? ' ' : '') : commonPrefix(matches);
  if (pick.length < word.length) return { line, matches };
  return { line: line.slice(0, line.length - word.length) + pick, matches };
}

export function splitLinks(text, names) {
  if (!names.length) return [{ text }];
  const esc = [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${esc.join('|')})`, 'g');
  return text.split(re).filter(Boolean).map((t) => (names.includes(t) ? { text: t, name: t } : { text: t }));
}

// Flow typing for scripted flourishes: the player mashes, the terminal types the line we wrote. Pure.
export function flowNext(script, shown, key, step = 2) {
  if (key === 'Enter') return { shown, done: shown === script };
  if (key.length !== 1) return { shown, done: false };
  return { shown: script.slice(0, Math.min(script.length, shown.length + step)), done: false };
}

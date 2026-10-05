const ALIAS = { cat: 'mail', read: 'mail', ssh: 'telnet', '?': 'help', man: 'help', call: 'dial', atdt: 'dial' };
export function parseLocal(line) {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const cmd = parts[0].toLowerCase();
  return { cmd: ALIAS[cmd] ?? cmd, args: parts.slice(1) };
}
export const fingerTarget = (arg) => String(arg ?? '').split('@')[0].toLowerCase();
export const checkLogin = (user, pass, answer) =>
  user.trim().toUpperCase() === answer.user.toUpperCase() && pass.trim().toUpperCase() === answer.pass.toUpperCase();
export const isTelnetEscape = (line) => ['', 'quit', 'exit', '^]', 'logout'].includes(line.trim().toLowerCase());

// A small, forgiving OpenVMS DCL: enough DIRECTORY / SET DEFAULT / TYPE to feel real without punishing syntax.
const VERBS = [
  { full: 'DIRECTORY', min: 3 },
  { full: 'TYPE', min: 2 },
  { full: 'HELP', min: 2 },
  { full: 'LOGOUT', min: 2 },
  { full: 'MAIL', min: 2 },
  { full: 'FINGER', min: 3 },
];
const UNIX = { ls: 'DIRECTORY', dir: 'DIRECTORY', cd: 'SET DEFAULT', cat: 'TYPE', more: 'TYPE', pwd: 'SHOW DEFAULT', exit: 'LOGOUT', help: 'HELP', mail: 'MAIL', finger: 'FINGER' };
const abbrev = (word, full, min) => word.length >= min && full.startsWith(word);

export function parseDcl(line) {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const w = parts[0].toUpperCase();
  const lower = parts[0].toLowerCase();
  if (UNIX[lower] && lower !== 'dir' && lower !== 'help') return { verb: UNIX[lower], args: parts.slice(1), unix: true };
  for (const v of VERBS) if (abbrev(w, v.full, v.min)) return { verb: v.full, args: parts.slice(1), unix: false };
  if ((abbrev(w, 'SET', 3) || abbrev(w, 'SHOW', 2)) && parts[1] && abbrev(parts[1].toUpperCase(), 'DEFAULT', 3)) {
    return { verb: w.startsWith('SE') ? 'SET DEFAULT' : 'SHOW DEFAULT', args: parts.slice(2), unix: false };
  }
  return { verb: 'UNKNOWN', args: parts, unix: false };
}

export function nodeAt(root, path) {
  let n = root;
  for (const seg of path) {
    n = n?.dirs?.[seg];
    if (!n) return null;
  }
  return n;
}

function dirName(node, name) {
  return Object.keys(node?.dirs ?? {}).find((d) => d === name.toUpperCase()) ?? null;
}

export function resolvePath(cwd, spec, root) {
  let s = String(spec ?? '').trim().replace(/^[A-Z$_]+:/i, '');
  let path;
  let segs;
  const vms = /^\[(.*)\]$/.exec(s);
  if (vms) {
    const inner = vms[1].toUpperCase();
    if (inner === '000000') return [];
    if (inner.startsWith('.') || inner.startsWith('-')) {
      path = [...cwd];
      segs = inner.split('.').filter(Boolean);
    } else {
      path = [];
      segs = inner.split('.');
    }
  } else {
    if (s.startsWith('/')) { path = []; s = s.slice(1); } else path = [...cwd];
    segs = s.split('/').filter(Boolean);
  }
  for (const seg of segs) {
    if (seg === '-' || seg === '..') {
      if (!path.length) return null;
      path.pop();
      continue;
    }
    if (seg === '.') continue;
    const real = dirName(nodeAt(root, path), seg);
    if (!real) return null;
    path.push(real);
  }
  return path;
}

export function findFile(node, name) {
  const want = name.toUpperCase();
  const hit = Object.entries(node?.files ?? {}).find(([full]) => full === want || full.split(';')[0] === want);
  return hit ?? null;
}

export const formatPath = (path) => `DISK$USER:[${path.length ? path.join('.') : '000000'}]`;

export function formatDir(path, node) {
  const rows = [];
  for (const d of Object.keys(node.dirs ?? {})) rows.push(`${`${d}.DIR;1`.padEnd(20)}${'1'.padStart(6)}  ${'01-JAN-1999 00:00'}`);
  let blocks = Object.keys(node.dirs ?? {}).length; // each .DIR file is 1 block
  for (const [name, f] of Object.entries(node.files ?? {})) {
    blocks += f.blocks;
    rows.push(`${name.padEnd(20)}${String(f.blocks).padStart(6)}  ${f.date}`);
  }
  const count = Object.keys(node.dirs ?? {}).length + Object.keys(node.files ?? {}).length;
  return `\nDirectory ${formatPath(path)}\n\n${rows.join('\n')}\n\nTotal of ${count} file${count === 1 ? '' : 's'}, ${blocks} block${blocks === 1 ? '' : 's'}.`;
}

// Halloran notices Patel the moment he steps (or reaches with cat) outside his home tree.
export function leavesHome(path, home) {
  return path.length < home.length || !home.every((s, i) => s === path[i]);
}

// A file argument as a player would type it: `job_0042.lis`, `job_0042`, `../sysmgr/daemon.log`,
// `/spool/print/hold/job_0042.lis` or VMS `[SPOOL.PRINT.HOLD]JOB_0042.LIS`.
export function resolveFile(cwd, spec, root) {
  const s = String(spec ?? '').trim();
  let dirSpec = null;
  let name = s;
  const vms = /^(?:[A-Z$_]+:)?(\[[^\]]*\])(.*)$/i.exec(s);
  if (vms) {
    [, dirSpec, name] = vms;
  } else if (s.includes('/')) {
    const i = s.lastIndexOf('/');
    dirSpec = s.slice(0, i) || '/';
    name = s.slice(i + 1);
  }
  const path = dirSpec ? resolvePath(cwd, dirSpec, root) : cwd;
  if (!path || !name) return null;
  const node = nodeAt(root, path);
  let hit = findFile(node, name);
  if (!hit && !name.includes('.')) {
    const base = name.toUpperCase();
    const matches = Object.entries(node?.files ?? {}).filter(([full]) => full.split('.')[0] === base);
    if (matches.length === 1) hit = matches[0];
  }
  return hit ? { path, name: hit[0], file: hit[1] } : null;
}

export function listingLinks(path, node) {
  const links = {};
  if (path.length) links['[..]'] = { cmd: 'cd ..' };
  for (const d of Object.keys(node?.dirs ?? {})) links[`${d}.DIR;1`] = { cmd: `cd ${d.toLowerCase()}` };
  for (const f of Object.keys(node?.files ?? {})) {
    const base = f.split(';')[0];
    links[f] = base === 'DAEMON.LOG' ? { cmd: `cat ${base.toLowerCase()}`, className: 'corrupt' } : { cmd: `cat ${base.toLowerCase()}` };
  }
  return links;
}
export const completionNames = (node) => ['..', ...Object.keys(node?.dirs ?? {}).map((d) => d.toLowerCase()), ...Object.keys(node?.files ?? {}).map((f) => f.split(';')[0].toLowerCase())];
export function countdownLabel(s) {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
export const crumb = (path) => `KESTREL › ${formatPath(path)}`;

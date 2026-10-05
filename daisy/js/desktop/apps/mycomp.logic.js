// Pure: how My Computer reads data/mycomp.json. A string is a text file; an object is a folder, or (by its "_" keys,
// which are never listed) a picture (_image), an archive (_zip: its files), a dead end with a message (_error), a drive.
export function entries(node) {
  return Object.entries(node).filter(([k]) => !k.startsWith('_')).map(([name, v]) => ({
    name, node: v, label: v?._label ?? name,
    kind: typeof v === 'string' ? 'text' : v._image ? 'image' : v._zip ? 'zip' : v._error ? 'error' : 'folder',
  }));
}
// "C:\MY DOCUMENTS\PHOTOS" for the path under My Computer; My Computer itself at the top.
export const address = (path) => (path.length ? `${path[0]}\\${path.slice(1).join('\\')}` : 'My Computer');
export function usage({ _capacity: cap, _free: free }) {
  return { capacity: cap, free, used: Math.round((cap - free) * 100) / 100, pct: Math.round(((cap - free) / cap) * 100) };
}

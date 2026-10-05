// Pure: how a hung frame tears. The screen is cut into horizontal slices that cover it top to bottom; a few of them
// slip sideways. Most of a real hang is the frame just sitting there, so most slices stay put.
export function tearSlices(n, rand = Math.random, { slip = 0.35, max = 60 } = {}) {
  const cuts = Array.from({ length: n - 1 }, () => rand() * 100).sort((a, b) => a - b);
  const edges = [0, ...cuts, 100];
  return edges.slice(0, -1).map((top, i) => ({
    top, bottom: 100 - edges[i + 1],
    dx: rand() < slip ? Math.round((rand() * 2 - 1) * max / 4) * 4 : 0, // whole 4px steps, like a bad pitch
  }));
}

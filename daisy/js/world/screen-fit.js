// Distance from a flat rectangle at which a perspective camera sees all of it (with margin), for any viewport aspect.
export function fitDistance({ screenW, screenH, fovDeg, aspect, margin = 1.15 }) {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  return Math.max((screenH * margin) / 2 / tanV, (screenW * margin) / 2 / (tanV * aspect));
}

// Projective transform taking the w×h rect (0,0)-(w,h) onto quad [tl, tr, br, bl] (screen px),
// as a CSS matrix3d (column-major). One flat element with this transform hit-tests reliably,
// unlike a DOM element nested inside a preserve-3d/perspective stack.
export function quadMatrix3d(w, h, quad) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  // Solve the 8 homography unknowns h0..h7 (h8 = 1) with Gaussian elimination.
  const A = [];
  const b = [];
  src.forEach(([x, y], i) => {
    const [u, v] = quad[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  });
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const [a, bb, c, d, e, f, g, hh] = b.map((v, i) => v / A[i][i]);
  // u = (a x + bb y + c) / (g x + hh y + 1), v = (d x + e y + f) / (g x + hh y + 1)
  return [a, d, 0, g, bb, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1];
}

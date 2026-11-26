// Finds the photos on a picture of a page (a scan or a phone photo of a menu or a pamphlet): the solid rectangles that are not the
// paper and not print. Plain arithmetic on the pixels, on this device. Text is mostly paper with thin strokes, an ornament is thin
// lines, a photo is filled edge to edge: that is the whole test.

export type Block = { x: number; y: number; w: number; h: number };

/** `rgba`: the picture's pixels (4 bytes each), `w` × `h`. Returns each photo's box in the picture's own pixels, top to bottom. */
export function photoBlocks(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Block[] {
  const C = Math.max(4, Math.round(w / 160)), gw = Math.floor(w / C), gh = Math.floor(h / C); if (gw < 20 || gh < 20) return [];
  // The paper: the commonest colour, counted coarsely.
  const hist = new Map<number, number>();
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) { const i = (y * w + x) * 4, k = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3); hist.set(k, (hist.get(k) || 0) + 1); }
  let bk = 0, bn = -1; for (const [k, n] of hist) if (n > bn) { bn = n; bk = k; }
  const br = ((bk >> 10) & 31) * 8 + 4, bg = ((bk >> 5) & 31) * 8 + 4, bb = (bk & 31) * 8 + 4;
  // A cell is "filled" when nearly all of it is something other than paper.
  const solid = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let off = 0, n = 0;
    for (let y = gy * C; y < gy * C + C; y += 2) for (let x = gx * C; x < gx * C + C; x += 2) { const i = (y * w + x) * 4; if (Math.abs(rgba[i] - br) + Math.abs(rgba[i + 1] - bg) + Math.abs(rgba[i + 2] - bb) > 30) off++; n++; }
    if (off >= n * 0.8) solid[gy * gw + gx] = 1;
  }
  // Groups of filled cells that touch.
  const seen = new Uint8Array(gw * gh), out: Block[] = [], stack: number[] = [];
  for (let s = 0; s < solid.length; s++) {
    if (!solid[s] || seen[s]) continue;
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0, area = 0; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const c = stack.pop()!, cx = c % gw, cy = (c / gw) | 0; area++; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const k = ny * gw + nx; if (solid[k] && !seen[k]) { seen[k] = 1; stack.push(k); } }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    // big enough to be a photo, filled like a rectangle, not a strip, and not the whole page
    if (bw * bh < gw * gh * 0.012 || area < bw * bh * 0.7 || bw / bh > 5 || bh / bw > 5 || bw > gw * 0.9 || bw * bh > gw * gh * 0.6) continue;
    out.push({ x: x0 * C, y: y0 * C, w: bw * C, h: bh * C });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * @file Tap targets from the picture itself: the renderer writes, for every pixel,
 * the id of the surface it shows. A target sits on the point of its surface that is
 * farthest from the surface's boundary (the middle of its widest visible patch), so
 * it is always on the surface it stands for; targets then get pushed apart.
 */

export interface Spot {
  /** Surface id of the id buffer. */
  readonly id: number;
  /** Position in percent of the view. */
  readonly x: number;
  readonly y: number;
  /** Share of the view the surface covers (0..1). */
  readonly area: number;
}

const GRID = 100;

interface Candidate {
  readonly x: number;
  readonly y: number;
  readonly d: number;
}

interface Patch {
  readonly id: number;
  readonly area: number;
  readonly cands: readonly Candidate[];
}

/** Chamfer distance (in grid cells) from every cell of `mask` to the nearest cell outside it; the image border counts as outside. */
function distance(mask: Uint8Array): Float32Array {
  const n = GRID;
  const d = new Float32Array(n * n);
  const big = 1e6;
  for (let i = 0; i < n * n; i += 1) d[i] = mask[i] ? big : 0;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= n || y >= n ? 0 : d[y * n + x]!);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const i = y * n + x;
      if (!mask[i]) continue;
      d[i] = Math.min(d[i]!, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4142, at(x + 1, y - 1) + 1.4142);
    }
  }
  for (let y = n - 1; y >= 0; y -= 1) {
    for (let x = n - 1; x >= 0; x -= 1) {
      const i = y * n + x;
      if (!mask[i]) continue;
      d[i] = Math.min(d[i]!, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4142, at(x - 1, y + 1) + 1.4142);
    }
  }
  return d;
}

/** Per visible surface: its area and the cells of its patches, best (most interior) first. */
export function surfacePatches(ids: Uint8Array, w: number, h: number): Patch[] {
  const count = new Map<number, number>();
  for (let i = 0; i < ids.length; i += 1) {
    const v = ids[i]!;
    if (v) count.set(v, (count.get(v) ?? 0) + 1);
  }
  // One label per grid cell: the id at the cell's centre.
  const label = new Uint8Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy += 1) {
    const py = Math.min(h - 1, Math.floor(((gy + 0.5) * h) / GRID));
    for (let gx = 0; gx < GRID; gx += 1) {
      const px = Math.min(w - 1, Math.floor(((gx + 0.5) * w) / GRID));
      label[gy * GRID + gx] = ids[py * w + px]!;
    }
  }
  const out: Patch[] = [];
  for (const [id, n] of count) {
    const mask = new Uint8Array(GRID * GRID);
    let cells = 0;
    for (let i = 0; i < mask.length; i += 1) {
      if (label[i] === id) {
        mask[i] = 1;
        cells += 1;
      }
    }
    if (!cells) continue;
    const d = distance(mask);
    const cands: Candidate[] = [];
    for (let i = 0; i < d.length; i += 1) if (mask[i]) cands.push({ x: ((i % GRID) + 0.5) / GRID, y: (Math.floor(i / GRID) + 0.5) / GRID, d: d[i]! });
    cands.sort((a, b) => b.d - a.d);
    out.push({ id, area: n / (w * h), cands: cands.slice(0, 400) });
  }
  return out;
}

/**
 * Place one target per wanted surface: on the most interior point of its patch,
 * kept at least `gap` (fraction of the view) from the others, and inside the picture.
 * Small surfaces choose first — they have the fewest options.
 */
export function placeSpots(patches: readonly Patch[], wanted: ReadonlySet<number>, gap = 0.1, reserved: readonly { x: number; y: number }[] = []): Spot[] {
  const list = patches.filter((p) => wanted.has(p.id)).sort((a, b) => a.area - b.area);
  // Reserved points (the ceiling light) are obstacles but not results.
  const placed: Spot[] = reserved.map((r) => ({ id: 0, x: r.x, y: r.y, area: 0 }));
  for (const p of list) {
    const best = p.cands[0];
    if (!best) continue;
    let pick = best;
    let score = -Infinity;
    for (const c of p.cands) {
      // Stay on the interior (within 60% of the best depth), clear of the picture's rim and of other targets.
      if (c.d < Math.max(1.5, best.d * 0.35) && score > -Infinity) continue;
      let pen = 0;
      for (const o of placed) {
        const dist = Math.hypot(o.x / 100 - c.x, o.y / 100 - c.y);
        if (dist < gap) pen += (gap - dist) * 220;
      }
      const rim = Math.min(c.x, c.y, 1 - c.x, 1 - c.y);
      if (rim < 0.05) pen += (0.05 - rim) * 30;
      const s = Math.min(c.d, best.d) - pen;
      if (s > score) {
        score = s;
        pick = c;
      }
    }
    placed.push({ id: p.id, x: pick.x * 100, y: pick.y * 100, area: p.area });
  }
  return placed.filter((s) => s.id !== 0);
}

/** A target at a known screen position (the ceiling lamp), nudged out of the others' way. */
export function nudge(spot: { x: number; y: number }, others: readonly Spot[], gap = 10): { x: number; y: number } {
  let { x, y } = spot;
  for (let i = 0; i < 12; i += 1) {
    const hit = others.find((o) => Math.hypot(o.x - x, o.y - y) < gap);
    if (!hit) break;
    const dy = y - hit.y;
    y += dy >= 0 ? gap * 0.6 : -gap * 0.6;
    x = Math.max(6, Math.min(94, x));
    y = Math.max(6, Math.min(94, y));
  }
  return { x, y };
}

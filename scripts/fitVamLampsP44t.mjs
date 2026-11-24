#!/usr/bin/env node
/**
 * @file Fits the app's ceiling-light art to the П-44Т (Утюжок) rooms.
 *
 * The app has no light on its П-44Т screens (10, 11). We reuse the long loggia's lamp
 * layers (`lamp1_` / `lamp11_`) — but those show a whole row of lights receding down a
 * long ceiling. The Утюжок's ceiling is short and ends at the slanted glazing, so the
 * far lights of that row land on the window frames and walls: they float in mid-air
 * outside the balcony. This keeps only the lights that really sit on the Утюжок's
 * ceiling and adds a soft warm pool of light on that ceiling, writing the result as
 * `lampp1_<k>.webp` (view 0) and `lampp11_<k>.webp` (view 1).
 *
 * Run by `importVamApp.mjs` right after the layers are copied; also usable on its own:
 *   node scripts/fitVamLampsP44t.mjs [public/vam/x]
 */
import path from 'node:path';
import sharp from 'sharp';

const W = 800;
const MODELS = [1, 2, 3, 4, 5, 6];

/** [source prefix, fitted prefix, ceiling outline in the 800x800 view (img10_0 / img10_1)]. */
const VIEWS = [
  ['lamp1_', 'lampp1_', [[108, 0], [722, 0], [580, 98], [487, 162], [440, 186]]],
  ['lamp11_', 'lampp11_', [[112, 0], [714, 0], [710, 124], [366, 196], [250, 132], [112, 42]]],
];

/** Where a vertical line at x leaves the ceiling outline (its lowest point there). */
function ceilingBottom(poly, x) {
  let bottom = -1;
  for (let i = 0; i < poly.length; i += 1) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    if ((ax - x) * (bx - x) > 0 || ax === bx) continue;
    bottom = Math.max(bottom, ay + ((x - ax) / (bx - ax)) * (by - ay));
  }
  return bottom;
}

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Connected pieces of the art (pixels within 2 px of each other belong together). */
function pieces(data) {
  const lab = new Int32Array(W * W);
  const out = [];
  for (let i = 0; i < W * W; i += 1) {
    if (data[i * 4 + 3] < 20 || lab[i]) continue;
    const id = out.length + 1;
    const stack = [i];
    lab[i] = id;
    const c = { id, x0: W, x1: 0, y0: W, y1: 0, n: 0 };
    while (stack.length) {
      const j = stack.pop();
      const x = j % W;
      const y = (j / W) | 0;
      c.n += 1;
      c.x0 = Math.min(c.x0, x);
      c.x1 = Math.max(c.x1, x);
      c.y0 = Math.min(c.y0, y);
      c.y1 = Math.max(c.y1, y);
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
          const q = ny * W + nx;
          if (!lab[q] && data[q * 4 + 3] >= 20) {
            lab[q] = id;
            stack.push(q);
          }
        }
      }
    }
    out.push(c);
  }
  return { lab, out };
}

async function fitOne(dir, from, to, poly, k) {
  const { data } = await sharp(path.join(dir, `${from}${k}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { lab, out } = pieces(data);
  // A piece belongs on the ceiling when it hangs from the top of the picture or ends well above the ceiling's far edge.
  const keep = new Set(out.filter((c) => c.n > 15 && (c.y0 <= 8 || c.y1 < ceilingBottom(poly, (c.x0 + c.x1) / 2) - 6)).map((c) => c.id));
  const rgba = Buffer.alloc(W * W * 4);
  // The lit parts: where the pool of light is centred.
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (let i = 0; i < W * W; i += 1) {
    if (!keep.has(lab[i])) continue;
    const o = i * 4;
    if (data[o + 3] > 200 && Math.min(data[o], data[o + 1], data[o + 2]) > 232) {
      sx += i % W;
      sy += (i / W) | 0;
      sw += 1;
    }
  }
  const cx = sw ? sx / sw : W / 2;
  const cy = sw ? sy / sw : 40;
  const radius = k === 5 || k === 6 ? 230 : 190;
  const strength = k === 1 || k === 4 ? 0.2 : 0.24;
  for (let y = 0; y < W; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const o = i * 4;
      // Soft warm pool on the ceiling only (feathered towards the outline's far edge).
      let a = 0;
      if (inside(poly, x, y)) {
        const d = Math.hypot((x - cx) * 1.15, y - cy) / radius;
        if (d < 1) a = strength * (1 - d * d) * (1 - d * d) * Math.min(1, (ceilingBottom(poly, x) - y) / 24);
      }
      let r = 255;
      let g = 242;
      let b = 214;
      let alpha = a * 255;
      if (keep.has(lab[i])) {
        // Source pixel over the glow (normal "over").
        const sa = data[o + 3] / 255;
        const oa = sa + (alpha / 255) * (1 - sa);
        if (oa > 0) {
          r = (data[o] * sa + r * (alpha / 255) * (1 - sa)) / oa;
          g = (data[o + 1] * sa + g * (alpha / 255) * (1 - sa)) / oa;
          b = (data[o + 2] * sa + b * (alpha / 255) * (1 - sa)) / oa;
        }
        alpha = oa * 255;
      }
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = alpha;
    }
  }
  await sharp(rgba, { raw: { width: W, height: W, channels: 4 } }).webp({ quality: 92, alphaQuality: 100, effort: 4 }).toFile(path.join(dir, `${to}${k}.webp`));
}

/**
 * Write the fitted lamp layers of every model for both views into `dir`.
 * @param {string} dir The `public/vam/x` folder holding the source `lamp1_*` / `lamp11_*` layers.
 * @returns {Promise<number>} Files written.
 */
export async function fitLampsP44t(dir) {
  let n = 0;
  for (const [from, to, poly] of VIEWS) {
    for (const k of MODELS) {
      await fitOne(dir, from, to, poly, k);
      n += 1;
    }
  }
  return n;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const dir = path.resolve(process.argv[2] ?? 'public/vam/x');
  console.log(`${await fitLampsP44t(dir)} fitted lamp layers in ${dir}`);
}

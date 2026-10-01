#!/usr/bin/env node
/**
 * @file Makes the street panorama seen through the windows of the "по чертежу"
 * room renderer (`public/vam/tex/street-pano.webp`): an equirectangular strip,
 * 360° of azimuth across and +40°..-40° of elevation down, built from two clean
 * window panes of the app's own renders (`public/vam/x/bg/img3_7.webp`): the winter
 * sky with panel-block houses on the horizon, and the frosted trees under them.
 * The panes are small, so the result is soft — right for a hazy backdrop.
 *
 * The strip is eight 45° tiles. Every tile has the same plain edges (hazy sky over
 * a frosted tree line), so any sequence joins seamlessly with no mirror axis; three
 * tiles carry the houses in their middle, the rest are tree line with different
 * slides of the foliage. The sky is smoothed from the panes' row averages.
 *
 * Usage: node scripts/importVamStreet.mjs
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = path.resolve('public/vam/x/bg/img3_7.webp');
const OUT = path.resolve('public/vam/tex');
const W = 2048;
const H = 512;
const TILES = 8;
const TILE_W = W / TILES;
const HORIZON = H / 2;
const HOUSE_ZOOM = 1.32; // the houses look a bit nearer than the pane's raw scale

/** A pane of the render as raw RGB. */
async function pane(left, top, width, height) {
  const { data, info } = await sharp(SRC).flatten({ background: '#888' }).extract({ left, top, width, height }).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

async function scale(p, w, h) {
  const { data, info } = await sharp(p.data, { raw: { width: p.w, height: p.h, channels: 3 } }).resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const smooth = (q) => {
  const t = Math.max(0, Math.min(1, q));
  return t * t * (3 - 2 * t);
};

const housesSrc = await pane(340, 257, 152, 182); // sky, houses and a tower on the horizon, trees under them
const treesSrc = await pane(340, 472, 90, 126); // frosted trees (the snowy bank is to the right of this crop)

const scaleH = (TILE_W / housesSrc.w) * HOUSE_ZOOM;
const hs = await scale(housesSrc, Math.round(housesSrc.w * scaleH), Math.round(housesSrc.h * scaleH));
const hX0 = Math.floor((hs.w - TILE_W) / 2); // centre crop
const ts = await scale(treesSrc, TILE_W, Math.round(treesSrc.h * (TILE_W / treesSrc.w)));
const hH = hs.h;
const tH = ts.h;
const feetRow = Math.round(0.8 * hH); // the houses' feet are at eye level
const hTop = HORIZON - feetRow;

const hAt = (x, y, c) => hs.data[(y * hs.w + x + hX0) * 3 + c];
const tAt = (x, y, c) => ts.data[(Math.min(tH - 1, y) * TILE_W + x) * 3 + c];

/** Mean colour of the houses pane per row: the sky has no horizontal detail. */
const rowAvg = [];
for (let y = 0; y < hH; y += 1) {
  const m = [0, 0, 0];
  for (let x = 0; x < TILE_W; x += 1) for (let c = 0; c < 3; c += 1) m[c] += hAt(x, y, c);
  rowAvg.push(m.map((v) => v / TILE_W));
}
const skyAt = (y) => rowAvg[Math.max(0, Math.min(Math.round(0.5 * hH), y - hTop))];
const haze = skyAt(HORIZON);

// The foliage is brought to the haze's brightness at the horizon.
const treesTop = [0, 1, 2].map((c) => {
  let s = 0;
  for (let x = 0; x < TILE_W; x += 1) for (let y = 0; y < 6; y += 1) s += tAt(x, y, c);
  return s / (TILE_W * 6);
});
const gain = haze.map((v, c) => v / Math.max(1, treesTop[c]));

/** The plain tree-line tile: haze, a faint frosted silhouette, then foliage emerging below the horizon. */
function treeTile() {
  const out = new Float32Array(TILE_W * H * 3);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < TILE_W; x += 1) {
      const sk = skyAt(y);
      let rgb;
      const below = y - HORIZON;
      if (below < 0) {
        // A faint silhouette of tree tops above the horizon, fading upwards.
        const f = smooth(1 + below / 46) * 0.42;
        const sy = Math.min(tH - 1, -below);
        rgb = [0, 1, 2].map((c) => sk[c] * (1 - f) + tAt(x, sy, c) * gain[c] * f);
      } else {
        // 0.42 -> 1 over 80 px: continuous with the silhouette above.
        const f = 0.42 + 0.58 * smooth(below / 80);
        rgb = [0, 1, 2].map((c) => haze[c] * (1 - f) + tAt(x, below, c) * gain[c] * f);
      }
      const o = (y * TILE_W + x) * 3;
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
    }
  }
  return out;
}

const treeT = treeTile();
// The houses tile: the pane fades into the plain tile towards both edges.
const houseT = new Float32Array(treeT.length);
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < TILE_W; x += 1) {
    const q = x / (TILE_W - 1);
    const w = smooth(Math.min(q, 1 - q) / 0.24);
    const py = y - hTop;
    for (let c = 0; c < 3; c += 1) {
      const o = (y * TILE_W + x) * 3 + c;
      let v = treeT[o];
      if (py >= 0 && py < hH) {
        // The pane's own sky is flattened to the smooth sky; the houses and trees keep their pixels.
        const keep = smooth((py - 0.5 * hH) / (0.12 * hH));
        const px = hAt(x, py, c);
        const paneV = skyAt(y)[c] * (1 - keep) + px * keep;
        // Below the pane the plain foliage takes over smoothly.
        const tail = py > hH - 24 ? smooth((hH - py) / 24) : 1;
        v = treeT[o] * (1 - w * tail) + paneV * w * tail;
      }
      houseT[o] = v;
    }
  }
}

// `shift` slides the plain tiles' foliage (wrapping mirrored) so the repeats differ.
const plan = [
  { t: houseT, flip: false, shift: 0 },
  { t: treeT, flip: false, shift: 40 },
  { t: treeT, flip: true, shift: 110 },
  { t: houseT, flip: true, shift: 0 },
  { t: treeT, flip: false, shift: 170 },
  { t: treeT, flip: true, shift: 15 },
  { t: houseT, flip: false, shift: 0 },
  { t: treeT, flip: true, shift: 80 },
];
const pano = Buffer.alloc(W * H * 3);
for (let i = 0; i < TILES; i += 1) {
  const { t, flip, shift } = plan[i];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < TILE_W; x += 1) {
      let sx = flip ? TILE_W - 1 - x : x;
      if (shift) {
        const p = (((sx + shift) % (2 * TILE_W)) + 2 * TILE_W) % (2 * TILE_W);
        sx = p < TILE_W ? p : 2 * TILE_W - 1 - p;
      }
      // Tone varies smoothly around the whole circle, so no tile edge shows.
      const g = 1 + 0.035 * Math.sin(((i * TILE_W + x) / W) * Math.PI * 6 + 0.7) + 0.02 * Math.sin((y / H) * 5);
      const o = (y * W + i * TILE_W + x) * 3;
      for (let c = 0; c < 3; c += 1) pano[o + c] = Math.max(0, Math.min(255, Math.round(t[(y * TILE_W + sx) * 3 + c] * g)));
    }
  }
}

mkdirSync(OUT, { recursive: true });
await sharp(pano, { raw: { width: W, height: H, channels: 3 } })
  .blur(1.3)
  .webp({ quality: 90 })
  .toFile(path.join(OUT, 'street-pano.webp'));
console.log(`street-pano.webp ${W}x${H} in ${OUT}`);

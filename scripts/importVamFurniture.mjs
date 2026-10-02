#!/usr/bin/env node
/**
 * @file Cuts three decor sprites out of the app's own renders for the "по чертежу"
 * room renderer's `furniture` layer, in every colour the app itself offers: a low
 * storage bench, a wall-mounted drying rack and a window planter. Unlike the window
 * units (`importVamWindows.mjs`) these are shown as drawn — cropped to their alpha
 * and padded, not rectified — because the app itself draws them as angled
 * billboards, not flat profiles; precision matters for a window's frame width, not
 * for a decoration's silhouette.
 *
 * Every colour of one item is cropped to the SAME pixel box (measured off the app's
 * own colour-1 frame — colour 0 is a fully transparent placeholder layer for all
 * three items, confirmed by its alpha and skipped): the pose never changes between
 * colours, only the material, so this keeps every colour pixel-aligned — swapping
 * colour never shifts or resizes the sprite.
 *
 * Source (one series each; see `docs/apk-to-plan-mapping.md` for the matching catalogue entry):
 * - `furn-cabinet-K.webp` (K=1..19) — `construktor/shkaf/shkaf0_1_K.webp` (low bench, "0j" — jaluzi doors);
 * - `furn-dryer-K.webp` (K=1..8) — `construktor/dryer/chair1_1_K.webp` (wall drying rack);
 * - `furn-flowers-K.webp` (K=1..3) — `construktor/flowers/chair2_1_K.webp` (window planter).
 *
 * Usage: node scripts/importVamFurniture.mjs [path-to-VamBalkon_extract]
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const extractRoot = process.argv[2] ?? 'D:\\VamBalkon_extract';
const SRC = path.join(extractRoot, 'construktor');
const OUT = path.resolve('public/vam/tex');
const PAD = 14;

const ITEMS = [
  { cat: 'cabinet', dir: 'shkaf', prefix: 'shkaf0_1_', count: 20 },
  { cat: 'dryer', dir: 'dryer', prefix: 'chair1_1_', count: 9 },
  { cat: 'flowers', dir: 'flowers', prefix: 'chair2_1_', count: 4 },
];

/** The source layer as the app itself places it: an 800x800 piece (a 1200 canvas is its centre 800, 200 px margin all round — same convention as `importVamApp.mjs`'s `layer800`). */
async function layer800(file) {
  const md = await sharp(file).metadata();
  if (md.width === 1200 && md.height === 1200) return sharp(file).extract({ left: 200, top: 200, width: 800, height: 800 }).toBuffer();
  return sharp(file).toBuffer();
}

async function alphaBBox(file) {
  const { data, info } = await sharp(await layer800(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let y0 = info.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { w: info.width, h: info.height, x0, y0, x1, y1 };
}

mkdirSync(OUT, { recursive: true });

for (const { cat, dir, prefix, count } of ITEMS) {
  // Measure the crop box off colour 1 (colour 0 is a flat grey placeholder in some series).
  const probe = await alphaBBox(path.join(SRC, dir, `${prefix}1.webp`));
  const left = Math.max(0, probe.x0 - PAD);
  const top = Math.max(0, probe.y0 - PAD);
  const width = Math.min(probe.w - left, probe.x1 - probe.x0 + 1 + 2 * PAD);
  const height = Math.min(probe.h - top, probe.y1 - probe.y0 + 1 + 2 * PAD);
  // Colour 0 is a blank placeholder in the app's own assets for every series tried so far — skip it.
  for (let k = 1; k < count; k += 1) {
    const src = path.join(SRC, dir, `${prefix}${k}.webp`);
    await sharp(await layer800(src)).extract({ left, top, width, height }).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(OUT, `furn-${cat}-${k}.webp`));
  }
  console.log(`furn-${cat}-1..${count - 1}.webp: ${width}x${height} (aspect ${(width / height).toFixed(3)})`);
}

#!/usr/bin/env node
/**
 * @file Cuts three decor sprites out of the app's own renders for the "по чертежу"
 * room renderer's `furniture` layer: a low storage bench, a wall-mounted drying
 * rack and a window planter. Unlike the window units (`importVamWindows.mjs`) these
 * are shown as drawn — cropped to their alpha and padded, not rectified — because
 * the app itself draws them as angled billboards, not flat profiles; precision
 * matters for a window's frame width, not for a decoration's silhouette.
 *
 * Source crops (one colour each; the app's own colour picker is not wired yet —
 * see docs/apk-to-plan-mapping.md):
 * - `furn-cabinet.webp` — `construktor/shkaf/shkaf0_1_1.webp` (low bench, colour 1);
 * - `furn-dryer.webp` — `construktor/dryer/chair1_1_1.webp` (wall drying rack);
 * - `furn-flowers.webp` — `construktor/flowers/chair2_1_1.webp` (window planter).
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
  { file: 'shkaf/shkaf0_1_1.webp', out: 'furn-cabinet.webp' },
  { file: 'dryer/chair1_1_1.webp', out: 'furn-dryer.webp' },
  { file: 'flowers/chair2_1_1.webp', out: 'furn-flowers.webp' },
];

mkdirSync(OUT, { recursive: true });

for (const { file, out } of ITEMS) {
  const src = path.join(SRC, file);
  const img = sharp(src);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  const left = Math.max(0, x0 - PAD);
  const top = Math.max(0, y0 - PAD);
  const width = Math.min(info.width - left, x1 - x0 + 1 + 2 * PAD);
  const height = Math.min(info.height - top, y1 - y0 + 1 + 2 * PAD);
  await sharp(src).extract({ left, top, width, height }).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(OUT, out));
  console.log(`${out}: ${width}x${height} (aspect ${(width / height).toFixed(3)}) from ${file}`);
}

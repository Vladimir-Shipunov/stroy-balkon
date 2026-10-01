#!/usr/bin/env node
/**
 * @file Makes the flat, tileable material textures used by the
 * "по чертежу" room renderer (`public/vam/tex/`). The app only ships its finishes
 * as pictures of finished rooms, so a texture is cut from the front-on end wall of
 * such a picture and its lighting gradient is flattened.
 *
 * Usage: node scripts/importVamTextures.mjs [path-to-VamBalkon_extract]
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const extractRoot = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'D:\\VamBalkon_extract';
const SRC = path.join(extractRoot, 'construktor');
const IMG = path.join(extractRoot, 'APK', 'assets', 'flutter_assets', 'assets', 'images');
const OUT = path.resolve('public/vam/tex');
const SIZE = 512;

/** Opaque bounding box of an image. */
async function bbox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * 4 + 3] > 200) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** A square texture cut from the middle of a front-on wall piece, lighting flattened. */
async function textureFromPiece(file) {
  const box = await bbox(file);
  if (!box) return null;
  const side = Math.floor(Math.min(box.width, box.height) * 0.6);
  if (side < 40) return null;
  const left = box.left + Math.floor((box.width - side) / 2);
  const top = box.top + Math.floor((box.height - side) / 2);
  const crop = await sharp(file).extract({ left, top, width: side, height: side }).flatten({ background: '#888' }).resize(SIZE, SIZE, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const blur = await sharp(crop.data, { raw: crop.info }).blur(40).raw().toBuffer();
  // texture * (mean / local mean): removes the gradient, keeps the planks and the colour.
  const px = SIZE * SIZE;
  const mean = [0, 0, 0];
  for (let i = 0; i < px; i += 1) for (let c = 0; c < 3; c += 1) mean[c] += crop.data[i * 3 + c];
  for (let c = 0; c < 3; c += 1) mean[c] /= px;
  const out = Buffer.alloc(px * 3);
  for (let i = 0; i < px; i += 1) for (let c = 0; c < 3; c += 1) {
    const b = Math.max(1, blur[i * 3 + c]);
    out[i * 3 + c] = Math.max(0, Math.min(255, Math.round((crop.data[i * 3 + c] * mean[c]) / b)));
  }
  return sharp(out, { raw: { width: SIZE, height: SIZE, channels: 3 } });
}

const FAMILIES = [
  { id: 'laminat', dir: (m) => path.join(SRC, 'stena6'), m: 3 },
  { id: 'vagonka', dir: () => path.join(SRC, 'vagonka', '4m', 'stena6'), m: 3 },
  { id: 'parket', dir: () => path.join(SRC, 'sten_parket', '4m', 'stena6'), m: 3 },
  { id: 'mdf', dir: () => path.join(SRC, 'mdf', 'stena6'), m: 2 },
];

rmSync(OUT, { recursive: true, force: true });
let count = 0;
for (const fam of FAMILIES) {
  const dir = fam.dir();
  const prefix = `cvet${fam.m}_`;
  for (const f of readdirSync(dir)) {
    if (!f.startsWith(prefix) || !f.endsWith('.webp')) continue;
    const k = f.slice(prefix.length, -5);
    if (!/^\d+$/.test(k)) continue;
    const tex = await textureFromPiece(path.join(dir, f));
    if (!tex) {
      console.warn(`skip ${fam.id}/${k}`);
      continue;
    }
    mkdirSync(path.join(OUT, fam.id), { recursive: true });
    await tex.webp({ quality: 92 }).toFile(path.join(OUT, fam.id, `${k}.webp`));
    count += 1;
  }
}

// Floor tiles: the app's own tile pictures.
for (let k = 0; k <= 5; k += 1) {
  const f = path.join(IMG, `plitka_cvet${k}.webp`);
  if (!existsSync(f)) continue;
  mkdirSync(path.join(OUT, 'plitka'), { recursive: true });
  await sharp(f).resize(SIZE, SIZE, { kernel: 'lanczos3' }).webp({ quality: 92 }).toFile(path.join(OUT, 'plitka', `${k}.webp`));
  count += 1;
}

// The street seen through the windows is made by importVamStreet.mjs (street-pano.webp).
mkdirSync(OUT, { recursive: true });
console.log(`${count} textures in ${OUT}`);

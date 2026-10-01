#!/usr/bin/env node
/**
 * @file Cuts a front-on window out of the app's own render for the "по чертежу"
 * room renderer. The app has no flat window images — every window is part of a fixed
 * camera render — so the right pane of the balcony block in `img10_0` (white PVC
 * frame, dark gasket, glass with the apartment's curtains behind) is rectified with a
 * homography: the four glass corners go to an upright rectangle, and the frame ring
 * round it is read from the same plane (a homography extrapolates perspective
 * exactly), so the profile keeps its real proportions.
 *
 * Writes into `public/vam/tex/`:
 * - `win-house.webp` — frame + glass with the curtains, opaque: the apartment's own
 *   door / window block in the house wall;
 * - `win-frame.webp` — the same with the glass cut out (alpha 0) and the frame
 *   desaturated to its shading: a profile that the renderer recolours with the chosen
 *   frame colour; the street shows through the hole.
 *
 * The renderer stretches both as 9-slice images (`render/units.ts` — border widths
 * below must match `BORDER_PX` there).
 *
 * Usage: node scripts/importVamWindows.mjs
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = path.resolve('public/vam/x/bg/img10_0.webp');
const OUT = path.resolve('public/vam/tex');

/** Glass corners in the source render: TL, TR, BR, BL. */
const GLASS = [
  [235, 175],
  [381, 227],
  [381, 498],
  [238, 538],
];
/** Output: the glass rectangle and the frame ring round it, px. */
const GW = 240;
const GH = 350;
const BORDER = { l: 37, r: 34, t: 24, b: 24 };
const W = GW + BORDER.l + BORDER.r;
const H = GH + BORDER.t + BORDER.b;
/** Glass pixels this close to the gasket stay opaque in the frame variant. */
const GASKET = 3;

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

/** Homography unit square -> quad (Heckbert). */
function homography(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return { a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0, d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h };
}

const H0 = homography(GLASS);
const px = (x, y, k) => data[(Math.min(info.height - 1, Math.max(0, y)) * info.width + Math.min(info.width - 1, Math.max(0, x))) * 4 + k];
const house = Buffer.alloc(W * H * 3);
const frame = Buffer.alloc(W * H * 4);
const REF = 0.8; // luma of the render's lit white frame (its 60th percentile): shading is measured against it

for (let j = 0; j < H; j += 1) {
  for (let i = 0; i < W; i += 1) {
    // Position in the glass's own unit square (outside 0..1 = the frame ring).
    const u = (i + 0.5 - BORDER.l) / GW;
    const v = (j + 0.5 - BORDER.t) / GH;
    const k = H0.g * u + H0.h * v + 1;
    const sx = (H0.a * u + H0.b * v + H0.c) / k - 0.5;
    const sy = (H0.d * u + H0.e * v + H0.f) / k - 0.5;
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    const fx = sx - ix;
    const fy = sy - iy;
    const c = [0, 1, 2].map((ch) => px(ix, iy, ch) * (1 - fx) * (1 - fy) + px(ix + 1, iy, ch) * fx * (1 - fy) + px(ix, iy + 1, ch) * (1 - fx) * fy + px(ix + 1, iy + 1, ch) * fx * fy);
    house.set(c.map((x) => Math.round(x)), (j * W + i) * 3);
    const inGlass = i >= BORDER.l + GASKET && i < BORDER.l + GW - GASKET && j >= BORDER.t + GASKET && j < BORDER.t + GH - GASKET;
    // Frame variant: grey shading only (the renderer multiplies it by the frame colour).
    const luma = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
    const shade = Math.max(0.35, Math.min(1.12, luma / REF));
    const g8 = Math.round(Math.min(1, shade / 1.12) * 255);
    frame.set([g8, g8, g8, inGlass ? 0 : 255], (j * W + i) * 4);
  }
}

mkdirSync(OUT, { recursive: true });
await sharp(house, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 92 }).toFile(path.join(OUT, 'win-house.webp'));
await sharp(frame, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(OUT, 'win-frame.webp'));
console.log(`win-house.webp, win-frame.webp: ${W}x${H}, borders l${BORDER.l} r${BORDER.r} t${BORDER.t} b${BORDER.b}`);

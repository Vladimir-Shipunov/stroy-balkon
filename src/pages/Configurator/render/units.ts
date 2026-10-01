/**
 * @file Window units: front-on images of a window (frame ring + glass) cut out of the
 * app's own render (`scripts/importVamWindows.mjs`), stretched onto a face as a
 * 9-slice — the frame ring keeps a fixed width in mm, only the glass in the middle
 * stretches — so a profile never gets fatter or thinner with the size of the window.
 */
import type { UnitImage, UnitMap } from './types';

export const WIN_HOUSE_URL = '/vam/tex/win-house.webp';
export const WIN_FRAME_URL = '/vam/tex/win-frame.webp';

/** Width of the frame ring in the source images, px (measured by the importer). */
export const UNIT_BORDER_PX = { l: 37, r: 34, t: 24, b: 24 } as const;
/** The frame image stores shade / this, so white shades at 1: see the importer. */
export const FRAME_SHADE_MAX = 1.12;

/** Decode RGBA bytes into a float image with a box-filtered mip chain. */
export function makeUnitImage(w: number, h: number, rgba: Uint8ClampedArray): UnitImage {
  let cw = w;
  let ch = h;
  let rgb = new Float32Array(cw * ch * 3);
  let a = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i += 1) {
    rgb[i * 3] = rgba[i * 4]! / 255;
    rgb[i * 3 + 1] = rgba[i * 4 + 1]! / 255;
    rgb[i * 3 + 2] = rgba[i * 4 + 2]! / 255;
    a[i] = rgba[i * 4 + 3]! / 255;
  }
  const levels = [{ w: cw, h: ch, rgb, a }];
  while (cw > 8 && ch > 8) {
    const nw = cw >> 1;
    const nh = ch >> 1;
    const nrgb = new Float32Array(nw * nh * 3);
    const na = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y += 1) {
      for (let x = 0; x < nw; x += 1) {
        const i0 = 2 * y * cw + 2 * x;
        const i1 = i0 + 1;
        const i2 = i0 + cw;
        const i3 = i2 + 1;
        na[y * nw + x] = (a[i0]! + a[i1]! + a[i2]! + a[i3]!) / 4;
        for (let c = 0; c < 3; c += 1) nrgb[(y * nw + x) * 3 + c] = (rgb[i0 * 3 + c]! + rgb[i1 * 3 + c]! + rgb[i2 * 3 + c]! + rgb[i3 * 3 + c]!) / 4;
      }
    }
    cw = nw;
    ch = nh;
    rgb = nrgb;
    a = na;
    levels.push({ w: cw, h: ch, rgb, a });
  }
  return { levels };
}

/**
 * Position along one axis of the image for a position `t` mm into a span of `total` mm: the
 * first `b` mm map to the first `lo` px, the last `b` mm to the last `hi` px, the middle
 * stretches over the rest.
 */
function slice(t: number, total: number, b: number, lo: number, hi: number, n: number): number {
  if (t <= b) return (Math.max(0, t) / b) * lo;
  if (t >= total - b) return n - (Math.max(0, total - t) / b) * hi;
  return lo + ((t - b) / (total - 2 * b)) * (n - lo - hi);
}

/** Scratch result of `sampleUnit` (r, g, b, alpha) — one per thread, no allocation per pixel. */
export const unitPixel = new Float32Array(4);

/**
 * Sample a unit image at face position (u, v) mm. `foot` is the pixel footprint in mm
 * (picks the mip level). Writes `unitPixel`.
 */
export function sampleUnit(img: UnitImage, m: UnitMap, u: number, v: number, foot: number): void {
  const total_u = m.u1 - m.u0;
  const total_v = m.v1 - m.v0;
  // Narrow units: the ring cannot be wider than half the unit.
  const b = Math.max(1, Math.min(m.b, total_u / 2 - 0.01, total_v / 2 - 0.01));
  const L0 = img.levels[0]!;
  let lev = 0;
  let px = (foot * UNIT_BORDER_PX.l) / b;
  while (px > 1.5 && lev < img.levels.length - 1) {
    px *= 0.5;
    lev += 1;
  }
  const T = img.levels[lev]!;
  const k = T.w / L0.w;
  const sx = slice(u - m.u0, total_u, b, UNIT_BORDER_PX.l, UNIT_BORDER_PX.r, L0.w) * k - 0.5;
  // Image rows run downwards, v upwards.
  const sy = slice(m.v1 - v, total_v, b, UNIT_BORDER_PX.t, UNIT_BORDER_PX.b, L0.h) * k - 0.5;
  let ix = Math.floor(sx);
  let iy = Math.floor(sy);
  const ax = sx - ix;
  const ay = sy - iy;
  const x1 = Math.min(T.w - 1, Math.max(0, ix + 1));
  const y1 = Math.min(T.h - 1, Math.max(0, iy + 1));
  ix = Math.min(T.w - 1, Math.max(0, ix));
  iy = Math.min(T.h - 1, Math.max(0, iy));
  const w00 = (1 - ax) * (1 - ay);
  const w10 = ax * (1 - ay);
  const w01 = (1 - ax) * ay;
  const w11 = ax * ay;
  const p00 = iy * T.w + ix;
  const p10 = iy * T.w + x1;
  const p01 = y1 * T.w + ix;
  const p11 = y1 * T.w + x1;
  const f = T.rgb;
  unitPixel[0] = f[p00 * 3]! * w00 + f[p10 * 3]! * w10 + f[p01 * 3]! * w01 + f[p11 * 3]! * w11;
  unitPixel[1] = f[p00 * 3 + 1]! * w00 + f[p10 * 3 + 1]! * w10 + f[p01 * 3 + 1]! * w01 + f[p11 * 3 + 1]! * w11;
  unitPixel[2] = f[p00 * 3 + 2]! * w00 + f[p10 * 3 + 2]! * w10 + f[p01 * 3 + 2]! * w01 + f[p11 * 3 + 2]! * w11;
  unitPixel[3] = T.a[p00]! * w00 + T.a[p10]! * w10 + T.a[p01]! * w01 + T.a[p11]! * w11;
}

/**
 * @file The resampler behind a warped frame (`vamWarp.ts`): it turns the flattened photo (800 x 800, every
 * layer of the view composited) into the finished frame at the size the screen actually shows — device
 * pixels — in ONE pass, every output column with its own horizontal window and vertical scale and a proper
 * kernel (Catmull-Rom, widened when the picture is squeezed so it is filtered rather than aliased).
 *
 * Why not `drawImage` column by column onto an 800 px canvas, which is what the first version did: the
 * browser then scaled that canvas to the frame a second time (and by a fractional factor, 800 → ~730 px), and
 * each of the two bilinear steps softens the picture — grain of a finish, joints between boards, window
 * frames all lose their edge. A finished frame at the display's own resolution is resampled once, from the
 * original pixels, exactly like the plain `<img>` layers of the other frame.
 *
 * Pure maths on typed arrays — no DOM — so it is unit-tested in node.
 */
import { warpColumn } from './vamWarp';
import type { WarpLayout } from './vamWarp';

/** An opaque RGBA picture. */
export interface Raster {
  readonly data: Uint8ClampedArray | Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** How the frame shows the warped picture: the fit's zoom about the centre and its pan (percent of the frame). */
export interface WarpView {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly shiftX: number;
  readonly shiftY: number;
}

/** The view of a spec: no zoom and no pan unless it names them. */
export function warpViewOf(fit: { readonly scaleX?: number; readonly scaleY?: number; readonly shift?: readonly [number, number] } | undefined): WarpView {
  return { scaleX: fit?.scaleX ?? 1, scaleY: fit?.scaleY ?? 1, shiftX: fit?.shift?.[0] ?? 0, shiftY: fit?.shift?.[1] ?? 0 };
}

/** Catmull-Rom cubic: sharp, no blur of a 1:1 pixel grid, only a whisper of overshoot. */
export function catmullRom(x: number): number {
  const t = Math.abs(x);
  if (t < 1) return 1.5 * t * t * t - 2.5 * t * t + 1;
  if (t < 2) return -0.5 * t * t * t + 2.5 * t * t - 4 * t + 2;
  return 0;
}

/** From this many source pixels per output pixel the kernel is widened to filter rather than alias. */
const MINIFY_FROM = 1.25;
/** The widest the kernel is made (source pixels per output pixel): past it the picture is a few output pixels wide and a tap buffer must stay bounded. */
export const MAX_KERNEL_SCALE = 64;
/** Farther than this from the picture a position is nonsense (and `i += 1` stops advancing near 2^53): the edge pixel is taken. */
const MAX_CENTRE = 1e7;

/** Upper bound of the taps `kernelTaps` can write for a scale. */
export const maxTaps = (scale: number): number => Math.ceil(4 * Math.max(1, scale)) + 4;

/**
 * The taps of one output sample: source pixel indices (clamped to the picture, so its edge carries on) and their
 * weights (summing to 1) for a sample at continuous source coordinate `centre` (pixel `i` covers [i, i + 1]) when
 * `scale` source pixels fall on one output pixel. The kernel is widened by the scale only where the picture is really
 * minified (squeezed to under ~0.8): there a plain kernel would alias; for the gentle scales of a frame that merely
 * shows the picture a little smaller or larger than it is, widening only blurs — measured on the same photo, a plain
 * Catmull-Rom is about 10 % crisper than the browser's own `<img>` scaling and a widened one only matches it.
 * @returns How many taps were written.
 */
export function kernelTaps(centre: number, scale: number, size: number, indices: Int32Array, weights: Float32Array): number {
  // Nothing sensible can be sampled from a non-finite position or width: take the nearest pixel, so one bad column cannot hang the page.
  if (!Number.isFinite(centre) || !Number.isFinite(scale) || scale <= 0 || Math.abs(centre) > MAX_CENTRE) {
    indices[0] = Number.isFinite(centre) ? Math.min(size - 1, Math.max(0, Math.floor(Math.min(MAX_CENTRE, Math.max(-MAX_CENTRE, centre))))) : 0;
    weights[0] = 1;
    return 1;
  }
  const s = Math.min(MAX_KERNEL_SCALE, scale < MINIFY_FROM ? 1 : scale);
  const first = Math.ceil(centre - 2 * s - 0.5);
  const last = Math.floor(centre + 2 * s - 0.5);
  let total = 0;
  let count = 0;
  for (let i = first; i <= last; i += 1) {
    const w = catmullRom((i + 0.5 - centre) / s);
    if (w === 0) continue;
    indices[count] = Math.min(size - 1, Math.max(0, i));
    weights[count] = w;
    total += w;
    count += 1;
  }
  for (let k = 0; k < count; k += 1) weights[k] = weights[k]! / total;
  return count;
}

/**
 * The finished frame: `outWidth` x `outHeight` opaque RGBA pixels of the warped picture shown through `view`.
 * Output pixel (i, j) is the frame at (i + .5) / outWidth, (j + .5) / outHeight of its size; the picture it shows
 * there is found through the fit's zoom/pan and the warp's own column maps, and the rows the picture does not
 * reach (above its first, below its last) repeat its edge row.
 */
export function resampleWarp(source: Raster, layout: WarpLayout, view: WarpView, outWidth: number, outHeight: number): Uint8ClampedArray<ArrayBuffer> {
  const { width: sw, height: sh } = source;
  const out = new Uint8ClampedArray(new ArrayBuffer(outWidth * outHeight * 4));
  // Column-major planes: one source column is then one contiguous run per channel.
  const planes = [0, 1, 2].map((channel) => {
    const plane = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) plane[x * sh + y] = source.data[(y * sw + x) * 4 + channel]!;
    return plane;
  });
  const columnRows = [0, 1, 2].map(() => new Float32Array(sh));
  // Room for the widest kernel there is.
  const capacity = maxTaps(MAX_KERNEL_SCALE);
  const hIndices = new Int32Array(capacity);
  const hWeights = new Float32Array(capacity);
  const vIndices = new Int32Array(capacity);
  const vWeights = new Float32Array(capacity);
  const dropPerColumn = 100 / (outWidth * view.scaleX);

  for (let i = 0; i < outWidth; i += 1) {
    // The column of the picture (before the fit's zoom/pan) this output column shows.
    const screenX = ((i + 0.5) / outWidth) * 100;
    const picture = 50 + (screenX - 50 - view.shiftX) / view.scaleX;
    const column = warpColumn(layout, picture);
    const sourcePerOutput = ((column.span * dropPerColumn) / 100) * sw;
    const taps = kernelTaps((column.xs / 100) * sw, sourcePerOutput, sw, hIndices, hWeights);
    // One source column's worth of picture: the horizontal window, filtered.
    for (let c = 0; c < 3; c += 1) {
      const target = columnRows[c]!;
      target.fill(0);
      const plane = planes[c]!;
      for (let t = 0; t < taps; t += 1) {
        const w = hWeights[t]!;
        const base = hIndices[t]! * sh;
        for (let y = 0; y < sh; y += 1) target[y] = target[y]! + w * plane[base + y]!;
      }
    }
    // Source rows per output row: the frame row maps to the picture through the zoom/pan and this column's vertical map.
    const perRow = sh / (outHeight * view.scaleY * column.scaleY);
    const first = ((50 + ((0.5 / outHeight) * 100 - 50 - view.shiftY) / view.scaleY - column.offsetY) / column.scaleY / 100) * sh;
    for (let j = 0; j < outHeight; j += 1) {
      const centre = first + j * perRow;
      const n = kernelTaps(centre, perRow, sh, vIndices, vWeights);
      let r = 0;
      let g = 0;
      let b = 0;
      for (let t = 0; t < n; t += 1) {
        const w = vWeights[t]!;
        const y = vIndices[t]!;
        r += w * columnRows[0]![y]!;
        g += w * columnRows[1]![y]!;
        b += w * columnRows[2]![y]!;
      }
      const o = (j * outWidth + i) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }
  return out;
}

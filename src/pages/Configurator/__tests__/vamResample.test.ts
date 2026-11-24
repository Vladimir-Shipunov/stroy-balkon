/**
 * Tests of the one-pass resampler behind a warped frame (`vamResample.ts`): it must not soften a picture that is
 * only shifted, must filter (not alias) a picture that is squeezed, must put every feature where the warp's own
 * point map says, and must carry the picture's edge rows on past its ends.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { VAM_FITS } from '../vamFit';
import { MAX_KERNEL_SCALE, catmullRom, kernelTaps, maxTaps, resampleWarp, warpViewOf } from '../vamResample';
import type { Raster, WarpView } from '../vamResample';
import { warpLayout, warpPoint } from '../vamWarp';
import type { FitWarp } from '../vamWarp';

const SIZE = 200;

/** A raster built from a grey-level function of (x, y). */
function raster(level: (x: number, y: number) => number, width = SIZE, height = SIZE): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      const v = level(x, y);
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { data, width, height };
}

/** A warp that changes nothing: one unsqueezed run, level lines. */
const IDENTITY: FitWarp = {
  x0: 40,
  x1: 60,
  ceiling: { y: 20, slope: 0 },
  floor: { y: 80, slope: 0 },
  topStart: 20,
  floorY: 80,
  spans: [{ w: 20, k: 1, top: 20 }],
};
const NO_VIEW: WarpView = { scaleX: 1, scaleY: 1, shiftX: 0, shiftY: 0 };
const grey = (out: Uint8ClampedArray, width: number, x: number, y: number): number => out[(y * width + x) * 4]!;

test('Catmull-Rom interpolates: 1 at the sample, 0 at its neighbours, and its taps sum to 1', () => {
  assert.equal(catmullRom(0), 1);
  assert.ok(Math.abs(catmullRom(1)) < 1e-12 && Math.abs(catmullRom(2)) < 1e-12);
  const indices = new Int32Array(40);
  const weights = new Float32Array(40);
  for (const [centre, scale] of [[10.5, 1], [10.3, 1], [10.7, 2.2], [0.2, 1.5], [99.9, 3]] as const) {
    const n = kernelTaps(centre, scale, 100, indices, weights);
    const sum = Array.from(weights.slice(0, n)).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-5, `taps at ${centre} / ${scale} sum to ${sum}`);
    for (let t = 0; t < n; t += 1) assert.ok(indices[t]! >= 0 && indices[t]! <= 99, 'taps stay inside the picture');
  }
  // Sample exactly on a pixel centre at scale 1: one tap of weight 1 (a plain copy, no blur).
  const n = kernelTaps(10.5, 1, 100, indices, weights);
  assert.equal(n, 1);
  assert.ok(Math.abs(weights[0]! - 1) < 1e-6 && indices[0] === 10);
});

test('a picture the warp does not move is copied, not softened', () => {
  const source = raster((x, y) => ((x * 7 + y * 13) % 5) * 60); // a busy pattern
  const out = resampleWarp(source, warpLayout(IDENTITY), NO_VIEW, SIZE, SIZE);
  let worst = 0;
  for (let y = 0; y < SIZE; y += 1) for (let x = 0; x < SIZE; x += 1) worst = Math.max(worst, Math.abs(grey(out, SIZE, x, y) - source.data[(y * SIZE + x) * 4]!));
  assert.ok(worst <= 1, `largest difference ${worst}`);
});

test('a flat colour stays exactly flat through the real warp and view', () => {
  const source = raster(() => 143);
  const fit = VAM_FITS.lodochka![1]!;
  const out = resampleWarp(source, warpLayout(fit.warp!), warpViewOf(fit), 120, 120);
  for (let i = 0; i < 120 * 120; i += 1) assert.ok(Math.abs(out[i * 4]! - 143) <= 1 && out[i * 4 + 3] === 255, `pixel ${i}: ${out[i * 4]}`);
});

test('an edge keeps its sharpness when the frame is a bit smaller than the picture, with little ringing', () => {
  // The frame shows the picture at 0.9125 (800 → 730), as on the owner's screen.
  const source = raster((x) => (x < SIZE / 2 ? 30 : 220));
  const outSize = Math.round(SIZE * 0.9125);
  const out = resampleWarp(source, warpLayout(IDENTITY), NO_VIEW, outSize, outSize);
  const row = Array.from({ length: outSize }, (_, x) => grey(out, outSize, x, Math.floor(outSize / 2)));
  const lo = 30 + 0.1 * 190;
  const hi = 30 + 0.9 * 190;
  const rise = row.findIndex((v) => v >= hi) - row.findIndex((v) => v > lo);
  assert.ok(rise <= 2.5, `10–90 % rise over ${rise} px`);
  const overshoot = Math.max(...row) - 220;
  const undershoot = 30 - Math.min(...row);
  assert.ok(overshoot <= 0.1 * 190 && undershoot <= 0.1 * 190, `ringing ${overshoot} / ${undershoot}`);
});

test('a squeezed run is filtered, not aliased: stripes finer than the output pixel come out as an even grey', () => {
  // One run squeezed to a half over x 30–70 (a real squeeze, which the real table no longer uses: it cuts instead).
  const squeezed: FitWarp = { ...IDENTITY, x0: 30, x1: 70, spans: [{ w: 40, k: 0.5, top: 20 }] };
  const layout = warpLayout(squeezed);
  const source = raster((x) => (x % 2 === 0 ? 0 : 255));
  const outSize = 200;
  const out = resampleWarp(source, layout, NO_VIEW, outSize, outSize);
  const [screenPct] = warpPoint(layout, 50, 50);
  const screenX = Math.round((screenPct / 100) * outSize);
  const values = Array.from({ length: 9 }, (_, k) => grey(out, outSize, screenX - 4 + k, outSize / 2));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  assert.ok(Math.max(...values) - Math.min(...values) < 60, `stripes show through: ${values}`);
  assert.ok(Math.abs(mean - 127.5) < 30, `mean ${mean}`);
});

test("a feature of the photo lands at the column the warp's own point map gives it", () => {
  const fit = VAM_FITS.lodochka![1]!;
  const layout = warpLayout(fit.warp!);
  const view = warpViewOf(fit);
  const outSize = 400;
  for (const featureX of [47, 52, 58, 62, 68, 95]) {
    const source = raster((x) => (Math.abs(x + 0.5 - (featureX / 100) * SIZE) < 1 ? 255 : 0));
    const out = resampleWarp(source, layout, view, outSize, outSize);
    let best = 0;
    let bestColumn = 0;
    for (let x = 0; x < outSize; x += 1) {
      const v = grey(out, outSize, x, outSize / 2);
      if (v > best) {
        best = v;
        bestColumn = x;
      }
    }
    const [pct] = warpPoint(layout, featureX, 50);
    const expected = ((50 + view.scaleX * (pct - 50) + view.shiftX) / 100) * outSize;
    assert.ok(best > 40, `feature ${featureX} shows (${best})`);
    assert.ok(Math.abs(bestColumn + 0.5 - expected) <= 2.5, `feature ${featureX} at ${bestColumn + 0.5}, expected ${expected.toFixed(1)}`);
  }
});

test('the rows above and below the picture repeat its edge rows', () => {
  const source = raster((_, y) => (y === 0 ? 10 : y === SIZE - 1 ? 240 : 128));
  // Zoomed out vertically, the picture is shorter than the frame: its edge rows carry on over the rest.
  const out = resampleWarp(source, warpLayout(IDENTITY), { scaleX: 1, scaleY: 0.6, shiftX: 0, shiftY: 0 }, SIZE, SIZE);
  assert.ok(Math.abs(grey(out, SIZE, 100, 2) - 10) <= 3, `top ${grey(out, SIZE, 100, 2)}`);
  assert.ok(Math.abs(grey(out, SIZE, 100, SIZE - 3) - 240) <= 3, `bottom ${grey(out, SIZE, 100, SIZE - 3)}`);
});

test('the kernel is bounded: a huge or non-finite scale or position never overruns its buffers or loops', () => {
  const indices = new Int32Array(maxTaps(MAX_KERNEL_SCALE));
  const weights = new Float32Array(maxTaps(MAX_KERNEL_SCALE));
  const n = kernelTaps(100, 1e6, 800, indices, weights);
  assert.ok(n > 0 && n <= indices.length, `taps ${n}`);
  assert.ok(Math.abs(Array.from(weights.slice(0, n)).reduce((a, b) => a + b, 0) - 1) < 1e-4);
  for (const [centre, scale] of [[Infinity, 1], [NaN, 1], [10, Infinity], [10, NaN], [10, 0], [10, -3], [2 ** 60, 1]] as const) {
    const taps = kernelTaps(centre, scale, 800, indices, weights);
    assert.equal(taps, 1, `${centre} / ${scale}`);
    assert.ok(indices[0]! >= 0 && indices[0]! <= 799 && weights[0] === 1);
  }
});

test('a frame as small as 8 px, or squeezed hard, stays the colour of its picture (no black column from an overrun)', () => {
  const source = raster(() => 143);
  const squeezed: FitWarp = { ...IDENTITY, spans: [{ w: 20, k: 0.05, top: 20 }] };
  for (const [warp, size] of [[IDENTITY, 8], [IDENTITY, 1], [squeezed, 12], [squeezed, 40]] as const) {
    const out = resampleWarp(source, warpLayout(warp), NO_VIEW, size, size);
    for (let i = 0; i < size * size; i += 1) assert.ok(Math.abs(out[i * 4]! - 143) <= 1, `${size}px pixel ${i}: ${out[i * 4]}`);
  }
});

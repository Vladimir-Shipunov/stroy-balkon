/**
 * @file The photo fit (vamFit.ts): a crop plus a few degrees of turn / shear / zoom on the
 * app's real photo frames. The maths is shared by the CSS the scene emits, the canvas the
 * save path captures and the tap targets that must ride the picture, so these pin down the
 * parts that would drift apart silently: identity when there is no fit, the order of the
 * transform, the mirror for the right-handed screen, and the crop test the tap targets use.
 *
 * Run with `npm run test:geometry`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VAM_FITS,
  bandDrop,
  bandLayout,
  fitBandPoint,
  fitBandX,
  fitClipPath,
  fitFor,
  fitKeepInFrame,
  fitMatrix,
  fitPieces,
  fitPoint,
  fitShows,
  fitTapPoint,
  fitTransform,
  mirrorFit,
  pieceClipPath,
  pieceTransform,
  shadeBackground,
  shadeClipPath,
  shadeColors,
} from '../vamFit';
import type { FitBand, FitPiece, SceneFit } from '../vamFit';
import { warpLayout } from '../vamWarp';
import { findVamShape, usesPlanRender, vamScreen, vamShapeGlazings } from '../vamCatalog';

const close = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

test('no fit leaves every point, the CSS and the crop alone', () => {
  assert.deepEqual(fitPoint(undefined, 12, 80), [12, 80]);
  assert.equal(fitTransform(undefined), 'none');
  assert.equal(fitClipPath(undefined), undefined);
  assert.equal(fitShows(undefined, 3, 4), true);
  assert.deepEqual(fitMatrix(undefined), { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
});

test('a pure pan moves the centre by exactly the shift; a pure zoom keeps the centre put', () => {
  assert.deepEqual(fitPoint({ shift: [5, -3] }, 50, 50), [55, 47]);
  const zoomed = fitPoint({ scaleX: 2, scaleY: 2 }, 50, 50);
  assert.ok(close(zoomed[0], 50) && close(zoomed[1], 50));
  const corner = fitPoint({ scaleX: 2, scaleY: 2 }, 60, 40);
  assert.ok(close(corner[0], 70) && close(corner[1], 30));
});

test('a rotation is clockwise on screen (y down): the right-hand point drops', () => {
  const [x, y] = fitPoint({ rotate: 90 }, 60, 50);
  assert.ok(close(x, 50, 1e-6) && close(y, 60, 1e-6), `${x}, ${y}`);
});

test('skewY drops the right side, skewX shears x by y (CSS skewX: x\' = x + tan(a)·y, y down)', () => {
  const sy = fitPoint({ skewY: 45 }, 60, 50);
  assert.ok(close(sy[0], 60, 1e-9) && close(sy[1], 60, 1e-9), `skewY: ${sy}`);
  const sx = fitPoint({ skewX: 45 }, 50, 40);
  assert.ok(close(sx[0], 40, 1e-9) && close(sx[1], 40, 1e-9), `skewX: ${sx}`);
});

test('the matrix composes in the order of the CSS string: scale, skewY, skewX, rotate, translate', () => {
  const fit: SceneFit = { scaleX: 1.3, scaleY: 0.9, skewX: 7, skewY: -4, rotate: 11, shift: [2, -1] };
  // Reference: apply each CSS function to the point, innermost (rightmost) first.
  const tx = Math.tan((7 * Math.PI) / 180);
  const ty = Math.tan((-4 * Math.PI) / 180);
  const r = (11 * Math.PI) / 180;
  const ref = (x: number, y: number): [number, number] => {
    let px = (x - 50) * 1.3;
    let py = (y - 50) * 0.9;
    py += ty * px; // skewY
    px += tx * py; // skewX
    [px, py] = [Math.cos(r) * px - Math.sin(r) * py, Math.sin(r) * px + Math.cos(r) * py];
    return [50 + px + 2, 50 + py - 1];
  };
  for (const [x, y] of [[0, 0], [100, 0], [20, 70], [50, 50], [93, 88]] as const) {
    const got = fitPoint(fit, x, y);
    const want = ref(x, y);
    assert.ok(close(got[0], want[0], 1e-9) && close(got[1], want[1], 1e-9), `(${x}, ${y}): ${got} != ${want}`);
  }
});

test('the mirrored fit lands where the mirror image of the original would', () => {
  const fit: SceneFit = { scaleX: 1.1, scaleY: 1.05, rotate: -2, skewX: 3, skewY: -3, shift: [-2, 1], clip: [[0, 10], [100, 0], [100, 100], [0, 100]] };
  const flipped = mirrorFit(fit);
  for (const [x, y] of [[5, 5], [30, 60], [88, 20], [50, 50]] as const) {
    const [ox, oy] = fitPoint(fit, x, y);
    const [mx, my] = fitPoint(flipped, 100 - x, y);
    assert.ok(close(mx, 100 - ox, 1e-9) && close(my, oy, 1e-9), `(${x}, ${y}): ${[mx, my]} vs ${[100 - ox, oy]}`);
  }
  // The crop mirrors too: a point is shown by the original iff its mirror image is shown by the flipped one.
  for (const [x, y] of [[2, 4], [2, 40], [97, 3], [60, 60]] as const) assert.equal(fitShows(fit, x, y), fitShows(flipped, 100 - x, y), `${x}, ${y}`);
});

test('the backdrop colour behind a cut survives the mirror, and every fitted view that crops has one', () => {
  assert.equal(mirrorFit({ clip: [[0, 0], [100, 0], [0, 100]], backdrop: '#123456' }).backdrop, '#123456');
  assert.equal(mirrorFit({ scaleX: 1.1 }).backdrop, undefined, 'no backdrop stays none');
  for (const [id, views] of Object.entries(VAM_FITS)) {
    for (const [view, fit] of views.entries()) {
      if (!fit?.clip) continue;
      assert.match(fit.backdrop ?? '', /^#[0-9a-f]{6}$/i, `${id}[${view}]: a cut view needs a ceiling-coloured backdrop, not the frame's default light blue-gray`);
    }
  }
});

// Where a point lands through one piece's CSS transform `translate(tx%, ty%) matrix(k, sl, 0, 1, 0, 0)` about the top-left corner (percent).
const throughPiece = (p: FitPiece, x: number, y: number): readonly [number, number] => [p.k * x + p.tx, p.sl * x + y + p.ty];

// The piece that owns a column is the one whose range holds it and which is drawn last (the band's runs on top).
const owner = (pieces: readonly FitPiece[], x: number): FitPiece => [...pieces].reverse().find((p) => x >= p.x0 && x <= p.x1)!;

// A corner that juts out, lit from the windows on the left: a far wall darkening into the inner corner, the ledge's side
// face (turned to the light, brighter, bright at its convex edge, its top edge climbing steeply toward the viewer), its
// front face (parallel to the far wall, a little darker toward the house wall) and the shadow where it meets the house
// wall — with the wall's top line given.
const CORNER_BAND: FitBand = {
  x0: 50,
  x1: 88.5,
  edge: { y: 23.57, slope: -0.2313 },
  spans: [
    { w: 22.5, k: 0.4822, shade: [[0, 0], [0.6, -0.03], [1, -0.3]] },
    { w: 5, k: 0.4, slope: -1.4, shade: [[0, 0.1], [0.5, 0.16], [0.88, 0.22], [1, 0.45]], ao: [0.25, 6] },
    { w: 9, k: 0.6, slope: -0.25, shade: [[0, -0.05], [1, -0.18]], ao: [0.25, 6] },
    { w: 2, k: 0.5, shade: [[0, 0], [1, -0.35]] },
  ],
};

test('a squeezed band gives up exactly its share and every column stays in order, seams included', () => {
  const band = { x0: 50, x1: 88.5, keep: 0.5 };
  assert.ok(close(bandDrop(band), 19.25));
  // The picture's ends move in by half the drop each; the band's own ends meet its neighbours exactly.
  assert.ok(close(fitBandX(band, 0), 9.625) && close(fitBandX(band, 100), 90.375));
  assert.ok(close(fitBandX(band, band.x0), band.x0 + 9.625) && close(fitBandX(band, band.x1), band.x1 - 9.625));
  let prev = -Infinity;
  for (let x = 0; x <= 100; x += 0.25) {
    const y = fitBandX(band, x);
    assert.ok(y > prev, `columns must stay in order at ${x}`);
    prev = y;
  }
  // No band, nothing given up.
  assert.equal(fitBandX({ x0: 10, x1: 20, keep: 1 }, 55), 55);
});

test('the pieces the scene draws land every column exactly where fitBandX says (screen and saved image share this)', () => {
  const fit: SceneFit = { band: { x0: 55.4, x1: 60.5, keep: 0.5 } };
  const pieces = fitPieces(fit)!;
  assert.equal(pieces.length, 3);
  for (let x = 0; x <= 100; x += 0.1) {
    const piece = owner(pieces, x);
    assert.ok(piece, `column ${x} belongs to a piece`);
    // Rounded to 1e-5 in the piece, so the match is to that.
    assert.ok(close(throughPiece(piece, x, 30)[0], fitBandX(fit.band!, x), 1e-3), `column ${x}: ${throughPiece(piece, x, 30)[0]} vs ${fitBandX(fit.band!, x)}`);
  }
  assert.equal(pieceClipPath(pieces[2]!), 'inset(0 39.5% 0 55.4%)');
  assert.equal(pieceTransform(pieces[2]!), 'translate(28.975%, 0%) matrix(0.5, 0, 0, 1, 0, 0)');
  assert.equal(fitPieces(undefined), undefined);
  assert.equal(fitPieces({ scaleX: 1.1 }), undefined);
});

test('a band cut into spans: every piece lands every column and row exactly where fitBandPoint says', () => {
  const pieces = fitPieces({ band: CORNER_BAND })!;
  assert.equal(pieces.length, 2 + 4, 'left, right, then one piece per span');
  for (let x = 0; x <= 100; x += 0.1) {
    const piece = owner(pieces, x);
    for (const y of [5, 40, 95]) {
      const [px, py] = throughPiece(piece, x, y);
      const [bx, by] = fitBandPoint(CORNER_BAND, x, y);
      assert.ok(close(px, bx, 2e-3) && close(py, by, 2e-3), `(${x}, ${y}): piece ${[px, py]} vs band ${[bx, by]}`);
    }
  }
});

test('the spans of a band cover it exactly and give up exactly what the zoom takes back', () => {
  const { spans, drop } = bandLayout(CORNER_BAND);
  assert.ok(close(spans.reduce((sum, s) => sum + s.w, 0), CORNER_BAND.x1 - CORNER_BAND.x0), 'the spans tile the band');
  assert.ok(close(drop, 19.25, 2e-3), `drop ${drop}`);
  // Left to right on screen they follow each other with no gap and no overlap.
  for (let i = 1; i < spans.length; i += 1) assert.ok(close(spans[i]!.xt, spans[i - 1]!.xt + spans[i - 1]!.w * spans[i - 1]!.k, 1e-9), `span ${i} starts where ${i - 1} ends`);
  assert.ok(close(spans[0]!.xt, CORNER_BAND.x0 + drop / 2), 'the first run starts where the left picture ends');
  const last = spans[spans.length - 1]!;
  assert.ok(close(last.xt + last.w * last.k, CORNER_BAND.x1 - drop / 2, 1e-9), 'the last run ends where the right picture starts');
});

test('the wall\'s top line is one unbroken polyline across the band: no jump at any seam, and the far wall keeps the photo\'s own slope', () => {
  const edgeAt = (x: number): number => CORNER_BAND.edge!.y + CORNER_BAND.edge!.slope * (x - CORNER_BAND.x0);
  const onLine = (x: number): readonly [number, number] => fitBandPoint(CORNER_BAND, x, edgeAt(x));
  const { spans } = bandLayout(CORNER_BAND);
  // No jump: just either side of every boundary the line is at the same screen height (and column).
  for (const x of [CORNER_BAND.x0, ...spans.slice(1).map((s) => s.xs), CORNER_BAND.x1]) {
    const [lx, ly] = onLine(x - 1e-6);
    const [rx, ry] = onLine(x + 1e-6);
    assert.ok(close(lx, rx, 1e-4) && close(ly, ry, 1e-4), `the top line jumps at column ${x}: ${[lx, ly]} -> ${[rx, ry]}`);
  }
  // Left of the band and across the far wall the line has the photo's slope, so the ceiling does not bend.
  const slopeBetween = (xa: number, xb: number): number => {
    const [ax, ay] = onLine(xa);
    const [bx, by] = onLine(xb);
    return (by - ay) / (bx - ax);
  };
  const edge = CORNER_BAND.edge!.slope;
  assert.ok(close(slopeBetween(30, 45), edge, 1e-6), 'left of the band');
  assert.ok(close(slopeBetween(52, 70), edge, 1e-6), 'across the far wall');
  assert.ok(close(slopeBetween(73, 77), -1.4, 1e-6), "the ledge's side face climbs at the slope of the house wall's edge — the ceiling steps up over the ledge as it would");
  assert.ok(close(slopeBetween(79, 85), -0.25, 1e-6), 'its front face runs parallel to the far wall, a hair steeper');
  assert.ok(close(slopeBetween(90, 99), edge, 1e-6), 'right of the band');
});

test('a band without a wall line never shears: only the squeeze, and the sides stay level', () => {
  const plain: FitBand = { x0: 55.4, x1: 100, keep: 0.5684 };
  const { rise, spans } = bandLayout(plain);
  assert.equal(rise, 0);
  assert.ok(spans.every((s) => s.sl === 0 && s.fy === 0));
  assert.equal(fitBandPoint(plain, 70, 33)[1], 33);
  const pieces = fitPieces({ band: plain })!;
  assert.equal(pieces.length, 2, 'a band that reaches the picture\'s edge has no piece beyond it');
  assert.ok(pieces.every((p) => p.sl === 0 && p.ty === 0));
});

test('the shade of a span lies on the wall below the top line, its ramp never crosses sign, and the colours follow the sign', () => {
  const pieces = fitPieces({ band: CORNER_BAND })!;
  const shaded = pieces.filter((p) => p.shade);
  assert.equal(shaded.length, 4);
  const stops = (...v: number[]) => ({ x0: 0, x1: 1, stops: v.map((a, i) => [i / Math.max(1, v.length - 1), a] as const) });
  assert.deepEqual(shadeColors(stops(0, -0.1)), ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.1)'], "a zero stop takes the shade's colour");
  assert.deepEqual(shadeColors(stops(0, 0.05, 0.4)), ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.4)']);
  for (const p of shaded) {
    const values = p.shade!.stops.map(([, v]) => v);
    assert.ok(values.every((v) => v * (values.find((u) => u !== 0) ?? 0) >= 0), 'a ramp with both signs would be mixed differently by CSS and by the canvas');
    const positions = p.shade!.stops.map(([position]) => position);
    assert.ok(positions[0] === 0 && positions[positions.length - 1] === 1 && positions.every((q, i) => i === 0 || q >= positions[i - 1]!), 'stops run 0..1 in order');
    const [ya, yb] = p.shade!.top!;
    assert.ok(ya >= 0 && yb <= 100 && yb < ya + 1e-9, 'the wall line rises to the right');
    assert.match(shadeClipPath(p)!, /^polygon\(/);
    assert.match(shadeBackground(p)!, /linear-gradient\(90deg, rgba\(/);
  }
  // The ceiling's contact shadow rides on the faces that ask for it and only there.
  assert.equal(shaded.filter((p) => p.shade!.ao).length, 2);
  assert.match(shadeBackground(shaded[1]!)!, /^linear-gradient\(180deg, rgba\(0, 0, 0, 0\.25\) /);
  assert.doesNotMatch(shadeBackground(shaded[0]!)!, /180deg/);
  assert.equal(pieces[0]!.shade, undefined, 'the side pictures are not shaded');
  assert.equal(shadeClipPath(pieces[0]!), undefined);
  assert.equal(shadeBackground(pieces[0]!), undefined);
});

test('the side pieces overlap the band a hair so no seam can open, and the band is drawn last', () => {
  const pieces = fitPieces({ band: { x0: 40, x1: 70, keep: 0.4 } })!;
  assert.ok(pieces[0]!.x1 > 40 && pieces[1]!.x0 < 70, 'both sides reach under the band');
  assert.equal(pieces[2]!.k, 0.4, 'the squeezed band is the last piece drawn, over the overlaps');
});

test('the mirror of a band is the band seen in the mirror', () => {
  const fit: SceneFit = { scaleX: 1.2, scaleY: 1.2, shift: [3, -2], band: { x0: 50, x1: 88.5, keep: 0.5 } };
  const flipped = mirrorFit(fit);
  assert.deepEqual(flipped.band, { x0: 11.5, x1: 50, keep: 0.5 });
  for (const [x, y] of [[0, 10], [20, 40], [50, 50], [69, 55], [95, 90]] as const) {
    const [ox, oy] = fitPoint(fit, x, y);
    const [mx, my] = fitPoint(flipped, 100 - x, y);
    assert.ok(close(mx, 100 - ox, 1e-9) && close(my, oy, 1e-9), `(${x}, ${y}): ${[mx, my]} vs ${[100 - ox, oy]}`);
  }
});

test('a tap target rides the band: columns in the squeezed wall move in, the rest move toward it', () => {
  const fit: SceneFit = { band: { x0: 50, x1: 88.5, keep: 0.5 } };
  const [hx] = fitPoint(fit, 68, 55); // the far wall's own tap target (screen 10, frame 2)
  assert.ok(close(hx, 69.25 + (68 - 69.25) * 0.5), `${hx}`);
  assert.ok(fitPoint(fit, 20, 50)[0] > 20, 'the left picture moves in (right)');
  assert.ok(fitPoint(fit, 95, 50)[0] < 95, 'the right picture moves in (left)');
});

test('the crop test follows the polygon, edges and all', () => {
  const fit: SceneFit = { clip: [[0, 10], [100, 0], [100, 100], [0, 100]] };
  assert.equal(fitShows(fit, 50, 50), true);
  assert.equal(fitShows(fit, 2, 4), false, 'above the slanted cut');
  assert.equal(fitShows(fit, 98, 4), true, 'below the cut on the right, where it rises to the top edge');
  assert.equal(fitClipPath(fit), 'polygon(0% 10%, 100% 0%, 100% 100%, 0% 100%)');
  assert.equal(fitClipPath({ clip: [[0, 0], [1, 1]] }), undefined, 'fewer than three points is no crop');
});

// A fit that does what the machinery is for — a turn plus a corner crop with the cover pan that keeps the picture
// over the frame — used to exercise the maths now that no real shape is fitted.
const SAMPLE_TABLE: Readonly<Record<string, readonly [SceneFit | undefined, SceneFit | undefined]>> = {
  sample: [
    { scaleX: 1.1, scaleY: 1.05, rotate: -2, skewY: -3, shift: [-2, 2.5], clip: [[0, 10], [100, 0], [100, 100], [0, 100]], backdrop: '#747273' },
    { scaleX: 1.1, scaleY: 1.05, rotate: 2, skewY: 3, shift: [2, 2.5], clip: [[0, 0], [100, 10], [100, 100], [0, 100]], backdrop: '#747273' },
  ],
};

test('fitFor: only shapes with a table entry are fitted, and the right-handed screen gets the mirror', () => {
  for (const id of ['sapozhok', 'utyuzhok', 'loggia', 'long-loggia', 'khrushchevka', 'unknown']) {
    assert.equal(fitFor(id, 0, false), undefined, id);
    assert.equal(fitFor(id, 1, true), undefined, id);
  }
  for (const view of [0, 1] as const) {
    assert.deepEqual(fitFor('lodochka', view, false), VAM_FITS.lodochka![view]);
    assert.deepEqual(fitFor('lodochka', view, true), mirrorFit(VAM_FITS.lodochka![view]!));
  }
  const table = SAMPLE_TABLE.sample!;
  for (const view of [0, 1] as const) {
    assert.deepEqual(fitFor('sample', view, false, SAMPLE_TABLE), table[view]);
    assert.deepEqual(fitFor('sample', view, true, SAMPLE_TABLE), mirrorFit(table[view]!));
  }
  assert.equal(fitFor('sample', 0, false, {}), undefined, 'a shape missing from the table is not fitted');
});

test('every fit in a table keeps the picture covering what the crop leaves visible', () => {
  let checked = 0;
  for (const [id, views] of [...Object.entries(VAM_FITS), ...Object.entries(SAMPLE_TABLE)]) {
    for (const [view, spec] of views.entries()) {
      if (!spec) continue;
      // The right-handed screen shows the mirror of the spec, so it has to cover its frame just the same.
      for (const fit of [spec, mirrorFit(spec)]) {
        const m = fitMatrix(fit);
        const det = m.a * m.d - m.b * m.c;
        assert.ok(det > 0, `${id}[${view}]: the picture must not be flipped or collapsed`);
        for (const [x, y] of fit.clip ?? []) assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100, `${id}[${view}]: crop point (${x}, ${y}) is outside the frame`);
        // The visible region is the crop polygon (the whole frame when there is none); the picture is convex,
        // so it covers that region exactly when it covers every one of the region's vertices — back-project each
        // into the picture and it must land inside it, or a gray wedge of backdrop shows there. (The vertices
        // themselves, not the frame corners filtered through `fitShows`: that test is false on the boundary, and
        // the crop's vertices ARE the boundary, so every corner would be skipped and nothing ever asserted.)
        const region: readonly (readonly [number, number])[] = fit.clip ?? [[0, 0], [100, 0], [0, 100], [100, 100]];
        // A band squeezed away leaves the picture that much narrower (half the drop off each end) before the zoom,
        // and a band that shears lifts its runs by up to their offsets, so the picture is only certain to cover the
        // rows every run covers.
        const layout = fit.band ? bandLayout(fit.band) : undefined;
        // A turned warp slides one side of the picture out of the frame and stretches the other to meet the frame's
        // edge, so the picture still covers the frame; the stretch must stay mild or the picture there is smeared.
        if (fit.warp) {
          const turned = warpLayout(fit.warp);
          assert.ok(turned.stretchLeft <= 1.9 && turned.stretchRight <= 1.9, `${id}[${view}]: the view turn stretches the picture ${turned.stretchLeft} / ${turned.stretchRight} times`);
        }
        const lo: number = layout ? layout.drop / 2 : fit.warp ? warpLayout(fit.warp).drop / 2 : 0;
        const lifts: number[] = layout ? [-layout.rise / 2, layout.rise / 2, ...layout.spans.flatMap((s) => [s.fy, s.fy + s.sl * s.w])] : [0];
        const top = Math.max(...lifts);
        const bottom = 100 + Math.min(...lifts);
        for (const [cx, cy] of region) {
          const dx = cx - 50 - m.e;
          const dy = cy - 50 - m.f;
          const px = 50 + (m.d * dx - m.c * dy) / det;
          const py = 50 + (-m.b * dx + m.a * dy) / det;
          assert.ok(
            px >= lo - 0.01 && px <= 100 - lo + 0.01 && py >= top - 0.01 && py <= bottom + 0.01,
            `${id}[${view}]: vertex (${cx}, ${cy}) shows outside the picture (${px.toFixed(2)}, ${py.toFixed(2)})`,
          );
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 0, 'the coverage check must actually run on something');
});

test('a corner band mirrors exactly: every point lands where the mirror image would, and the runs reverse', () => {
  const fit: SceneFit = { scaleX: 1.2384, scaleY: 1.2384, shift: [0, -0.663], band: CORNER_BAND };
  const flipped = mirrorFit(fit);
  assert.deepEqual(flipped.band!.spans!.map((s) => s.w), [2, 9, 5, 22.5]);
  assert.deepEqual(flipped.band!.spans![0]!.shade, [[0, -0.35], [1, 0]], 'the house-wall corner shadow now deepens toward the left');
  assert.deepEqual(flipped.band!.spans![1]!.shade, [[0, -0.18], [1, -0.05]], 'the front face darkens toward the house wall on its left now');
  assert.deepEqual(flipped.band!.spans![2]!.shade, [[0, 0.45], [0.12, 0.22], [0.5, 0.16], [1, 0.1]], "the side face's bright convex edge is now on its left");
  assert.deepEqual(flipped.band!.spans![3]!.shade, [[0, -0.3], [0.4, -0.03], [1, 0]], "the inner-corner shadow now falls on the far wall's left end");
  assert.deepEqual(flipped.band!.spans![2]!.ao, [0.25, 6], 'the ceiling shadow is the same either way');
  assert.deepEqual(flipped.band!.spans!.map((s) => s.slope), [undefined, 0.25, 1.4, undefined], 'slopes turn over with the mirror');
  assert.ok(close(flipped.band!.edge!.slope, 0.2313) && close(flipped.band!.edge!.y, 23.57 + -0.2313 * 38.5, 1e-9));
  for (const [x, y] of [[0, 10], [20, 40], [50, 50], [60, 23], [78, 30], [84, 60], [95, 90]] as const) {
    const [ox, oy] = fitPoint(fit, x, y);
    const [mx, my] = fitPoint(flipped, 100 - x, y);
    assert.ok(close(mx, 100 - ox, 1e-9) && close(my, oy, 1e-9), `(${x}, ${y}): ${[mx, my]} vs ${[100 - ox, oy]}`);
  }
  // The pieces mirror too: the mirrored fit's pieces put each mirrored column where its own band maths says.
  const pieces = fitPieces(flipped)!;
  for (let x = 0; x <= 100; x += 0.2) {
    const piece = owner(pieces, x);
    const [px, py] = throughPiece(piece, x, 40);
    const [bx, by] = fitBandPoint(flipped.band!, x, 40);
    assert.ok(close(px, bx, 2e-3) && close(py, by, 2e-3), `mirrored column ${x}: ${[px, py]} vs ${[bx, by]}`);
  }
});

test('FROZEN: the Лодочка picture — far end wall made head-on and straight (no ledge), a narrower left frame (2026-10-24)', () => {
  // First the owner asked for the far gray end wall to be halved in both frames ("в половину"); then for the ledge of
  // the plan in the corner at their point 2, for the crooked ceiling of the right photo to be straightened, and for the
  // left photo to show the narrower balcony; then "потолок не параллельно полу" — squeezing the wall had left its floor
  // line twice as steep as the photo's, so the wall is now re-cut head-on (vamWarp.ts), ceiling and floor level and
  // parallel; then "зачем ты сломал геометрию балкона… верни как была и просто смести её чуть левее", then "камера смотрит
  // как раз на выступ левее, чтобы выступ было лучше видно с двух сторон", then "стена 3 неровная, остаток без выступа
  // должен быть прямым, светильник вялый, камеру сдвинул не в ту сторону" — the wall is now measured from its finish
  // mask, kept parallel in its planks, the ledge is a proper protrusion (front face scaled up about the vanishing
  // point), the view is turned toward the ledge and the lamp stays undistorted; then "текстура размытая" — the wall
  // is made shorter by cutting a piece out instead of squeezing every board to half its width; then, on seeing it ("D нужно чтобы
  // было"): the same, the camera further left, and every corner a right angle — the ledge's faces are rectangles; then the seams
  // and unevenness of the ledge ("сильно виден стык и неровности") and finally "всё отмена, верни как было сторону 3, пусть
  // она будет просто прямая": the ledge is removed and the wall is a plain straight wall.
  // Wall lengths in planShapes.ts move the blueprint only — nothing here may depend on them — so a failure
  // here is a change to the picture the owner asked for and needs their say-so first, not a quiet update of these numbers.
  // 2026-10-24 ("верни как было сторону 3, пусть она будет просто прямая"): the ledge is gone — the wall is a plain straight wall.
  const table: Readonly<Record<string, readonly (SceneFit | undefined)[]>> = VAM_FITS; // (deepEqual narrows what it is given)
  assert.deepEqual(table, {
    lodochka: [
      { scaleX: 1.2384, scaleY: 1.2384, band: { x0: 55.4, x1: 100, keep: 0.5684 }, taps: { '4_3': [69, 6] } },
      {
        scaleX: 1.2384,
        scaleY: 1.2384,
        shift: [0, -1.91],
        taps: { '6_4': [54, 54] },
        warp: {
          x0: 45.75,
          x1: 89.5,
          ceiling: { y: 24.861, slope: -0.229 },
          floor: { y: 84.332, slope: 0.2744 },
          topStart: 24.861,
          floorY: 84.332,
          slide: -9.2,
          rigid: ['/lampp11_'],
          spans: [
            { w: 4, k: 1, top: 24.861 },
            { w: 3, k: 1, top: 24.861 },
            { w: 3, k: 0.9532, top: 24.861 },
            { w: 3, k: 0.9096, top: 24.861 },
            { w: 3, k: 0.8689, top: 24.861 },
            { w: 3, k: 0.8309, top: 24.861 },
            { w: 3, k: 0.7953, top: 24.861 },
            { w: 3, k: 0.762, top: 24.861 },
            { w: 2.928, k: 0.7311, top: 24.861 },
            { w: 15.822, k: 1, top: 24.861, skip: true },
          ],
        },
      },
    ],
  });
  // The zoom must exactly take back the width the band gave up, or a gap or a crop shows at the sides — and both
  // frames give up the same 19.25 %, so the two photos zoom alike.
  for (const fit of VAM_FITS.lodochka!) {
    const drop = fit!.warp ? warpLayout(fit!.warp).drop : bandDrop(fit!.band!);
    assert.ok(close(fit!.scaleX!, 100 / (100 - drop), 5e-4), `zoom ${fit!.scaleX} vs ${100 / (100 - drop)}`);
    assert.ok(close(drop, 19.25, 0.01), `drop ${drop}`);
    assert.equal(fit!.clip, undefined, 'nothing is cropped off the top (or anywhere)');
    assert.equal(fit!.rotate, undefined, 'nothing is turned');
  }
  assert.deepEqual(Object.keys(VAM_FITS), ['lodochka'], 'no other shape is fitted');
  assert.equal(findVamShape('lodochka')?.type, 'u', 'Лодочка keeps borrowing the П-44Т screen');
  assert.deepEqual(vamShapeGlazings(findVamShape('lodochka')!).map((g) => [g.id, g.screen, g.mirror ?? false]), [['left', '10', false], ['right', '10', true]]);
  assert.equal(usesPlanRender('lodochka'), false, "the picture stays the app's real photo");
});

test('the corner frame keeps the window and sill where they were while the ceiling is straightened', () => {
  // Before the ceiling fix the left of the right-hand photo sat at screen y = 50 + 1.2384·(y − 50) − 1.91; lifting the
  // runs by half the rise moved it up, and the table's pan gives that back, so the left half is exactly as it was.
  const right = VAM_FITS.lodochka![1]!;
  for (const y of [10, 30, 50, 70, 90]) {
    const [, sy] = fitPoint(right, 20, y);
    assert.ok(close(sy, 50 + 1.2384 * (y - 50) - 1.91, 0.01), `y ${y}: ${sy}`);
  }
  // The far wall's tap target (6_4, frame 2) stands on the bare wall: right of the window's corner strip and left of the
  // ledge's side face, at the height of the wall, inside the picture.
  const [wx, wy] = fitTapPoint(right, '6_4', fitPoint(right, 68, 55));
  const [wallLeft] = fitPoint(right, 49.75, 55);
  const [wallRight] = fitPoint(right, 59.1, 55);
  assert.ok(wx > wallLeft && wx < wallRight && wy > 40 && wy < 70, `far wall tap target at ${[wx, wy]} between ${wallLeft} and ${wallRight}`);
});

test('the left frame shows the narrower balcony: the glazed side comes in a long way, not a few pixels', () => {
  const left = VAM_FITS.lodochka![0]!;
  // The window of the right-hand glazing (2_3's tap target, 68 / 73) moves by well over a tenth of the picture —
  // the first version squeezed only the 41-pixel strip and moved it by about two percent.
  const [x] = fitPoint(left, 68, 73);
  assert.ok(Math.abs(x - 68) > 8, `moved ${x - 68}`);
  // Nothing hangs outside the picture: the left of the frame is the picture's own left edge, the right likewise.
  assert.ok(close(fitPoint(left, 0, 50)[0], 0, 0.01) && close(fitPoint(left, 100, 50)[0], 100, 0.01));
  // The ceiling's and the floor's tap targets (4_3 at 51 / 8, 5_4 at 52 / 94) are pushed past the frame's edge by the
  // zoom — the buttons stay reachable just inside it — and an ordinary target is left exactly where the fit put it.
  const ceilingRaw = fitPoint(left, 51, 8);
  const floorRaw = fitPoint(left, 52, 94);
  assert.ok(ceilingRaw[1] < 0 && floorRaw[1] > 100, `raw: ${ceilingRaw} / ${floorRaw}`);
  for (const raw of [ceilingRaw, floorRaw]) {
    const [kx, ky] = fitKeepInFrame(left, raw);
    assert.ok(kx >= 5 && kx <= 95 && ky >= 5 && ky <= 95, `kept at ${[kx, ky]}`);
    assert.equal(kx, raw[0], 'only the coordinate that left the frame moves');
  }
  assert.deepEqual(fitKeepInFrame(left, [50, 50]), [50, 50]);
  assert.deepEqual(fitKeepInFrame(undefined, [-3, 140]), [-3, 140], 'a shape with no fit is left alone');
  // The switch (8_7 at 46 / 19) and the wall below the sill (3_3 at 37 / 52) stay in the frame by themselves.
  for (const [hx, hy] of [[46, 19], [37, 52]] as const) {
    const [sx, sy] = fitPoint(left, hx, hy);
    assert.ok(sx > 5 && sx < 95 && sy > 5 && sy < 95, `(${hx}, ${hy}) -> ${[sx, sy]}`);
  }
});

test('the CSS of a sheared piece carries its shear in the right slot (the ceiling fix lives in it)', () => {
  const pieces = fitPieces({ band: CORNER_BAND })!;
  // matrix(a, b, c, d, e, f): b is the drop per column that keeps the wall's top line straight; c must stay 0, or the
  // picture would shear sideways instead.
  assert.equal(pieceTransform(pieces[2]!), 'translate(35.51525%, -6.99549%) matrix(0.4822, 0.11977, 0, 1, 0, 0)');
  assert.equal(pieceTransform(pieces[3]!), 'translate(41.47475%, 25.51838%) matrix(0.4, -0.3287, 0, 1, 0, 0)');
  assert.equal(pieceTransform(pieces[0]!), 'translate(9.62525%, -1.00713%) matrix(1, 0, 0, 1, 0, 0)');
});

test('the shade of a span sits on its columns, below the wall line, with its own colours — on both hands', () => {
  const edgeAt = (band: FitBand, x: number): number => band.edge!.y + band.edge!.slope * (x - band.x0);
  for (const band of [CORNER_BAND, mirrorFit({ band: CORNER_BAND }).band!]) {
    const { spans } = bandLayout(band);
    const shaded = fitPieces({ band })!.filter((p) => p.shade);
    assert.equal(shaded.length, spans.filter((s) => s.shade).length);
    shaded.forEach((p, i) => {
      const span = spans.filter((s) => s.shade)[i]!;
      const sh = p.shade!;
      assert.deepEqual(sh.stops, span.shade, "the ramp is the span's");
      assert.deepEqual(sh.ao, span.ao, "so is the ceiling's shadow");
      assert.ok(close(sh.x0, span.xs, 1e-4) && close(sh.x1, span.xs + span.w, 1e-4), `columns ${sh.x0}..${sh.x1} vs ${span.xs}..${span.xs + span.w}`);
      // The shade's top corners lie on the wall's top line, so it never covers the ceiling.
      assert.ok(close(sh.top![0], edgeAt(band, sh.x0), 1e-4) && close(sh.top![1], edgeAt(band, sh.x1), 1e-4), `top ${sh.top} vs line`);
      // …and through the piece's own transform the whole shade lands where the band puts the line.
      const [lx, ly] = throughPiece(p, sh.x0, sh.top![0]);
      const [bx, by] = fitBandPoint(band, sh.x0, edgeAt(band, sh.x0));
      assert.ok(close(lx, bx, 2e-3) && close(ly, by, 2e-3), `shade corner (${lx}, ${ly}) vs band (${bx}, ${by})`);
    });
  }
  // Exact CSS for one face of the ledge: its columns, the wall line across them, the ceiling's shadow over a ramp from
  // the dark crease at the inner corner to a little less dark.
  const side = fitPieces({ band: CORNER_BAND })![3]!;
  assert.equal(shadeClipPath(side), 'polygon(72.5% 18.36575%, 77.5% 17.20925%, 77.5% 100%, 72.5% 100%)');
  assert.equal(
    shadeBackground(side),
    'linear-gradient(180deg, rgba(0, 0, 0, 0.25) 17.7875%, rgba(0, 0, 0, 0) 23.7875%), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 72.5%, rgba(255, 255, 255, 0.16) 75%, rgba(255, 255, 255, 0.22) 76.9%, rgba(255, 255, 255, 0.45) 77.5%)',
  );
  // The mirror reads the ramp from the other end: the bright convex edge is now on the left of the face.
  const flippedSide = fitPieces(mirrorFit({ band: CORNER_BAND }))![4]!;
  assert.equal(
    shadeBackground(flippedSide),
    'linear-gradient(180deg, rgba(0, 0, 0, 0.25) 17.7875%, rgba(0, 0, 0, 0) 23.7875%), linear-gradient(90deg, rgba(255, 255, 255, 0.45) 22.5%, rgba(255, 255, 255, 0.22) 23.1%, rgba(255, 255, 255, 0.16) 25%, rgba(255, 255, 255, 0.1) 27.5%)',
  );
  // A shade on a band that does not know its wall line covers the whole column.
  const noLinePieces = fitPieces({ band: { x0: 10, x1: 30, spans: [{ w: 20, k: 0.5, shade: [[0, -0.2], [1, -0.2]] }] } })!;
  const noLine = noLinePieces[noLinePieces.length - 1]!;
  assert.equal(shadeClipPath(noLine), 'polygon(10% 0%, 30% 0%, 30% 100%, 10% 100%)');
});

test("a band that starts at the picture's left edge has no piece to its left, and its mirror no piece to its right", () => {
  const edgeLeft = fitPieces({ band: { x0: 0, x1: 40, keep: 0.5 } })!;
  assert.equal(edgeLeft.length, 2, 'the right piece and the band');
  assert.ok(edgeLeft.every((p) => p.x0 >= 0 && p.x1 <= 100));
  const frame0 = VAM_FITS.lodochka![0]!;
  assert.equal(fitPieces(frame0)!.length, 2, 'the left frame: a piece left of the glazed side, and the side');
  assert.equal(fitPieces(mirrorFit(frame0))!.length, 2, 'and the same mirrored');
});

test('a fit can name where a tap target stands, and the mirror puts it on the other side', () => {
  const fit: SceneFit = { scaleX: 1.2, scaleY: 1.2, taps: { '4_3': [69, 6] } };
  assert.deepEqual(fitTapPoint(fit, '4_3', [63, -2]), [69, 6], 'the named place wins over the pulled-in point');
  assert.deepEqual(fitTapPoint(fit, '5_4', [63, 104]), [63, 95], 'any other target is only kept inside the frame');
  assert.deepEqual(fitTapPoint(mirrorFit(fit), '4_3', [37, -2]), [31, 6], 'mirrored');
  assert.deepEqual(fitTapPoint(undefined, '4_3', [63, -2]), [63, -2], 'no fit, no change');
});

test('no two tap targets of the fitted Лодочка frames overlap — 46 px buttons stay apart down to a 354 px frame, on both hands', () => {
  let checked = 0;
  for (const glazing of ['left', 'right']) {
    const screen = vamScreen({ shape: 'lodochka', glazing, picks: {} });
    screen.views.forEach((view, i) => {
      const fit = fitFor('lodochka', i as 0 | 1, screen.mirror);
      const spots = view.hotspots.flatMap((h) => {
        const [fx, fy] = fitPoint(fit, screen.mirror ? 100 - h.x : h.x, h.y);
        return fitShows(fit, fx, fy) ? [{ id: h.id, p: fitTapPoint(fit, h.id, [fx, fy]) }] : [];
      });
      assert.ok(spots.length >= 2, `${glazing} view ${i}: the targets are there`);
      for (const s of spots) assert.ok(s.p[0] >= 5 && s.p[0] <= 95 && s.p[1] >= 5 && s.p[1] <= 95, `${glazing} view ${i} ${s.id} at ${s.p} is not inside the frame`);
      for (let a = 0; a < spots.length; a += 1) {
        for (let b = a + 1; b < spots.length; b += 1) {
          const d = Math.hypot(spots[a]!.p[0] - spots[b]!.p[0], spots[a]!.p[1] - spots[b]!.p[1]);
          assert.ok(d >= 13, `${glazing} view ${i}: ${spots[a]!.id} and ${spots[b]!.id} are ${d.toFixed(1)} % apart`);
          checked += 1;
        }
      }
    });
  }
  assert.ok(checked >= 20, 'the pair check must actually run');
});

test('the coverage check would catch a fit that leaves the picture short of the frame', () => {
  // The Лодочка's turn with no downward pan — the exact table value that left a wedge — must fail the same maths.
  const short: SceneFit = { scaleX: 1.1, scaleY: 1.05, rotate: -2, skewY: -3, shift: [-2, 0], clip: [[0, 10], [100, 0], [100, 100], [0, 100]] };
  const m = fitMatrix(short);
  const det = m.a * m.d - m.b * m.c;
  const dx = 100 - 50 - m.e;
  const dy = 100 - 50 - m.f;
  const py = 50 + (-m.b * dx + m.a * dy) / det;
  assert.ok(py > 100.01, `the bare turn must overshoot the picture at the (100, 100) vertex (got ${py.toFixed(2)})`);
});

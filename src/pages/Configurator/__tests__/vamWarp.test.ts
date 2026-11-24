/**
 * Tests of the far-wall warp (`vamWarp.ts`): ceiling and floor of the re-cut wall land on level, parallel lines, the
 * wall is a plain straight wall (no ledge: "пусть она будет просто прямая"), a cut takes no room and is never sampled,
 * the picture either side meets the wall's ends, a spec mirrors exactly, and the view turn moves the band rigidly and
 * stretches the other side to the frame's edge. The engine can still stand a face out of the wall and shade a run; the
 * shipped table uses neither, so those parts are tested on a spec of their own (`LEDGE`).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fitFor, fitPoint, VAM_FITS } from '../vamFit';
import { mirrorWarp, warpBottomAt, warpColumn, warpLayout, warpPoint, warpShades, warpSourceFloor, warpSourceTop, warpTopAt } from '../vamWarp';
import type { FitWarp, WarpRun } from '../vamWarp';

const close = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

/** The shipped far wall of the Лодочка's second frame, and the same with no turn of the view. */
const WALL: FitWarp = VAM_FITS.lodochka![1]!.warp!;
const FLAT: FitWarp = { ...WALL, slide: 0 };

/** A far wall with a rectangular ledge standing out of its end, shaded at the inner corner — what the engine can do, not what the table ships. */
const LEDGE: FitWarp = {
  ...WALL,
  x1: 88.5,
  slide: -10,
  spans: [
    { w: 4, k: 1, top: 24.861 },
    { w: 3.12, k: 1, top: 24.861 },
    { w: 3.12, k: 0.9514, top: 24.861 },
    { w: 3.12, k: 0.9063, top: 24.861, shade: [[0, 0], [0.84, 0], [0.92, -0.1], [1, -0.22]] },
    { w: 0.9, k: 1, top: 24.861, skip: true },
    { w: 0.15, k: 0.15, top: 22.244, bottom: 86.473 },
    { w: 6.358, k: 0.8306, top: 22.244 },
    { w: 6.999, k: 0.7545, top: 22.244, shade: [[0, 0], [0.75, -0.01], [1, -0.1]], ao: [0.25, 6] },
    { w: 14.983, k: 1, top: 22.244, skip: true },
  ],
};
const LEDGE_FLAT: FitWarp = { ...LEDGE, slide: 0 };

/** Where, on screen, the photo's wall edges land at destination column `d`: [top, bottom], read off the painter's own column map. */
function edgesAt(warp: FitWarp, d: number): readonly [number, number] {
  const column = warpColumn(warpLayout(warp), d);
  return [column.scaleY * warpSourceTop(warp, column.xs) + column.offsetY, column.scaleY * warpSourceFloor(warp, column.xs) + column.offsetY];
}

test('the far wall gives up 19.25 % of the picture, and the picture left of it keeps its scale', () => {
  const layout = warpLayout(FLAT);
  assert.ok(close(layout.drop, 19.25, 0.01), `drop ${layout.drop}`);
  assert.ok(close(layout.scaleLeft, 1, 1e-9), 'the left of the picture is the identity in y');
  assert.ok(layout.scaleRight > 0.7 && layout.scaleRight < 0.9, `right scale ${layout.scaleRight}`);
  assert.equal(layout.stretchLeft, 1);
  assert.equal(layout.stretchRight, 1, 'no turn, no stretch');
});

test('the wall is a straight rectangle: ceiling and floor level, exactly, along every column of it — no step, no ledge', () => {
  const layout = warpLayout(FLAT);
  const shown = layout.runs.filter((run) => run.wt > 0);
  const from = shown[0]!.xt;
  const to = shown[shown.length - 1]!.xt + shown[shown.length - 1]!.wt;
  for (let d = from + 0.02; d < to; d += 0.1) {
    const [top, bottom] = edgesAt(FLAT, d);
    assert.ok(close(top, FLAT.topStart, 1e-6), `ceiling at ${d}: ${top}`);
    assert.ok(close(bottom, FLAT.floorY, 1e-6), `floor at ${d}: ${bottom}`);
  }
  for (const run of layout.runs) {
    assert.ok(close(run.top, FLAT.topStart) && close(run.bottom, FLAT.floorY), `run at ${run.xs} stands on the wall's own levels`);
    assert.equal(run.shade, undefined, 'no shading');
  }
  assert.ok(close(layout.topEnd, FLAT.topStart) && close(layout.bottomEnd, FLAT.floorY), 'the end of the band is at the wall levels');
});

test('the wall is shortened by one cut at its far end, never by a squeeze: boards keep their scale and nothing of the cut is sampled', () => {
  const layout = warpLayout(FLAT);
  const cuts = layout.runs.filter((run) => run.skip);
  assert.equal(cuts.length, 1, 'one cut, after the wall');
  const cut = cuts[0]!;
  assert.equal(cut.wt, 0, 'a cut-out run has no width on screen');
  assert.equal(layout.runs.indexOf(cut), layout.runs.length - 1, 'the cut is the end of the band: the wall meets the door frame');
  const before = layout.runs[layout.runs.length - 2]!;
  assert.ok(close(before.xt + before.wt, cut.xt, 1e-9), 'the run before the cut ends where the cut closes');
  const half = layout.drop / 2;
  for (let d = half + 0.01; d < 100 - half; d += 0.05) {
    const { xs } = warpColumn(layout, d);
    assert.ok(xs <= cut.xs + 1e-6 || xs >= cut.xs + cut.w - 1e-6, `column ${d} samples ${xs} inside the cut ${cut.xs}..${cut.xs + cut.w}`);
  }
  // The photo's column inside the cut collapses onto the seam.
  const [seamX] = warpPoint(layout, cut.xs + cut.w / 2, 50);
  assert.ok(close(seamX, cut.xt + layout.slide, 1e-6), `seam at ${seamX}`);
  // What stays is at the photo's own scale where it starts (k = 1) and no board is halved anywhere.
  assert.equal(layout.runs[0]!.k, 1);
  assert.equal(layout.runs[1]!.k, 1);
  for (const run of layout.runs) if (!run.skip) assert.ok(run.k > 0.7, `run at ${run.xs} squeezed to ${run.k}`);
  assert.ok(close(layout.drop, 19.25, 0.01));
});

test("the band ends past the finish mask's slanted right edge (89.25 %), so no wedge of the finish stands beside the door frame", () => {
  assert.ok(WALL.x1 >= 89.25 + 0.2, `the band ends at ${WALL.x1} %`);
  const layout = warpLayout(WALL);
  // The picture right of the band shows only what is past the wall: its first column is the band's end.
  assert.ok(close(warpColumn(layout, 100 - layout.drop / 2).xs, 100, 1e-6));
});

test('a board is as wide on screen along the whole wall — the board-width law w ∝ h²', () => {
  const layout = warpLayout(FLAT);
  // Measured on the finish pictures: a board's width in the photo grows as the square of the wall's height at its column.
  const heightAt = (x: number): number => warpSourceFloor(FLAT, x) - warpSourceTop(FLAT, x);
  const boardOnScreen = (run: WarpRun): number => (run.k * heightAt(run.xs + run.w / 2) ** 2) / 1e4;
  const wall = layout.runs.filter((run) => !run.skip && run.xs >= FLAT.x0 + 4);
  const first = boardOnScreen(wall[0]!);
  assert.ok(wall.length >= 6, 'a wall of several runs');
  for (const run of wall) assert.ok(close(boardOnScreen(run) / first, 1, 0.01), `a board at ${run.xs} is ${boardOnScreen(run) / first} of the first one's width`);
  assert.equal(layout.runs[0]!.k, 1, "the window's corner strip (its handle) is not squeezed");
});

test('the engine can stand a rectangular ledge out of the wall: faces level on top and bottom, taller than the wall, a vertical step between', () => {
  const layout = warpLayout(LEDGE_FLAT);
  // runs: corner strip, three bare runs, a cut, the step sliver, side face, front face, a cut
  const [side, front] = [layout.runs[6], layout.runs[7]];
  assert.ok(side && front);
  for (const face of [side, front]) assert.ok(close(face.topFrom, face.top) && close(face.bottomFrom, face.bottom), 'a face has level edges');
  const vanishing = LEDGE_FLAT.topStart + 0.55 * (LEDGE_FLAT.floorY - LEDGE_FLAT.topStart);
  const nearer = (front.bottom - vanishing) / (LEDGE_FLAT.floorY - vanishing);
  assert.ok(close((front.top - vanishing) / (LEDGE_FLAT.topStart - vanishing), nearer, 2e-3), `top and bottom scale alike (${nearer})`);
  assert.ok(front.top < LEDGE_FLAT.topStart && front.bottom > LEDGE_FLAT.floorY, 'higher and lower than the wall');
  const step = layout.runs[5]!;
  assert.ok(step.wt < 0.1, `the step is ${step.wt} % wide`);
  assert.ok(close(step.topFrom, LEDGE_FLAT.topStart) && close(step.bottomFrom, LEDGE_FLAT.floorY) && close(step.top, front.top) && close(step.bottom, front.bottom));
  for (const run of [side, front]) {
    for (const along of [0.25, 0.5, 0.75]) {
      const d = run.xt + along * run.wt;
      assert.ok(close(warpTopAt(layout, d), run.top, 1e-9) && close(warpBottomAt(layout, d), run.bottom, 1e-9));
      const [top, bottom] = edgesAt(LEDGE_FLAT, d);
      assert.ok(close(top, run.top, 1e-6) && close(bottom, run.bottom, 1e-6), 'the column map lands on those levels');
    }
  }
});

test('the pictures either side of the band meet its ends, and every run boundary is seamless', () => {
  for (const warp of [FLAT, LEDGE_FLAT]) {
    const layout = warpLayout(warp);
    const left = warpPoint(layout, warp.x0, warpSourceTop(warp, warp.x0));
    const leftFloor = warpPoint(layout, warp.x0, warpSourceFloor(warp, warp.x0));
    assert.ok(close(left[1], warp.topStart) && close(leftFloor[1], warp.floorY));
    const right = warpPoint(layout, warp.x1, warpSourceTop(warp, warp.x1));
    const rightFloor = warpPoint(layout, warp.x1, warpSourceFloor(warp, warp.x1));
    assert.ok(close(right[1], layout.topEnd) && close(rightFloor[1], layout.bottomEnd));
    const seams = [warp.x0, ...layout.runs.map((run) => run.xs + run.w)];
    for (const x of seams) {
      for (const y of [10, 40, 70]) {
        const before = warpPoint(layout, x - 1e-6, y);
        const after = warpPoint(layout, x + 1e-6, y);
        assert.ok(close(before[0], after[0], 1e-4) && close(before[1], after[1], 1e-4), `seam at ${x}, row ${y}: ${before} vs ${after}`);
      }
    }
  }
});

test('a point of the photo lands in the column the painter draws it in', () => {
  for (const warp of [FLAT, WALL, LEDGE, LEDGE_FLAT]) {
    const layout = warpLayout(warp);
    // Photo columns that are shown (not in a cut): the left picture, the middle of every shown run, the right picture.
    const xs = [20, 47, ...layout.runs.filter((run) => !run.skip).map((run) => run.xs + run.w / 2), 95];
    for (const x of xs) {
      for (const y of [30, 60]) {
        const [px, py] = warpPoint(layout, x, y);
        const column = warpColumn(layout, px);
        assert.ok(close(column.xs, x, 1e-6), `column ${px}: samples ${column.xs}, expected ${x}`);
        assert.ok(close(column.scaleY * y + column.offsetY, py, 1e-6), `row of (${x}, ${y}): ${column.scaleY * y + column.offsetY} vs ${py}`);
      }
    }
  }
});

test('the view turn slides the band rigidly and stretches the picture right of it to the frame edge', () => {
  const flat = warpLayout(FLAT);
  const turned = warpLayout(WALL);
  const half = turned.drop / 2;
  const slide = WALL.slide!;
  assert.equal(turned.slide, slide);
  assert.ok(slide < 0 && slide > -12, `a few percent: ${slide}`);
  // Left of the wall and the wall itself slide by the turn; the pictures' y never moves.
  for (const [x, y] of [[10, 40], [47, 50], [60, 30], [80, 70]] as const) {
    const [fx, fy] = warpPoint(flat, x, y);
    const [tx, ty] = warpPoint(turned, x, y);
    assert.ok(close(tx - fx, slide, 1e-9) && close(ty, fy, 1e-9), `(${x}, ${y}): ${[tx - fx, ty - fy]}`);
  }
  // The right of the picture is stretched, not slid: its far edge still stands at the frame's edge.
  assert.ok(close(turned.stretchRight, (100 - WALL.x1 - slide) / (100 - WALL.x1), 1e-9));
  assert.ok(close(warpPoint(turned, 100, 50)[0], 100 - half, 1e-9));
  assert.ok(close(warpPoint(turned, 0, 50)[0], half + slide, 1e-9), 'the left of the picture slides out of the frame');
  // Every destination column of the frame (the zoom shows 9.6..90.4) is drawn from the photo, none from beyond it.
  for (let d = half; d <= 100 - half; d += 0.25) {
    const column = warpColumn(turned, d);
    assert.ok(column.xs >= 0 && column.xs <= 100, `column ${d} samples ${column.xs}`);
  }
});

test('a view turned the other way stretches the left of the picture instead', () => {
  const turned = warpLayout({ ...WALL, slide: 4 });
  assert.ok(close(turned.stretchLeft, (WALL.x0 + 4) / WALL.x0, 1e-9));
  assert.equal(turned.stretchRight, 1);
  const half = turned.drop / 2;
  assert.ok(close(warpPoint(turned, 0, 50)[0], half, 1e-9), 'the left of the picture stays at the frame edge');
  assert.ok(close(warpColumn(turned, half).xs, 0, 1e-9));
});

test('a mirrored warp puts every point where the mirror image would, and its levels read from the other end', () => {
  for (const warp of [WALL, LEDGE]) {
    const flipped = mirrorWarp(warp);
    assert.deepEqual(flipped.spans.map((s) => s.w), [...warp.spans].reverse().map((s) => s.w));
    assert.deepEqual(flipped.spans.map((s) => s.skip === true), [...warp.spans].reverse().map((s) => s.skip === true));
    assert.ok(close(flipped.ceiling.slope, -warp.ceiling.slope) && close(flipped.floor.slope, -warp.floor.slope));
    assert.ok(close(flipped.ceiling.y, warp.ceiling.y + warp.ceiling.slope * (warp.x1 - warp.x0), 1e-9));
    assert.equal(flipped.slide, -warp.slide!);
    assert.deepEqual(flipped.rigid, warp.rigid);
    const layout = warpLayout(warp);
    const mirrored = warpLayout(flipped);
    for (const [x, y] of [[0, 10], [20, 40], [46, 50], [52, 23], [60, 30], [70, 60], [95, 90]] as const) {
      const [ox, oy] = warpPoint(layout, x, y);
      const [mx, my] = warpPoint(mirrored, 100 - x, y);
      assert.ok(close(mx, 100 - ox, 1e-9) && close(my, oy, 1e-9), `(${x}, ${y}): ${[mx, my]} vs ${[100 - ox, oy]}`);
    }
    assert.ok(close(mirrored.drop, layout.drop, 1e-9));
  }
  // A ledge's levels read from the other end once mirrored.
  const flippedLedge = mirrorWarp(LEDGE);
  assert.ok(close(flippedLedge.topStart, 22.244) && close(flippedLedge.floorY, 86.473));
  assert.ok(close(flippedLedge.spans[7]!.top, 24.861) && close(flippedLedge.spans[7]!.bottom!, 84.332));
  // Through the table: the right-handed screen's fit is the mirror of the left-handed one, taps and all.
  const [fx, fy] = fitPoint(fitFor('lodochka', 1, false), 68, 55);
  const [rx, ry] = fitPoint(fitFor('lodochka', 1, true), 32, 55);
  assert.ok(close(rx, 100 - fx, 1e-9) && close(ry, fy, 1e-9));
});

test('the shades lie on their runs, turned with the picture, between the ceiling and floor lines of each run', () => {
  const layout = warpLayout(LEDGE);
  const shades = warpShades(layout);
  const shaded = layout.runs.filter((run) => run.shade);
  assert.equal(shades.length, shaded.length);
  assert.equal(shades.length, 2);
  shades.forEach((shade, i) => {
    const run = shaded[i]!;
    assert.ok(close(shade.x0, run.xt + LEDGE.slide!, 1e-4) && close(shade.x1, run.xt + run.wt + LEDGE.slide!, 1e-4));
    const r5 = (v: number): number => Math.round(v * 1e5) / 1e5;
    assert.deepEqual(shade.top, [r5(run.topFrom), r5(run.top)]);
    assert.deepEqual(shade.bottom, [r5(run.bottomFrom), r5(run.bottom)]);
  });
  assert.equal(shades[0]!.ao, undefined);
  assert.deepEqual(shades[1]!.ao, [0.25, 6]);
  // The shipped wall has none.
  assert.equal(warpShades(warpLayout(WALL)).length, 0);
});

test('a cut inside the wall takes no room and its photo columns are never sampled', () => {
  const layout = warpLayout(LEDGE_FLAT);
  const cuts = layout.runs.filter((run) => run.skip);
  assert.equal(cuts.length, 2);
  for (const cut of cuts) {
    assert.equal(cut.wt, 0);
    const at = layout.runs.indexOf(cut);
    const before = layout.runs[at - 1]!;
    const after = layout.runs[at + 1];
    assert.ok(close(before.xt + before.wt, cut.xt, 1e-9));
    if (after) assert.ok(close(cut.xt, after.xt, 1e-9));
  }
  const half = layout.drop / 2;
  for (let d = half + 0.01; d < 100 - half; d += 0.05) {
    const { xs } = warpColumn(layout, d);
    for (const cut of cuts) assert.ok(xs <= cut.xs + 1e-6 || xs >= cut.xs + cut.w - 1e-6, `column ${d} samples ${xs} inside the cut`);
  }
  assert.ok(close(layout.drop, 19.25, 0.01));
});

test('the spans of every warp tile its band exactly, and every warp has a wall to show', () => {
  for (const mirror of [false, true]) {
    const warp = fitFor('lodochka', 1, mirror)!.warp!;
    const total = warp.spans.reduce((sum, s) => sum + s.w, 0);
    assert.ok(close(total, warp.x1 - warp.x0, 1e-9), `spans cover ${total} of ${warp.x1 - warp.x0}`);
    assert.ok(warp.spans.some((s) => !s.skip), 'something is shown');
    assert.ok(warp.floorY > warp.topStart && warp.floor.y > warp.ceiling.y, 'the floor is below the ceiling');
  }
  for (const warp of [LEDGE, mirrorWarp(LEDGE)]) assert.ok(close(warp.spans.reduce((sum, s) => sum + s.w, 0), warp.x1 - warp.x0, 1e-9));
});

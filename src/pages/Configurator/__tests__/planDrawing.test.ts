/**
 * Tests of the plan drawing's geometry (`planDrawing.ts`): for every shape, on both hands, the wall bands are
 * proper polygons that lie outside the room, leave no gap against their neighbours (a step is a closed notch, not
 * a square stuck on), and every dimension label — measured by the box its glyphs really occupy, baseline-anchored
 * like the `<text>` — keeps clear of the walls and their outline, of its own line, arrows and extension lines, of the
 * other dimensions and labels, of the note, and stays inside the view box.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { exportSize } from '../exportSvg';
import { PLAN_SHAPES, mirrorPlan } from '../planShapes';
import type { PlanGeom } from '../planShapes';
import {
  BESIDE_GAP_EM,
  CAP_HEIGHT_EM,
  DIGIT_ADVANCE_EM,
  DIM_LINE_EM,
  EXT_LINE_EM,
  EXT_OVERSHOOT_EM,
  HALO_EM,
  STROKE_EM,
  arrowHead,
  bandParts,
  bandQuad,
  dimLine,
  extensionLines,
  inside,
  len,
  outward,
  planView,
  polyDistance,
  signedArea,
  solidPolygons,
  sub,
  unit,
  wallBands,
} from '../planDrawing';
import type { DimPlacement, PlanView, V } from '../planDrawing';

const HANDS: readonly (readonly [string, PlanGeom])[] = Object.entries(PLAN_SHAPES).flatMap(([id, g]) => [
  [id, g] as const,
  [`${id}:mirrored`, mirrorPlan(g)] as const,
]);

/** True when open segments p1-p2 and p3-p4 cross. */
function crosses(p1: V, p2: V, p3: V, p4: V): boolean {
  const d = (a: V, b: V, c: V): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** A handful of points inside a (convex or mildly non-convex) polygon: its centre and the halves of its fans. */
function interiorPoints(poly: readonly V[]): V[] {
  const out: V[] = [];
  const c = poly.reduce<V>((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
  out.push(c);
  for (const p of poly) out.push([c[0] + (p[0] - c[0]) * 0.5, c[1] + (p[1] - c[1]) * 0.5]);
  return out;
}

const inAny = (polys: readonly (readonly V[])[], p: V): boolean => polys.some((poly) => inside(poly, p));

test('every wall band is a simple, non-degenerate polygon on every shape and hand', () => {
  for (const [id, g] of HANDS) {
    for (const band of wallBands(g)) {
      const [a, b, b2, a2] = bandQuad(band);
      assert.ok(Math.abs(signedArea([a!, b!, b2!, a2!])) > 1, `${id} edge ${band.i}: band has no area`);
      assert.ok(!crosses(a!, b!, b2!, a2!) && !crosses(b!, b2!, a2!, a!), `${id} edge ${band.i}: band is a bow-tie`);
    }
  }
});

test('the solid mass lies outside the room: no hatching over the floor', () => {
  for (const [id, g] of HANDS) {
    for (const poly of solidPolygons(g)) {
      for (const p of interiorPoints(poly)) assert.ok(!inside(g.poly, p), `${id}: a solid piece reaches into the room at ${p}`);
    }
  }
});

test('the walls leave no gap: just outside every edge, and at every corner, there is wall', () => {
  for (const [id, g] of HANDS) {
    const bands = wallBands(g);
    const solids = solidPolygons(g, bands);
    const lights = bands.flatMap((band) => (band.kind === 'glazing' || band.kind === 'panel' ? [] : [bandParts(g, band).light ?? []])).filter((l) => l.length > 0);
    const quads = bands.filter((band) => band.kind === 'glazing' || band.kind === 'panel').map(bandQuad);
    const everything = [...solids, ...lights, ...quads];
    bands.forEach((band) => {
      const dir = unit(sub(band.b, band.a));
      const normal = outward(band.a, band.b);
      const length = len(sub(band.b, band.a));
      for (const t of [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]) {
        const p: V = [band.a[0] + dir[0] * length * t + normal[0] * 6, band.a[1] + dir[1] * length * t + normal[1] * 6];
        assert.ok(inAny(everything, p), `${id} edge ${band.i} at ${(t * 100).toFixed(0)} %: nothing outside the wall at ${p.map((v) => v.toFixed(0))}`);
      }
    });
    g.poly.forEach((v, i) => {
      // A point just outside the corner, along the bisector of the two outward normals.
      const prev = g.poly[(i - 1 + g.poly.length) % g.poly.length]!;
      const next = g.poly[(i + 1) % g.poly.length]!;
      const n1 = outward(prev, v);
      const n2 = outward(v, next);
      const sum: V = [n1[0] + n2[0], n1[1] + n2[1]];
      const l = len(sum);
      if (l < 0.2) return; // a straight run: no corner
      // The bisector is where two bands meet, so test a little to either side of it (a point exactly on a shared edge
      // is neither's).
      for (const turn of [-0.06, 0.06]) {
        const c = Math.cos(turn);
        const sn = Math.sin(turn);
        const dir: V = [(sum[0] * c - sum[1] * sn) / l, (sum[0] * sn + sum[1] * c) / l];
        const p: V = [v[0] + dir[0] * 25, v[1] + dir[1] * 25];
        if (inside(g.poly, p)) continue; // a reflex corner's bisector points into the room: nothing to cover
        assert.ok(inAny(everything, p), `${id} corner ${i}: a pinhole outside the corner at ${p.map((x) => x.toFixed(0))}`);
      }
    });
  }
});

test("the Лодочка's step is a closed notch: its whole 400 x 280 corner is solid, on both hands", () => {
  const g = PLAN_SHAPES.lodochka!;
  const notch = (plan: PlanGeom, x0: number, x1: number): void => {
    const solids = solidPolygons(plan);
    for (let i = 1; i < 20; i += 1) {
      for (let j = 1; j < 14; j += 1) {
        const p: V = [x0 + ((x1 - x0) * i) / 20, (280 * j) / 14];
        assert.ok(!inside(plan.poly, p), `${p} is in the room`);
        assert.ok(inAny(solids, p), `the corner is not solid at ${p.map((v) => v.toFixed(0))}`);
      }
    }
  };
  notch(g, 3250, 3650);
  notch(mirrorPlan(g), 0, 400);
});

test('mirroring a plan twice gives the plan back, blocks, dimensions and openings included', () => {
  for (const [id, g] of Object.entries(PLAN_SHAPES)) {
    const back = mirrorPlan(mirrorPlan(g));
    assert.deepEqual(back.poly, g.poly, `${id}: outline`);
    assert.deepEqual(back.kinds, g.kinds, `${id}: kinds`);
    assert.deepEqual(back.dims, g.dims, `${id}: dimensions`);
    assert.deepEqual(back.openings, g.openings, `${id}: openings`);
    assert.deepEqual(back.blocks ?? [], g.blocks ?? [], `${id}: blocks`);
  }
});


/*
 * ---- Dimension labels, measured on the box their glyphs really occupy.
 *
 * A label is a `<text>` anchored by the middle of its BASELINE, so its glyphs fill the box from the baseline up to
 * the digits' height (not a box centred on the anchor), one digit advance per character, rotated like the text.
 */

/** The box a label's glyphs fill as the browser draws the `<text>`: centred on `at`, from the baseline up, rotated by `angle`. */
function glyphBox(label: { readonly at: V; readonly angle: number }, text: string, font: number): V[] {
  const rad = (label.angle * Math.PI) / 180;
  // SVG rotates clockwise on screen, the plan's y points up: a drawn rotation of `angle` is a plan rotation of -angle.
  const ux: V = [Math.cos(rad), -Math.sin(rad)];
  const uy: V = [Math.sin(rad), Math.cos(rad)];
  const hx = (text.length * DIGIT_ADVANCE_EM * font) / 2;
  const h = CAP_HEIGHT_EM * font;
  const corners: readonly V[] = [[-hx, 0], [hx, 0], [hx, h], [-hx, h]];
  return corners.map(([x, y]): V => [label.at[0] + ux[0] * x + uy[0] * y, label.at[1] + ux[1] * x + uy[1] * y]);
}

const wallPolygons = (g: PlanGeom): (readonly V[])[] => [...wallBands(g).map(bandQuad), ...(g.blocks ?? [])];

interface Furniture {
  readonly name: string;
  readonly shape: readonly V[];
  /** Half the stroke width, em. */
  readonly reach: number;
}

/** What a dimension draws besides its text: its line, its extension lines and its two arrowheads. */
function furnitureOf(placement: DimPlacement, font: number): Furniture[] {
  const { line } = placement;
  return [
    { name: 'its dimension line', shape: [line.p, line.q], reach: DIM_LINE_EM / 2 },
    ...extensionLines(line, font).map((e, k): Furniture => ({ name: `extension line ${k}`, shape: [e[0], e[1]], reach: EXT_LINE_EM / 2 })),
    { name: 'arrowhead at p', shape: arrowHead(line.p, line.q, font), reach: 0 },
    { name: 'arrowhead at q', shape: arrowHead(line.q, line.p, font), reach: 0 },
  ];
}

const TOL = 1e-6;

/** Calls `check` for every label of every shape on both hands, with its real glyph box. */
function forEachLabel(check: (id: string, g: PlanGeom, view: PlanView, placement: DimPlacement, box: readonly V[], index: number) => void): void {
  for (const [id, g] of HANDS) {
    const view = planView(g, true);
    assert.equal(view.dims.length, g.dims.length, `${id}: a placement for every dimension`);
    view.dims.forEach((placement, index) => check(id, g, view, placement, glyphBox(placement.label, placement.dim.text, view.font), index));
  }
}

test('every label is set on the box its glyphs fill (baseline up to the digits height), and reports that box', () => {
  forEachLabel((id, _g, view, placement, box) => {
    placement.label.box.forEach((corner, k) => {
      assert.ok(Math.abs(corner[0] - box[k]![0]) < TOL && Math.abs(corner[1] - box[k]![1]) < TOL, `${id} "${placement.dim.text}": reported box differs from the real one at corner ${k}`);
    });
    assert.ok(view.font > 0);
  });
});

test('no label touches a wall, its outline stroke or the halo cutting it: the glyphs keep clear paper around them', () => {
  forEachLabel((id, g, view, placement, box) => {
    const need = (HALO_EM + STROKE_EM) * view.font - TOL;
    wallPolygons(g).forEach((wall, k) => {
      const d = polyDistance(box, wall);
      assert.ok(d >= need, `${id} "${placement.dim.text}": ${d.toFixed(1)} mm from wall piece ${k}, needs ${need.toFixed(1)}`);
    });
    const room = polyDistance(box, g.poly);
    assert.ok(room >= (HALO_EM + STROKE_EM / 2) * view.font - TOL, `${id} "${placement.dim.text}": ${room.toFixed(1)} mm from the room outline`);
  });
});

test('no label touches a dimension line, an arrowhead or an extension line — its own or any other dimension\'s', () => {
  forEachLabel((id, _g, view, placement, box) => {
    for (const other of view.dims) {
      for (const f of furnitureOf(other, view.font)) {
        const need = (HALO_EM + f.reach) * view.font - TOL;
        const d = polyDistance(box, f.shape);
        assert.ok(d >= need, `${id} "${placement.dim.text}": ${d.toFixed(1)} mm from ${f.name} of "${other.dim.text}", needs ${need.toFixed(1)}`);
      }
    }
  });
});

test('labels are clearly separate: at least one digit between any two, and none touches the note under the drawing', () => {
  forEachLabel((id, _g, view, placement, box, index) => {
    view.dims.forEach((other, j) => {
      if (j <= index) return;
      const d = polyDistance(box, glyphBox(other.label, other.dim.text, view.font));
      assert.ok(d >= DIGIT_ADVANCE_EM * view.font - TOL, `${id}: "${placement.dim.text}" and "${other.dim.text}" are ${d.toFixed(1)} mm apart, a digit is ${(DIGIT_ADVANCE_EM * view.font).toFixed(1)}`);
    });
    const note = view.note;
    assert.ok(note, `${id}: the detailed card has its note`);
    assert.ok(polyDistance(box, note.box) >= HALO_EM * view.font - TOL, `${id} "${placement.dim.text}": touches the note`);
  });
});

test('the view box holds every label (glyphs and halo), line and arrow, and the note stays inside it', () => {
  forEachLabel((id, _g, view, placement, box) => {
    const halo = HALO_EM * view.font;
    for (const c of box) {
      assert.ok(c[0] - halo >= view.minX - TOL && c[0] + halo <= view.maxX + TOL && c[1] - halo >= view.minY - TOL && c[1] + halo <= view.maxY + TOL, `${id} "${placement.dim.text}": a glyph corner or its halo leaves the view box`);
    }
    for (const f of furnitureOf(placement, view.font)) {
      for (const c of f.shape) assert.ok(c[0] >= view.minX && c[0] <= view.maxX && c[1] >= view.minY && c[1] <= view.maxY, `${id} "${placement.dim.text}": ${f.name} leaves the view box`);
    }
    for (const c of view.note!.box) assert.ok(c[0] <= view.maxX + 0.4 * view.font && c[1] >= view.minY - 0.4 * view.font, `${id}: the note leaves the view`);
  });
});

test('dimension lines, arrows and extension lines keep off the note under the drawing', () => {
  for (const [id, g] of HANDS) {
    const view = planView(g, true);
    for (const placement of view.dims) {
      for (const f of furnitureOf(placement, view.font)) {
        assert.ok(polyDistance(f.shape, view.note!.box) > f.reach * view.font, `${id} "${placement.dim.text}": ${f.name} touches the note`);
      }
    }
  }
});

test('a label beside its line keeps its NEAR glyph edge the same distance from the line on both sides, clear of the extension lines overshoot', () => {
  let beside = 0;
  const sides = new Set<number>();
  forEachLabel((id, _g, view, placement, box) => {
    if (!placement.label.beside) return;
    beside += 1;
    const rad = (placement.label.angle * Math.PI) / 180;
    const uy: V = [Math.sin(rad), Math.cos(rad)];
    const mid: V = [(placement.line.p[0] + placement.line.q[0]) / 2, (placement.line.p[1] + placement.line.q[1]) / 2];
    const across = box.map((c) => (c[0] - mid[0]) * uy[0] + (c[1] - mid[1]) * uy[1]);
    const side = Math.sign(across[0]!);
    assert.ok(across.every((n) => Math.sign(n) === side), `${id} "${placement.dim.text}": the label straddles its line`);
    sides.add(side);
    const near = Math.min(...across.map(Math.abs));
    assert.ok(Math.abs(near - BESIDE_GAP_EM * view.font) < 1e-6, `${id} "${placement.dim.text}": near edge ${near.toFixed(1)} mm from the line, expected ${(BESIDE_GAP_EM * view.font).toFixed(1)}`);
    assert.ok(near >= (EXT_OVERSHOOT_EM + HALO_EM + EXT_LINE_EM / 2) * view.font, `${id} "${placement.dim.text}": inside the extension lines' overshoot`);
    // It stands on the side the extension lines run on, past their overshoot.
    assert.equal(side, Math.sign(placement.line.out[0] * uy[0] + placement.line.out[1] * uy[1]), `${id} "${placement.dim.text}": not on the extension lines' side`);
  });
  assert.ok(beside >= 8, `the shapes have labels beside their line (${beside})`);
  assert.ok(sides.has(1) && sides.has(-1), 'beside labels are exercised on both sides of their lines');
});

test("the Лодочка's 280 and 600 are two separate numbers, each next to its own segment, on both hands", () => {
  for (const [id, g] of HANDS.filter(([name]) => name.startsWith('lodochka'))) {
    const view = planView(g, true);
    const pick = (text: string): DimPlacement => view.dims.find((d) => d.dim.text === text)!;
    const [small, big] = [pick('280'), pick('600')];
    const dir = unit(sub(big.line.q, big.line.p));
    const run = (p: DimPlacement): [number, number] => {
      const along = glyphBox(p.label, p.dim.text, view.font).map((c) => c[0] * dir[0] + c[1] * dir[1]);
      return [Math.min(...along), Math.max(...along)];
    };
    const [r1, r2] = [run(small), run(big)];
    const gap = r1[0] < r2[0] ? r2[0] - r1[1] : r1[0] - r2[1];
    assert.ok(gap >= DIGIT_ADVANCE_EM * view.font - TOL, `${id}: 280 and 600 are ${gap.toFixed(1)} mm apart along their line, a digit is ${(DIGIT_ADVANCE_EM * view.font).toFixed(1)}`);
    for (const p of [small, big]) {
      const [lo, hi] = [Math.min(...[p.line.p, p.line.q].map((c) => c[0] * dir[0] + c[1] * dir[1])), Math.max(...[p.line.p, p.line.q].map((c) => c[0] * dir[0] + c[1] * dir[1]))];
      const centre = (run(p)[0] + run(p)[1]) / 2;
      assert.ok(centre >= lo && centre <= hi, `${id}: "${p.dim.text}" has slid off its own segment`);
    }
  }
});

test('a dimension line only ever moves away from what it measures, a row of dimensions stays straight, and no printed value changes', () => {
  for (const [id, g] of HANDS) {
    const view = planView(g, true);
    view.dims.forEach((placement, i) => {
      assert.equal(placement.dim, g.dims[i], `${id}: dimension ${i} is the plan's own`);
      const nominal = dimLine(g.dims[i]!, g);
      for (const end of ['p', 'q'] as const) {
        const moved = sub(placement.line[end], nominal[end]);
        const along = moved[0] * nominal.out[0] + moved[1] * nominal.out[1];
        assert.ok(along >= -TOL, `${id} "${placement.dim.text}": the line moved towards what it measures`);
        assert.ok(Math.abs(len(moved) - Math.abs(along)) < 1e-6, `${id} "${placement.dim.text}": the line moved sideways`);
      }
    });
    // Dimensions on one line (same axis, same distance in the plan) are still one line.
    view.dims.forEach((a, i) => {
      view.dims.forEach((b, j) => {
        if (j <= i || a.dim.axis === 'along' || a.dim.axis !== b.dim.axis || a.dim.at !== b.dim.at) return;
        const k = a.dim.axis === 'x' ? 1 : 0;
        assert.ok(Math.abs(a.line.p[k] - b.line.p[k]) < 1e-6, `${id}: "${a.dim.text}" and "${b.dim.text}" were one row and are not any more`);
      });
    });
  }
});

test("the labels do not make the text bigger: the Лодочка's text stays at the size of the plain drawing", () => {
  for (const [id, g] of HANDS.filter(([name]) => name.startsWith('lodochka'))) {
    const view = planView(g, true);
    // The drawing used to set its 213 mm text from the walls and lines alone; a beside label's room inflated it to 234.
    assert.ok(view.font <= 213, `${id}: text is ${view.font.toFixed(1)} mm`);
  }
});

test('polyDistance: 0 for overlapping, touching or nested shapes, the true gap otherwise', () => {
  const square = (x: number, y: number, s: number): V[] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
  assert.equal(polyDistance(square(0, 0, 10), square(5, 5, 10)), 0);
  assert.equal(polyDistance(square(0, 0, 10), square(10, 0, 10)), 0);
  assert.equal(polyDistance(square(0, 0, 10), square(2, 2, 3)), 0);
  assert.equal(polyDistance(square(0, 0, 10), square(13, 0, 10)), 3);
  assert.ok(Math.abs(polyDistance(square(0, 0, 10), square(13, 14, 10)) - 5) < TOL);
  assert.equal(polyDistance(square(0, 0, 10), [[-5, 5], [15, 5]]), 0);
  assert.equal(polyDistance(square(0, 0, 10), [[-5, 12], [15, 12]]), 2);
});

test('the downloaded SVG gets a sensible size: ~1200 px wide with the drawing\'s proportions, not its millimetres', () => {
  assert.deepEqual(exportSize({ width: 5633, height: 2754 }), { width: 1200, height: 587 });
  assert.deepEqual(exportSize({ width: 100, height: 100 }), { width: 1200, height: 1200 });
  assert.deepEqual(exportSize({ width: 1200, height: 600 }), { width: 1200, height: 600 });
  assert.ok(exportSize({ width: 5000, height: 1 }).height >= 1);
  for (const [id, g] of HANDS) {
    const view = planView(g, true);
    const box = { width: view.maxX - view.minX, height: view.maxY - view.minY };
    const size = exportSize(box);
    assert.ok(Math.abs(size.width / size.height - box.width / box.height) < 0.01, `${id}: proportions kept`);
  }
});

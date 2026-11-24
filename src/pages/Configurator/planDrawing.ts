/**
 * @file The geometry of the plan drawing (`ShapePlan.tsx`), kept apart from the SVG so it can be tested: the wall
 * bands laid outside the room outline with mitred corners, the solid (hatched) mass they and the plan's support
 * blocks make together, the thin parts of a wall, and the placement of the dimension lines and their labels (by
 * the real glyph box of the text, so a label clears the walls, its own line and its neighbours).
 *
 * The drawing paints the solid mass as ONE shape (see `ShapePlan.tsx`), so the pieces here may overlap freely —
 * a support block under a step overlaps the bands around it — but every piece must be a proper simple polygon that
 * lies outside the room and leaves no gap against its neighbours; `__tests__/planDrawing.test.ts` checks that for
 * every shape on both hands.
 */
import { edgeOf } from './planShapes';
import type { EdgeKind, PlanDim, PlanGeom } from './planShapes';

export type V = readonly [number, number];
export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
export const len = (a: V): number => Math.hypot(a[0], a[1]);
export const unit = (a: V): V => mul(a, 1 / (len(a) || 1));
export const cross = (a: V, b: V): number => a[0] * b[1] - a[1] * b[0];

/** Outward normal of a counter-clockwise outline's edge a->b (the room is on the left). */
export const outward = (a: V, b: V): V => {
  const d = unit(sub(b, a));
  return [d[1], -d[0]];
};

/** Thickness drawn outside the room for every edge kind, mm. */
export const THICK: Readonly<Record<EdgeKind, number>> = { house: 210, wall: 170, concrete: 170, panel: 70, glazing: 80 };

/** Even-odd point-in-polygon test. */
export function inside(poly: readonly V[], p: V): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

/** Distance from p to the segment a-b. */
export function segDist(p: V, a: V, b: V): number {
  const d = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1] || 1)));
  return len(sub(p, add(a, mul(d, t))));
}

/** Signed area of a polygon (positive when counter-clockwise). */
export function signedArea(poly: readonly V[]): number {
  let s = 0;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    s += cross(a, b);
  });
  return s / 2;
}

/** Where the outer faces of the two edges meeting at vertex i cross (a mitred corner). */
export function outerCorner(g: PlanGeom, i: number, side: 'start' | 'end', edge: number): V {
  const n = g.poly.length;
  const prev = (i - 1 + n) % n;
  const [p0, p1] = edgeOf(g, prev);
  const [q0, q1] = edgeOf(g, i);
  const v = g.poly[i]!;
  const d1 = unit(sub(p1, p0));
  const d2 = unit(sub(q1, q0));
  // In line (the Утюжок's concrete + glazing) or nearly so: square end at the edge's own thickness.
  if (Math.abs(cross(d1, d2)) < 0.05) return add(v, mul(side === 'start' ? outward(q0, q1) : outward(p0, p1), THICK[g.kinds[edge]!]));
  const a1 = add(v, mul(outward(p0, p1), THICK[g.kinds[prev]!]));
  const a2 = add(v, mul(outward(q0, q1), THICK[g.kinds[i]!]));
  const s = cross(sub(a2, a1), d2) / cross(d1, d2);
  return add(a1, mul(d1, s));
}

/** One wall of the outline with the band laid outside it: the edge `a`..`b` and the band's outer face `a2`..`b2`. */
export interface WallBand {
  readonly kind: EdgeKind;
  readonly i: number;
  readonly a: V;
  readonly b: V;
  readonly a2: V;
  readonly b2: V;
}

/** The band of every edge of the plan, corners mitred. */
export function wallBands(g: PlanGeom): readonly WallBand[] {
  const n = g.poly.length;
  return g.kinds.map((kind, i) => {
    const [a, b] = edgeOf(g, i);
    return { kind, i, a, b, a2: outerCorner(g, i, 'start', i), b2: outerCorner(g, (i + 1) % n, 'end', i) };
  });
}

/** The corners of a band as a polygon. */
export const bandQuad = (band: WallBand): readonly V[] => [band.a, band.b, band.b2, band.a2];

/** A band's point at distance `t` mm along its edge: on the room face, or on the outer face. */
export function bandAt(band: WallBand, t: number, outer: boolean): V {
  const edgeLen = len(sub(band.b, band.a));
  const k = t / edgeLen;
  return outer ? add(band.a2, mul(sub(band.b2, band.a2), k)) : add(band.a, mul(sub(band.b, band.a), k));
}

/** What a concrete band is made of: hatched solid pieces and, when part of the wall is thin, the light piece between them. */
export interface BandParts {
  readonly solid: readonly (readonly V[])[];
  readonly light?: readonly V[];
}

/** The hatched pieces of a `house` / `wall` / `concrete` band, and its thin (light) piece where the plan says so. */
export function bandParts(g: PlanGeom, band: WallBand): BandParts {
  const thin = g.thin?.[band.i];
  if (!thin) return { solid: [bandQuad(band)] };
  const edgeLen = len(sub(band.b, band.a));
  const [t0, t1] = thin;
  const thinW = THICK.panel / THICK[band.kind];
  const inner0 = bandAt(band, t0, false);
  const inner1 = bandAt(band, t1, false);
  const outer0 = add(inner0, mul(sub(bandAt(band, t0, true), inner0), thinW));
  const outer1 = add(inner1, mul(sub(bandAt(band, t1, true), inner1), thinW));
  const solid: (readonly V[])[] = [];
  if (t0 > 0) solid.push([band.a, inner0, bandAt(band, t0, true), band.a2]);
  if (t1 < edgeLen - 1) solid.push([inner1, band.b, band.b2, bandAt(band, t1, true)]);
  return { solid, light: [inner0, inner1, outer1, outer0] };
}

/** Every hatched polygon of a plan: its solid wall pieces and the support blocks. They are painted as one mass. */
export function solidPolygons(g: PlanGeom, bands: readonly WallBand[] = wallBands(g)): readonly (readonly V[])[] {
  const out: (readonly V[])[] = [];
  for (const band of bands) {
    if (band.kind === 'glazing' || band.kind === 'panel') continue;
    out.push(...bandParts(g, band).solid);
  }
  for (const block of g.blocks ?? []) out.push(block);
  return out;
}

/** Dot product. */
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1];

/** Distance between the segments a-b and c-d (0 when they cross or touch). */
function segsDist(a: V, b: V, c: V, d: V): number {
  const ab = sub(b, a);
  const cd = sub(d, c);
  if (cross(ab, sub(c, a)) * cross(ab, sub(d, a)) < 0 && cross(cd, sub(a, c)) * cross(cd, sub(b, c)) < 0) return 0;
  return Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b));
}

/**
 * Distance between two polygons' regions: 0 when they overlap, touch or one holds the other. A segment passes as a
 * two-point polygon.
 */
export function polyDistance(a: readonly V[], b: readonly V[]): number {
  if (inside(b, a[0]!) || inside(a, b[0]!)) return 0;
  let best = Infinity;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      best = Math.min(best, segsDist(a[i]!, a[(i + 1) % a.length]!, b[j]!, b[(j + 1) % b.length]!));
    }
  }
  return best;
}

/*
 * ---- The dimensions. Every length below is in em (the drawing's text size) unless it says mm.
 *
 * The labels are `<text>` anchored by the BASELINE (`textAnchor="middle"`), so what a label occupies is the box
 * from its baseline up to the digits' height, one digit advance per character, rotated like the text. That box —
 * not a box centred on the anchor — is what every placement rule below measures.
 */

/**
 * Manrope's digits: each advances 0.603 em. Arial, the fallback where Manrope is missing, advances 0.556 em, so a
 * label that clears its surroundings at this width clears them in either face.
 */
export const DIGIT_ADVANCE_EM = 0.603;
/** How far Manrope's digits rise above the baseline: 0.72 em, rounded up a little so the box always holds the ink. */
export const CAP_HEIGHT_EM = 0.735;
/** How far the white halo under a label reaches past the glyphs (`ShapePlan.tsx` strokes the text twice this wide, round-joined). */
export const HALO_EM = 0.09;
/** Width of the plan's outline strokes in the detailed card (`ShapePlan.tsx`). */
export const STROKE_EM = 0.07;
/** Width of a dimension line and of its extension lines. */
export const DIM_LINE_EM = 0.06;
export const EXT_LINE_EM = 0.05;
/** Arrow length (`ShapePlan.tsx` draws arrows this long); an arrowhead is `ARROW_HALF_WIDTH` of its length wide on either side. */
const ARROW_EM = 0.62;
const ARROW_HALF_WIDTH = 0.28;
/** An extension line starts this far from the measured point (at most a fifth of its length) and runs this far past the dimension line. */
const EXT_START_EM = 0.4;
export const EXT_OVERSHOOT_EM = 0.45;

/** A label on its line: its baseline stands this far above the line, which clears the line (0.03), the arrowheads (0.17) and the halo (0.09). */
const LINE_GAP_EM = 0.35;
/**
 * A label beside its line: the NEAR edge of its glyphs stands this far from the line, on whichever side the label is
 * on. It clears the extension lines' overshoot (0.45), their stroke (0.025) and the halo (0.09), with a little air.
 */
export const BESIDE_GAP_EM = 0.75;
/** Clear paper kept between a label and a wall band: more than the outline's stroke and the halo together (0.07 + 0.09). */
const WALL_GAP_EM = 0.3;
/** Between the runs of two labels on one line: over a digit, so that '600' and '280' do not read as '600 280'. */
const LABEL_SEP_EM = 1;
/** Clear paper kept, beyond the halo and the stroke, between a label and the lines, arrows and extension lines of the drawing. */
const LABEL_AIR_EM = 0.15;
/** A label fits on its line when it is no longer than the line minus the two arrows and this much slack on them. */
const ARROW_FIT = 1.1;
/** How far a label slides, in steps of this many em, to clear the other dimensions. */
const SLIDE_STEP_EM = 0.05;
/** The step and the limit of pushing a dimension line away from a wall that its label would touch. */
const PUSH_STEP_EM = 0.02;
const PUSH_LIMIT_EM = 4;

export interface DimLine {
  readonly dim: PlanDim;
  readonly p: V;
  readonly q: V;
  /** Unit vector from the measured points to the line: the side its extension lines run on, and overshoot to. */
  readonly out: V;
}

/**
 * The dimension line's ends: on y = at / x = at, or `at` mm outside the room along a->b; `push` mm further out, away
 * from what it measures.
 */
export function dimLine(dim: PlanDim, g: PlanGeom, push = 0): DimLine {
  const { a, b } = dim;
  let p: V;
  let q: V;
  if (dim.axis === 'x') {
    p = [a[0], dim.at];
    q = [b[0], dim.at];
  } else if (dim.axis === 'y') {
    p = [dim.at, a[1]];
    q = [dim.at, b[1]];
  } else {
    let nrm: V = outward(a, b);
    const mid = mul(add(a, b), 0.5);
    if (inside(g.poly, add(mid, mul(nrm, 20)))) nrm = mul(nrm, -1);
    p = add(a, mul(nrm, dim.at));
    q = add(b, mul(nrm, dim.at));
  }
  const out = unit(add(sub(p, a), sub(q, b)));
  return { dim, p: add(p, mul(out, push)), q: add(q, mul(out, push)), out };
}

/** The two extension lines of a dimension, each from just off the measured point to just past the line. */
export function extensionLines(l: DimLine, font: number): readonly (readonly [V, V])[] {
  const one = (from: V, to: V): readonly [V, V] | null => {
    const d = sub(to, from);
    const length = len(d);
    if (length < 1) return null;
    const u = mul(d, 1 / length);
    return [add(from, mul(u, Math.min(font * EXT_START_EM, length * 0.2))), add(to, mul(u, font * EXT_OVERSHOOT_EM))];
  };
  return [one(l.dim.a, l.p), one(l.dim.b, l.q)].filter((e): e is readonly [V, V] => e !== null);
}

/** The triangle of an arrowhead whose tip is at `tip` and which points away from `back`. */
export function arrowHead(tip: V, back: V, font: number): readonly [V, V, V] {
  const arrow = font * ARROW_EM;
  const u = unit(sub(back, tip));
  const w: V = [-u[1] * arrow * ARROW_HALF_WIDTH, u[0] * arrow * ARROW_HALF_WIDTH];
  const base = add(tip, mul(u, arrow));
  return [tip, add(base, w), sub(base, w)];
}

/** What a dimension draws besides its text, for something to keep clear of: its line, extension lines and arrowheads, each with half its stroke width (em). */
interface DimFurniture {
  readonly shape: readonly V[];
  readonly reach: number;
}

function dimFurniture(l: DimLine, font: number): readonly DimFurniture[] {
  return [
    { shape: [l.p, l.q], reach: DIM_LINE_EM / 2 },
    ...extensionLines(l, font).map((e): DimFurniture => ({ shape: [e[0], e[1]], reach: EXT_LINE_EM / 2 })),
    { shape: arrowHead(l.p, l.q, font), reach: 0 },
    { shape: arrowHead(l.q, l.p, font), reach: 0 },
  ];
}

/** Width of a label's text, mm. */
const labelWidth = (text: string, font: number): number => text.length * DIGIT_ADVANCE_EM * font;

/** The frame a dimension's text is set in: `ux` along the text, `uy` up from its baseline, rotated like the text. */
interface LineFrame {
  readonly mid: V;
  readonly ux: V;
  readonly uy: V;
  /** Rotation, degrees, in SVG's sense (clockwise on screen): reading left-to-right, or top-to-bottom on a vertical line. */
  readonly angle: number;
  readonly length: number;
}

function lineFrame(p: V, q: V): LineFrame {
  const dir = unit(sub(q, p));
  let angle = (Math.atan2(-dir[1], dir[0]) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  const rad = (angle * Math.PI) / 180;
  // SVG's y points down and the plan's up: a drawn rotation of `angle` is a plan rotation of -angle.
  return { mid: mul(add(p, q), 0.5), ux: [Math.cos(rad), -Math.sin(rad)], uy: [Math.sin(rad), Math.cos(rad)], angle, length: len(sub(q, p)) };
}

/** The box of a label's glyphs: from its baseline (anchored at `at`, centred) up to the digits' height. */
function glyphBox(at: V, frame: LineFrame, text: string, font: number): readonly V[] {
  const hx = labelWidth(text, font) / 2;
  const h = CAP_HEIGHT_EM * font;
  const corner = (x: number, y: number): V => add(at, add(mul(frame.ux, x), mul(frame.uy, y)));
  return [corner(-hx, 0), corner(hx, 0), corner(hx, h), corner(-hx, h)];
}

export interface DimLabel {
  /** Where the text is anchored: the middle of its baseline. */
  readonly at: V;
  /** Rotation, degrees, reading left-to-right or top-to-bottom. */
  readonly angle: number;
  /** The label stands beside its line rather than on it — a segment too short to hold the text between its arrows. */
  readonly beside: boolean;
  /** The box of the glyphs (baseline to the digits' height, one digit advance per character). */
  readonly box: readonly V[];
}

export interface DimPlacement {
  readonly dim: PlanDim;
  readonly line: DimLine;
  readonly label: DimLabel;
}

/** A label before it is slid and its line pushed: on which side of its line it stands and how far from it. */
interface Draft {
  readonly line: DimLine;
  readonly frame: LineFrame;
  readonly beside: boolean;
  /** +1: on the `uy` side of the line, -1: against it. */
  readonly side: 1 | -1;
  /** Distance from the line to the baseline along `uy`. */
  readonly baseline: number;
}

/**
 * A label stands on its line, centred and just above it, when it fits between the two arrows. A longer one stands
 * beside the line instead, on the side its extension lines overshoot to, with the near edge of its glyphs a fixed
 * distance from the line on either side (so it clears the extension lines' overshoot and any arrow).
 */
function draftLabel(line: DimLine, font: number): Draft {
  const frame = lineFrame(line.p, line.q);
  const room = frame.length - 2 * ARROW_EM * font * ARROW_FIT;
  if (labelWidth(line.dim.text, font) <= room) return { line, frame, beside: false, side: 1, baseline: LINE_GAP_EM * font };
  const side = dot(frame.uy, line.out) >= 0 ? 1 : -1;
  const baseline = side === 1 ? BESIDE_GAP_EM * font : -(BESIDE_GAP_EM + CAP_HEIGHT_EM) * font;
  return { line, frame, beside: true, side, baseline };
}

/** Dimensions whose lines are one line (same axis, same distance) share it; a slanted dimension stands alone. */
const lineKey = (dim: PlanDim, i: number): string => (dim.axis === 'along' ? `along${i}` : `${dim.axis}@${dim.at.toFixed(1)}`);

/** Centres moved apart until every neighbouring pair of runs is `sep` apart; the `fixed` ones stay where they are. */
function spreadApart(centres: readonly number[], halves: readonly number[], fixed: readonly boolean[], sep: number): number[] {
  const out = [...centres];
  const order = centres.map((_, i) => i).sort((i, j) => centres[i]! - centres[j]!);
  for (let pass = 0; pass < 32; pass += 1) {
    let settled = true;
    for (let k = 0; k + 1 < order.length; k += 1) {
      const i = order[k]!;
      const j = order[k + 1]!;
      const missing = halves[i]! + halves[j]! + sep - (out[j]! - out[i]!);
      if (missing <= 1e-9) continue;
      settled = false;
      const movers = (fixed[i] ? 0 : 1) + (fixed[j] ? 0 : 1);
      if (movers === 0) continue;
      if (!fixed[i]) out[i] = out[i]! - missing / movers;
      if (!fixed[j]) out[j] = out[j]! + missing / movers;
    }
    if (settled) break;
  }
  return out;
}

/**
 * How far each label slides along its line: the labels that stand on one side of one line (the Лодочка's 280 and 600,
 * both too long for their short segments) are moved apart until their runs are `LABEL_SEP_EM` clear of each other.
 */
function slideApart(drafts: readonly Draft[], font: number): readonly number[] {
  const shifts = drafts.map(() => 0);
  const groups = new Map<string, number[]>();
  drafts.forEach((d, i) => {
    const key = `${lineKey(d.line.dim, i)}/${d.side}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const centres = members.map((i) => dot(drafts[i]!.frame.mid, drafts[i]!.frame.ux));
    const halves = members.map((i) => labelWidth(drafts[i]!.line.dim.text, font) / 2);
    const moved = spreadApart(centres, halves, members.map((i) => !drafts[i]!.beside), LABEL_SEP_EM * font);
    members.forEach((i, k) => {
      shifts[i] = moved[k]! - centres[k]!;
    });
  }
  return shifts;
}

/** The least distance (a multiple of the push step) to move `box` along `out` so that it is `WALL_GAP_EM` clear of every wall. */
function pushClearOfWalls(box: readonly V[], out: V, walls: readonly (readonly V[])[], font: number): number {
  const limit = font * PUSH_LIMIT_EM;
  for (let push = 0; push <= limit; push += font * PUSH_STEP_EM) {
    const moved = box.map((corner) => add(corner, mul(out, push)));
    if (walls.every((wall) => polyDistance(moved, wall) >= WALL_GAP_EM * font)) return push;
  }
  return limit;
}

/** The point a label is anchored at: `shift` along its line from the middle, `baseline` up from it. */
const anchorAt = (frame: LineFrame, shift: number, baseline: number): V => add(frame.mid, add(mul(frame.ux, shift), mul(frame.uy, baseline)));

/**
 * Slides each label, if it must, along its line to the nearest place where it clears the walls, the other labels and
 * everything the other dimensions draw (the Сапожок's 1008 would otherwise brush the end of its neighbour 2413). A
 * label on its line stays between its arrows; one beside its line may slide a text-length.
 */
function declutter(drafts: readonly Draft[], lines: readonly DimLine[], shifts: readonly number[], walls: readonly (readonly V[])[], font: number): readonly number[] {
  const out = [...shifts];
  const frames = lines.map((l) => lineFrame(l.p, l.q));
  const boxAt = (i: number, shift: number): readonly V[] => glyphBox(anchorAt(frames[i]!, shift, drafts[i]!.baseline), frames[i]!, lines[i]!.dim.text, font);
  drafts.forEach((d, i) => {
    const width = labelWidth(lines[i]!.dim.text, font);
    const slack = d.beside ? width : Math.max(0, (frames[i]!.length - 2 * ARROW_EM * font * ARROW_FIT - width) / 2);
    const furniture = lines.flatMap((l, j) => (j === i ? [] : dimFurniture(l, font)));
    const clear = (shift: number): boolean => {
      const box = boxAt(i, shift);
      return (
        walls.every((wall) => polyDistance(box, wall) >= WALL_GAP_EM * font) &&
        furniture.every((f) => polyDistance(box, f.shape) >= (HALO_EM + f.reach + LABEL_AIR_EM) * font) &&
        out.every((other, j) => j === i || polyDistance(box, boxAt(j, other)) >= DIGIT_ADVANCE_EM * font)
      );
    };
    const home = shifts[i]!;
    const step = font * SLIDE_STEP_EM;
    for (let k = 0; k * step <= slack; k += 1) {
      const found = [home + k * step, home - k * step].find((shift) => Math.abs(shift - home) <= slack + 1e-9 && clear(shift));
      if (found !== undefined) {
        out[i] = found;
        return;
      }
    }
  });
  return out;
}

/**
 * Lines and labels of every dimension of a plan at text size `font`. A label that would touch a wall pushes its line
 * out until it is clear — and the whole row of dimensions on that line with it, so a row stays straight — leaving
 * the printed values and the plan's own `at` distances as they are. Labels that crowd each other slide apart, and
 * slide clear of the other dimensions' lines.
 */
export function placeDims(g: PlanGeom, font: number): readonly DimPlacement[] {
  const drafts = g.dims.map((dim) => draftLabel(dimLine(dim, g), font));
  const shifts = slideApart(drafts, font);
  const walls: readonly (readonly V[])[] = [...wallBands(g).map(bandQuad), ...(g.blocks ?? [])];
  const needs = drafts.map((d, i) => pushClearOfWalls(glyphBox(anchorAt(d.frame, shifts[i]!, d.baseline), d.frame, d.line.dim.text, font), d.line.out, walls, font));
  const keys = drafts.map((d, i) => lineKey(d.line.dim, i));
  const lines = drafts.map((d, i) => dimLine(d.line.dim, g, Math.max(...needs.filter((_, j) => keys[j] === keys[i]))));
  const slid = declutter(drafts, lines, shifts, walls, font);
  return drafts.map((d, i) => {
    const line = lines[i]!;
    const frame = lineFrame(line.p, line.q);
    const at = anchorAt(frame, slid[i]!, d.baseline);
    return { dim: line.dim, line, label: { at, angle: frame.angle, beside: d.beside, box: glyphBox(at, frame, line.dim.text, font) } };
  });
}

/** The view box's margin round the drawing, em (`ShapePlan.tsx` adds it to the bounds). */
export const VIEW_PAD_EM = 0.4;
/** The note in the view's lower-left corner ("схема, не в масштабе"): its text size, its inset from the view's edges and an upper bound of its width, em. */
const NOTE_SIZE_EM = 0.55;
const NOTE_INSET_EM = 0.3;
const NOTE_WIDTH_EM = 6.5;
/** Clear space kept between the note and the dimensions above it, em. */
const NOTE_CLEAR_EM = 0.25;

/** Where the note stands: the left end of its baseline, its text size and the box it covers, in plan mm (y up). */
export interface PlanNote {
  readonly x: number;
  readonly baseline: number;
  readonly size: number;
  readonly box: readonly V[];
}

/** The note of a view whose content box has the lower-left corner (`minX`, `minY`) and text size `font`. */
function planNote(minX: number, minY: number, font: number): PlanNote {
  const x = minX - VIEW_PAD_EM * font + NOTE_INSET_EM * font;
  const baseline = minY - VIEW_PAD_EM * font + NOTE_INSET_EM * font;
  const size = NOTE_SIZE_EM * font;
  const [x1, y0, y1] = [x + NOTE_WIDTH_EM * font, baseline - 0.2 * size, baseline + 0.75 * size];
  return { x, baseline, size, box: [[x, y0], [x1, y0], [x1, y1], [x, y1]] };
}

/** The drawing's view: its box in plan mm (y up), the text size, the overall size of the outline and the dimensions placed in it. */
export interface PlanView {
  readonly font: number;
  readonly size: number;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  /** The dimensions at this text size (none in the plain badge). */
  readonly dims: readonly DimPlacement[];
  /** The note under the drawing (the detailed card only). */
  readonly note: PlanNote | null;
}

/**
 * How far the view box must be lowered for the note under it — which goes down with the box — to clear the labels and
 * the dimension lines, arrows and extension lines above it.
 */
function dropForNote(dims: readonly DimPlacement[], minX: number, minY: number, font: number): number {
  const { box } = planNote(minX, minY, font);
  const noteTop = Math.max(...box.map((c) => c[1]));
  const noteLeft = Math.min(...box.map((c) => c[0]));
  const noteRight = Math.max(...box.map((c) => c[0]));
  const clear = font * NOTE_CLEAR_EM;
  const above: { readonly shape: readonly V[]; readonly margin: number }[] = dims.flatMap(({ line, label }) => [
    { shape: label.box, margin: font * HALO_EM },
    ...dimFurniture(line, font).map((f) => ({ shape: f.shape, margin: f.reach * font })),
  ]);
  let drop = 0;
  for (const { shape, margin } of above) {
    const xs = shape.map((c) => c[0]);
    if (Math.max(...xs) + margin < noteLeft - clear || Math.min(...xs) - margin > noteRight + clear) continue;
    drop = Math.max(drop, noteTop + clear - (Math.min(...shape.map((c) => c[1])) - margin));
  }
  return drop;
}

/**
 * The view box holds the walls and, in the detailed card, the dimensions; the text size is a fixed share of the box
 * that holds the walls and the dimension lines, so every shape's labels look the same size. The labels are then
 * placed in it and the box grows to hold their glyphs (and halos): a label never makes the text bigger. The note in
 * the lower-left corner stays clear of them: the box is lowered under it when something would reach it.
 */
export function planView(g: PlanGeom, detailed: boolean): PlanView {
  const xs = g.poly.map((p) => p[0]);
  const ys = g.poly.map((p) => p[1]);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const bounds = (font: number, dims: readonly DimPlacement[], labels: boolean): [number, number, number, number] => {
    let x0 = Math.min(...xs) - 260;
    let x1 = Math.max(...xs) + 260;
    let y0 = Math.min(...ys) - 260;
    let y1 = Math.max(...ys) + 260;
    const grow = (v: V, m: number): void => {
      x0 = Math.min(x0, v[0] - m);
      x1 = Math.max(x1, v[0] + m);
      y0 = Math.min(y0, v[1] - m);
      y1 = Math.max(y1, v[1] + m);
    };
    for (const { line, label } of dims) {
      grow(line.p, font * 0.6);
      grow(line.q, font * 0.6);
      if (labels) for (const corner of label.box) grow(corner, font * HALO_EM);
    }
    return [x0, y0, x1, y1];
  };
  const place = (font: number): readonly DimPlacement[] => (detailed ? placeDims(g, font) : []);
  let font = size * 0.05;
  for (let pass = 0; pass < 3; pass += 1) {
    const [x0, y0, x1, y1] = bounds(font, place(font), false);
    // The card is 100% wide (~300 px) and at most 0.86 of that tall: ~12.5 px text once the labels have widened the
    // box a little (the share is 4.4 % of the box of the walls and lines, 4.2 % of the final one).
    font = Math.max(x1 - x0, (y1 - y0) / 0.86) * 0.044;
  }
  const dims = place(font);
  const [minX, lowest, maxX, maxY] = bounds(font, dims, true);
  if (!detailed) return { font, size, minX, minY: lowest, maxX, maxY, dims, note: null };
  const minY = lowest - dropForNote(dims, minX, lowest, font);
  return { font, size, minX, minY, maxX, maxY, dims, note: planNote(minX, minY, font) };
}

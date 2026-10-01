/**
 * @file The plans of the six balcony shapes, taken from the owner's dimension
 * drawings: the room outline in mm, what every edge is made of, heights, the
 * balcony door block in the house wall and the dimension lines of the drawing.
 *
 * The drawings are schematic — not to scale (the Утюжок is drawn ~1.4x wider than
 * its own numbers, the Сапожок ~1.5x), so their pixel angles cannot be used: with
 * the Сапожок's numbers a 45° diagonal is impossible (2400 + 400 + 1000·cos45° =
 * 3507 ≠ 3048). Every outline is therefore a least-squares fit of the drawing's
 * numbers that keeps its topology (which edges exist, which are parallel,
 * perpendicular or in line). The fits agree with the real П-44Т passports: the
 * Сапожок comes out at 4.18 m² with a 68.6° diagonal (passport: 4.18 m², ≈69°),
 * the Лодочка at 2.68 m² (passport: 2.7 m²); the Утюжок keeps its 3000×2000 box
 * and 1750 front (4.75 m², passport 4.2–4.8 m²) with the 1850 glazing and the
 * 700 concrete end in one straight line, scaled together to fit.
 */

export type Pt = readonly [number, number];

/**
 * What an edge of the outline is:
 * - `house` — the facade wall of the building (holds the balcony door block);
 * - `wall` — a concrete side wall, step or support (hatched on the drawings);
 * - `panel` — a thin side wall (a plain double line on the drawings);
 * - `glazing` — the windows: a parapet with the frames above it (yellow);
 * - `concrete` — a concrete piece in line with the glazing (the Утюжок's 700).
 */
export type EdgeKind = 'house' | 'wall' | 'panel' | 'glazing' | 'concrete';

/** An opening in the house wall, `from`..`to` mm along edge 0. */
export interface PlanOpening {
  readonly kind: 'door' | 'window';
  readonly from: number;
  readonly to: number;
}

/**
 * A dimension line as on the drawing. `x` / `y` measure the horizontal / vertical
 * distance between `a` and `b` with the line drawn at y = `at` / x = `at`;
 * `along` measures `a`→`b` itself, drawn `at` mm outside the room.
 */
export interface PlanDim {
  readonly text: string;
  readonly a: Pt;
  readonly b: Pt;
  readonly axis: 'x' | 'y' | 'along';
  readonly at: number;
}

export interface PlanGeom {
  /** Room outline (finished surfaces) in mm, counter-clockwise, y up; edge i runs `poly[i]` -> `poly[i+1]`; edge 0 is the house wall from (0,0) along +x. */
  readonly poly: readonly Pt[];
  /** Material of every edge. */
  readonly kinds: readonly EdgeKind[];
  /** The plan card draws this mm range of edge `i` thin (as a `panel`): a wall that is concrete near the house and light further out. */
  readonly thin?: Readonly<Record<number, readonly [number, number]>>;
  /** Extra solid concrete outside the room for the plan card (the Лодочка's support block under the step). */
  readonly blocks?: readonly (readonly Pt[])[];
  /** Floor to ceiling, mm. */
  readonly ceilingH: number;
  /** Floor to the top of the parapet (window sill level), mm. */
  readonly parapetH: number;
  /** Windows go down to the floor ("остекление до пола") — no parapet under them. */
  readonly floorGlazing?: boolean;
  readonly openings: readonly PlanOpening[];
  readonly dims: readonly PlanDim[];
}

/** Door / window tops and the window bottom of the balcony block, mm. */
export const DOOR_TOP = 2200;
export const HOUSE_WINDOW_BOTTOM = 850;

// Утюжок: the 1850 glazing + 700 concrete are one straight line from (1250, 2000)
// to the corner (0, 0) — 2358 mm, split in the drawing's 1850 : 700 ratio.
const UTYUG_SPLIT = 700 / 2550;
const UTYUG_C: Pt = [Math.round(1250 * UTYUG_SPLIT), Math.round(2000 * UTYUG_SPLIT)];

export const PLAN_SHAPES: Readonly<Record<string, PlanGeom>> = {
  // Сапожок (П-44Т): 3048 / 2400 + 1000 + 400 / 1200 / 1330 + 660 — fit: 3130 / 2370 + 988 (68.6°) + 400 / 1165 / 2085.
  sapozhok: {
    poly: [[0, 0], [3130, 0], [3130, 2085], [2730, 2085], [2370, 1165], [0, 1165]],
    kinds: ['house', 'wall', 'glazing', 'glazing', 'glazing', 'panel'],
    thin: { 1: [1395, 2085] },
    ceilingH: 2640,
    parapetH: 1070,
    openings: [
      { kind: 'door', from: 600, to: 1350 },
      { kind: 'window', from: 1350, to: 2500 },
    ],
    dims: [
      { text: '3048', a: [0, 0], b: [3130, 0], axis: 'x', at: -480 },
      { text: '1200', a: [0, 0], b: [0, 1165], axis: 'y', at: -420 },
      { text: '2400', a: [0, 1165], b: [2370, 1165], axis: 'x', at: 1520 },
      { text: '1000', a: [2370, 1165], b: [2730, 2085], axis: 'along', at: 330 },
      { text: '400', a: [2730, 2085], b: [3130, 2085], axis: 'x', at: 2440 },
      { text: '1330', a: [3130, 0], b: [3130, 1395], axis: 'y', at: 3560 },
      { text: '660', a: [3130, 1395], b: [3130, 2085], axis: 'y', at: 3560 },
    ],
  },
  // Лодочка (П-44Т), CAD drawing: 3250 + 400 step / 280 + 600 / 1950 front / 1850 slope / 400.
  lodochka: {
    poly: [[0, 0], [3250, 0], [3250, 280], [3650, 280], [3650, 880], [1745, 880], [0, 400]],
    kinds: ['house', 'wall', 'wall', 'wall', 'glazing', 'glazing', 'wall'],
    blocks: [[[3250, -210], [3820, -210], [3820, 280], [3250, 280]]],
    ceilingH: 2660,
    parapetH: 1100,
    openings: [
      { kind: 'window', from: 440, to: 1590 },
      { kind: 'door', from: 1590, to: 2340 },
    ],
    dims: [
      { text: '3250', a: [0, 0], b: [3250, 0], axis: 'x', at: -430 },
      { text: '400', a: [3250, 0], b: [3650, 280], axis: 'x', at: -430 },
      { text: '280', a: [3250, 0], b: [3650, 280], axis: 'y', at: 4080 },
      { text: '600', a: [3650, 280], b: [3650, 880], axis: 'y', at: 4080 },
      { text: '1950', a: [1745, 880], b: [3650, 880], axis: 'x', at: 1260 },
      { text: '1850', a: [0, 400], b: [1745, 880], axis: 'along', at: 330 },
      { text: '400', a: [0, 0], b: [0, 400], axis: 'y', at: -430 },
    ],
  },
  // Утюжок (П-44Т): 3000 / 2000 / 1750 front / 1850 slanted glazing + 700 concrete in one line.
  utyuzhok: {
    poly: [[0, 0], [3000, 0], [3000, 2000], [1250, 2000], UTYUG_C],
    kinds: ['house', 'wall', 'glazing', 'glazing', 'concrete'],
    ceilingH: 2640,
    parapetH: 1050,
    openings: [
      { kind: 'door', from: 630, to: 1380 },
      { kind: 'window', from: 1380, to: 2530 },
    ],
    dims: [
      { text: '3000', a: [0, 0], b: [3000, 0], axis: 'x', at: -480 },
      { text: '2000', a: [3000, 0], b: [3000, 2000], axis: 'y', at: 3480 },
      { text: '1750', a: [1250, 2000], b: [3000, 2000], axis: 'x', at: 2380 },
      { text: '1850', a: UTYUG_C, b: [1250, 2000], axis: 'along', at: 330 },
      { text: '700', a: [0, 0], b: UTYUG_C, axis: 'along', at: 330 },
    ],
  },
  // The straight ones have no drawing: typical sizes (П-44Т loggia; И-209А 6 m loggia 6043×1206;
  // a Khrushchev-era balcony slab sticks out of the facade, so it is glazed on three sides).
  loggia: {
    poly: [[0, 0], [3000, 0], [3000, 1200], [0, 1200]],
    kinds: ['house', 'wall', 'glazing', 'wall'],
    ceilingH: 2640,
    parapetH: 1050,
    openings: [
      { kind: 'door', from: 550, to: 1300 },
      { kind: 'window', from: 1300, to: 2450 },
    ],
    dims: [
      { text: '3000', a: [0, 0], b: [3000, 0], axis: 'x', at: -430 },
      { text: '1200', a: [3000, 0], b: [3000, 1200], axis: 'y', at: 3430 },
    ],
  },
  'long-loggia': {
    poly: [[0, 0], [6000, 0], [6000, 1200], [0, 1200]],
    kinds: ['house', 'wall', 'glazing', 'wall'],
    ceilingH: 2600,
    parapetH: 1100,
    openings: [
      { kind: 'window', from: 600, to: 1690 },
      { kind: 'door', from: 1690, to: 2430 },
      { kind: 'window', from: 3700, to: 5570 },
    ],
    dims: [
      { text: '6000', a: [0, 0], b: [6000, 0], axis: 'x', at: -760 },
      { text: '1200', a: [6000, 0], b: [6000, 1200], axis: 'y', at: 6520 },
    ],
  },
  khrushchevka: {
    poly: [[0, 0], [2700, 0], [2700, 800], [0, 800]],
    kinds: ['house', 'glazing', 'glazing', 'glazing'],
    ceilingH: 2500,
    parapetH: 1000,
    openings: [
      { kind: 'door', from: 450, to: 1150 },
      { kind: 'window', from: 1150, to: 2150 },
    ],
    dims: [
      { text: '2700', a: [0, 0], b: [2700, 0], axis: 'x', at: -400 },
      { text: '800', a: [2700, 0], b: [2700, 800], axis: 'y', at: 3100 },
    ],
  },
};

export function isGlazed(g: PlanGeom, edge: number): boolean {
  return g.kinds[edge] === 'glazing';
}

/** Edge `i` as its two end points. */
export function edgeOf(g: PlanGeom, i: number): readonly [Pt, Pt] {
  return [g.poly[i]!, g.poly[(i + 1) % g.poly.length]!];
}

/** Floor area, m². */
export function planArea(g: PlanGeom): number {
  let s = 0;
  g.poly.forEach((a, i) => {
    const b = g.poly[(i + 1) % g.poly.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  });
  return Math.abs(s) / 2 / 1e6;
}

/**
 * The plan mirrored left <-> right (the right-handed П-44Т). Kept counter-clockwise
 * with the house wall as edge 0, so edge j of the mirror is edge -j of the original.
 */
export function mirrorPlan(g: PlanGeom): PlanGeom {
  const n = g.poly.length;
  const w = Math.max(...g.poly.map((p) => p[0]));
  const m = (p: Pt): Pt => [w - p[0], p[1]];
  const src = (j: number): number => (n - j) % n;
  const thin: Record<number, readonly [number, number]> = {};
  for (const [k, [t0, t1]] of Object.entries(g.thin ?? {})) {
    const i = Number(k);
    const [a, b] = edgeOf(g, i);
    // Mirrored edges run backwards: the range is measured from the other end.
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    thin[(n - i) % n] = [len - t1, len - t0];
  }
  return {
    ...g,
    poly: g.poly.map((_, j) => m(g.poly[(1 - j + n) % n]!)),
    kinds: g.kinds.map((_, j) => g.kinds[src(j)]!),
    thin,
    openings: g.openings.map((o) => ({ ...o, from: w - o.to, to: w - o.from })),
    ...(g.blocks ? { blocks: g.blocks.map((b) => b.map(m)) } : {}),
    dims: g.dims.map((d) => ({ ...d, a: m(d.b), b: m(d.a), at: d.axis === 'y' ? w - d.at : d.at })),
  };
}

/**
 * The plan a selection shows: mirrored for the right-handed П-44Т, windows to the
 * floor for "остекление до пола".
 */
export function planFor(shapeId: string, glazingId: string): PlanGeom | undefined {
  const g = PLAN_SHAPES[shapeId];
  if (!g) return undefined;
  if (glazingId === 'right') return mirrorPlan(g);
  if (glazingId === 'floor') return { ...g, floorGlazing: true };
  return g;
}

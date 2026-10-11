/**
 * @file Automatic geometry validation (допфайлплана.txt §14): checks a `PlanGeom`
 * for the defect classes that document calls out — degenerate/duplicate walls,
 * out-of-range openings, invalid thin-wall ranges, missing glazing units, zero-length
 * dimension lines — before it's handed to the drawing (`ShapePlan.tsx`) or the render
 * (`render/scene.ts`). Both already consume the exact same `PlanGeom` object (see
 * docs/GEOMETRY_AUDIT.md §1), so this module validates the one shared model rather
 * than comparing two independent ones — there is nothing to reconcile, only to check.
 *
 * Deliberately depends only on `planShapes.ts` and `wallGeometry.ts` (both
 * side-effect-free, dependency-light modules) so it can run standalone under plain
 * Node (`node --experimental-strip-types`), no bundler required — see
 * `__tests__/geometry.test.ts` and `package.json`'s `test:geometry` script.
 */
import type { PlanGeom, PlanOpening, Pt } from './planShapes';
import { PLAN_SHAPES, edgeOf, mirrorPlan, planArea } from './planShapes';
import { glazingUnitCount } from './wallGeometry';

export type GeometryIssueSeverity = 'error' | 'warning';

export interface GeometryIssue {
  readonly severity: GeometryIssueSeverity;
  /** Stable machine-readable code, e.g. `'DUPLICATE_WALL'` — for tests/tooling to assert on. */
  readonly code: string;
  /** Human-readable, e.g. for a future admin/QA view. */
  readonly message: string;
  /** What the issue is about, e.g. `'edge 2'`, `'opening 1 (door)'`. */
  readonly element: string;
}

function edgeLength(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function segmentKey(a: Pt, b: Pt): string {
  // Order-independent — a wall from A to B occupies the same segment as one from B to A.
  return [a.join(','), b.join(',')].sort().join('|');
}

/** §14 "Проверки габаритов" — overall dimensions make sense. */
function checkOverallDimensions(g: PlanGeom, issues: GeometryIssue[]): void {
  if (!(g.ceilingH > 0)) {
    issues.push({ severity: 'error', code: 'INVALID_CEILING_HEIGHT', element: 'ceilingH', message: `ceilingH must be positive, got ${g.ceilingH}` });
  }
  if (!(g.parapetH > 0)) {
    issues.push({ severity: 'error', code: 'INVALID_PARAPET_HEIGHT', element: 'parapetH', message: `parapetH must be positive, got ${g.parapetH}` });
  }
  if (g.ceilingH > 0 && g.parapetH > 0 && g.parapetH >= g.ceilingH) {
    issues.push({
      severity: 'error',
      code: 'PARAPET_NOT_BELOW_CEILING',
      element: 'parapetH/ceilingH',
      message: `parapetH (${g.parapetH}) must be below ceilingH (${g.ceilingH})`,
    });
  }
  const area = planArea(g);
  if (!(area > 0)) {
    issues.push({ severity: 'error', code: 'NON_POSITIVE_AREA', element: 'poly', message: `computed floor area is ${area} m² — outline is degenerate or wound incorrectly` });
  }
  if (g.kinds.length !== g.poly.length) {
    issues.push({
      severity: 'error',
      code: 'KINDS_LENGTH_MISMATCH',
      element: 'kinds',
      message: `kinds has ${g.kinds.length} entries but poly has ${g.poly.length} points — every edge needs exactly one kind`,
    });
  }
}

/** §14 "Проверки стен" — no degenerate or duplicate walls, thin ranges make sense. */
function checkWalls(g: PlanGeom, issues: GeometryIssue[]): void {
  const n = g.poly.length;
  const segments = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const [a, b] = edgeOf(g, i);
    const len = edgeLength(a, b);
    if (len < 1) {
      issues.push({ severity: 'error', code: 'DEGENERATE_EDGE', element: `edge ${i}`, message: `edge ${i} has near-zero length (${len.toFixed(2)}mm) — likely a duplicated outline point` });
      continue; // a degenerate edge can't meaningfully be deduped below
    }
    const key = segmentKey(a, b);
    const list = segments.get(key) ?? [];
    list.push(i);
    segments.set(key, list);
  }

  for (const idxs of segments.values()) {
    if (idxs.length > 1) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_WALL',
        element: idxs.map((i) => `edge ${i}`).join(', '),
        message: `edges ${idxs.join(', ')} occupy the same segment of the outline — a wall drawn/rendered twice`,
      });
    }
  }

  for (const [key, range] of Object.entries(g.thin ?? {})) {
    const i = Number(key);
    if (!Number.isInteger(i) || i < 0 || i >= n) {
      issues.push({ severity: 'error', code: 'THIN_RANGE_BAD_EDGE', element: `thin[${key}]`, message: `thin references edge ${key}, which doesn't exist (0..${n - 1})` });
      continue;
    }
    const [a, b] = edgeOf(g, i);
    const len = edgeLength(a, b);
    const [t0, t1] = range;
    if (!(t0 >= 0 && t1 <= len + 0.5 && t0 < t1)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_THIN_RANGE',
        element: `edge ${i}`,
        message: `thin range [${t0}, ${t1}] is not within edge ${i}'s length [0, ${len.toFixed(0)}]`,
      });
    }
  }
}

/** §14 "Проверки секций" — openings in the house wall stay in bounds and don't overlap. */
function checkOpenings(g: PlanGeom, issues: GeometryIssue[]): void {
  if (g.poly.length === 0) return;
  const [h0, h1] = edgeOf(g, 0);
  const houseLen = edgeLength(h0, h1);

  const labeled = g.openings.map((o: PlanOpening, idx: number) => ({ ...o, idx }));
  for (const o of labeled) {
    if (!(o.from >= 0 && o.to <= houseLen + 0.5 && o.from < o.to)) {
      issues.push({
        severity: 'error',
        code: 'OPENING_OUT_OF_BOUNDS',
        element: `opening ${o.idx} (${o.kind})`,
        message: `[${o.from}, ${o.to}] is outside the house wall's span [0, ${houseLen.toFixed(0)}]`,
      });
    }
  }

  const sorted = [...labeled].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (cur.from < prev.to) {
      issues.push({
        severity: 'error',
        code: 'OPENINGS_OVERLAP',
        element: `opening ${prev.idx} (${prev.kind}) / opening ${cur.idx} (${cur.kind})`,
        message: `opening ${prev.idx} [${prev.from}, ${prev.to}] overlaps opening ${cur.idx} [${cur.from}, ${cur.to}]`,
      });
    }
  }
}

/** §14 "Проверки профилей" — every glazing edge resolves to at least one window unit. */
function checkGlazingProfiles(g: PlanGeom, issues: GeometryIssue[]): void {
  g.kinds.forEach((kind, i) => {
    if (kind !== 'glazing') return;
    const [a, b] = edgeOf(g, i);
    const len = edgeLength(a, b);
    const units = glazingUnitCount(len);
    if (!(units >= 1)) {
      issues.push({ severity: 'error', code: 'NO_GLAZING_UNITS', element: `edge ${i}`, message: `edge ${i} is glazing but resolves to ${units} window units` });
    }
  });
}

/** §13 "Размерные линии" — a dimension line should measure a non-zero, finite distance. */
function checkDimensionLines(g: PlanGeom, issues: GeometryIssue[]): void {
  g.dims.forEach((d, idx) => {
    const len = edgeLength(d.a, d.b);
    if (!Number.isFinite(len)) {
      issues.push({ severity: 'error', code: 'DIM_NOT_FINITE', element: `dim ${idx} (${d.text})`, message: `dimension "${d.text}" has non-finite endpoints` });
    } else if (len < 1) {
      issues.push({ severity: 'warning', code: 'DIM_ZERO_LENGTH', element: `dim ${idx} (${d.text})`, message: `dimension "${d.text}" measures a near-zero distance (${len.toFixed(2)}mm)` });
    }
  });
}

/**
 * Validates one `PlanGeom`. Returns an empty array when the geometry is clean.
 * `label` is only used to make issue messages traceable back to a shape id (e.g.
 * `"sapozhok"` or `"sapozhok:mirrored"`) — it does not affect what's checked.
 */
export function validatePlanGeom(g: PlanGeom): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  checkOverallDimensions(g, issues);
  checkWalls(g, issues);
  checkOpenings(g, issues);
  checkGlazingProfiles(g, issues);
  checkDimensionLines(g, issues);
  return issues;
}

/**
 * Validates every shape in `PLAN_SHAPES`, plus its mirrored variant (used for the
 * "остекление справа" / `glazingId === 'right'` selection — see `planFor()` in
 * planShapes.ts) since mirroring is itself a geometric transform that could
 * introduce a defect the un-mirrored shape doesn't have.
 */
export function validateAllShapes(): Readonly<Record<string, readonly GeometryIssue[]>> {
  const out: Record<string, readonly GeometryIssue[]> = {};
  for (const [id, g] of Object.entries(PLAN_SHAPES)) {
    out[id] = validatePlanGeom(g);
    out[`${id}:mirrored`] = validatePlanGeom(mirrorPlan(g));
  }
  return out;
}

/** True if `validateAllShapes()` found nothing above `'warning'`. */
export function allShapesAreClean(): boolean {
  return Object.values(validateAllShapes()).every((issues) => issues.every((i) => i.severity !== 'error'));
}

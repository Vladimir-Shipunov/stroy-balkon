/**
 * @file Reference/golden-config tests (допфайлплана.txt §15): for each supported
 * balcony model, asserts its actual computed geometry (area, point count, section/
 * opening count, heights) matches a documented reference value, and that the model
 * passes geometryValidation.ts cleanly. Where a reference value is itself a
 * documented real-world figure (the П-44Т passport areas cited in planShapes.ts's
 * file header), the assertion carries the same tolerance language as that source
 * comment — this test does not invent precision the source data doesn't have.
 *
 * Run with `npm run test:geometry`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_SHAPES, planArea, mirrorPlan } from '../planShapes';
import { validatePlanGeom } from '../geometryValidation';

/**
 * Reference values per model. `area` carries the tolerance actually achievable per
 * planShapes.ts's own file-header comment: passport-matched (not exact, the source
 * drawing is schematic) for sapozhok/lodochka/utyuzhok and for long-loggia (exact
 * И-209А passport size, no drawing involved so no schematic slop); exact for loggia
 * and khrushchevka, which have no cited passport number to match, only a typical size.
 */
const REFERENCE: Readonly<
  Record<
    string,
    {
      readonly areaM2: number;
      readonly areaToleranceM2: number;
      readonly vertexCount: number;
      readonly openingCount: number;
      readonly ceilingH: number;
      readonly parapetH: number;
    }
  >
> = {
  // Built from a real measured развёртка (see planShapes.ts file header), not forced to
  // the passport number — lands within 0.4% of it on its own, a wider tolerance than
  // the schematic-fit shapes below because this is independent real-instance variance,
  // not label-vs-geometry schematic slop.
  sapozhok: { areaM2: 4.18, areaToleranceM2: 0.02, vertexCount: 6, openingCount: 2, ceilingH: 2640, parapetH: 1070 },
  lodochka: { areaM2: 2.68, areaToleranceM2: 0.01, vertexCount: 7, openingCount: 2, ceilingH: 2660, parapetH: 1100 },
  utyuzhok: { areaM2: 4.75, areaToleranceM2: 0.01, vertexCount: 5, openingCount: 2, ceilingH: 2640, parapetH: 1050 },
  loggia: { areaM2: 3.6, areaToleranceM2: 0.001, vertexCount: 4, openingCount: 2, ceilingH: 2640, parapetH: 1050 },
  // Real И-209А passport size (6043x1206mm, not a rounded "6 m typical") — exact area.
  'long-loggia': { areaM2: 7.287858, areaToleranceM2: 0.000001, vertexCount: 4, openingCount: 3, ceilingH: 2600, parapetH: 1100 },
  khrushchevka: { areaM2: 2.16, areaToleranceM2: 0.001, vertexCount: 4, openingCount: 2, ceilingH: 2500, parapetH: 1000 },
};

test('every PLAN_SHAPES entry has a reference value (no model silently uncovered)', () => {
  assert.deepEqual(Object.keys(PLAN_SHAPES).sort(), Object.keys(REFERENCE).sort());
});

for (const [id, ref] of Object.entries(REFERENCE)) {
  test(`${id}: matches its reference geometry`, () => {
    const g = PLAN_SHAPES[id];
    assert.ok(g, `${id} must exist in PLAN_SHAPES`);
    if (!g) return;

    const area = planArea(g);
    assert.ok(
      Math.abs(area - ref.areaM2) <= ref.areaToleranceM2,
      `${id}: area ${area.toFixed(3)} m² is not within ${ref.areaToleranceM2} of reference ${ref.areaM2} m²`,
    );
    assert.equal(g.poly.length, ref.vertexCount, `${id}: vertex count`);
    assert.equal(g.kinds.length, ref.vertexCount, `${id}: kinds count must match vertex count`);
    assert.equal(g.openings.length, ref.openingCount, `${id}: opening count`);
    assert.equal(g.ceilingH, ref.ceilingH, `${id}: ceilingH`);
    assert.equal(g.parapetH, ref.parapetH, `${id}: parapetH`);
  });

  test(`${id}: passes geometry validation with no errors`, () => {
    const g = PLAN_SHAPES[id];
    if (!g) return;
    const issues = validatePlanGeom(g).filter((i) => i.severity === 'error');
    assert.deepEqual(issues, [], `${id} has validation errors: ${JSON.stringify(issues)}`);
  });

  test(`${id}: mirrored variant keeps the same area and passes validation`, () => {
    const g = PLAN_SHAPES[id];
    if (!g) return;
    const mirrored = mirrorPlan(g);
    const area = planArea(g);
    const mirroredArea = planArea(mirrored);
    assert.ok(
      Math.abs(area - mirroredArea) < 1e-6,
      `${id}: mirroring changed the floor area (${area} -> ${mirroredArea}) — mirroring must be area-preserving`,
    );
    const issues = validatePlanGeom(mirrored).filter((i) => i.severity === 'error');
    assert.deepEqual(issues, [], `${id}:mirrored has validation errors: ${JSON.stringify(issues)}`);
  });
}

test('house wall (edge 0) is always a straight run starting at the origin', () => {
  for (const [id, g] of Object.entries(PLAN_SHAPES)) {
    assert.deepEqual(g.poly[0], [0, 0], `${id}: poly[0] must be the origin`);
    assert.equal(g.kinds[0], 'house', `${id}: edge 0 must be the house wall`);
  }
});

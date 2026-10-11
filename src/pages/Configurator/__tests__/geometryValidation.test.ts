/**
 * @file Unit tests for geometryValidation.ts (допфайлплана.txt §14): asserts the
 * validator actually catches each defect class it claims to, using small
 * hand-built broken geometries — not the real shapes (those are covered
 * separately by geometry.reference.test.ts).
 *
 * Run with `npm run test:geometry` (plain `node --test`, no new dependency — see
 * that script in package.json and scripts/ts-esm-resolve-loader.mjs for why this
 * needs a custom resolve hook to run TS directly).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlanGeom } from '../planShapes';
import { validatePlanGeom } from '../geometryValidation';

/** A minimal valid rectangle to mutate per test — same shape family as `loggia`. */
function baseGeom(overrides: Partial<PlanGeom> = {}): PlanGeom {
  return {
    poly: [
      [0, 0],
      [3000, 0],
      [3000, 1200],
      [0, 1200],
    ],
    kinds: ['house', 'wall', 'glazing', 'wall'],
    ceilingH: 2640,
    parapetH: 1050,
    openings: [{ kind: 'door', from: 550, to: 1300 }],
    dims: [{ text: '3000', a: [0, 0], b: [3000, 0], axis: 'x', at: -430 }],
    ...overrides,
  };
}

function codesOf(geom: PlanGeom): string[] {
  return validatePlanGeom(geom).map((i) => i.code);
}

test('a clean rectangle has no issues', () => {
  assert.deepEqual(validatePlanGeom(baseGeom()), []);
});

test('non-positive ceiling height is caught', () => {
  assert.ok(codesOf(baseGeom({ ceilingH: 0 })).includes('INVALID_CEILING_HEIGHT'));
});

test('parapet at or above ceiling height is caught', () => {
  assert.ok(codesOf(baseGeom({ parapetH: 2640, ceilingH: 2640 })).includes('PARAPET_NOT_BELOW_CEILING'));
});

test('kinds/poly length mismatch is caught', () => {
  assert.ok(codesOf(baseGeom({ kinds: ['house', 'wall', 'glazing'] })).includes('KINDS_LENGTH_MISMATCH'));
});

test('a degenerate (duplicated-point) edge is caught', () => {
  const geom = baseGeom({ poly: [[0, 0], [0, 0], [3000, 1200], [0, 1200]] });
  assert.ok(codesOf(geom).includes('DEGENERATE_EDGE'));
});

test('two edges on the same segment are flagged as a duplicate wall', () => {
  // A "bowtie": edge 1 (A->B) and edge 3 (B->A, i.e. the same segment reversed).
  const geom = baseGeom({
    poly: [
      [0, 0],
      [3000, 0],
      [3000, 0],
      [0, 0],
    ],
    kinds: ['house', 'wall', 'wall', 'wall'],
  });
  assert.ok(codesOf(geom).includes('DUPLICATE_WALL'));
});

test('a thin-range outside its edge length is caught', () => {
  assert.ok(codesOf(baseGeom({ thin: { 1: [0, 5000] } })).includes('INVALID_THIN_RANGE'));
});

test('a thin-range on a nonexistent edge is caught', () => {
  assert.ok(codesOf(baseGeom({ thin: { 9: [0, 100] } })).includes('THIN_RANGE_BAD_EDGE'));
});

test('an opening past the end of the house wall is caught', () => {
  assert.ok(codesOf(baseGeom({ openings: [{ kind: 'door', from: 2900, to: 3200 }] })).includes('OPENING_OUT_OF_BOUNDS'));
});

test('two overlapping openings are caught', () => {
  const geom = baseGeom({
    openings: [
      { kind: 'door', from: 500, to: 1300 },
      { kind: 'window', from: 1200, to: 2000 },
    ],
  });
  assert.ok(codesOf(geom).includes('OPENINGS_OVERLAP'));
});

test('a zero-length dimension line is caught as a warning', () => {
  const geom = baseGeom({ dims: [{ text: '0', a: [0, 0], b: [0, 0], axis: 'x', at: 0 }] });
  const issues = validatePlanGeom(geom);
  const dim = issues.find((i) => i.code === 'DIM_ZERO_LENGTH');
  assert.ok(dim);
  assert.equal(dim?.severity, 'warning');
});

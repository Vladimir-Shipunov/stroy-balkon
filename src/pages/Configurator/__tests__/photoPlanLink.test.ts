/**
 * @file Photo <-> plan link: which plan walls a tap target of the app's photo frames
 * stands for, and where the two frames are shot from. The expectations are the layout
 * every one of the app's screens shares: frame 1 looks along the balcony from one end
 * with the house wall (door block) on the left and the glazing on the right; frame 2
 * looks back from the other end and its wall targets are only the far end wall. A
 * right-handed screen is the same photos flipped, with a mirrored plan.
 *
 * Run with `npm run test:geometry`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_SHAPES, planFor } from '../planShapes';
import { glazingEdges, planCameras, wallNumbersText, wallTitle, wallsAtPhotoX } from '../photoPlanLink';

// Columns of the app's own tap targets (percent from the left of the frame): the house
// wall hotspot sits at x=17..37 in frame 1, the parapet at x=72, the far wall at ~50.
const HOUSE_COL = 30;
const GLAZING_COL = 72;
const CENTER = 50;

for (const [id, g] of Object.entries(PLAN_SHAPES)) {
  test(`${id}: frame 1 — left is the house wall, right is the glazing parapet`, () => {
    assert.deepEqual(wallsAtPhotoX(g, 0, false, HOUSE_COL), [0]);
    assert.deepEqual(wallsAtPhotoX(g, 0, false, GLAZING_COL), glazingEdges(g));
  });

  test(`${id}: frame 2 looks back — a wall target there is the far end wall wherever it sits`, () => {
    const centre = wallsAtPhotoX(g, 1, false, CENTER);
    assert.equal(centre.length, 1);
    assert.notEqual(g.kinds[centre[0]!], 'house');
    // The Утюжок's far wall sits off-centre (x=68); it must not be taken for the house wall.
    assert.deepEqual(wallsAtPhotoX(g, 1, false, 68), centre);
    assert.deepEqual(wallsAtPhotoX(g, 1, false, 32), centre);
  });

  test(`${id}: the far wall in each frame is one real wall, never the house wall`, () => {
    for (const view of [0, 1] as const) {
      const hit = wallsAtPhotoX(g, view, false, CENTER);
      assert.equal(hit.length, 1, `frame ${view + 1}: exactly one far wall`);
      assert.notEqual(g.kinds[hit[0]!], 'house', `frame ${view + 1}: far wall is not the house wall`);
    }
  });

  test(`${id}: the two cameras stand inside the plan, facing opposite ways`, () => {
    const [a, b] = planCameras(g, false);
    assert.ok(a && b);
    assert.ok(a!.fx * b!.fx + a!.fy * b!.fy < -0.99, 'opposite viewing directions');
    for (const c of [a!, b!]) {
      assert.ok(c.x > 0 && c.y > 0, `${id}: camera ${c.label} is off the house-wall/left edge`);
    }
    assert.deepEqual([a!.label, b!.label], ['кадр 1', 'кадр 2']);
  });
}

test('right-handed Утюжок: the flipped frames put the house wall on the opposite side', () => {
  const right = planFor('utyuzhok', 'right');
  assert.ok(right, 'the mirrored plan exists');
  if (!right) return;
  // Flipped frame 1: the house wall is on the right of the picture, glazing on the left.
  assert.deepEqual(wallsAtPhotoX(right, 0, true, 100 - HOUSE_COL), [0]);
  assert.deepEqual(wallsAtPhotoX(right, 0, true, 100 - GLAZING_COL), glazingEdges(right));
  // Flipped frame 2: still just the far wall, never the house wall.
  const far = wallsAtPhotoX(right, 1, true, CENTER);
  assert.equal(far.length, 1);
  assert.notEqual(far[0], 0);
  // The frames swap ends: flipped frame 1 is the other camera of the mirrored plan.
  const [f1] = planCameras(right, true);
  assert.ok(f1);
  assert.equal(f1!.label, 'кадр 1');
  assert.ok(f1!.fx > 0, 'flipped frame 1 looks along +x on the mirrored plan');
});

test('glazingEdges lists exactly the glazing runs', () => {
  const sapozhok = PLAN_SHAPES.sapozhok;
  assert.ok(sapozhok);
  assert.deepEqual(glazingEdges(sapozhok!), [2, 3, 4]);
});

test('wall number text matches the plan badges (index + 1), runs collapse', () => {
  assert.equal(wallNumbersText([0]), '1');
  assert.equal(wallNumbersText([2, 3, 4]), '3–5');
  assert.equal(wallNumbersText([1, 3]), '2, 4');
  assert.equal(wallTitle([5]), 'Стена 6');
  assert.equal(wallTitle([2, 3, 4]), 'Стены 3–5');
});

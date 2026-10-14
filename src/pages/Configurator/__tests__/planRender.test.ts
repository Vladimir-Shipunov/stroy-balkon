/**
 * @file Shapes the app has no photo scenes for (Лодочка) are drawn from their exact plan:
 * their tap targets are the plan's surfaces, not the app screen's, and every other shape
 * keeps the app's photos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVamSelection, pickKey, usesPlanRender, vamHotspotList, vamPlanHotspots, vamSummary } from '../vamCatalog';

test('only Лодочка is drawn by the room renderer', () => {
  assert.equal(usesPlanRender('lodochka'), true);
  for (const id of ['sapozhok', 'utyuzhok', 'loggia', 'long-loggia', 'khrushchevka']) assert.equal(usesPlanRender(id), false, id);
});

test('Лодочка has one tap target per plan wall (the 7 edges of the boat) and its picks survive normalisation', () => {
  const sel = normalizeVamSelection({ shape: 'lodochka', glazing: 'left' });
  const hotspots = vamHotspotList(sel);
  assert.deepEqual(hotspots.map((h) => h.id), vamPlanHotspots('lodochka').map((h) => h.id));
  const walls = hotspots.filter((h) => h.kind === 'wall');
  assert.equal(walls.length, 7);

  const wall = walls[5]!;
  const slot = wall.slots[0]!;
  const option = slot.options[0]!;
  const pick = { o: option.id, k: option.colors[0]!.k };
  const kept = normalizeVamSelection({ shape: 'lodochka', glazing: 'left', picks: { [pickKey(wall.id, slot.id)]: pick } });
  assert.deepEqual(kept.picks[pickKey(wall.id, slot.id)], pick);
  assert.ok(vamSummary(kept).some((r) => r.value.startsWith(option.label)), 'the choice reaches the summary');
});

test('a stale Лодочка selection with the old parapet/floor glazing falls back to a real one', () => {
  assert.equal(normalizeVamSelection({ shape: 'lodochka', glazing: 'parapet' }).glazing, 'left');
});

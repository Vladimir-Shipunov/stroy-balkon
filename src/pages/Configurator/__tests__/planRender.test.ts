/**
 * @file Лодочка and Сапожок have no real app photo that matches their own footprint (Лодочка
 * has none at all; Сапожок's stepped П-44Т outline isn't the straight rectangle the generic
 * "П" type's photo shows) — the room renderer can draw either from its exact plan instead
 * (`usesPlanRender`, still typechecked/tested below), but the owner's final call (2026-10-14,
 * after trying it every way more than once that day) was the app's own real photo everywhere:
 * the "Чертёж, мм" plan card carries the exact geometry on its own, unconditionally, so this
 * flag only ever picks which *photo* goes next to it. Every shape, this pair included,
 * borrows its mapped type's real screen — Лодочка the П-44Т Утюжок photo, Сапожок the generic
 * П-образный photo — and `usesPlanRender` is always false.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVamSelection, pickKey, usesPlanRender, VAM_AVAILABLE_SHAPES, vamHotspotList, vamPlanHotspots, vamScreen, vamSummary } from '../vamCatalog';

test('only finished balcony shapes are selectable and stale hidden-shape selections fall back safely', () => {
  assert.deepEqual(VAM_AVAILABLE_SHAPES.map((shape) => shape.id), ['utyuzhok', 'loggia', 'long-loggia', 'khrushchevka']);
  assert.deepEqual(normalizeVamSelection({ shape: 'lodochka', glazing: 'left' }), { shape: 'utyuzhok', glazing: 'left', picks: {} });
  assert.deepEqual(normalizeVamSelection({ shape: 'sapozhok', glazing: 'parapet' }), { shape: 'utyuzhok', glazing: 'left', picks: {} });
  assert.equal(normalizeVamSelection(null).shape, 'utyuzhok');
});

test('usesPlanRender is always false — every shape shows the app\'s own real photo', () => {
  for (const id of ['lodochka', 'sapozhok', 'utyuzhok', 'loggia', 'long-loggia', 'khrushchevka']) assert.equal(usesPlanRender(id), false, id);
});

test('Лодочка borrows the П-44Т Утюжок screen (same type, same tap targets) and its picks survive normalisation', () => {
  const sel = normalizeVamSelection({ shape: 'lodochka', glazing: 'left' });
  const utyuzhokSel = normalizeVamSelection({ shape: 'utyuzhok', glazing: 'left' });
  assert.equal(vamScreen(sel).id, vamScreen(utyuzhokSel).id);
  const hotspots = vamHotspotList(sel);
  assert.deepEqual(hotspots.map((h) => h.id), vamHotspotList(utyuzhokSel).map((h) => h.id));
  const walls = hotspots.filter((h) => h.kind === 'wall');
  assert.equal(walls.length, 3);

  const wall = walls[1]!;
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

test('the plan renderer itself still works (the documented alternative usesPlanRender no longer wires in)', () => {
  assert.equal(vamPlanHotspots('lodochka').filter((h) => h.kind === 'wall').length, 7);
  assert.equal(vamPlanHotspots('sapozhok').filter((h) => h.kind === 'wall').length, 6);
});

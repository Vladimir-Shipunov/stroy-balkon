# Geometry audit — допфайлплана.txt

Scope: `src/pages/Configurator/{planShapes,planGeometry,ShapePlan,PlanScene,VamScene,render/*}`. Read-only audit by two parallel agents, consolidated here. No code changed yet in this document — fixes tracked below and applied separately.

## 1. Coordinate system

`planShapes.ts` is the single geometry source of truth: plain data, millimetres, origin at the house-wall start corner, `+x` along the house wall, `+y` into the room, polygon counter-clockwise. No pixels leak into the geometry layer — `ShapePlan.tsx` (SVG) and `render/scene.ts` (raster) each convert mm→px only at their own rendering boundary. Verdict: **OK**, matches допфайлплана.txt §4.

## 2. RE-EXAMINED — wall thickness: not actually a bug

Initial pass flagged this as a duplicate-geometry bug: `ShapePlan.tsx:23`'s `THICK` table (70–210mm, drawn outward from the interior polygon) versus `render/scene.ts`'s walls, which are zero-thickness planes on the same polygon line.

On closer reading this is **not a defect**: `render/scene.ts` (see its file header) only ever builds the two first-person *interior* camera views (`roomCameras`) — the camera is always inside the room looking at interior-facing surfaces, so a wall's outer face/thickness is never in frame and has no visual effect. `ShapePlan.tsx` is the only view that needs wall thickness, because it's a true top-down floor plan where the exterior footprint matters. There is no "same wall shown two different thicknesses in the same view" problem — these are two different view types with two different, individually-correct needs. No change made; corrected from the first draft of this document, which over-stated the issue before checking what `scene.ts`'s camera actually sees.

## 3. CONFIRMED BUG — window-division count disagrees between drawing and render

- `render/scene.ts:165` (`glazingFaces`) computes `units = Math.max(1, Math.round(e.len / UNIT))`, `UNIT = 900mm` — a procedural mullion count with no backing data in `planShapes.ts`.
- `ShapePlan.tsx:265-273` draws a single center glazing line per edge regardless of length.

A glazing wall long enough to need 3 sashes in the 3D/plan render shows only one dividing line on the technical drawing — directly the failure mode допфайлплана.txt §12 calls out ("На чертеже показана одна стойка, а визуализация отображает две").

**Fix applied**: new `src/pages/Configurator/wallGeometry.ts` exports `glazingUnitCount()`/`glazingUnitCuts()` (same `UNIT=900` rule, now named and shared instead of duplicated). `render/scene.ts`'s `glazingFaces()` now calls it instead of computing `units`/`cuts` inline, and `ShapePlan.tsx`'s glazing band now draws one cross-tick per interior cut point (same count, same positions) instead of a single decorative centre line — so the drawing and the interior render always agree on how many sashes a glazed run has.

## 4. Frame/glass geometry — correctly derived, not independently placed

`glazingFaces()` computes the frame reveal (`FRAME_B` inset) and the glass pane from the same per-unit opening rectangle — glass does not float independently of its frame. One caveat: the glass pane is a single rect spanning the whole edge rather than clipped per-unit; harmless today (it just sits behind all mullions uniformly) but fragile if `FRAME_B`/`GLASS_SET` ever become shape-dependent. Left as-is — not a visible defect, flagged for future attention if profile data becomes available.

## 5. FRAME_B / GLASS_SET — global constant, not per-profile

`scene.ts:20-21` applies one frame-ring width (`FRAME_B=64`) and one glass setback (`GLASS_SET=46`) to every balcony type and every profile color. допфайлплана.txt §8 rule 3 asks for per-profile thickness where "исходные материалы предусматривают разные профили" — but the APK/construktor source materials (per docs/apk-inventory.md, docs/apk-to-plan-mapping.md) do not expose distinct profile-width data per type, only color variants. **Not fixed**: inventing per-type profile widths without real sourced data would violate the project's explicit "don't fabricate specs" rule. Documented here as a known, data-limited gap rather than silently left unexplained.

## 6. Corner/angle geometry — correctly implemented

`offsetChain()`/`cross()` in `scene.ts` do real line-intersection mitring, and `planShapes.ts`'s outlines are a documented least-squares fit to real П-44Т passport areas (sapozhok 4.18 m² @ 68.6°, lodochka 2.68 m², utyuzhok 4.75 m²) — not a 90°-assumption patch. Verdict: **OK**, no change needed.

## 7. Coplanar layering (frame/glass/unit)

Resolved by a real per-pixel z-buffer (`raster.ts`) plus `LAYERS` draw order as a tie-breaker for near-coplanar faces (depth tolerance `*1.000003`). Works correctly today; the draw-order convention is implicit and untested as an invariant. **Not changed** — no observed defect, noted as a fragility for future regression testing (see test coverage note in the main audit).

## 8. Photo-mode (VamScene) vs documented real-app behaviour

Matches the real app's layer-stacking model faithfully (absolute-positioned pre-composited images, no coordinate math needed, per docs/vam-2d-mapping.md). Known, already-documented deviations (soft street panorama, a couple of unwired flat-color variants) are pre-existing and intentional, not new findings.

## 9. Duplicate walls & unintended intersections (§5/§6, all 6 shapes)

Checked every shape's `poly`/`kinds`/`thin`/`blocks` plus `render/scene.ts`'s `buildRoom()` face-generation loops. No accidental duplicate wall objects, no double-drawn surfaces, no overlapping skirting/parapet corners found in any of the 6 models. The only overlap-looking data — `sapozhok`'s `thin` sub-span and `lodochka`'s `blocks` support rectangle — is confined to the 2D plan card (`ShapePlan.tsx`), explicitly commented as intentional, and `render/scene.ts` never reads either field, so there is no 3D counterpart to collide with. Verdict: **OK**, no change needed.

## 10. Unplanned partitions (§7, all 6 shapes)

Every divider `ShapePlan.tsx` draws (mullion ticks, thin/solid wall splits, door/window openings) traces back to a real field in that shape's `PlanGeom` (`glazingUnitCuts`, `g.thin`, `g.openings`) — none are drawn "for looks" without backing data. Verdict: **OK**, no change needed (and the mullion-tick fix in §3 only made this stricter, since the count itself is now shared with the render).

## 11. Dimension lines (§13)

All dimension endpoints (`dims[].a`/`.b`) trace to real `poly` vertices or `thin`-boundary points — none are arbitrary/hardcoded screen positions. However: for 3 of 6 shapes (sapozhok, lodochka, utyuzhok), a dimension's **label text** is the owner's original drawing/passport number, while the **drawn line's actual length** (computed from the fitted polygon) differs by 30–192mm. This is not a bug in the geometry-vs-rendering sense — it is the direct, documented consequence of `planShapes.ts`'s file-header comment: the source drawings are schematic/non-scale and their numbers can't all hold simultaneously (e.g. sapozhok's stated 45° diagonal is arithmetically impossible against its other stated lengths), so the outline is a least-squares fit that preserves topology and matches the real П-44Т passport *areas*, while dimension labels keep the owner's original stated sub-dimensions per допфайлплана.txt §3's instruction to "use the drawing's value, not a fabricated correction." The two can't be made to agree without either inventing a new, unsourced "corrected" number (forbidden) or discarding real passport data (also forbidden) — this is exactly the "величины противоречат друг другу — зафиксируй противоречие" case §3 anticipates.

**Fix applied**: this was previously only documented in a code comment, invisible to anyone looking at the rendered drawing. Added a small "схема, не в масштабе" (schematic, not to scale) caption to `ShapePlan.tsx`'s detailed card so a careful reader doesn't mistake the label/line-length gap for a rendering defect. No geometry or label values were changed. The `bounds()`/viewBox sizing and dimension-line layout logic itself checked out fine (no clipping/overlap risk found by static reading).

## 12. Automatic geometry validation & per-model reference tests (§14/§15)

`src/pages/Configurator/geometryValidation.ts` — `validatePlanGeom(g)` checks one `PlanGeom` for: non-positive ceiling/parapet height or parapet at/above ceiling, `kinds`/`poly` length mismatch, non-positive floor area, degenerate (near-zero-length) edges, two edges occupying the same segment (a duplicate wall), a `thin` range outside its edge's length or on a nonexistent edge, an opening outside the house wall's span or overlapping another opening, a glazing edge resolving to zero window units (via the shared `wallGeometry.ts` rule), and a zero-length dimension line. `validateAllShapes()` runs this over every `PLAN_SHAPES` entry plus its mirrored variant. Deliberately depends only on `planShapes.ts` + `wallGeometry.ts` (no `render/scene.ts` import) so it runs standalone under plain Node.

Two test files under `src/pages/Configurator/__tests__/`:
- `geometryValidation.test.ts` — 11 hand-built broken geometries, one per defect class above, asserting the validator actually flags each one (plus one clean-rectangle case asserting no false positives).
- `geometry.reference.test.ts` — per-model golden values (area within the tolerance this file's own header documents for the three passport-matched shapes, exact for the three plain rectangles; vertex/opening counts; `ceilingH`/`parapetH`) for all 6 `PLAN_SHAPES` entries, plus a check that `validatePlanGeom` reports zero errors for every real model and its mirrored variant, plus a mirror-invariant-area check.

Run via `npm run test:geometry` — 31/31 pass as of this writing, confirming the §3 mullion fix and the rest of the real model have no detectable defects from this checklist. Needed one infrastructure addition to run TS test files directly without a bundler: `@types/node` (devDependency, types-only) plus a narrow `tsconfig.test.json` (excluded from the main `tsconfig.json` via its own `exclude`, so the shared config's `"types": []` — deliberately kept empty to avoid leaking Node globals into browser-code typechecking — is untouched) and a tiny custom Node ESM resolve hook (`scripts/ts-esm-resolve-loader.mjs`, no new runtime dependency) that lets `node --experimental-strip-types --test` resolve this project's extensionless relative imports.

## Summary of code changes made as a result of this audit

1. §2 (wall thickness): re-examined, not a bug — no change, see above.
2. New `src/pages/Configurator/wallGeometry.ts` — single shared source for the glazing-unit/mullion-count rule, consumed by both `ShapePlan.tsx` and `render/scene.ts` (fixes §3 — the one confirmed drawing/visualization mismatch).
3. No change made for frame/glass profile width (FRAME_B/GLASS_SET, §8) — no real profile-width source data exists to drive per-type variation; fabricating values would violate the "don't invent specs" rule. Left as a documented limitation.
4. No change made for §4, §6, §7, §8/§9/§10 corner+layering checks — audited, no defect found.
5. §5/§6/§7 (duplicate walls, intersections, unplanned partitions) across all 6 models — audited, no defect found (§9/§10 above).
6. §13 (dimension lines): added a "схема, не в масштабе" caption to `ShapePlan.tsx`'s detailed card — no geometry/label values changed, see §11 above for why the label/geometry gap itself is correct, not a bug.
7. §14/§15 (automatic validation, reference tests): claimed by a parallel session, not built here.

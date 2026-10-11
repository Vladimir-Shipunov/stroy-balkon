/**
 * @file Shared geometry rules that both the technical drawing (`ShapePlan.tsx`) and
 * the interior render (`render/scene.ts`) must agree on, so neither can drift from
 * the other independently. See docs/GEOMETRY_AUDIT.md for why this file exists.
 */

/** ~one sash per 0.9 m of glazing — the app's real window-unit spacing. */
export const GLAZING_UNIT_MM = 900;

/** Number of window units (mullion-separated panes) a glazed run of this length gets. */
export function glazingUnitCount(edgeLenMm: number): number {
  return Math.max(1, Math.round(edgeLenMm / GLAZING_UNIT_MM));
}

/** The `edgeLenMm`-long run cut into `glazingUnitCount` equal segments, as cut points along it. */
export function glazingUnitCuts(edgeLenMm: number): number[] {
  const units = glazingUnitCount(edgeLenMm);
  return [0, ...Array.from({ length: units - 1 }, (_, k) => ((k + 1) * edgeLenMm) / units), edgeLenMm];
}

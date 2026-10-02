/**
 * @file The surfaces of a plan that the customer can finish, numbered like the app
 * ("Стена 3"): one wall per edge of the outline, the floor, the ceiling, the window
 * frames, the window sill, the plinth and the ceiling light. The rendering itself lives in `render/`; this file
 * only names the surfaces and ties them to the ids the renderer writes into its
 * id buffer.
 */
import { PICK } from './render/types';
import { bestWallEdge, glazedChains } from './render/scene';
import type { PlanGeom } from './planShapes';

export type SurfaceKind = 'wall' | 'floor' | 'ceiling' | 'frame' | 'light' | 'sill' | 'plintus' | 'cabinet' | 'dryer' | 'flowers';

export interface PlanSurface {
  /** Pick id of the catalogue: `P:w3` (wall 3), `P:floor`, `P:ceiling`, `P:frame`, `P:light`. */
  readonly id: string;
  readonly kind: SurfaceKind;
  /** The value the renderer's id buffer holds where this surface is visible (0 = never drawn: the light). */
  readonly pick: number;
}

/** The finishable surfaces of a plan, in the order the panel lists them. */
export function planSurfaces(g: PlanGeom): PlanSurface[] {
  const out: PlanSurface[] = [];
  g.kinds.forEach((kind, i) => {
    // Windows to the floor leave no wall under the glazing to finish.
    if (kind === 'glazing' && g.floorGlazing) return;
    out.push({ id: `P:w${i + 1}`, kind: 'wall', pick: i + 1 });
  });
  out.push({ id: 'P:floor', kind: 'floor', pick: PICK.floor });
  out.push({ id: 'P:ceiling', kind: 'ceiling', pick: PICK.ceiling });
  if (g.kinds.includes('glazing')) out.push({ id: 'P:frame', kind: 'frame', pick: PICK.frame });
  out.push({ id: 'P:light', kind: 'light', pick: PICK.light });
  if (g.kinds.includes('glazing') && !g.floorGlazing) out.push({ id: 'P:sill', kind: 'sill', pick: PICK.sill });
  out.push({ id: 'P:plintus', kind: 'plintus', pick: PICK.plinth });
  // Decor: a bench + a dryer need a solid side wall to stand against (none on the Хрущёвка, glazed on
  // three sides); the planter needs a sill to stand on (none when the glazing goes to the floor).
  if (bestWallEdge(g) !== null) {
    out.push({ id: 'P:cabinet', kind: 'cabinet', pick: PICK.cabinet });
    out.push({ id: 'P:dryer', kind: 'dryer', pick: PICK.dryer });
  }
  if (!g.floorGlazing && glazedChains(g).length > 0) out.push({ id: 'P:flowers', kind: 'flowers', pick: PICK.flowers });
  return out;
}

/**
 * @file Ties the app's pre-rendered photo frames to the plan drawing. The two photos
 * of a screen are the balcony seen from each end along its length (the same two
 * viewpoints `render/scene.ts`'s `roomCameras` models), so where a wall tap target sits
 * says which walls of the plan it is. In every screen of the app:
 * - frame 1's wall targets are the house wall (door block, curtains) on its left, the
 *   parapet under the windows on its right, and the far end wall in the middle;
 * - frame 2's wall targets are only ever the far end wall (it can sit off-centre when the
 *   camera looks diagonally, as in the Утюжок).
 * The house wall is plan edge 0, the parapet runs along every glazed edge, and the far
 * wall is the first wall the viewing axis hits. The drawing then shows where each frame
 * is shot from and which walls a tapped surface covers.
 *
 * Pure geometry, no React — unit-tested in `__tests__/photoPlanLink.test.ts`.
 */
import { edgeOf } from './planShapes';
import type { PlanGeom } from './planShapes';
import { roomCameras } from './render/scene';

/** Horizontal field of view of the app's photo frames (they are wide-angle interior renders). */
export const PHOTO_FOV = (78 * Math.PI) / 180;

/** Share of the frame width (percent from each edge) that counts as "a side" of it. */
const SIDE = 40;

/** A camera standing in the plan: position in mm and a unit viewing direction. */
export interface PlanCamera {
  readonly x: number;
  readonly y: number;
  readonly fx: number;
  readonly fy: number;
  /** "кадр 1" / "кадр 2": the photo frame this camera stands for. */
  readonly label: string;
}

/**
 * Index of the model camera that stands for photo frame `view`. A right-handed screen
 * is the left-handed one drawn flipped, and the plan is mirrored the same way, so the
 * flipped frame 1 is seen from the opposite end of the mirrored plan.
 */
function modelView(view: 0 | 1, mirror: boolean): 0 | 1 {
  return mirror ? ((1 - view) as 0 | 1) : view;
}

/** The two photo viewpoints drawn on the plan, labelled by the frame they belong to. */
export function planCameras(g: PlanGeom, mirror: boolean): readonly PlanCamera[] {
  const cams = roomCameras(g);
  return ([0, 1] as const).map((view) => {
    const c = cams[modelView(view, mirror)];
    const l = Math.hypot(c.fx, c.fy) || 1;
    return { x: c.x, y: c.y, fx: c.fx / l, fy: c.fy / l, label: `кадр ${view + 1}` };
  });
}

/** Plan edges of the glazing runs (windows, parapet, sill, frames live there). */
export function glazingEdges(g: PlanGeom): number[] {
  return g.kinds.flatMap((kind, i) => (kind === 'glazing' ? [i] : []));
}

/** The first wall (0-based edge) the viewing axis of a model camera hits, or null. */
function farWall(g: PlanGeom, camera: 0 | 1): number | null {
  const c = roomCameras(g)[camera];
  const l = Math.hypot(c.fx, c.fy) || 1;
  const dx = c.fx / l;
  const dy = c.fy / l;
  let best = Infinity;
  let hit: number | null = null;
  for (let i = 0; i < g.poly.length; i += 1) {
    const [a, b] = edgeOf(g, i);
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const apx = a[0] - c.x;
    const apy = a[1] - c.y;
    const t = (apx * ey - apy * ex) / den;
    const s = (apx * dy - apy * dx) / den;
    if (t > 1e-6 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) {
      best = t;
      hit = i;
    }
  }
  return hit;
}

/**
 * The plan walls (0-based edge indices; the number drawn on the plan is index + 1) that
 * a wall tap target at `xPct` (percent from the left of the displayed frame) stands for.
 */
export function wallsAtPhotoX(g: PlanGeom, view: 0 | 1, mirror: boolean, xPct: number): number[] {
  if (view === 0) {
    // A flipped (right-handed) screen has the house wall on the right of frame 1.
    const houseSide = mirror ? xPct >= 100 - SIDE : xPct <= SIDE;
    const glazingSide = mirror ? xPct <= SIDE : xPct >= 100 - SIDE;
    if (houseSide) return [0];
    if (glazingSide) {
      const glazed = glazingEdges(g);
      if (glazed.length > 0) return glazed;
    }
  }
  const far = farWall(g, modelView(view, mirror));
  return far === null ? [] : [far];
}

/** "3" for one wall, "3–5" for a run of neighbours, "2, 4" otherwise (numbers as printed on the plan). */
export function wallNumbersText(edges: readonly number[]): string {
  const nums = [...edges].map((e) => e + 1).sort((a, b) => a - b);
  if (nums.length <= 1) return nums.join('');
  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1]! + 1);
  return contiguous ? `${nums[0]}–${nums[nums.length - 1]}` : nums.join(', ');
}

/** Panel heading of a wall tap target: "Стена 6" / "Стены 3–5". */
export function wallTitle(edges: readonly number[]): string {
  return `${edges.length > 1 ? 'Стены' : 'Стена'} ${wallNumbersText(edges)}`;
}

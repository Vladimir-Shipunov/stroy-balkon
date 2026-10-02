/**
 * @file Baked daylight of a room: every large face gets a light map (one texel per
 * 50 mm), small parts one value. Light = a soft ambient (light bounced around the
 * room) + the sky seen through every window, using the exact form factor of the
 * window polygon (the part behind the face's plane is clipped off first), times an
 * ambient-occlusion term that darkens corners — floor and ceiling lines, wall
 * corners, the floor along the parapets and the parapet under the sill.
 */
import type { PlanGeom } from '../planShapes';
import { PARAPET_D } from './scene';
import type { RoomModel } from './scene';
import type { Face, Vec3 } from './types';

export interface LightMap {
  readonly u0: number;
  readonly v0: number;
  readonly inv: number;
  readonly nu: number;
  readonly nv: number;
  readonly data: Float32Array;
}

/** A face's light: a map, or one value for small parts. */
export type FaceLight = LightMap | number;

const AMBIENT = 0.7; // light bounced around the room: reveals and corners are never black
const SKY = 1.3;
const TEXEL = 50;

type V = [number, number, number];

/** Clip polygon q to the half-space in front of the plane (point p, normal n). */
function clipFront(q: readonly Vec3[], p: Vec3, n: Vec3): V[] {
  const out: V[] = [];
  const side = (a: Vec3): number => (a[0] - p[0]) * n[0] + (a[1] - p[1]) * n[1] + (a[2] - p[2]) * n[2] - 1;
  for (let i = 0; i < q.length; i += 1) {
    const a = q[i]!;
    const b = q[(i + 1) % q.length]!;
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push([a[0], a[1], a[2]]);
    if (sa >= 0 !== sb >= 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]);
    }
  }
  return out;
}

/** Lambert form factor from a point (normal n) to a polygon. */
function formFactor(p: Vec3, n: Vec3, poly: readonly Vec3[]): number {
  const q = clipFront(poly, p, n);
  if (q.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < q.length; i += 1) {
    const a = q[i]!;
    const b = q[(i + 1) % q.length]!;
    let ax = a[0] - p[0];
    let ay = a[1] - p[1];
    let az = a[2] - p[2];
    const la = Math.hypot(ax, ay, az) || 1;
    ax /= la;
    ay /= la;
    az /= la;
    let bx = b[0] - p[0];
    let by = b[1] - p[1];
    let bz = b[2] - p[2];
    const lb = Math.hypot(bx, by, bz) || 1;
    bx /= lb;
    by /= lb;
    bz /= lb;
    const gam = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const lc = Math.hypot(cx, cy, cz);
    if (lc < 1e-9) continue;
    s += (gam * (cx * n[0] + cy * n[1] + cz * n[2])) / lc;
  }
  return Math.abs(s) / (2 * Math.PI);
}

function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

interface Ctx {
  readonly g: PlanGeom;
  readonly windows: readonly (readonly Vec3[])[];
  readonly parapet: number;
}

/** Daylight at point p of a face. `top` is the height of the face's upper edge (the sill over a parapet). */
function lightAt(c: Ctx, p: Vec3, n: Vec3, top: number): number {
  let e = 0;
  for (const w of c.windows) e += formFactor(p, n, w);
  const poly = c.g.poly;
  const floor = n[2] > 0.5;
  const ceiling = n[2] < -0.5;
  const shelf = floor && p[2] > 200;
  // Distance in the plan to the nearest wall in front of the point.
  let dw = Infinity;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    let d = segDist(p[0], p[1], a[0], a[1], b[0], b[1]);
    if (!floor && !ceiling) {
      // Skip the wall the face lies on, and walls behind it.
      const mx = (a[0] + b[0]) / 2 - p[0];
      const my = (a[1] + b[1]) / 2 - p[1];
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const parallel = Math.abs(ex * n[1] - ey * n[0]) / (Math.hypot(ex, ey) || 1) > 0.98;
      if ((parallel && d < 30) || mx * n[0] + my * n[1] < -1) continue;
    }
    // A sill is a shelf against the windows: the glazing next to it does not darken it.
    if (shelf && c.g.kinds[i] === 'glazing') continue;
    // On the floor the parapets stand in front of the glazing.
    if (floor && !shelf && c.parapet > 0 && c.g.kinds[i] === 'glazing') d = Math.max(0, d - PARAPET_D);
    dw = Math.min(dw, d);
  }
  let ao = 1 - 0.34 * Math.exp(-dw / 240);
  if (!floor && !ceiling) {
    ao *= 1 - 0.3 * Math.exp(-p[2] / 220);
    ao *= 1 - 0.36 * Math.exp(-Math.max(0, top - p[2]) / (top < c.g.ceilingH - 1 ? 110 : 240));
  }
  return (AMBIENT + SKY * e) * ao;
}

/** Bake the light of every face of a room. */
export function bakeLight(g: PlanGeom, room: RoomModel): FaceLight[] {
  const c: Ctx = { g, windows: room.windows, parapet: g.floorGlazing ? 0 : g.parapetH };
  return room.faces.map((f: Face): FaceLight => {
    // A window's frame/handles sit right at the opening, facing INTO the room — so the window
    // they surround is never "in front of" them in the room-facing form-factor sense (it is
    // coplanar with, or behind, their own base along their own normal) and the general model
    // below would always read them as flat, dim ambient: physically backwards for a part that is
    // directly exposed to the sky. Their own image already carries real shading (the `unit` faces
    // are the app's own lit render, `win-frame`'s grey channel), so they just need full exposure
    // here instead of a borrowed, wrong, room-interior light level.
    if (f.kind === 'unit') return 1.15;
    if (f.kind === 'frame') return 1.05;
    const pts = f.loops[0]!;
    const top = Math.max(...pts.map((p) => p[2]));
    const lift: Vec3 = [f.n[0] * 2, f.n[1] * 2, f.n[2] * 2];
    if (!f.map) {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const p of pts) {
        cx += p[0];
        cy += p[1];
        cz += p[2];
      }
      const k = 1 / pts.length;
      return lightAt(c, [cx * k + lift[0], cy * k + lift[1], cz * k + lift[2]], f.n, Math.max(top, cz * k + 1));
    }
    let umin = Infinity;
    let umax = -Infinity;
    let vmin = Infinity;
    let vmax = -Infinity;
    for (const p of pts) {
      const rx = p[0] - f.o[0];
      const ry = p[1] - f.o[1];
      const rz = p[2] - f.o[2];
      const u = rx * f.u[0] + ry * f.u[1] + rz * f.u[2];
      const v = rx * f.v[0] + ry * f.v[1] + rz * f.v[2];
      umin = Math.min(umin, u);
      umax = Math.max(umax, u);
      vmin = Math.min(vmin, v);
      vmax = Math.max(vmax, v);
    }
    // Rooms are a few metres: cap the map so a degenerate face can never blow it up.
    const step = Math.max(TEXEL, (umax - umin) / 240, (vmax - vmin) / 240);
    const nu = Math.max(2, Math.ceil((umax - umin) / step) + 2);
    const nv = Math.max(2, Math.ceil((vmax - vmin) / step) + 2);
    const u0 = umin - step / 2;
    const v0 = vmin - step / 2;
    const data = new Float32Array(nu * nv);
    for (let j = 0; j < nv; j += 1) {
      for (let i = 0; i < nu; i += 1) {
        // Texel centres, kept on the face so corners sample real distances.
        const u = Math.max(umin + 1, Math.min(umax - 1, u0 + i * step));
        const v = Math.max(vmin + 1, Math.min(vmax - 1, v0 + j * step));
        const p: Vec3 = [
          f.o[0] + f.u[0] * u + f.v[0] * v + lift[0],
          f.o[1] + f.u[1] * u + f.v[1] * v + lift[1],
          f.o[2] + f.u[2] * u + f.v[2] * v + lift[2],
        ];
        data[j * nu + i] = lightAt(c, p, f.n, top);
      }
    }
    return { u0, v0, inv: 1 / step, nu, nv, data };
  });
}

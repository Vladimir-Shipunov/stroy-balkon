/**
 * @file Builds the balcony room of a plan (`planShapes.ts`) as planar faces, in mm:
 * walls (the house wall with its balcony door block cut out, reveals, frames,
 * curtains behind the glass and a drip sill under the window), parapets and deep
 * window sills along every run of glazing (mitred at the corners, capped where the
 * glazing runs into a wall in line with it), PVC frames with mullions, sashes and
 * handles, the glass, floor and ceiling — plus the two camera views.
 */
import { DOOR_TOP, HOUSE_WINDOW_BOTTOM, edgeOf } from '../planShapes';
import type { PlanGeom, Pt } from '../planShapes';
import { PICK } from './types';
import type { CameraSpec, Face, FaceKind, Vec3 } from './types';

/** Eye height of both views, mm (the app's renders put the horizon at ~0.52 of the wall). */
export const EYE = 1450;
/** Field of view of the square views. */
export const FOV = (78 * Math.PI) / 180;

const GLASS_SET = 46; // glass behind the face of the frame
const FRAME_W = 64; // outer frame profile
const MULLION_W = 80;
const SASH_W = 46;
const UNIT = 900; // ~one sash per 0.9 m of glazing
export const PARAPET_D = 160; // parapet box: its face is this far into the room
export const SILL_D = 250; // window sill depth from the frame (90 mm overhang)
export const SILL_T = 32;
const REVEAL = 200; // the house wall's door / window reveal depth
const DRIP_OUT = 45;
const PLINTH_H = 60; // skirting board
const PLINTH_D = 14;

type P2 = readonly [number, number];

const v3 = (p: P2, z: number): Vec3 => [p[0], p[1], z];
const add2 = (a: P2, b: P2): P2 => [a[0] + b[0], a[1] + b[1]];
const mul2 = (a: P2, k: number): P2 => [a[0] * k, a[1] * k];
const sub2 = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const len2 = (a: P2): number => Math.hypot(a[0], a[1]);
const cross2 = (a: P2, b: P2): number => a[0] * b[1] - a[1] * b[0];
const UP: Vec3 = [0, 0, 1];
const DOWN: Vec3 = [0, 0, -1];

interface Edge {
  readonly a: P2;
  readonly b: P2;
  readonly d: P2;
  /** Inward normal (the room is on the left of a counter-clockwise outline). */
  readonly n: P2;
  readonly len: number;
}

function edgeInfo(g: PlanGeom, i: number): Edge {
  const [a, b] = edgeOf(g, i);
  const dd = sub2(b, a);
  const l = len2(dd) || 1;
  const d: P2 = [dd[0] / l, dd[1] / l];
  return { a, b, d, n: [-d[1], d[0]], len: l };
}

function makeFace(
  loops: readonly (readonly Vec3[])[],
  n: Vec3,
  o: Vec3,
  u: Vec3,
  v: Vec3,
  kind: FaceKind,
  paint: string,
  pick: number,
  map: boolean,
  tint = 1,
): Face {
  return { loops, n, o, u, v, kind, paint, pick, map, tint };
}

/** A rectangle in the vertical plane of edge `e`, `off` mm along its inward normal. */
function vrect(e: Edge, off: number, s0: number, s1: number, z0: number, z1: number): Vec3[] {
  const p0 = add2(add2(e.a, mul2(e.d, s0)), mul2(e.n, off));
  const p1 = add2(add2(e.a, mul2(e.d, s1)), mul2(e.n, off));
  return [v3(p0, z0), v3(p1, z0), v3(p1, z1), v3(p0, z1)];
}

/** A face lying in the vertical plane of edge `e` (seen from the room). */
function vface(e: Edge, off: number, s0: number, s1: number, z0: number, z1: number, kind: FaceKind, paint: string, pick: number, map: boolean, tint = 1): Face {
  const o = add2(e.a, mul2(e.n, off));
  return makeFace([vrect(e, off, s0, s1, z0, z1)], [e.n[0], e.n[1], 0], v3(o, 0), [e.d[0], e.d[1], 0], UP, kind, paint, pick, map, tint);
}

/** A face perpendicular to edge `e` at `s` (a reveal / a frame side), spanning offsets off0..off1, facing `dir` (+1 = along the edge). */
function sideFace(e: Edge, s: number, off0: number, off1: number, z0: number, z1: number, dir: 1 | -1, kind: FaceKind, paint: string, pick: number, map: boolean, tint = 1): Face {
  const base = add2(e.a, mul2(e.d, s));
  const p0 = add2(base, mul2(e.n, off0));
  const p1 = add2(base, mul2(e.n, off1));
  const nrm: Vec3 = [e.d[0] * dir, e.d[1] * dir, 0];
  return makeFace([[v3(p0, z0), v3(p1, z0), v3(p1, z1), v3(p0, z1)]], nrm, v3(p0, 0), [e.n[0], e.n[1], 0], UP, kind, paint, pick, map, tint);
}

/** A horizontal face along edge `e` at height z, between offsets off0..off1, facing up or down. */
function hface(e: Edge, s0: number, s1: number, off0: number, off1: number, z: number, up: boolean, kind: FaceKind, paint: string, pick: number, map: boolean, tint = 1): Face {
  const q = (s: number, off: number): Vec3 => v3(add2(add2(e.a, mul2(e.d, s)), mul2(e.n, off)), z);
  return makeFace([[q(s0, off0), q(s1, off0), q(s1, off1), q(s0, off1)]], up ? UP : DOWN, q(s0, off0), [e.d[0], e.d[1], 0], [e.n[0], e.n[1], 0], kind, paint, pick, map, tint);
}

/** Where two lines (point + unit direction) cross; null when (nearly) parallel — a wall in line with the glazing, within rounding. */
function cross(p: P2, d: P2, q: P2, e: P2): P2 | null {
  const den = cross2(d, e);
  if (Math.abs(den) < 0.03) return null;
  const t = cross2(sub2(q, p), e) / den;
  return add2(p, mul2(d, t));
}

/** Runs of consecutive glazed edges (the house wall, edge 0, never is one). */
function glazedChains(g: PlanGeom): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < g.kinds.length; i += 1) {
    if (g.kinds[i] === 'glazing') cur.push(i);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * The chain's outline pushed `off` mm into the room: mitred between its own edges,
 * ending on the face of the neighbouring walls. `capStart` / `capEnd` mark ends
 * that meet a wall in line with the glazing (the box needs an end face there).
 */
function offsetChain(g: PlanGeom, chain: readonly number[], off: number): { pts: P2[]; capStart: boolean; capEnd: boolean } {
  const n = g.kinds.length;
  const first = edgeInfo(g, chain[0]!);
  const last = edgeInfo(g, chain[chain.length - 1]!);
  const before = edgeInfo(g, (chain[0]! - 1 + n) % n);
  const after = edgeInfo(g, (chain[chain.length - 1]! + 1) % n);
  const pts: P2[] = [];
  const startHit = cross(add2(first.a, mul2(first.n, off)), first.d, before.a, before.d);
  pts.push(startHit ?? add2(first.a, mul2(first.n, off)));
  for (let k = 0; k + 1 < chain.length; k += 1) {
    const e0 = edgeInfo(g, chain[k]!);
    const e1 = edgeInfo(g, chain[k + 1]!);
    pts.push(cross(add2(e0.a, mul2(e0.n, off)), e0.d, add2(e1.a, mul2(e1.n, off)), e1.d) ?? add2(e0.b, mul2(e0.n, off)));
  }
  const endHit = cross(add2(last.a, mul2(last.n, off)), last.d, after.a, after.d);
  pts.push(endHit ?? add2(last.b, mul2(last.n, off)));
  return { pts, capStart: !startHit, capEnd: !endHit };
}

type Emit = (s0: number, s1: number, z0: number, z1: number, off: number, tint: number) => void;

/**
 * The outer frame of a window — jambs, top and bottom bars, mullions and an optional
 * transom — as bars that never overlap (coplanar overlaps would flicker by depth).
 * `cuts` are the mullion centres along the window, `transom` the height of a cross bar.
 */
function frameBars(emit: Emit, len: number, zb: number, zt: number, cuts: readonly number[], transom: number | null, off: number): void {
  emit(0, FRAME_W, zb, zt, off, 1);
  emit(len - FRAME_W, len, zb, zt, off, 1);
  const edges = [FRAME_W, ...cuts.flatMap((c) => [c - MULLION_W / 2, c + MULLION_W / 2]), len - FRAME_W];
  for (let k = 0; k + 1 < edges.length; k += 2) {
    const a = edges[k]!;
    const b = edges[k + 1]!;
    emit(a, b, zt - FRAME_W, zt, off, 1);
    emit(a, b, zb, zb + FRAME_W, off, 1);
    if (transom !== null) emit(a, b, transom - MULLION_W / 2, transom + MULLION_W / 2, off, 1);
  }
  for (const c of cuts) {
    const s0 = c - MULLION_W / 2;
    const s1 = c + MULLION_W / 2;
    if (transom === null) {
      emit(s0, s1, zb + FRAME_W, zt - FRAME_W, off, 1);
    } else {
      emit(s0, s1, zb + FRAME_W, transom - MULLION_W / 2, off, 1);
      emit(s0, s1, transom - MULLION_W / 2, transom + MULLION_W / 2, off, 1);
      emit(s0, s1, transom + MULLION_W / 2, zt - FRAME_W, off, 1);
    }
  }
}

/** A sash: a narrower frame round the pane s0..s1 x z0..z1, bars not overlapping. */
function sashBars(emit: Emit, s0: number, s1: number, z0: number, z1: number, off: number): void {
  emit(s0, s0 + SASH_W, z0, z1, off, 0.97);
  emit(s1 - SASH_W, s1, z0, z1, off, 0.97);
  emit(s0 + SASH_W, s1 - SASH_W, z0, z0 + SASH_W, off, 0.97);
  emit(s0 + SASH_W, s1 - SASH_W, z1 - SASH_W, z1, off, 0.97);
}

/** Frames, sashes, handles and glass of one glazed edge. */
function glazingFaces(e: Edge, zb: number, zt: number, transom: number | null, out: Face[]): void {
  const frame: Emit = (s0, s1, z0, z1, off, tint) => {
    if (s1 - s0 > 1 && z1 - z0 > 1) out.push(vface(e, off, s0, s1, z0, z1, 'frame', 'P:frame', PICK.frame, false, tint));
  };
  out.push(vface(e, -GLASS_SET, 0, e.len, zb, zt, 'glass', '', PICK.frame, false));
  const units = Math.max(1, Math.round(e.len / UNIT));
  const cuts = Array.from({ length: units - 1 }, (_, k) => ((k + 1) * e.len) / units);
  frameBars(frame, e.len, zb, zt, cuts, transom, 0);
  const bounds = [FRAME_W, ...cuts.flatMap((c) => [c - MULLION_W / 2, c + MULLION_W / 2]), e.len - FRAME_W];
  for (let k = 0; k < units; k += 1) {
    const s0 = bounds[2 * k]!;
    const s1 = bounds[2 * k + 1]!;
    const panes: [number, number][] = transom === null ? [[zb + FRAME_W, zt - FRAME_W]] : [[zb + FRAME_W, transom - MULLION_W / 2], [transom + MULLION_W / 2, zt - FRAME_W]];
    panes.forEach(([z0, z1], pi) => {
      // Depth of the frame around the pane (frame face -> glass).
      out.push(sideFace(e, s0, 0, -GLASS_SET, z0, z1, 1, 'frame', 'P:frame', PICK.frame, false, 0.8));
      out.push(sideFace(e, s1, 0, -GLASS_SET, z0, z1, -1, 'frame', 'P:frame', PICK.frame, false, 0.8));
      out.push(hface(e, s0, s1, 0, -GLASS_SET, z0, true, 'frame', 'P:frame', PICK.frame, false, 0.9));
      out.push(hface(e, s0, s1, 0, -GLASS_SET, z1, false, 'frame', 'P:frame', PICK.frame, false, 0.72));
      // The sash: a narrower frame just behind the outer one, on the main (upper) panes.
      if (pi === panes.length - 1 && s1 - s0 > 3 * SASH_W) {
        sashBars(frame, s0, s1, z0, z1, -14);
        // A handle on every other sash, on its side next to the mullion.
        if (k % 2 === 0 && units > 1) {
          const hs = k === units - 1 ? s0 + SASH_W * 0.5 : s1 - SASH_W * 0.5;
          const hz = Math.min(z1 - 250, z0 + (z1 - z0) * 0.45);
          frame(hs - 11, hs + 11, hz - 60, hz + 70, 22, 1.05);
        }
      }
    });
  }
}

/** The balcony block in the house wall: reveals, frames, curtains behind the glass, drip sill. */
function openingFaces(e: Edge, o: { kind: 'door' | 'window'; from: number; to: number }, zt: number, out: Face[]): Vec3[] {
  const zb = o.kind === 'door' ? 0 : HOUSE_WINDOW_BOTTOM;
  const hole = vrect(e, 0, o.from, o.to, zb, zt);
  const wall = 'P:w1';
  const fo = -REVEAL; // the block's frame plane
  const back = fo - 8; // the curtain, just behind it: reveals run on to here, so no gap shows
  // Reveals take the wall's finish and light.
  out.push(sideFace(e, o.from, 0, back, zb, zt, 1, 'paint', wall, 1, true));
  out.push(sideFace(e, o.to, 0, back, zb, zt, -1, 'paint', wall, 1, true));
  out.push(hface(e, o.from, o.to, 0, back, zt, false, 'paint', wall, 1, true));
  if (o.kind === 'window') {
    out.push(hface(e, o.from - 20, o.to + 20, back, DRIP_OUT, zb, true, 'white', '', 0, false, 0.92));
    out.push(vface(e, DRIP_OUT, o.from - 20, o.to + 20, zb - 28, zb, 'white', '', 0, false, 0.82));
  } else {
    // The threshold continues the balcony floor under the door.
    out.push(hface(e, o.from, o.to, 0, back, 1, true, 'paint', 'P:floor', PICK.floor, true));
  }
  const white: Emit = (s0, s1, z0, z1, off, tint) => {
    if (s1 - s0 > 1 && z1 - z0 > 1) out.push(vface(e, off, s0, s1, z0, z1, 'white', '', 0, false, 0.96 * tint));
  };
  const L = o.to - o.from;
  // Tulle behind the glass.
  out.push(vface(e, back, o.from, o.to, zb, zt, 'curtain', '', 0, false));
  // Frame bars in the block's own coordinates (0 at `from`).
  const local: Emit = (s0, s1, z0, z1, off, tint) => white(o.from + s0, o.from + s1, z0, z1, fo + off, tint);
  if (o.kind === 'door') {
    // A glazed balcony door: a solid leaf below the window line, glass above it.
    const split = HOUSE_WINDOW_BOTTOM;
    local(0, FRAME_W, 0, zt, 0, 1);
    local(L - FRAME_W, L, 0, zt, 0, 1);
    local(FRAME_W, L - FRAME_W, zt - FRAME_W, zt, 0, 1);
    local(FRAME_W, L - FRAME_W, 0, 24, 0, 1);
    local(FRAME_W, L - FRAME_W, 24, split, 6, 0.93);
    local(FRAME_W, L - FRAME_W, split, split + MULLION_W, 0, 1);
    sashBars(local, FRAME_W, L - FRAME_W, split + MULLION_W, zt - FRAME_W, 10);
    local(L - FRAME_W - SASH_W / 2 - 11, L - FRAME_W - SASH_W / 2 + 11, 980, 1130, 30, 1.02);
  } else {
    const cuts = L > 900 ? [L / 2] : [];
    frameBars(local, L, zb, zt, cuts, null, 0);
    const bounds = [FRAME_W, ...cuts.flatMap((c) => [c - MULLION_W / 2, c + MULLION_W / 2]), L - FRAME_W];
    for (let k = 0; k + 1 < bounds.length; k += 2) sashBars(local, bounds[k]!, bounds[k + 1]!, zb + FRAME_W, zt - FRAME_W, 10);
  }
  return hole;
}

export interface RoomModel {
  readonly faces: readonly Face[];
  /** Window (glass) rectangles: the daylight sources. */
  readonly windows: readonly (readonly Vec3[])[];
  /** Where the ceiling lights hang (points on the ceiling), in a row along the room. */
  readonly lamps: readonly Vec3[];
}

/** Ceiling lights: a row along the room, about one per 1.5 m (the app hangs several along a long loggia). */
function lampRowAt(g: PlanGeom): Vec3[] {
  const xs = g.poly.map((p) => p[0]);
  const x0 = Math.min(...xs);
  const len = Math.max(...xs) - x0;
  const n = Math.max(1, Math.min(4, Math.round(len / 1500)));
  return Array.from({ length: n }, (_, k) => {
    const x = x0 + ((k + 0.5) * len) / n;
    const [lo, hi] = section(g.poly, x);
    return [x, (lo + hi) / 2, g.ceilingH] as const;
  });
}

/** Vertical extent of the outline at `x`: [min y, max y]. */
export function section(poly: readonly Pt[], x: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
    const y = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  return lo <= hi ? [lo, hi] : [0, 0];
}

/** Build the room of a plan. */
export function buildRoom(g: PlanGeom): RoomModel {
  const faces: Face[] = [];
  const windows: Vec3[][] = [];
  const H = g.ceilingH;
  const P = g.floorGlazing ? 0 : g.parapetH;
  const n = g.kinds.length;

  // Walls.
  for (let i = 0; i < n; i += 1) {
    const kind = g.kinds[i]!;
    if (kind === 'glazing') continue;
    const e = edgeInfo(g, i);
    const paint = `P:w${i + 1}`;
    const holes: Vec3[][] = [];
    if (kind === 'house') {
      const top = Math.min(DOOR_TOP, H - 250);
      for (const o of g.openings) holes.push(openingFaces(e, o, top, faces));
    }
    faces.push(makeFace([vrect(e, 0, 0, e.len, 0, H), ...holes], [e.n[0], e.n[1], 0], v3(e.a, 0), [e.d[0], e.d[1], 0], UP, 'paint', paint, i + 1, true));
  }

  // Glazing runs: parapet + sill (unless the windows go to the floor), frames, glass.
  for (const chain of glazedChains(g)) {
    if (P > 0) {
      const box = offsetChain(g, chain, PARAPET_D);
      const sill = offsetChain(g, chain, SILL_D);
      const zTop = P - SILL_T;
      chain.forEach((i, k) => {
        const e = edgeInfo(g, i);
        const p0 = box.pts[k]!;
        const p1 = box.pts[k + 1]!;
        faces.push(makeFace([[v3(p0, 0), v3(p1, 0), v3(p1, zTop), v3(p0, zTop)]], [e.n[0], e.n[1], 0], v3(p0, 0), [e.d[0], e.d[1], 0], UP, 'paint', `P:w${i + 1}`, i + 1, true));
        const s0 = sill.pts[k]!;
        const s1 = sill.pts[k + 1]!;
        faces.push(makeFace([[v3(s0, zTop), v3(s1, zTop), v3(s1, P), v3(s0, P)]], [e.n[0], e.n[1], 0], v3(s0, zTop), [e.d[0], e.d[1], 0], UP, 'paint', 'P:sill', PICK.sill, false));
      });
      // Sill top: from the frames to the sill's front edge.
      const back: P2[] = [edgeInfo(g, chain[0]!).a, ...chain.map((i) => edgeInfo(g, i).b)];
      const top = [...back.map((p) => v3(p, P)), ...[...sill.pts].reverse().map((p) => v3(p, P))];
      const e0 = edgeInfo(g, chain[0]!);
      faces.push(makeFace([top], UP, v3(e0.a, P), [e0.d[0], e0.d[1], 0], [e0.n[0], e0.n[1], 0], 'paint', 'P:sill', PICK.sill, true));
      // End caps where the run meets a wall in line with it (the Утюжок's 700 concrete).
      const cap = (at: P2, inward: P2, along: P2, dir: 1 | -1, edge: number): void => {
        const q0 = at;
        const qb = add2(at, mul2(inward, PARAPET_D));
        const qs = add2(at, mul2(inward, SILL_D));
        const nrm: Vec3 = [along[0] * dir, along[1] * dir, 0];
        faces.push(makeFace([[v3(q0, 0), v3(qb, 0), v3(qb, zTop), v3(q0, zTop)]], nrm, v3(q0, 0), [inward[0], inward[1], 0], UP, 'paint', `P:w${edge + 1}`, edge + 1, false));
        faces.push(makeFace([[v3(q0, zTop), v3(qs, zTop), v3(qs, P), v3(q0, P)]], nrm, v3(q0, zTop), [inward[0], inward[1], 0], UP, 'paint', 'P:sill', PICK.sill, false));
      };
      if (box.capStart) cap(e0.a, e0.n, e0.d, -1, chain[0]!);
      const eL = edgeInfo(g, chain[chain.length - 1]!);
      if (box.capEnd) cap(eL.b, eL.n, eL.d, 1, chain[chain.length - 1]!);
    }
    for (const i of chain) {
      const e = edgeInfo(g, i);
      glazingFaces(e, P, H, g.floorGlazing ? g.parapetH : null, faces);
      windows.push(vrect(e, 0, 0, e.len, P, H));
    }
  }

  // Skirting board along the walls and in front of the parapets (not across a door).
  for (let i = 0; i < n; i += 1) {
    const kind = g.kinds[i]!;
    if (kind === 'glazing') continue;
    const e = edgeInfo(g, i);
    let spans: [number, number][] = [[0, e.len]];
    if (kind === 'house') {
      for (const o of g.openings) {
        if (o.kind !== 'door') continue;
        spans = spans.flatMap(([a, b]) => (o.to <= a || o.from >= b ? [[a, b] as [number, number]] : [[a, Math.max(a, o.from)], [Math.min(b, o.to), b]] as [number, number][])).filter(([a, b]) => b - a > 20);
      }
    }
    for (const [a, b] of spans) {
      faces.push(vface(e, PLINTH_D, a, b, 0, PLINTH_H, 'paint', 'P:plintus', PICK.plinth, false));
      faces.push(hface(e, a, b, 0, PLINTH_D, PLINTH_H, true, 'paint', 'P:plintus', PICK.plinth, false));
    }
  }
  if (P > 0) {
    for (const chain of glazedChains(g)) {
      const base = offsetChain(g, chain, PARAPET_D);
      const front = offsetChain(g, chain, PARAPET_D + PLINTH_D);
      chain.forEach((i, k) => {
        const e = edgeInfo(g, i);
        const a = front.pts[k]!;
        const b = front.pts[k + 1]!;
        faces.push(makeFace([[v3(a, 0), v3(b, 0), v3(b, PLINTH_H), v3(a, PLINTH_H)]], [e.n[0], e.n[1], 0], v3(a, 0), [e.d[0], e.d[1], 0], UP, 'paint', 'P:plintus', PICK.plinth, false));
        const c = base.pts[k]!;
        const d = base.pts[k + 1]!;
        faces.push(makeFace([[v3(c, PLINTH_H), v3(d, PLINTH_H), v3(b, PLINTH_H), v3(a, PLINTH_H)]], UP, v3(c, PLINTH_H), [e.d[0], e.d[1], 0], [e.n[0], e.n[1], 0], 'paint', 'P:plintus', PICK.plinth, false));
      });
    }
  }

  // Floor and ceiling (planks / boards run along the balcony).
  faces.push(makeFace([g.poly.map((p) => v3(p, 0))], UP, [0, 0, 0], [0, 1, 0], [1, 0, 0], 'paint', 'P:floor', PICK.floor, true));
  faces.push(makeFace([g.poly.map((p) => v3(p, H))], DOWN, [0, 0, H], [0, 1, 0], [1, 0, 0], 'paint', 'P:ceiling', PICK.ceiling, true));

  return { faces, windows, lamps: lampRowAt(g) };
}

/**
 * The two views, as in the app: from each end of the balcony along its length, at
 * eye height, a little way in from the end wall and in the middle of the room
 * there. View 0 looks towards -x from the +x end, view 1 towards +x from the -x end.
 */
export function roomCameras(g: PlanGeom): readonly [CameraSpec, CameraSpec] {
  const xs = g.poly.map((p) => p[0]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const inset = Math.max(320, Math.min(520, (x1 - x0) * 0.1));
  // Median of the section midlines along the room.
  const mids: number[] = [];
  for (let k = 0; k <= 40; k += 1) {
    const [lo, hi] = section(g.poly, x0 + 1 + ((x1 - x0 - 2) * k) / 40);
    mids.push((lo + hi) / 2);
  }
  mids.sort((a, b) => a - b);
  const axisY = mids[Math.floor(mids.length / 2)]!;
  const place = (dir: 1 | -1): CameraSpec => {
    const x = dir === 1 ? x0 + inset : x1 - inset;
    const [lo, hi] = section(g.poly, x);
    // The room's main axis (a bay at one end must not pull the eye into it), kept clear of the walls.
    const y = Math.max(lo + 300, Math.min(hi - 300, axisY));
    return { x, y, z: EYE, fx: dir, fy: 0, fov: FOV };
  };
  return [place(-1), place(1)];
}

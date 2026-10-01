/**
 * @file The app's six ceiling lights as small meshes, hung in a row along the room
 * (the app puts several along a long loggia): 1 pendant dome, 2 flat round light,
 * 3 cylinder spot, 4 caged bulb pendant, 5 / 6 rail with three spots (black /
 * white). Glowing parts are `emit` faces; the renderer adds a soft bloom around them.
 */
import { PICK } from './types';
import type { Face, Vec3 } from './types';

export interface LampPart {
  readonly face: Face;
  /** Glowing (the lit bulb or opening) rather than lit by the room. */
  readonly emit: boolean;
  /** Fixed albedo of lit parts. */
  readonly rgb: readonly [number, number, number];
}

export interface LampSet {
  readonly parts: readonly LampPart[];
  /** World points that glow: the renderer blooms around them. */
  readonly glows: readonly { readonly at: Vec3; readonly radius: number; readonly strength: number }[];
}

const WHITE: readonly [number, number, number] = [0.9, 0.9, 0.89];
const BLACK: readonly [number, number, number] = [0.1, 0.1, 0.11];
const DARK: readonly [number, number, number] = [0.16, 0.16, 0.17];
const EMIT: readonly [number, number, number] = [1, 0.96, 0.86];
const SEG = 20;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A convex polygon facing `n` (the outward direction), as a face. */
function poly(pts: readonly Vec3[], n: Vec3): Face {
  const u = norm3(Math.abs(n[2]) > 0.9 ? [1, 0, 0] : cross3(n, [0, 0, 1]));
  return { loops: [pts], n, o: pts[0]!, u, v: norm3(cross3(n, u)), kind: 'lamp', paint: '', pick: PICK.light, map: false, tint: 1 };
}

/** A quad whose normal is made to point away from `from` (a point inside the solid). */
function quadOut(a: Vec3, b: Vec3, c: Vec3, d: Vec3, from: Vec3): Face {
  let n = norm3(cross3(sub(b, a), sub(d, a)));
  const mid: Vec3 = [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + b[2] + c[2] + d[2]) / 4];
  const away = sub(mid, from);
  if (n[0] * away[0] + n[1] * away[1] + n[2] * away[2] < 0) n = [-n[0], -n[1], -n[2]];
  return poly([a, b, c, d], n);
}

function ring(cx: number, cy: number, r: number, z: number, n = SEG): Vec3[] {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as const;
  });
}

/** A surface of revolution round the vertical axis through (cx, cy): profile = [radius, z] pairs. */
function revolve(cx: number, cy: number, profile: readonly (readonly [number, number])[], rgb: readonly [number, number, number], out: LampPart[], emit = false): void {
  for (let i = 0; i + 1 < profile.length; i += 1) {
    const [r0, z0] = profile[i]!;
    const [r1, z1] = profile[i + 1]!;
    const a = ring(cx, cy, r0, z0);
    const b = ring(cx, cy, r1, z1);
    const inside: Vec3 = [cx, cy, (z0 + z1) / 2];
    for (let k = 0; k < SEG; k += 1) {
      const k1 = (k + 1) % SEG;
      out.push({ face: quadOut(a[k]!, a[k1]!, b[k1]!, b[k]!, inside), emit, rgb });
    }
  }
}

/** A disc facing down (glowing opening) or up. */
function disc(cx: number, cy: number, r: number, z: number, down: boolean, emit: boolean, rgb: readonly [number, number, number], out: LampPart[]): void {
  out.push({ face: poly(ring(cx, cy, r, z), down ? [0, 0, -1] : [0, 0, 1]), emit, rgb });
}

/** A thin vertical cord: two crossing quads (visible from every side). */
function cord(cx: number, cy: number, z0: number, z1: number, rgb: readonly [number, number, number], out: LampPart[]): void {
  const w = 4;
  for (const [dx, dy] of [[w, 0], [0, w]] as const) {
    const f = poly([[cx - dx, cy - dy, z0], [cx + dx, cy + dy, z0], [cx + dx, cy + dy, z1], [cx - dx, cy - dy, z1]], norm3([dy, -dx, 0]));
    out.push({ face: f, emit: false, rgb }, { face: { ...f, n: [-f.n[0], -f.n[1], 0] }, emit: false, rgb });
  }
}

/** A box between two corners, without its top (it hangs under the ceiling). */
function hangingBox(x0: number, x1: number, y0: number, y1: number, zTop: number, zBot: number, rgb: readonly [number, number, number], out: LampPart[]): void {
  const mid: Vec3 = [(x0 + x1) / 2, (y0 + y1) / 2, (zTop + zBot) / 2];
  out.push({ face: poly([[x0, y0, zBot], [x1, y0, zBot], [x1, y1, zBot], [x0, y1, zBot]], [0, 0, -1]), emit: false, rgb });
  out.push({ face: quadOut([x0, y0, zBot], [x1, y0, zBot], [x1, y0, zTop], [x0, y0, zTop], mid), emit: false, rgb });
  out.push({ face: quadOut([x0, y1, zBot], [x1, y1, zBot], [x1, y1, zTop], [x0, y1, zTop], mid), emit: false, rgb });
  out.push({ face: quadOut([x0, y0, zBot], [x0, y1, zBot], [x0, y1, zTop], [x0, y0, zTop], mid), emit: false, rgb });
  out.push({ face: quadOut([x1, y0, zBot], [x1, y1, zBot], [x1, y1, zTop], [x1, y0, zTop], mid), emit: false, rgb });
}

/** One light of model 1..6 hanging from the ceiling (height H) at (x, y). */
function oneLamp(model: number, x: number, y: number, H: number): LampSet {
  const parts: LampPart[] = [];
  const glows: { at: Vec3; radius: number; strength: number }[] = [];
  switch (model) {
    case 1: {
      // Pendant dome: a cord, a white shade, the lit opening.
      cord(x, y, H, H - 420, DARK, parts);
      revolve(x, y, [[30, H - 420], [70, H - 436], [120, H - 480], [165, H - 560], [188, H - 640], [192, H - 665]], WHITE, parts);
      disc(x, y, 178, H - 664, true, true, EMIT, parts);
      glows.push({ at: [x, y, H - 660], radius: 900, strength: 0.3 });
      break;
    }
    case 2: {
      // Flat round light.
      revolve(x, y, [[175, H], [175, H - 26]], WHITE, parts);
      const outer = ring(x, y, 175, H - 26);
      const inner = ring(x, y, 150, H - 26);
      for (let k = 0; k < SEG; k += 1) parts.push({ face: poly([outer[k]!, outer[(k + 1) % SEG]!, inner[(k + 1) % SEG]!, inner[k]!], [0, 0, -1]), emit: false, rgb: WHITE });
      disc(x, y, 150, H - 27, true, true, EMIT, parts);
      glows.push({ at: [x, y, H - 60], radius: 950, strength: 0.34 });
      break;
    }
    case 3: {
      // Cylinder spot.
      revolve(x, y, [[64, H], [64, H - 110]], WHITE, parts);
      const outer = ring(x, y, 64, H - 110);
      const inner = ring(x, y, 50, H - 110);
      for (let k = 0; k < SEG; k += 1) parts.push({ face: poly([outer[k]!, outer[(k + 1) % SEG]!, inner[(k + 1) % SEG]!, inner[k]!], [0, 0, -1]), emit: false, rgb: WHITE });
      disc(x, y, 50, H - 111, true, true, EMIT, parts);
      glows.push({ at: [x, y, H - 130], radius: 800, strength: 0.3 });
      break;
    }
    case 4: {
      // Caged bulb pendant.
      cord(x, y, H, H - 380, DARK, parts);
      revolve(x, y, [[22, H - 380], [22, H - 450]], DARK, parts);
      // The cage: eight thin bars and two rings.
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        const cx = x + Math.cos(a) * 88;
        const cy = y + Math.sin(a) * 88;
        const tx = -Math.sin(a) * 6;
        const ty = Math.cos(a) * 6;
        const f = poly([[cx - tx, cy - ty, H - 450], [cx + tx, cy + ty, H - 450], [cx + tx, cy + ty, H - 650], [cx - tx, cy - ty, H - 650]], [Math.cos(a), Math.sin(a), 0]);
        parts.push({ face: f, emit: false, rgb: DARK }, { face: { ...f, n: [-f.n[0], -f.n[1], 0] }, emit: false, rgb: DARK });
      }
      revolve(x, y, [[90, H - 640], [90, H - 654]], DARK, parts);
      revolve(x, y, [[90, H - 520], [90, H - 530]], DARK, parts);
      // The bulb.
      revolve(x, y, [[22, H - 456], [48, H - 500], [50, H - 560], [30, H - 610]], EMIT, parts, true);
      disc(x, y, 30, H - 611, true, true, EMIT, parts);
      glows.push({ at: [x, y, H - 540], radius: 950, strength: 0.32 });
      break;
    }
    default: {
      // Rail with three spots; black (5) or white (6).
      const body = model === 5 ? BLACK : WHITE;
      hangingBox(x - 500, x + 500, y - 15, y + 15, H, H - 30, body, parts);
      for (const dx of [-330, 0, 330]) {
        const sx = x + dx;
        revolve(sx, y, [[9, H - 30], [9, H - 110]], body, parts);
        revolve(sx, y, [[44, H - 110], [44, H - 240]], body, parts);
        disc(sx, y, 34, H - 241, true, true, EMIT, parts);
        glows.push({ at: [sx, y, H - 250], radius: 620, strength: 0.2 });
      }
      break;
    }
  }
  return { parts, glows };
}

/** The lamps of a row: one set of meshes + glows for every position. */
export function lampRow(model: number, positions: readonly Vec3[]): LampSet {
  const parts: LampPart[] = [];
  const glows: LampSet['glows'][number][] = [];
  for (const p of positions) {
    const s = oneLamp(model, p[0], p[1], p[2]);
    parts.push(...s.parts);
    glows.push(...s.glows);
  }
  return { parts, glows };
}

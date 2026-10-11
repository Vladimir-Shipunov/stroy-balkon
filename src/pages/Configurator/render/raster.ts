/**
 * @file The per-pixel rasteriser. Every face is a plane, so along a pixel's ray
 * t = num / (a·x + b·y + c) and the face's (u, v) are linear in t — exact
 * perspective with a handful of operations per pixel. Faces are filled scanline by
 * scanline with the even-odd rule (so holes — the door and window openings — come
 * for free), depth-tested in a float buffer, shaded from a mipmapped texture or a
 * colour times the baked light, and their surface id is kept for the tap targets.
 */
import type { LightMap } from './lighting';
import type { CameraSpec, EnvData, Face, SpriteMap, TexData, UnitImage, UnitMap, Vec3 } from './types';
import { FRAME_SHADE_MAX, sampleSprite, sampleUnit, unitPixel } from './units';

export interface Target {
  readonly w: number;
  readonly h: number;
  readonly rgb: Float32Array;
  readonly depth: Float32Array;
  readonly ids: Uint8Array;
}

export function makeTarget(w: number, h: number): Target {
  const rgb = new Float32Array(w * h * 3).fill(0.35);
  return { w, h, rgb, depth: new Float32Array(w * h).fill(Infinity), ids: new Uint8Array(w * h) };
}

/** Clear a target for a new picture (the buffers are reused between renders). */
export function resetTarget(t: Target): void {
  t.rgb.fill(0.35);
  t.depth.fill(Infinity);
  t.ids.fill(0);
}

export interface Basis {
  readonly C: Vec3;
  readonly R: Vec3;
  readonly Up: Vec3;
  readonly Fw: Vec3;
  readonly F: number;
  readonly cx: number;
  readonly cy: number;
}

const NEAR = 30;

export function makeBasis(cam: CameraSpec, w: number, h: number): Basis {
  const l = Math.hypot(cam.fx, cam.fy) || 1;
  const fx = cam.fx / l;
  const fy = cam.fy / l;
  return { C: [cam.x, cam.y, cam.z], Fw: [fx, fy, 0], R: [fy, -fx, 0], Up: [0, 0, 1], F: w / 2 / Math.tan(cam.fov / 2), cx: w / 2, cy: h / 2 };
}

/** Screen position (target pixels) of a world point, or null when it is behind the eye. */
export function project(bs: Basis, p: Vec3): [number, number] | null {
  const rx = p[0] - bs.C[0];
  const ry = p[1] - bs.C[1];
  const rz = p[2] - bs.C[2];
  const z = rx * bs.Fw[0] + ry * bs.Fw[1] + rz * bs.Fw[2];
  if (z < NEAR) return null;
  const x = rx * bs.R[0] + ry * bs.R[1] + rz * bs.R[2];
  return [bs.cx + (bs.F * x) / z, bs.cy - (bs.F * rz) / z];
}

/**
 * The light of a lamp on what surrounds it: every pixel whose surface point lies
 * within `radiusMm` of the glowing point is brightened, falling off with the real
 * distance (a pool of light on the ceiling and nearby walls — nothing on what merely
 * lies behind the lamp in the picture), plus a small halo right round the source.
 */
export function addGlow(t: Target, bs: Basis, at: Vec3, radiusMm: number, strength: number): void {
  const rx = at[0] - bs.C[0];
  const ry = at[1] - bs.C[1];
  const rz = at[2] - bs.C[2];
  const z = rx * bs.Fw[0] + ry * bs.Fw[1] + rz * bs.Fw[2];
  if (z < NEAR) return;
  const sx = bs.cx + (bs.F * (rx * bs.R[0] + ry * bs.R[1] + rz * bs.R[2])) / z;
  const sy = bs.cy - (bs.F * rz) / z;
  // Screen bound of the lit sphere (generous when the lamp is close).
  const R = (bs.F * radiusMm) / Math.max(NEAR, z - radiusMm * 0.6);
  const halo = (bs.F * radiusMm * 0.22) / z;
  const x0 = Math.max(0, Math.floor(sx - R));
  const x1 = Math.min(t.w - 1, Math.ceil(sx + R));
  const y0 = Math.max(0, Math.floor(sy - R));
  const y1 = Math.min(t.h - 1, Math.ceil(sy + R));
  const inv = 1 / radiusMm;
  const zMin = (z * 0.9) / bs.F;
  for (let y = y0; y <= y1; y += 1) {
    const uy = bs.cy - (y + 0.5);
    for (let x = x0; x <= x1; x += 1) {
      const i = y * t.w + x;
      const tt = t.depth[i]!;
      if (tt === Infinity) continue;
      const ux = x + 0.5 - bs.cx;
      // The surface point of this pixel, relative to the lamp.
      const px = (bs.R[0] * ux + bs.Fw[0] * bs.F) * tt - rx;
      const py = (bs.R[1] * ux + bs.Fw[1] * bs.F) * tt - ry;
      const pz = uy * tt - rz;
      const d = Math.sqrt(px * px + py * py + pz * pz) * inv;
      let k = 0;
      if (d < 1) {
        const f = 1 - d * d;
        k = strength * f * f;
      }
      if (tt >= zMin) {
        const hx = (x + 0.5 - sx) / halo;
        const hy = (y + 0.5 - sy) / halo;
        const h2 = hx * hx + hy * hy;
        if (h2 < 1) k += strength * 0.7 * (1 - h2) * (1 - h2);
      }
      if (k <= 0) continue;
      const o = i * 3;
      t.rgb[o] = t.rgb[o]! + k;
      t.rgb[o + 1] = t.rgb[o + 1]! + k * 0.94;
      t.rgb[o + 2] = t.rgb[o + 2]! + k * 0.8;
    }
  }
}

/** How a face is shaded. */
export const Mode = { Texture: 0, Flat: 1, Glass: 2, Curtain: 3, Emit: 4, Unit: 5, Sprite: 6 } as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

export interface Shade {
  readonly mode: Mode;
  /** Albedo (Flat, Curtain tint, Emit colour) or the texture's tint. */
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly tex: TexData | null;
  /** World size of one texture tile, mm. */
  readonly tile: number;
  readonly lm: LightMap | null;
  readonly light: number;
  readonly env: EnvData | null;
  /** Sheen strength (0 = matte): a Fresnel glow that grows towards grazing angles, as on varnished floors. */
  readonly gloss?: number;
  /** `Unit` faces: the window image and its placement; `recolor` multiplies the image's grey shading by (r, g, b), else it is shown as is. */
  readonly img?: UnitImage | null;
  readonly unit?: UnitMap | null;
  readonly recolor?: boolean;
  /** `Sprite` faces: a plain decor image and its placement. */
  readonly sprite?: SpriteMap | null;
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Pixel-ray coefficients of a vector: dot(V, dir(px, py)) = a·px + b·py + c. */
function lin(bs: Basis, V: Vec3): [number, number, number] {
  const a = dot(V, bs.R);
  const b = -dot(V, bs.Up);
  return [a, b, dot(V, bs.Fw) * bs.F - a * bs.cx - b * bs.cy];
}

interface ScreenEdge {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Near-clip one loop in camera space and project it; returns its screen edges. */
function projectLoop(bs: Basis, loop: readonly Vec3[], out: ScreenEdge[], bounds: number[]): void {
  const cam: [number, number, number][] = loop.map((p) => {
    const rx = p[0] - bs.C[0];
    const ry = p[1] - bs.C[1];
    const rz = p[2] - bs.C[2];
    return [rx * bs.R[0] + ry * bs.R[1] + rz * bs.R[2], rx * bs.Up[0] + ry * bs.Up[1] + rz * bs.Up[2], rx * bs.Fw[0] + ry * bs.Fw[1] + rz * bs.Fw[2]];
  });
  const clipped: [number, number, number][] = [];
  for (let i = 0; i < cam.length; i += 1) {
    const a = cam[i]!;
    const b = cam[(i + 1) % cam.length]!;
    const ain = a[2] >= NEAR;
    const bin = b[2] >= NEAR;
    if (ain) clipped.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      clipped.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), NEAR]);
    }
  }
  if (clipped.length < 3) return;
  const sp = clipped.map((c) => [bs.cx + (bs.F * c[0]) / c[2], bs.cy - (bs.F * c[1]) / c[2]] as const);
  for (let i = 0; i < sp.length; i += 1) {
    const a = sp[i]!;
    const b = sp[(i + 1) % sp.length]!;
    out.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1] });
    bounds[0] = Math.min(bounds[0]!, a[1]);
    bounds[1] = Math.max(bounds[1]!, a[1]);
  }
}

/** Draw one face into the target. */
export function drawFace(t: Target, bs: Basis, f: Face, s: Shade, pick: number): void {
  // Faces are one-sided: skip those seen from behind.
  const toCam: Vec3 = [bs.C[0] - f.o[0], bs.C[1] - f.o[1], bs.C[2] - f.o[2]];
  const num = -dot(f.n, toCam);
  if (num >= 0) return;
  const edges: ScreenEdge[] = [];
  const bounds = [Infinity, -Infinity];
  for (const loop of f.loops) projectLoop(bs, loop, edges, bounds);
  if (!edges.length) return;
  const W = t.w;
  const H = t.h;
  const y0 = Math.max(0, Math.ceil(bounds[0]! - 0.5));
  const y1 = Math.min(H - 1, Math.floor(bounds[1]! - 0.5));
  if (y1 < y0) return;
  const [na, nb, nc] = lin(bs, f.n);
  const [ua, ub, uc] = lin(bs, f.u);
  const [va, vb, vc] = lin(bs, f.v);
  const CO: Vec3 = [bs.C[0] - f.o[0], bs.C[1] - f.o[1], bs.C[2] - f.o[2]];
  const u0 = dot(CO, f.u);
  const v0 = dot(CO, f.v);
  const xs: number[] = [];
  for (let y = y0; y <= y1; y += 1) {
    const py = y + 0.5;
    xs.length = 0;
    for (const e of edges) {
      if ((e.y0 <= py && e.y1 > py) || (e.y1 <= py && e.y0 > py)) xs.push(e.x0 + ((py - e.y0) / (e.y1 - e.y0)) * (e.x1 - e.x0));
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let m = 0; m + 1 < xs.length; m += 2) {
      const xa = Math.max(0, Math.ceil(xs[m]! - 0.5));
      const xb = Math.min(W - 1, Math.floor(xs[m + 1]! - 0.5));
      if (xb < xa) continue;
      span(t, bs, s, pick, y, py, xa, xb, num, na, nb, nc, u0, ua, ub, uc, v0, va, vb, vc);
    }
  }
}

/** Shade one span of a face (all the per-pixel work lives here, in a plain function V8 optimises). */
function span(
  t: Target,
  bs: Basis,
  s: Shade,
  pick: number,
  y: number,
  py: number,
  xa: number,
  xb: number,
  num: number,
  na: number,
  nb: number,
  nc: number,
  u0: number,
  ua: number,
  ub: number,
  uc: number,
  v0: number,
  va: number,
  vb: number,
  vc: number,
): void {
  const depth = t.depth;
  const rgb = t.rgb;
  const ids = t.ids;
  const row = y * t.w;
  const px0 = xa + 0.5;
  let den = na * px0 + nb * py + nc;
  let ul = ua * px0 + ub * py + uc;
  let vl = va * px0 + vb * py + vc;
  const lm = s.lm;
  const mode = s.mode;
  const tex = s.tex;
  const tileInv = 1 / s.tile;
  for (let x = xa; x <= xb; x += 1, den += na, ul += ua, vl += va) {
    const tt = num / den;
    const idx = row + x;
    // A hair of tolerance: coplanar parts (frame bars that overlap in a corner) resolve to the
    // face drawn later, instead of flickering between the two by rounding error.
    if (!(tt > 0) || tt > depth[idx]! * 1.000003) continue;
    if (mode === Mode.Unit) {
      // A window image: see-through pixels (the glass of a frame profile) leave the depth untouched.
      const uu = u0 + tt * ul;
      const vv = v0 + tt * vl;
      const tx = num / (den + na);
      const ty = num / (den + nb);
      const foot = Math.max(Math.abs(u0 + tx * (ul + ua) - uu), Math.abs(u0 + ty * (ul + ub) - uu), Math.abs(v0 + tx * (vl + va) - vv), Math.abs(v0 + ty * (vl + vb) - vv));
      sampleUnit(s.img!, s.unit!, uu, vv, foot);
      if (unitPixel[3]! < 0.5) continue;
      depth[idx] = tt;
      ids[idx] = pick;
      const o = idx * 3;
      if (s.recolor) {
        const k = unitPixel[0]! * FRAME_SHADE_MAX * s.light;
        rgb[o] = s.r * k;
        rgb[o + 1] = s.g * k;
        rgb[o + 2] = s.b * k;
      } else {
        const k = 0.82 + 0.18 * s.light;
        rgb[o] = unitPixel[0]! * s.r * k;
        rgb[o + 1] = unitPixel[1]! * s.g * k;
        rgb[o + 2] = unitPixel[2]! * s.b * k;
      }
      continue;
    }
    if (mode === Mode.Sprite) {
      // A decor billboard: see-through pixels leave the depth untouched, same as a window image.
      const uu = u0 + tt * ul;
      const vv = v0 + tt * vl;
      const tx = num / (den + na);
      const ty = num / (den + nb);
      const foot = Math.max(Math.abs(u0 + tx * (ul + ua) - uu), Math.abs(u0 + ty * (ul + ub) - uu), Math.abs(v0 + tx * (vl + va) - vv), Math.abs(v0 + ty * (vl + vb) - vv));
      sampleSprite(s.img!, s.sprite!, uu, vv, foot);
      if (unitPixel[3]! < 0.5) continue;
      depth[idx] = tt;
      ids[idx] = pick;
      const o = idx * 3;
      const k = 0.82 + 0.18 * s.light;
      rgb[o] = unitPixel[0]! * s.r * k;
      rgb[o + 1] = unitPixel[1]! * s.g * k;
      rgb[o + 2] = unitPixel[2]! * s.b * k;
      continue;
    }
    depth[idx] = tt;
    ids[idx] = pick;
    const o = idx * 3;
    if (mode === Mode.Glass) {
      envSample(s, bs, x + 0.5, py, rgb, o);
      continue;
    }
    const u = u0 + tt * ul;
    const v = v0 + tt * vl;
    let L = s.light;
    if (lm) {
      let fu = (u - lm.u0) * lm.inv;
      let fv = (v - lm.v0) * lm.inv;
      if (fu < 0) fu = 0;
      else if (fu > lm.nu - 1.001) fu = lm.nu - 1.001;
      if (fv < 0) fv = 0;
      else if (fv > lm.nv - 1.001) fv = lm.nv - 1.001;
      const li = fu | 0;
      const lj = fv | 0;
      const la = fu - li;
      const lb = fv - lj;
      const D = lm.data;
      const k = lj * lm.nu + li;
      L = (D[k]! * (1 - la) + D[k + 1]! * la) * (1 - lb) + (D[k + lm.nu]! * (1 - la) + D[k + lm.nu + 1]! * la) * lb;
    }
    const gloss = s.gloss ?? 0;
    let sheen = 0;
    if (gloss > 0) {
      const ux2 = x + 0.5 - bs.cx;
      const uy2 = bs.cy - py;
      const cosT = Math.abs(den) / Math.sqrt(ux2 * ux2 + uy2 * uy2 + bs.F * bs.F);
      const q = 1 - cosT;
      sheen = gloss * q * q * q * q * 0.85 * L;
    }
    if (mode === Mode.Texture && tex) {
      // Mip level from the texel footprint of this pixel (next pixel along x and y).
      const tx = num / (den + na);
      const ty = num / (den + nb);
      const du = Math.max(Math.abs(u0 + tx * (ul + ua) - u), Math.abs(u0 + ty * (ul + ub) - u));
      const dv = Math.max(Math.abs(v0 + tx * (vl + va) - v), Math.abs(v0 + ty * (vl + vb) - v));
      const levels = tex.levels;
      let lev = 0;
      let foot = Math.max(du, dv) * tileInv * levels[0]!.size;
      while (foot > 1.5 && lev < levels.length - 1) {
        foot *= 0.5;
        lev += 1;
      }
      const T = levels[lev]!;
      const size = T.size;
      const f = T.rgb;
      const fx = u * tileInv * size - 0.5;
      const fy = (1 - v * tileInv) * size - 0.5;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const ax = fx - ix;
      const ay = fy - iy;
      const msk = size - 1;
      const x0 = ix & msk;
      const x1 = (ix + 1) & msk;
      const yy0 = (iy & msk) * size;
      const yy1 = ((iy + 1) & msk) * size;
      const p00 = (yy0 + x0) * 3;
      const p10 = (yy0 + x1) * 3;
      const p01 = (yy1 + x0) * 3;
      const p11 = (yy1 + x1) * 3;
      const w00 = (1 - ax) * (1 - ay);
      const w10 = ax * (1 - ay);
      const w01 = (1 - ax) * ay;
      const w11 = ax * ay;
      rgb[o] = (f[p00]! * w00 + f[p10]! * w10 + f[p01]! * w01 + f[p11]! * w11) * L * s.r + sheen;
      rgb[o + 1] = (f[p00 + 1]! * w00 + f[p10 + 1]! * w10 + f[p01 + 1]! * w01 + f[p11 + 1]! * w11) * L * s.g + sheen;
      rgb[o + 2] = (f[p00 + 2]! * w00 + f[p10 + 2]! * w10 + f[p01 + 2]! * w01 + f[p11 + 2]! * w11) * L * s.b + sheen * 1.03;
    } else if (mode === Mode.Curtain) {
      // Tulle: soft vertical folds with a finer weave, lit from the room behind.
      // Folds fade out when a pixel spans more than half a fold (grazing views would alias).
      const tx = num / (den + na);
      const du = Math.abs(u0 + tx * (ul + ua) - u);
      const a1 = Math.max(0, 1 - du / 34);
      const a2 = Math.max(0, 1 - du / 11);
      const fold = 0.9 + 0.045 * a1 * Math.sin(u * 0.062) + 0.03 * a1 * Math.sin(u * 0.141 + 1.3) + 0.012 * a2 * Math.sin(u * 0.29) + 0.02 * Math.sin(v * 0.05);
      const k = fold * Math.min(1.05, 0.7 + 0.3 * L);
      rgb[o] = s.r * k;
      rgb[o + 1] = s.g * k;
      rgb[o + 2] = s.b * k;
    } else if (mode === Mode.Emit) {
      rgb[o] = s.r;
      rgb[o + 1] = s.g;
      rgb[o + 2] = s.b;
    } else {
      rgb[o] = s.r * L + sheen;
      rgb[o + 1] = s.g * L + sheen;
      rgb[o + 2] = s.b * L + sheen * 1.03;
    }
  }
}

/** The street seen through glass: the panorama along the pixel's ray, slightly tinted. */
function envSample(s: Shade, bs: Basis, px: number, py: number, rgb: Float32Array, o: number): void {
  const dx = bs.R[0] * (px - bs.cx) + bs.Fw[0] * bs.F;
  const dy = bs.R[1] * (px - bs.cx) + bs.Fw[1] * bs.F;
  const dz = bs.cy - py;
  const horiz = Math.hypot(dx, dy);
  const el = Math.atan2(dz, horiz);
  const env = s.env;
  let r: number;
  let g: number;
  let b: number;
  if (env) {
    let az = Math.atan2(dy, dx) / (2 * Math.PI);
    if (az < 0) az += 1;
    const fx = az * env.w;
    const fy = Math.max(0, Math.min(env.h - 1.001, ((env.elTop - el) / (env.elTop - env.elBottom)) * env.h));
    const ix = Math.floor(fx);
    const iy = fy | 0;
    const ax = fx - ix;
    const ay = fy - iy;
    const x0 = ((ix % env.w) + env.w) % env.w;
    const x1 = (x0 + 1) % env.w;
    const d = env.rgb;
    const p00 = (iy * env.w + x0) * 3;
    const p10 = (iy * env.w + x1) * 3;
    const p01 = ((iy + 1) * env.w + x0) * 3;
    const p11 = ((iy + 1) * env.w + x1) * 3;
    const w00 = (1 - ax) * (1 - ay);
    const w10 = ax * (1 - ay);
    const w01 = (1 - ax) * ay;
    const w11 = ax * ay;
    r = d[p00]! * w00 + d[p10]! * w10 + d[p01]! * w01 + d[p11]! * w11;
    g = d[p00 + 1]! * w00 + d[p10 + 1]! * w10 + d[p01 + 1]! * w01 + d[p11 + 1]! * w11;
    b = d[p00 + 2]! * w00 + d[p10 + 2]! * w10 + d[p01 + 2]! * w01 + d[p11 + 2]! * w11;
  } else {
    // No panorama yet: an overcast winter sky over a hazy town.
    const k = Math.max(0, Math.min(1, el * 2.2 + 0.35));
    r = 0.6 + 0.2 * k;
    g = 0.65 + 0.19 * k;
    b = 0.7 + 0.2 * k;
  }
  // Glass: a little darker, faintly cool, with a soft sheen — a mild top bias (the sky is
  // brighter than the street) plus a radial grazing-angle term (real glass reflects more
  // steeply near the pane's edges/corners than dead centre — a believable fresnel glint,
  // not just a flat gradient).
  const nx = (px - bs.cx) / bs.cx;
  const ny = (bs.cy - py) / bs.cy;
  const grazing = Math.min(1, Math.hypot(nx, ny));
  const sheen = 0.03 + 0.04 * Math.max(0, ny) + 0.07 * grazing * grazing * grazing;
  rgb[o] = r * 0.9 + sheen;
  rgb[o + 1] = g * 0.91 + sheen;
  rgb[o + 2] = b * 0.93 + sheen * 1.05;
}

/**
 * Average the supersampled image down to RGBA and the id buffer down to one id
 * per output pixel; gentle highlight roll-off and a soft vignette like the app's renders.
 */
export function resolve(t: Target, ss: number): { rgba: Uint8ClampedArray<ArrayBuffer>; ids: Uint8Array; w: number; h: number } {
  const w = Math.floor(t.w / ss);
  const h = Math.floor(t.h / ss);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const ids = new Uint8Array(w * h);
  const inv = 1 / (ss * ss);
  const half = ss >> 1;
  const tone = (c: number): number => (c < 0.82 ? c : 0.82 + 0.18 * (1 - Math.exp(-(c - 0.82) / 0.18)));
  // A gentle warm grade (the app's own pre-rendered scenes read as golden-hour
  // daylight, not a neutral CG grey) — small per-channel multipliers after the
  // highlight rolloff, not a hue shift of the underlying light model.
  const WR = 1.04;
  const WG = 1.01;
  const WB = 0.95;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < ss; j += 1) {
        let k = ((y * ss + j) * t.w + x * ss) * 3;
        for (let i = 0; i < ss; i += 1, k += 3) {
          r += t.rgb[k]!;
          g += t.rgb[k + 1]!;
          b += t.rgb[k + 2]!;
        }
      }
      const vx = (x - w / 2) / (w / 2);
      const vy = (y - h / 2) / (h / 2);
      const vig = 1 - 0.13 * (vx * vx + vy * vy);
      const o = (y * w + x) * 4;
      rgba[o] = 255 * tone(r * inv) * vig * WR;
      rgba[o + 1] = 255 * tone(g * inv) * vig * WG;
      rgba[o + 2] = 255 * tone(b * inv) * vig * WB;
      rgba[o + 3] = 255;
      ids[y * w + x] = t.ids[(y * ss + half) * t.w + x * ss + half]!;
    }
  }
  sharpen(rgba, w, h);
  return { rgba, ids, w, h };
}

/** A cheap unsharp mask on the final picture (cross-kernel blur, subtracted back in): the
 * app's own pre-rendered photos read as crisper than a raw SSAA-filtered render of the same
 * scene, because a camera photo has real micro-contrast a renderer's box filter softens
 * away. Runs once per frame at output resolution (not supersampled), so it's cheap. */
function sharpen(rgba: Uint8ClampedArray, w: number, h: number): void {
  if (w < 3 || h < 3) return;
  const src = rgba.slice();
  const AMOUNT = 0.35;
  for (let y = 1; y < h - 1; y += 1) {
    const row = y * w;
    for (let x = 1; x < w - 1; x += 1) {
      const o = (row + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const center = src[o + c]!;
        const blur = (src[o - 4 + c]! + src[o + 4 + c]! + src[o - w * 4 + c]! + src[o + w * 4 + c]! + center * 4) / 8;
        rgba[o + c] = center + AMOUNT * (center - blur);
      }
    }
  }
}

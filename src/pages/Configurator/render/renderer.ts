/**
 * @file RoomRenderer — builds a plan's room once (faces + baked light, cached per
 * plan), then draws a camera view of it with the current finishes. Pure computation
 * on typed arrays: it runs inside a Web Worker (`worker.ts`) or, as a fallback,
 * on the main thread.
 */
import type { PlanGeom } from '../planShapes';
import { bakeLight } from './lighting';
import type { FaceLight } from './lighting';
import { lampRow } from './lamps';
import { Mode, addGlow, drawFace, makeBasis, makeTarget, project, resetTarget, resolve } from './raster';
import type { Shade, Target } from './raster';
import { buildRoom } from './scene';
import type { RoomModel } from './scene';
import { LAYERS, PICK } from './types';
import { layerOf } from './layers';
import { WIN_FRAME_URL, WIN_HOUSE_URL } from './units';
import { FURNITURE_KIND, furnitureUrl } from './furniture';
import type { CameraSpec, EnvData, Face, LayerId, RenderPaint, TexData, UnitImage } from './types';

export interface RenderOutput {
  readonly rgba: Uint8ClampedArray<ArrayBuffer>;
  readonly ids: Uint8Array;
  readonly w: number;
  readonly h: number;
  readonly ms: number;
  /** Where the ceiling light hangs in the picture (percent), null when it is out of view. */
  readonly lamp: readonly [number, number] | null;
}

/** Bare surfaces before a finish is chosen: grey plaster walls, concrete floor, white ceiling. */
// Warm, lived-in defaults for a surface with no finish picked yet — plain plaster/
// concrete tones rather than a cool construction-site grey, so the room still reads
// as a real space (matching the warmth of the app's own pre-rendered photo scenes)
// before the user has chosen anything.
const BARE: Readonly<Record<string, readonly [number, number, number]>> = {
  sill: [0.96, 0.95, 0.92],
  plintus: [0.96, 0.95, 0.92],
  wall: [0.72, 0.68, 0.62],
  floor: [0.52, 0.48, 0.43],
  ceiling: [0.86, 0.84, 0.79],
};
const WHITE: readonly [number, number, number] = [0.93, 0.93, 0.92];
const DARK: readonly [number, number, number] = [0.2, 0.2, 0.21];
const CURTAIN: readonly [number, number, number] = [0.92, 0.9, 0.86];

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  if (!Number.isFinite(n)) return [0.8, 0.8, 0.8];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface Built {
  readonly room: RoomModel;
  readonly lights: FaceLight[];
  /** Face indices of every layer. */
  readonly layers: ReadonlyMap<LayerId, readonly number[]>;
}

export class RoomRenderer {
  private readonly built = new Map<string, Built>();
  private readonly textures = new Map<string, TexData>();
  private readonly units = new Map<string, UnitImage>();
  private env: EnvData | null = null;
  private target: Target | null = null;

  addTexture(url: string, tex: TexData): void {
    this.textures.set(url, tex);
  }

  hasTexture(url: string): boolean {
    return this.textures.has(url);
  }

  addUnitImage(url: string, img: UnitImage): void {
    this.units.set(url, img);
  }

  hasUnitImage(url: string): boolean {
    return this.units.has(url);
  }

  setEnv(env: EnvData): void {
    this.env = env;
  }

  private build(key: string, g: PlanGeom): Built {
    let b = this.built.get(key);
    if (!b) {
      const room = buildRoom(g);
      const layers = new Map<LayerId, number[]>(LAYERS.map((l) => [l, []]));
      room.faces.forEach((f, i) => layers.get(layerOf(f))!.push(i));
      b = { room, lights: bakeLight(g, room), layers };
      this.built.set(key, b);
    }
    return b;
  }

  /** The room of `g` (cached under `key`) seen from `cam`, `size` px square, `ss`x supersampled. */
  render(key: string, g: PlanGeom, cam: CameraSpec, paint: RenderPaint, size = 800, ss = 2): RenderOutput {
    const t0 = performance.now();
    const { room, lights, layers } = this.build(key, g);
    if (this.target?.w !== size * ss) this.target = makeTarget(size * ss, size * ss);
    else resetTarget(this.target);
    const target = this.target;
    const basis = makeBasis(cam, size * ss, size * ss);
    const frame = hexRgb(paint.frame);
    const hidden = new Set<LayerId>(paint.hide);
    const env = hidden.has('background') ? null : this.env;
    for (const layer of LAYERS) {
      if (hidden.has(layer)) continue;
      for (const i of layers.get(layer)!) {
        const f = room.faces[i]!;
        // A decor sprite with nothing picked for it yet stays unbuilt rather than
        // showing a default item the user never chose (docs/FINAL_REPORT.md §7).
        if (f.kind === 'sprite' && (!f.sprite || paint.furniture?.[f.sprite.img] === undefined)) continue;
        const light = lights[i]!;
        const lm = typeof light === 'number' ? null : light;
        const L = typeof light === 'number' ? light : 1;
        drawFace(target, basis, f, this.shade(f, paint, frame, lm, L, env), f.pick);
      }
      if (layer === 'lamps' && paint.lamp) this.drawLamps(target, basis, room, paint.lamp, hidden.has('light'));
    }
    const out = resolve(target, ss);
    return { ...out, ms: performance.now() - t0, lamp: this.lampSpot(target, basis, room) };
  }

  /** The picture position (percent) of the nearest ceiling light that is in view. */
  private lampSpot(target: Target, basis: ReturnType<typeof makeBasis>, room: RoomModel): readonly [number, number] | null {
    let best: readonly [number, number] | null = null;
    let bestDist = Infinity;
    for (const p of room.lamps) {
      // Aim a little under the ceiling point: where the lamp body hangs.
      const at = project(basis, [p[0], p[1], p[2] - 120]);
      if (!at || at[0] < 0 || at[0] > target.w || at[1] < 0 || at[1] > target.h) continue;
      const d = Math.hypot(p[0] - basis.C[0], p[1] - basis.C[1]);
      if (d < bestDist) {
        bestDist = d;
        best = [(at[0] / target.w) * 100, (at[1] / target.h) * 100];
      }
    }
    return best;
  }

  private shade(f: Face, paint: RenderPaint, frame: readonly number[], lm: Shade['lm'], light: number, env: EnvData | null): Shade {
    const base = { tex: null, tile: 1000, lm, light, env: null };
    switch (f.kind) {
      case 'paint': {
        const p = paint.surfaces[f.paint];
        const bare = BARE[f.paint === 'P:floor' ? 'floor' : f.paint === 'P:ceiling' ? 'ceiling' : f.paint === 'P:sill' ? 'sill' : f.paint === 'P:plintus' ? 'plintus' : 'wall']!;
        const tex = p?.tex ? this.textures.get(p.tex) : undefined;
        // Varnished floors and sills catch the light at grazing angles.
        const gloss = f.paint === 'P:floor' ? 0.9 : f.paint === 'P:sill' ? 0.5 : 0;
        if (p && tex) return { ...base, mode: Mode.Texture, r: 1, g: 1, b: 1, tex, tile: p.tile ?? 800, gloss };
        const c = p ? hexRgb(p.color) : bare;
        return { ...base, mode: Mode.Flat, r: c[0], g: c[1], b: c[2], gloss };
      }
      case 'frame':
        // PVC profile: a mild plastic gloss, same grazing-angle sheen as the floor/sill.
        return { ...base, mode: Mode.Flat, r: frame[0]! * f.tint, g: frame[1]! * f.tint, b: frame[2]! * f.tint, gloss: 0.4 };
      case 'glass':
        return { ...base, mode: Mode.Glass, r: 1, g: 1, b: 1, env };
      case 'curtain':
        return { ...base, mode: Mode.Curtain, r: CURTAIN[0], g: CURTAIN[1], b: CURTAIN[2] };
      case 'unit': {
        const m = f.unit;
        const img = m ? this.units.get(m.img === 'house' ? WIN_HOUSE_URL : WIN_FRAME_URL) : undefined;
        // Without the image (not loaded) a unit falls back to a plain white / frame-coloured panel.
        if (!m || !img) return { ...base, mode: Mode.Flat, r: frame[0]! * f.tint, g: frame[1]! * f.tint, b: frame[2]! * f.tint };
        if (m.img === 'house') return { ...base, mode: Mode.Unit, r: f.tint, g: f.tint, b: f.tint, img, unit: m, recolor: false };
        return { ...base, mode: Mode.Unit, r: frame[0]!, g: frame[1]!, b: frame[2]!, img, unit: m, recolor: true };
      }
      case 'sprite': {
        const m = f.sprite;
        if (!m) return { ...base, mode: Mode.Flat, r: 0.5, g: 0.5, b: 0.5 };
        const k = paint.furniture?.[m.img] ?? FURNITURE_KIND[m.img].from;
        const img = this.units.get(furnitureUrl(m.img, k));
        // Without the image (not loaded yet — the caller preloads it before rendering) a neutral placeholder.
        if (!img) return { ...base, mode: Mode.Flat, r: 0.5, g: 0.5, b: 0.5 };
        return { ...base, mode: Mode.Sprite, r: 1, g: 1, b: 1, img, sprite: m };
      }
      case 'lamp':
        return { ...base, mode: Mode.Emit, r: 1, g: 0.97, b: 0.9 };
      case 'dark':
        return { ...base, mode: Mode.Flat, r: DARK[0] * f.tint, g: DARK[1] * f.tint, b: DARK[2] * f.tint };
      default:
        return { ...base, mode: Mode.Flat, r: WHITE[0] * f.tint, g: WHITE[1] * f.tint, b: WHITE[2] * f.tint };
    }
  }

  /** A fixed key-light direction (unit, mostly horizontal) for shading lamp meshes — any
   * revolved shade (the pendant dome, the caged bulb) is built from quads that all share
   * the same n[2] but face every compass direction, so a top-light-only term alone leaves
   * the whole shade one flat brightness. A one-sided horizontal term gives it a real lit
   * side and a shadow side, so it reads as a solid object instead of a painted silhouette. */
  private static readonly LAMP_KEY: readonly [number, number] = [0.6, -0.8];

  /** The row of ceiling lights of the chosen model, with a soft bloom round their glowing parts. */
  private drawLamps(target: Target, basis: ReturnType<typeof makeBasis>, room: RoomModel, model: number, noGlow: boolean): void {
    const set = lampRow(model, room.lamps);
    const [kx, ky] = RoomRenderer.LAMP_KEY;
    for (const part of set.parts) {
      const n = part.face.n;
      const L = part.emit ? 1 : Math.min(1.15, 0.64 + 0.14 * n[2] + 0.34 * Math.max(0, n[0] * kx + n[1] * ky));
      drawFace(target, basis, part.face, { mode: part.emit ? Mode.Emit : Mode.Flat, r: part.rgb[0], g: part.rgb[1], b: part.rgb[2], tex: null, tile: 1, lm: null, light: L, env: null }, PICK.light);
    }
    if (!noGlow) for (const g of set.glows) addGlow(target, basis, g.at, g.radius, g.strength);
  }
}

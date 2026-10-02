/**
 * @file Shared types of the plan-mode room renderer (`render/`): a balcony built
 * from its plan (`planShapes.ts`) as planar faces, lit by the daylight from its
 * windows and drawn per pixel in software — no 3D engine.
 */

export type Vec3 = readonly [number, number, number];

/**
 * The layers of a picture, back to front. Every face of the room belongs to one, and a layer
 * can be hidden or restyled without touching the others:
 * - `background` — the street seen through the glass (hidden: a plain hazy sky);
 * - `structure` — walls, parapets, floor, ceiling (the surfaces the customer finishes);
 * - `openings` — the apartment's own door / window block, its reveals, drip sill and curtains;
 * - `frames` — the balcony's window frames (colour from the customer's choice);
 * - `glass` — the window glass;
 * - `handles` — window and door handles;
 * - `sill` — the window sills; `plinth` — the skirting;
 * - `furniture` — cabinets, chair, dryer, flowers (sprites);
 * - `lamps` — the ceiling lights; `shadows` — contact shadows; `light` — glows and light effects.
 */
export const LAYERS = ['background', 'structure', 'openings', 'frames', 'glass', 'handles', 'sill', 'plinth', 'furniture', 'lamps', 'shadows', 'light'] as const;
export type LayerId = (typeof LAYERS)[number];

/** How a face is shaded. */
export type FaceKind =
  /** A finish the customer picks (walls, parapets, floor, ceiling): texture or colour from the paint. */
  | 'paint'
  /** Window glass: the street behind it. */
  | 'glass'
  /** A window frame profile in the chosen frame colour. */
  | 'frame'
  /** Fixed white parts (sills, the apartment's door/window frames, drip sills). */
  | 'white'
  /** The apartment seen through its door/window glass: tulle curtains. */
  | 'curtain'
  /** Light-emitting lamp parts. */
  | 'lamp'
  /** Fixed dark parts (handles' shadows, door threshold). */
  | 'dark'
  /** A window unit cut out of the app's render (9-slice image): `house` = the apartment's block, `frame` = a glazing profile in the chosen frame colour. */
  | 'unit'
  /** A decor cut-out (cabinet, dryer, planter) shown as drawn: a plain billboard image, no 9-slice, no recolour. */
  | 'sprite';

/** Placement of a 9-slice window image on a face: the rectangle in the face's (u, v) mm, and the border ring's width in mm. */
export interface UnitMap {
  readonly img: 'house' | 'frame';
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  readonly b: number;
}

/** A front-on window image (frame ring + glass) with a mip chain; `a` is the alpha (0 = see-through). */
export interface UnitImage {
  readonly levels: readonly { readonly w: number; readonly h: number; readonly rgb: Float32Array; readonly a: Float32Array }[];
}

/** Placement of a plain (non-sliced) decor image on a face: which decor item and the rectangle in the face's (u, v) mm. Its colour comes from `RenderPaint.furniture` at draw time, not here — the geometry is built once per plan, the pick changes far more often. */
export interface SpriteMap {
  readonly img: 'cabinet' | 'dryer' | 'flowers';
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
}

export interface Face {
  /** Planar outline in mm (y up = into the plan, z up = height); further loops are holes. */
  readonly loops: readonly (readonly Vec3[])[];
  /** Unit normal on the side the face is seen from. */
  readonly n: Vec3;
  /** Texture / light-map frame: origin and two unit in-plane axes. */
  readonly o: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
  readonly kind: FaceKind;
  /** Paint key of `paint` faces: `P:w3`, `P:floor`, `P:ceiling`. */
  readonly paint: string;
  /** Surface id written to the id buffer (tap targets); 0 = none. */
  readonly pick: number;
  /** Light-mapped (large surfaces) or lit by one value (small parts). */
  readonly map: boolean;
  /** Albedo multiplier of fixed parts (white / dark / frame shading). */
  readonly tint: number;
  /** Set on `unit` faces. */
  readonly unit?: UnitMap;
  /** Set on `sprite` faces. */
  readonly sprite?: SpriteMap;
  /** The layer when it is not implied by the face's kind (`layerOf`). */
  readonly layer?: LayerId;
}

/** A tileable texture: RGB floats per mip level, power-of-two square. */
export interface TexData {
  readonly levels: readonly { readonly size: number; readonly rgb: Float32Array }[];
}

/** An outdoor panorama: RGB floats, azimuth 0..2π across, elevation `elTop`..`elBottom` down. */
export interface EnvData {
  readonly w: number;
  readonly h: number;
  readonly rgb: Float32Array;
  readonly elTop: number;
  readonly elBottom: number;
}

/** What paints a `paint` face: a texture (with the world size of one tile, mm) or a flat colour. */
export interface SurfacePaint {
  readonly color: string;
  readonly tex?: string;
  readonly tile?: number;
}

export interface RenderPaint {
  readonly surfaces: Readonly<Record<string, SurfacePaint>>;
  /** Window frame colour (hex). */
  readonly frame: string;
  /** Lamp model (1..6) or none. */
  readonly lamp: number | null;
  /** Layers left out of the picture. */
  readonly hide?: readonly LayerId[];
  /** Decor colour (0-based, the app's own index) per item; absent = `FURNITURE_KIND[item].from`'s default, same as the frame colour defaulting when nothing is picked yet — a plan-mode room is always shown finished, so a tap target always has something to land on. */
  readonly furniture?: {
    readonly cabinet?: number;
    readonly dryer?: number;
    readonly flowers?: number;
  };
}

export interface CameraSpec {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Viewing direction in the plan (unit). */
  readonly fx: number;
  readonly fy: number;
  /** Horizontal = vertical field of view (square image), radians. */
  readonly fov: number;
}

/** Ids written to the id buffer for the non-wall surfaces (walls use their 1-based edge number). */
export const PICK = { floor: 40, ceiling: 41, frame: 42, light: 43, sill: 44, plinth: 45, cabinet: 46, dryer: 47, flowers: 48 } as const;

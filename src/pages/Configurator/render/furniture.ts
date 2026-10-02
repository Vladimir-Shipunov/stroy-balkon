/**
 * @file Decor sprites cut from the app's own renders (`scripts/importVamFurniture.mjs`),
 * every colour the app offers: URLs, the real-world footprint each is drawn at (kept
 * from the importer's crop aspect, so a sprite is only ever shrunk to fit, never
 * stretched), and how many colours exist (colour 0 renders blank for all three — a
 * placeholder swatch in the app itself, not an actual layer — so it is left out of
 * the pickable range; confirmed by decoding every `furn-*-0.webp`, not assumed).
 */
import type { RenderPaint } from './types';

export type FurnitureCat = keyof NonNullable<RenderPaint['furniture']>;

export const FURNITURE_CATS: readonly FurnitureCat[] = ['cabinet', 'dryer', 'flowers'];

export function furnitureUrl(cat: FurnitureCat, k: number): string {
  return `/vam/tex/furn-${cat}-${k}.webp`;
}

/** A category's real-world size, mm (the importer's crop aspect), and its colour range. */
export interface FurnitureKind {
  readonly w: number;
  readonly h: number;
  /** Colours 0..count-1; `from` is the first one worth offering (the app's own colour 0 is blank for some). */
  readonly count: number;
  readonly from: number;
}

// Aspect kept from the importer's crop (w/h): cabinet 1.354, dryer 1.267, flowers 1.120.
export const FURNITURE_KIND: Readonly<Record<FurnitureCat, FurnitureKind>> = {
  cabinet: { w: 700, h: 517, count: 20, from: 1 },
  dryer: { w: 650, h: 513, count: 9, from: 1 },
  flowers: { w: 300, h: 268, count: 4, from: 1 },
};

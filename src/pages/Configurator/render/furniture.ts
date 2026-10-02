/**
 * @file Decor sprites cut from the app's own renders (`scripts/importVamFurniture.mjs`):
 * URLs and the real-world footprint each is drawn at. The app's colour pickers for these
 * (20 cabinet colours, 9 dryers, 4 planters) are not wired yet — one colour each, matching
 * `docs/apk-to-plan-mapping.md`'s stage-7 note.
 */

export const FURN_CABINET_URL = '/vam/tex/furn-cabinet.webp';
export const FURN_DRYER_URL = '/vam/tex/furn-dryer.webp';
export const FURN_FLOWERS_URL = '/vam/tex/furn-flowers.webp';

/** Every decor image the renderer needs ready before it draws a room. */
export const FURNITURE_URLS = [FURN_CABINET_URL, FURN_DRYER_URL, FURN_FLOWERS_URL] as const;

/** A sprite's real-world size, mm (its aspect ratio as cropped by the importer). */
export interface FurnitureSize {
  readonly url: string;
  readonly w: number;
  readonly h: number;
}

// Aspect kept from the importer's crop (w/h): cabinet 1.354, dryer 1.267, flowers 1.120.
export const CABINET_SIZE: FurnitureSize = { url: FURN_CABINET_URL, w: 700, h: 517 };
export const DRYER_SIZE: FurnitureSize = { url: FURN_DRYER_URL, w: 650, h: 513 };
export const FLOWERS_SIZE: FurnitureSize = { url: FURN_FLOWERS_URL, w: 300, h: 268 };

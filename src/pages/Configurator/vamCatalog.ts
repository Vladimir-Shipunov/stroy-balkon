/**
 * @file The configurator model, as in the Vam Balkon app: a balcony shape picks an
 * app balcony type; the type + glazing pick one of the app's own real pre-rendered
 * screens (`vamApp.generated.ts`) that shows the balcony from two sides — the exact
 * pixels the real app shows, not a redrawn approximation. Every tap target on a
 * side owns one surface (wall, ceiling, floor, frames, light...) and the user picks
 * a material option and colour for it — those picks are the whole selection. This
 * module holds the selection model, its validation, the layer list of a view and
 * the human-readable summary sent with a lead.
 *
 * `vamPlanHotspots()`/`vamRenderPaint()` below still feed the parametric room
 * renderer (`render/`, driven by real geometry in `planShapes.ts`) — kept in the
 * codebase and still typechecked/tested, just not the active page view right now
 * (see `docs/superpowers/` session notes: the owner wants the real app's own
 * pre-rendered visuals, not a procedural approximation of them).
 */
import { VAM_APP_SCREENS } from './vamApp.generated';
import type { AppHotspot, AppOption, AppSlot, AppView, HotspotKind } from './vamApp.generated';
import { VAM_SHAPES, VAM_TYPES, findVamShape, findVamType } from './vamShapes';
import type { VamGlazingDef, VamShapeDef, VamTypeDef } from './vamShapes';
import { planSurfaces } from './planGeometry';
import { PLAN_SHAPES } from './planShapes';
import { LAYERS } from './render/types';
import type { LayerId, RenderPaint, SurfacePaint } from './render/types';

export { VAM_SHAPES, VAM_TYPES, findVamShape, findVamType };
export type { AppHotspot, AppOption, AppSlot, AppView, HotspotKind, VamGlazingDef, VamShapeDef, VamTypeDef };

/** A material option + colour chosen for one slot of a tap target. */
export interface VamPick {
  readonly o: string;
  readonly k: number;
}

export interface VamSelection {
  /** Balcony shape id (`vamShapes.ts`). */
  readonly shape: string;
  /** Glazing id of the shape's type (`parapet` / `floor`, or `left` / `right`). */
  readonly glazing: string;
  /** Picks by `pickKey(hotspot, slot)`; absent = the bare surface. */
  readonly picks: Readonly<Record<string, VamPick>>;
}

export function pickKey(hotspotId: string, slotId: string): string {
  return `${hotspotId}|${slotId}`;
}

/** The two camera views of a screen and whether they are drawn flipped. */
export interface VamScreen {
  readonly id: string;
  readonly mirror: boolean;
  readonly views: readonly [AppView, AppView];
}

const DEFAULT_SHAPE = VAM_SHAPES[0]!;

export function vamShapeType(shape: VamShapeDef): VamTypeDef {
  return findVamType(shape.type) ?? VAM_TYPES[0]!;
}

/** Glazings of a shape's balcony type. */
export function vamShapeGlazings(shape: VamShapeDef): readonly VamGlazingDef[] {
  return vamShapeType(shape).glazings;
}

/** The app screen (with its two real pre-rendered views) of a selection. */
export function vamScreen(sel: VamSelection): VamScreen {
  const shape = findVamShape(sel.shape) ?? DEFAULT_SHAPE;
  const glazings = vamShapeGlazings(shape);
  const glazing = glazings.find((g) => g.id === sel.glazing) ?? glazings[0]!;
  return { id: glazing.screen, mirror: glazing.mirror === true, views: VAM_APP_SCREENS[glazing.screen]! };
}

/** Reference option lists for the plan view: the app's own materials and colours
 * (screens '2'/'8' are fixed lookup points into the app's own catalogue, not tied to
 * any particular shape/glazing — every shape's plan hotspots draw from the same
 * app-wide material/colour lists). */
function refOptions(screen: string, view: number, hotspot: string): readonly AppOption[] {
  return VAM_APP_SCREENS[screen]?.[view]?.hotspots.find((h) => h.id === hotspot)?.slots[0]?.options ?? [];
}

/** One named option of a hotspot's first slot, wrapped as a single-option list (no "Материал" row — the plan only offers this one). Colour 0 renders as a blank layer for the plan's decor crops — left out, as `plintus`/`lamp` already do for their own colour 0. */
function refOption(screen: string, view: number, hotspot: string, optionId: string): readonly AppOption[] {
  const o = refOptions(screen, view, hotspot).find((op) => op.id === optionId);
  return o ? [{ ...o, colors: o.colors.filter((c) => c.k > 0) }] : [];
}

/** One slot's options from a multi-slot hotspot (the app's combined "Декор" popup: a slot per decor kind). Colour 0 is a blank placeholder layer for some of these — left out, as `plintus`/`lamp` already do. */
function refSlotOptions(screen: string, view: number, hotspot: string, slotId: string): readonly AppOption[] {
  const opts = VAM_APP_SCREENS[screen]?.[view]?.hotspots.find((h) => h.id === hotspot)?.slots.find((s) => s.id === slotId)?.options ?? [];
  return opts.map((o) => ({ ...o, colors: o.colors.filter((c) => c.k > 0) }));
}

const PLAN_LABELS: Readonly<Record<string, string>> = {
  wall: 'Стены',
  floor: 'Пол',
  ceiling: 'Потолок',
  frame: 'Цвет рам',
  light: 'Светильник',
  sill: 'Подоконник',
  plintus: 'Плинтус',
  cabinet: 'Шкаф',
  dryer: 'Сушилка',
  flowers: 'Цветы',
};

/** This plan hotspot's `AppHotspot.kind` — the generated catalogue has no dedicated `dryer`/`flowers` kind, so both fall back to `decor` (same as the app's own combined decor popup); `hotspotTitle` tells them apart by their (single) slot's own label. */
function hotspotKindOf(surfaceKind: string): HotspotKind {
  return surfaceKind === 'dryer' || surfaceKind === 'flowers' ? 'decor' : (surfaceKind as HotspotKind);
}

/** The tap targets of a shape's plan view (one per wall, floor, ceiling, window frames, decor). */
export function vamPlanHotspots(shapeId: string): AppHotspot[] {
  const geom = PLAN_SHAPES[shapeId];
  if (!geom) return [];
  const options: Record<string, readonly AppOption[]> = {
    wall: refOptions('2', 0, '3'),
    floor: refOptions('2', 0, '5'),
    ceiling: refOptions('2', 0, '4'),
    frame: refOptions('2', 1, '7_3'),
    light: refOptions('8', 1, '8_7'),
    sill: refOptions('2', 1, '7'),
    plintus: refOptions('2', 1, '8_9_2'),
    cabinet: refOption('2', 0, '1_5', '0j'),
    dryer: refSlotOptions('2', 1, '8_8_decor', 'dryer'),
    flowers: refSlotOptions('2', 1, '8_8_decor', 'flowers'),
  };
  return planSurfaces(geom).map((surface) => ({
    id: surface.id,
    kind: hotspotKindOf(surface.kind),
    x: 50,
    y: 50,
    slots: [{ id: 'main', label: PLAN_LABELS[surface.kind] ?? '', options: options[surface.kind] ?? [] }],
  }));
}

/** Every tap target of the selection's balcony: both views of the app's real screen. */
export function vamHotspotList(sel: VamSelection): AppHotspot[] {
  return vamScreen(sel).views.flatMap((v) => [...v.hotspots]);
}

function validPick(hotspots: readonly AppHotspot[], key: string, pick: VamPick): boolean {
  for (const h of hotspots) {
    for (const s of h.slots) {
      if (pickKey(h.id, s.id) !== key) continue;
      return s.options.some((o) => o.id === pick.o && o.colors.some((c) => c.k === pick.k));
    }
  }
  return false;
}

/** Coerce a possibly stale/partial selection into one that exists in the catalogue. */
export function normalizeVamSelection(raw: Partial<VamSelection> | null | undefined): VamSelection {
  const shape = findVamShape(raw?.shape) ?? DEFAULT_SHAPE;
  const glazings = vamShapeGlazings(shape);
  const glazing = glazings.find((g) => g.id === raw?.glazing) ?? glazings[0]!;
  // Validated against the union of the app's real screen hotspots and the plan
  // renderer's hotspots, so a config saved under either still restores cleanly.
  const hotspots = [...(VAM_APP_SCREENS[glazing.screen] ?? []).flatMap((v) => v.hotspots), ...vamPlanHotspots(shape.id)];
  const picks: Record<string, VamPick> = {};
  for (const [key, pick] of Object.entries(raw?.picks ?? {})) {
    if (pick && typeof pick.o === 'string' && typeof pick.k === 'number' && validPick(hotspots, key, pick)) picks[key] = pick;
  }
  return { shape: shape.id, glazing: glazing.id, picks };
}

export const DEFAULT_VAM_SELECTION: VamSelection = normalizeVamSelection(null);

export function vamBgUrl(name: string): string {
  return `/vam/x/bg/${name}.webp`;
}

/** A balcony-type/glazing preview thumbnail (step 1's picker cards — the app's own UI art, not a rendered scene). */
export function vamUiUrl(name: string): string {
  return `/vam/x/ui/${name}.webp`;
}

/** The option a slot currently shows (its pick, else undefined). */
export function pickedOption(slot: AppSlot, pick: VamPick | undefined): AppOption | undefined {
  return pick ? slot.options.find((o) => o.id === pick.o) : undefined;
}

/**
 * Layer URLs of one view in stacking order: the bare background images, then the
 * layers of every chosen option that belong to this view (a wall picked on one view
 * also colours its counterpart on the other), by draw order: floor, walls, frames,
 * sills, baseboard, furniture, light.
 */
export function vamViewLayerUrls(screen: VamScreen, viewIndex: 0 | 1, picks: Readonly<Record<string, VamPick>>): string[] {
  const layers: { url: string; z: number }[] = [];
  for (const view of screen.views) {
    for (const h of view.hotspots) {
      for (const s of h.slots) {
        const pick = picks[pickKey(h.id, s.id)];
        const option = pickedOption(s, pick);
        if (!pick || !option) continue;
        for (const l of option.layers) {
          if (l.v === viewIndex) layers.push({ url: `/vam/x/${l.p}${pick.k}.webp`, z: l.z });
        }
      }
    }
  }
  layers.sort((a, b) => a.z - b.z);
  return [...screen.views[viewIndex].bg.map(vamBgUrl), ...layers.map((l) => l.url)];
}

export const HOTSPOT_LABELS: Readonly<Record<HotspotKind, string>> = {
  wall: 'Стена',
  ceiling: 'Потолок',
  floor: 'Пол',
  frame: 'Рамы окон',
  sill: 'Подоконник',
  plintus: 'Плинтус',
  light: 'Освещение',
  cabinet: 'Шкаф',
  decor: 'Декор',
};

/** "Стена 3" — the app numbers its walls by the piece of the room. */
export function hotspotTitle(h: AppHotspot): string {
  if (h.kind === 'wall') {
    const n = h.id.match(/^P:w(\d+)/)?.[1] ?? h.id.match(/^\d+/)?.[0];
    return n ? `${HOTSPOT_LABELS.wall} ${n}` : HOTSPOT_LABELS.wall;
  }
  // A single app view can have several frame hotspots (ids like "7_3", "7_5" — one per window),
  // which otherwise all fall through to the same flat "Рамы окон" label below. The plan's own
  // single frame surface uses the id "P:frame" instead, which has no number to show.
  if (h.kind === 'frame') {
    const n = h.id.match(/^\d+_\d+$/)?.[0];
    return n ? `${HOTSPOT_LABELS.frame} ${n}` : HOTSPOT_LABELS.frame;
  }
  // The plan's dryer / planter hotspots share the app's generic "decor" kind (there is no kind of
  // their own in the catalogue) but, unlike the app's combined decor popup, each is its own single-slot
  // hotspot — so its own slot's label ("Сушилка" / "Цветы") is the real title, not the generic "Декор".
  if (h.kind === 'decor' && h.slots.length === 1) return h.slots[0]!.label;
  return HOTSPOT_LABELS[h.kind];
}

export function vamShapeLabel(id: string): string {
  return findVamShape(id)?.label ?? id;
}

export function vamGlazingLabel(shapeId: string, glazingId: string): string {
  const shape = findVamShape(shapeId);
  const glazings = shape ? vamShapeGlazings(shape) : [];
  return (glazings.find((g) => g.id === glazingId) ?? glazings[0])?.label ?? '';
}

/** Colour name: the app's own when it has one, else "Цвет N" by position. */
export function colorName(option: AppOption, k: number): string {
  const i = option.colors.findIndex((c) => c.k === k);
  return option.colors[i]?.name ?? `цвет ${i + 1}`;
}

/** Human-readable rows of a selection — shown in the order modal and sent with the lead. */
export function vamSummary(sel: VamSelection): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: 'Форма балкона', value: vamShapeLabel(sel.shape) },
    { label: 'Тип балкона', value: vamShapeType(findVamShape(sel.shape) ?? DEFAULT_SHAPE).label },
    { label: 'Остекление', value: vamGlazingLabel(sel.shape, sel.glazing) },
  ];
  const seen = new Set<string>();
  for (const h of vamHotspotList(sel)) {
    {
      for (const s of h.slots) {
        const pick = sel.picks[pickKey(h.id, s.id)];
        const option = pickedOption(s, pick);
        if (!pick || !option) continue;
        const label = h.kind === 'decor' ? s.label : hotspotTitle(h);
        const value = `${option.label}, ${colorName(option, pick.k)}`;
        const key = `${label}|${value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ label, value });
      }
    }
  }
  return rows;
}

/** Label of the first wall material chosen, for the header chip. */
export function vamMaterialLabel(sel: VamSelection): string | null {
  for (const h of vamHotspotList(sel)) {
    {
      if (h.kind !== 'wall') continue;
      for (const s of h.slots) {
        const option = pickedOption(s, sel.picks[pickKey(h.id, s.id)]);
        if (option) return option.label;
      }
    }
  }
  return null;
}

/**
 * Set `option` (by id, first available when absent) with a default colour on every
 * slot of the given hotspot kinds in the selection's screen — used by the assistant.
 * Returns the new picks.
 */
export function vamAutoPicks(
  sel: VamSelection,
  kinds: readonly HotspotKind[],
  optionId: string | undefined,
  colorK: number | undefined,
  slotId?: string,
): Record<string, VamPick> {
  const picks: Record<string, VamPick> = { ...sel.picks };
  for (const h of vamHotspotList(sel)) {
    {
      if (!kinds.includes(h.kind)) continue;
      for (const s of h.slots) {
        if (slotId && s.id !== slotId) continue;
        const option = (optionId ? s.options.find((o) => o.id === optionId) : undefined) ?? (optionId ? undefined : s.options[0]);
        if (!option) continue;
        const color = option.colors.find((c) => c.k === colorK) ?? option.colors[Math.min(1, option.colors.length - 1)];
        if (color) picks[pickKey(h.id, s.id)] = { o: option.id, k: color.k };
      }
    }
  }
  return picks;
}

/** The option id chosen on the first tap target of `kind` that has a pick (null when none). */
export function vamChosen(sel: VamSelection, kind: HotspotKind): VamPick | null {
  for (const h of vamHotspotList(sel)) {
    {
      if (h.kind !== kind) continue;
      for (const s of h.slots) {
        const pick = sel.picks[pickKey(h.id, s.id)];
        if (pick) return pick;
      }
    }
  }
  return null;
}

const TEXTURED = new Set(['laminat', 'vagonka', 'parket', 'mdf', 'plitka']);

/** World size (mm) one copy of a finish's texture covers: boards of the right width on walls, floor and ceiling. */
const WALL_TILE: Readonly<Record<string, number>> = { laminat: 640, vagonka: 560, parket: 720, mdf: 700, plitka: 600 };
const FLOOR_TILE: Readonly<Record<string, number>> = { laminat: 760, vagonka: 640, parket: 760, mdf: 700, plitka: 560 };

/** What the room renderer paints: a texture or colour per finished surface, the frame colour and the lamp. */
export function vamRenderPaint(sel: VamSelection): RenderPaint {
  const surfaces: Record<string, SurfacePaint> = {};
  let frame = '#f4f4f2';
  let lamp: number | null = null;
  const furniture: { cabinet?: number; dryer?: number; flowers?: number } = {};
  for (const h of vamPlanHotspots(sel.shape)) {
    for (const s of h.slots) {
      const pick = sel.picks[pickKey(h.id, s.id)];
      const option = pickedOption(s, pick);
      if (!pick || !option) continue;
      if (h.id === 'P:cabinet' || h.id === 'P:dryer' || h.id === 'P:flowers') {
        furniture[h.id === 'P:cabinet' ? 'cabinet' : h.id === 'P:dryer' ? 'dryer' : 'flowers'] = pick.k;
        continue;
      }
      if (h.kind === 'light') {
        lamp = pick.k;
        continue;
      }
      const hex = option.colors.find((c) => c.k === pick.k)?.hex;
      if (!hex) continue;
      if (h.kind === 'frame') {
        frame = hex;
        continue;
      }
      if (TEXTURED.has(option.id)) {
        const tile = (h.kind === 'floor' ? FLOOR_TILE : WALL_TILE)[option.id] ?? 700;
        surfaces[h.id] = { color: hex, tex: `/vam/tex/${option.id}/${pick.k}.webp`, tile };
      } else {
        surfaces[h.id] = { color: hex };
      }
    }
  }
  return { surfaces, frame, lamp, furniture, hide: hiddenLayers() };
}

/** Layers named in the page's `?hide=frames,glass` (a debugging aid; empty in normal use). */
function hiddenLayers(): LayerId[] {
  if (typeof window === 'undefined') return [];
  const names = new URLSearchParams(window.location.search).get('hide')?.split(',') ?? [];
  return LAYERS.filter((l) => names.includes(l));
}

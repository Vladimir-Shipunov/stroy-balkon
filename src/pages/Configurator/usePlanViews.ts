/**
 * @file usePlanViews — renders both views of a plan's room (`render/`) whenever the
 * plan or the finishes change, and works out where the tap targets go. Renders
 * never pile up: while one is running only the newest request is kept.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { nudge, placeSpots, surfacePatches } from './render/hotspots';
import type { Spot } from './render/hotspots';
import { renderView } from './render/client';
import { roomCameras } from './render/scene';
import type { RenderPaint } from './render/types';
import { planSurfaces } from './planGeometry';
import type { PlanSurface } from './planGeometry';
import type { PlanGeom } from './planShapes';

export interface PlanSpot {
  readonly surface: PlanSurface;
  /** Percent of the view. */
  readonly x: number;
  readonly y: number;
}

export interface PlanView {
  readonly rgba: Uint8ClampedArray<ArrayBuffer>;
  readonly w: number;
  readonly h: number;
  readonly spots: readonly PlanSpot[];
}

type Pair = readonly [PlanView | null, PlanView | null];

/** Share of a view a surface must cover for its target to be shown there. */
const MIN_AREA = 0.004;
/** A surface seen in only a sliver still gets its target in the view that shows it best. */
const MIN_BEST = 0.0004;

/** Decide which view shows which surface's target and where. */
function layoutSpots(geom: PlanGeom, outs: readonly [{ ids: Uint8Array; w: number; h: number; lamp: readonly [number, number] | null }, { ids: Uint8Array; w: number; h: number; lamp: readonly [number, number] | null }]): [PlanSpot[], PlanSpot[]] {
  const surfaces = planSurfaces(geom).filter((s) => s.kind !== 'light');
  const patches = outs.map((o) => surfacePatches(o.ids, o.w, o.h));
  const areaOf = (v: 0 | 1, pick: number): number => patches[v]!.find((p) => p.id === pick)?.area ?? 0;
  const wanted: [Set<number>, Set<number>] = [new Set(), new Set()];
  for (const s of surfaces) {
    const a0 = areaOf(0, s.pick);
    const a1 = areaOf(1, s.pick);
    if (a0 >= MIN_AREA) wanted[0].add(s.pick);
    if (a1 >= MIN_AREA) wanted[1].add(s.pick);
    if (!wanted[0].has(s.pick) && !wanted[1].has(s.pick)) {
      const best = a0 >= a1 ? 0 : 1;
      if (Math.max(a0, a1) >= MIN_BEST) wanted[best].add(s.pick);
    }
  }
  const byPick = new Map(surfaces.map((s) => [s.pick, s]));
  const light = planSurfaces(geom).find((s) => s.kind === 'light');
  return ([0, 1] as const).map((v) => {
    // The ceiling light is a fixed point of the picture: the other targets keep clear of it.
    const lampAt = outs[v]!.lamp;
    const lampSpot = lampAt ? { x: Math.max(7, Math.min(93, lampAt[0])), y: Math.max(7, Math.min(93, lampAt[1])) } : null;
    const placed: Spot[] = placeSpots(patches[v]!, wanted[v], 0.1, lampSpot ? [lampSpot] : []);
    const list: PlanSpot[] = placed.flatMap((p) => {
      const surface = byPick.get(p.id);
      return surface ? [{ surface, x: p.x, y: p.y }] : [];
    });
    // The ceiling light hangs where the lamp is; when that is out of view it sits on the ceiling of the first view.
    const ceiling = list.find((s) => s.surface.kind === 'ceiling');
    if (light && lampSpot) {
      list.push({ surface: light, x: lampSpot.x, y: lampSpot.y });
    } else if (light && ceiling && v === 0) {
      list.push({ surface: light, ...nudge({ x: ceiling.x, y: Math.max(8, ceiling.y - 11) }, placed) });
    }
    return list;
  }) as [PlanSpot[], PlanSpot[]];
}

/**
 * The two rendered views of a room.
 *
 * Renders are single-flight: while one runs, further changes only mark the state
 * dirty and the newest snapshot is rendered next — so fast clicks never pile up. The
 * loop lives in refs, not in an effect's closure, so React's double-mounting of
 * effects (StrictMode) cannot drop a result or start a second loop.
 * @param key Identifies the plan exactly (shape + glazing): the renderer caches the room under it.
 * @param enabled False while the plan view is not on screen: nothing is rendered.
 * @returns The latest pictures (null until the first arrives) and whether a render is running.
 */
export function usePlanViews(key: string, geom: PlanGeom, paint: RenderPaint, enabled = true): { views: Pair; busy: boolean } {
  const [views, setViews] = useState<Pair>([null, null]);
  const [busy, setBusy] = useState(enabled);
  const paintKey = useMemo(() => JSON.stringify(paint), [paint]);
  const latest = useRef({ key, geom, paint });
  latest.current = { key, geom, paint };
  const mounted = useRef(false);
  const running = useRef(false);
  const dirty = useRef(false);

  const kick = useRef((): void => undefined);
  kick.current = (): void => {
    if (running.current) {
      dirty.current = true;
      return;
    }
    running.current = true;
    dirty.current = false;
    setBusy(true);
    const snap = latest.current;
    const cams = roomCameras(snap.geom);
    Promise.all([
      renderView({ key: snap.key, geom: snap.geom, cam: cams[0], paint: snap.paint }, 0),
      renderView({ key: snap.key, geom: snap.geom, cam: cams[1], paint: snap.paint }, 1),
    ])
      .then(([a, b]) => {
        if (!mounted.current) return;
        const [s0, s1] = layoutSpots(snap.geom, [a, b]);
        setViews([
          { rgba: a.rgba, w: a.w, h: a.h, spots: s0 },
          { rgba: b.rgba, w: b.w, h: b.h, spots: s1 },
        ]);
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Plan render failed:', err);
      })
      .finally(() => {
        running.current = false;
        if (mounted.current && dirty.current) kick.current();
        else if (mounted.current) setBusy(false);
      });
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (enabled) kick.current();
    else setBusy(false);
    // `paintKey` stands for the paint object's content.
  }, [key, paintKey, enabled]);

  return { views, busy };
}

/**
 * @file Page-side access to the room renderer: one shared worker, promise-based
 * requests, and a main-thread fallback if workers or OffscreenCanvas are missing.
 */
import type { PlanGeom } from '../planShapes';
import type { RenderOutput } from './renderer';
import type { CameraSpec, RenderPaint } from './types';
import type { RenderRequest, RenderResponse } from './worker';

export type { RenderOutput };

interface Pending {
  resolve: (o: RenderOutput) => void;
  reject: (e: Error) => void;
}

const workers: (Worker | null)[] = [null, null];
let nextId = 1;
const pending = new Map<number, Pending>();
let fallback: Promise<typeof import('./fallback')> | null = null;

/** One worker per view slot, so the two views render in parallel. */
function spawn(slot: number): Worker | null {
  const existing = workers[slot];
  if (existing) return existing;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
  try {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<RenderResponse>): void => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok && e.data.out) p.resolve(e.data.out);
      else p.reject(new Error(e.data.error ?? 'render failed'));
    };
    w.onerror = (): void => {
      // The worker died (old browser, blocked module worker): switch to the main thread.
      const all = [...pending.values()];
      pending.clear();
      workers[0] = null;
      workers[1] = null;
      workerBroken = true;
      all.forEach((p) => p.reject(new Error('worker failed')));
    };
    workers[slot] = w;
    return w;
  } catch {
    return null;
  }
}

let workerBroken = false;

/**
 * Perf audit (docs/PERF_AUDIT_15-20.md #1): the two render workers are a module-level
 * singleton that otherwise lives (and holds its baked room/texture/light-map caches,
 * see renderer.ts) for the lifetime of the page — fine for this SPA's single
 * configurator consumer, but there was no cleanup path at all. Call this when the
 * configurator page itself unmounts (not on every inner step/mode toggle, which
 * would just thrash workers needlessly — see the call site in Configurator.tsx for
 * why it's placed there and not in usePlanViews.ts). Any renders still in flight are
 * rejected rather than left to resolve into a promise nobody awaits anymore.
 */
export function disposeWorkers(): void {
  for (const slot of [0, 1] as const) {
    workers[slot]?.terminate();
    workers[slot] = null;
  }
  const inFlight = [...pending.values()];
  pending.clear();
  inFlight.forEach((p) => p.reject(new Error('renderer disposed')));
}

export interface ViewRequest {
  readonly key: string;
  readonly geom: PlanGeom;
  readonly cam: CameraSpec;
  readonly paint: RenderPaint;
  readonly size?: number;
  readonly ss?: number;
}

/**
 * Render one view of a room. The geometry is cached by `key` inside the renderer, so
 * the key must identify the plan (shape + glazing) exactly.
 * @returns The picture (RGBA), its surface-id buffer and the time it took.
 */
export function renderView(req: ViewRequest, slot: 0 | 1 = 0): Promise<RenderOutput> {
  const size = req.size ?? 800;
  const ss = req.ss ?? 2;
  const w = workerBroken ? null : spawn(slot);
  if (!w) {
    fallback ??= import('./fallback');
    return fallback.then((m) => m.renderOnMainThread(req.key, req.geom, req.cam, req.paint, size, ss));
  }
  const id = nextId;
  nextId += 1;
  const msg: RenderRequest = { id, key: req.key, geom: req.geom, cam: req.cam, paint: req.paint, size, ss };
  return new Promise<RenderOutput>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage(msg);
  }).catch((e: unknown) => {
    if (!workerBroken) throw e;
    fallback ??= import('./fallback');
    return fallback.then((m) => m.renderOnMainThread(req.key, req.geom, req.cam, req.paint, size, ss));
  });
}

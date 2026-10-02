/**
 * @file Web worker of the room renderer: holds one `RoomRenderer` (built rooms with
 * baked light, decoded textures and the street panorama) and answers render
 * requests from the page, so a repaint never blocks the UI.
 */
import { loadEnv, loadTexture, loadUnitImage } from './assets';
import { WIN_FRAME_URL, WIN_HOUSE_URL } from './units';
import { FURNITURE_CATS, FURNITURE_KIND, furnitureUrl } from './furniture';
import { RoomRenderer } from './renderer';
import type { RenderOutput } from './renderer';
import type { PlanGeom } from '../planShapes';
import type { CameraSpec, RenderPaint } from './types';

export const STREET_URL = '/vam/tex/street-pano.webp';

export interface RenderRequest {
  readonly id: number;
  readonly key: string;
  readonly geom: PlanGeom;
  readonly cam: CameraSpec;
  readonly paint: RenderPaint;
  readonly size: number;
  readonly ss: number;
}

export interface RenderResponse {
  readonly id: number;
  readonly ok: boolean;
  readonly error?: string;
  readonly out?: RenderOutput;
}

interface Scope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<RenderRequest>) => void) | null;
}

const ctx = self as unknown as Scope;
const renderer = new RoomRenderer();
const loading = new Map<string, Promise<void>>();
let envReady: Promise<void> | null = null;

function ensureTexture(url: string): Promise<void> {
  if (renderer.hasTexture(url)) return Promise.resolve();
  let p = loading.get(url);
  if (!p) {
    p = loadTexture(url)
      .then((t) => renderer.addTexture(url, t))
      .catch(() => undefined) // a missing texture falls back to the flat colour
      .finally(() => loading.delete(url));
    loading.set(url, p);
  }
  return p;
}

function ensureUnitImage(url: string): Promise<void> {
  if (renderer.hasUnitImage(url)) return Promise.resolve();
  let p = loading.get(url);
  if (!p) {
    p = loadUnitImage(url)
      .then((img) => renderer.addUnitImage(url, img))
      .catch(() => undefined) // a missing image falls back to a plain panel
      .finally(() => loading.delete(url));
    loading.set(url, p);
  }
  return p;
}

function ensureEnv(): Promise<void> {
  envReady ??= loadEnv(STREET_URL, 2048, 512, 40, -40)
    .then((e) => renderer.setEnv(e))
    .catch(() => undefined);
  return envReady;
}

ctx.onmessage = (e: MessageEvent<RenderRequest>): void => {
  const r = e.data;
  const urls = Object.values(r.paint.surfaces).flatMap((s) => (s.tex ? [s.tex] : []));
  const furnUrls = FURNITURE_CATS.map((cat) => furnitureUrl(cat, r.paint.furniture?.[cat] ?? FURNITURE_KIND[cat].from));
  void Promise.all([ensureEnv(), ensureUnitImage(WIN_HOUSE_URL), ensureUnitImage(WIN_FRAME_URL), ...furnUrls.map(ensureUnitImage), ...urls.map(ensureTexture)])
    .then(() => {
      const out = renderer.render(r.key, r.geom, r.cam, r.paint, r.size, r.ss);
      const res: RenderResponse = { id: r.id, ok: true, out };
      ctx.postMessage(res, [out.rgba.buffer, out.ids.buffer]);
    })
    .catch((err: unknown) => {
      const res: RenderResponse = { id: r.id, ok: false, error: err instanceof Error ? err.message : String(err) };
      ctx.postMessage(res);
    });
};

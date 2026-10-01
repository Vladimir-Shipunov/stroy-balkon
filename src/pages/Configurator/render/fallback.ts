/**
 * @file Main-thread fallback of the room renderer, for browsers without module
 * workers or OffscreenCanvas: decodes assets through ordinary <img> + <canvas> and
 * renders on the page's thread (a repaint then blocks the UI for a fraction of a second).
 */
import type { PlanGeom } from '../planShapes';
import { RoomRenderer } from './renderer';
import type { RenderOutput } from './renderer';
import type { CameraSpec, EnvData, RenderPaint, TexData, UnitImage } from './types';
import { WIN_FRAME_URL, WIN_HOUSE_URL, makeUnitImage } from './units';

const renderer = new RoomRenderer();
const loading = new Map<string, Promise<void>>();
let envReady: Promise<void> | null = null;

function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`${url}: failed to load`));
    img.src = url;
  });
}

function pixels(img: HTMLImageElement, w: number, h: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

function texture(img: HTMLImageElement): TexData {
  let size = 512;
  const data = pixels(img, size, size);
  let rgb = new Float32Array(size * size * 3);
  for (let i = 0; i < size * size; i += 1) {
    rgb[i * 3] = data[i * 4]! / 255;
    rgb[i * 3 + 1] = data[i * 4 + 1]! / 255;
    rgb[i * 3 + 2] = data[i * 4 + 2]! / 255;
  }
  const levels = [{ size, rgb }];
  while (size > 4) {
    const half = size / 2;
    const next = new Float32Array(half * half * 3);
    for (let y = 0; y < half; y += 1) {
      for (let x = 0; x < half; x += 1) {
        const a = (2 * y * size + 2 * x) * 3;
        for (let c = 0; c < 3; c += 1) next[(y * half + x) * 3 + c] = (rgb[a + c]! + rgb[a + 3 + c]! + rgb[a + size * 3 + c]! + rgb[a + size * 3 + 3 + c]!) / 4;
      }
    }
    size = half;
    rgb = next;
    levels.push({ size, rgb });
  }
  return { levels };
}

function env(img: HTMLImageElement): EnvData {
  const w = 2048;
  const h = 512;
  const data = pixels(img, w, h);
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i += 1) {
    rgb[i * 3] = data[i * 4]! / 255;
    rgb[i * 3 + 1] = data[i * 4 + 1]! / 255;
    rgb[i * 3 + 2] = data[i * 4 + 2]! / 255;
  }
  return { w, h, rgb, elTop: (40 * Math.PI) / 180, elBottom: (-40 * Math.PI) / 180 };
}

function unitImage(img: HTMLImageElement): UnitImage {
  return makeUnitImage(img.naturalWidth, img.naturalHeight, pixels(img, img.naturalWidth, img.naturalHeight));
}

function ensureUnitImage(url: string): Promise<void> {
  if (renderer.hasUnitImage(url)) return Promise.resolve();
  let p = loading.get(url);
  if (!p) {
    p = image(url)
      .then((img) => renderer.addUnitImage(url, unitImage(img)))
      .catch(() => undefined)
      .finally(() => loading.delete(url));
    loading.set(url, p);
  }
  return p;
}

function ensureTexture(url: string): Promise<void> {
  if (renderer.hasTexture(url)) return Promise.resolve();
  let p = loading.get(url);
  if (!p) {
    p = image(url)
      .then((img) => renderer.addTexture(url, texture(img)))
      .catch(() => undefined)
      .finally(() => loading.delete(url));
    loading.set(url, p);
  }
  return p;
}

export async function renderOnMainThread(key: string, geom: PlanGeom, cam: CameraSpec, paint: RenderPaint, size: number, ss: number): Promise<RenderOutput> {
  envReady ??= image('/vam/tex/street-pano.webp')
    .then((img) => renderer.setEnv(env(img)))
    .catch(() => undefined);
  const urls = Object.values(paint.surfaces).flatMap((s) => (s.tex ? [s.tex] : []));
  await Promise.all([envReady, ensureUnitImage(WIN_HOUSE_URL), ensureUnitImage(WIN_FRAME_URL), ...urls.map(ensureTexture)]);
  return renderer.render(key, geom, cam, paint, size, ss);
}

/**
 * @file Image assets of the room renderer, decoded for per-pixel sampling: tileable
 * finish textures (float RGB with a mip chain) and the street panorama. Uses
 * `fetch` + `createImageBitmap` + `OffscreenCanvas`, so it works inside the worker.
 */
import type { EnvData, TexData } from './types';

const TEX_SIZE = 512;

async function pixels(url: string, w: number, h: number): Promise<Uint8ClampedArray> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return ctx.getImageData(0, 0, w, h).data;
}

/** A tileable texture, 512² with a box-filtered mip chain down to 4². */
export async function loadTexture(url: string): Promise<TexData> {
  const data = await pixels(url, TEX_SIZE, TEX_SIZE);
  let size = TEX_SIZE;
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
        for (let c = 0; c < 3; c += 1) {
          next[(y * half + x) * 3 + c] = (rgb[a + c]! + rgb[a + 3 + c]! + rgb[a + size * 3 + c]! + rgb[a + size * 3 + 3 + c]!) / 4;
        }
      }
    }
    size = half;
    rgb = next;
    levels.push({ size, rgb });
  }
  return { levels };
}

/** The street panorama: 360° across, `elTopDeg`..`elBottomDeg` down. */
export async function loadEnv(url: string, w: number, h: number, elTopDeg: number, elBottomDeg: number): Promise<EnvData> {
  const data = await pixels(url, w, h);
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i += 1) {
    rgb[i * 3] = data[i * 4]! / 255;
    rgb[i * 3 + 1] = data[i * 4 + 1]! / 255;
    rgb[i * 3 + 2] = data[i * 4 + 2]! / 255;
  }
  return { w, h, rgb, elTop: (elTopDeg * Math.PI) / 180, elBottom: (elBottomDeg * Math.PI) / 180 };
}

/**
 * @file Canvas drawing for the fitted photo frames: the shades laid over a wall (`drawShade`) and the warped
 * far wall with its ledge (`paintWarp`, the maths is in `vamWarp.ts`, the resampling in `vamResample.ts`). The screen and the saved image both use
 * these, so they cannot drift apart.
 */
import { shadeAo, shadeColors, shadePolygon } from './vamFit';
import type { FitPt, FitShade } from './vamFit';
import { resampleWarp } from './vamResample';
import type { WarpView } from './vamResample';
import { warpPoint, warpShades } from './vamWarp';
import type { WarpLayout } from './vamWarp';

/** The side of the square picture, in pixels. */
export const PAINT_SIZE = 800;

/** The colour a view shows where no picture covers it (the scene's own backdrop). */
export const BACKDROP = '#8a8f96';

/**
 * One shade over its wall: the ramp through its stops across its columns, clipped to the wall below its top line,
 * then the ceiling's contact shadow (a vertical fade from that line) over it — the same two layers the CSS builds.
 */
export function drawShade(ctx: CanvasRenderingContext2D, shade: FitShade, size: number = PAINT_SIZE): void {
  const colours = shadeColors(shade);
  const ramp = ctx.createLinearGradient((shade.x0 / 100) * size, 0, (shade.x1 / 100) * size, 0);
  shade.stops.forEach(([position], i) => ramp.addColorStop(position, colours[i]!));
  const wall = new Path2D();
  shadePolygon(shade).forEach(([x, y], i) => {
    const px = (x / 100) * size;
    const py = (y / 100) * size;
    if (i === 0) wall.moveTo(px, py);
    else wall.lineTo(px, py);
  });
  wall.closePath();
  ctx.fillStyle = ramp;
  ctx.fill(wall);
  const ao = shadeAo(shade);
  if (ao) {
    const [y, darkness, height] = ao;
    const fade = ctx.createLinearGradient(0, (y / 100) * size, 0, ((y + height) / 100) * size);
    fade.addColorStop(0, `rgba(0, 0, 0, ${darkness})`);
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fade;
    ctx.fill(wall);
  }
}

/**
 * The layers of a view flattened onto one square canvas, flipped when the screen is drawn mirrored. With a `backdrop`
 * the canvas is first filled with it, so a layer that failed to load leaves the backdrop's colour, not a hole.
 */
function flatten(images: readonly CanvasImageSource[], mirror: boolean, backdrop?: string): HTMLCanvasElement {
  const stack = document.createElement('canvas');
  stack.width = PAINT_SIZE;
  stack.height = PAINT_SIZE;
  // The flattened picture is read back once (getImageData) and not drawn again.
  const ctx = stack.getContext('2d', { willReadFrequently: true });
  if (!ctx) return stack;
  if (backdrop) {
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, PAINT_SIZE, PAINT_SIZE);
  }
  if (mirror) {
    ctx.translate(PAINT_SIZE, 0);
    ctx.scale(-1, 1);
  }
  for (const image of images) ctx.drawImage(image, 0, 0, PAINT_SIZE, PAINT_SIZE);
  return stack;
}

const px = (percent: number): number => (percent / 100) * PAINT_SIZE;

/** One layer of a view: where it came from (its url) and the loaded image. */
export interface PaintLayer {
  readonly url: string;
  readonly image: CanvasImageSource;
}

/** The top centre (percent of the picture) of what a canvas draws — the lowest-numbered row with something on it, the middle of that row's reach. */
function topCentre(canvas: HTMLCanvasElement): FitPt | undefined {
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let maxX = -1;
  let minY = height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
      }
    }
  }
  return maxX < 0 ? undefined : [(((minX + maxX) / 2) / width) * 100, (minY / height) * 100];
}

/** A view's layers made ready to paint at any frame size: the flattened photo, and each rigid layer (a lamp) with where it hangs. */
export interface PreparedWarp {
  readonly photo: ImageData;
  readonly rigid: readonly { readonly canvas: HTMLCanvasElement; readonly anchor: FitPt }[];
}

/**
 * Flattens the layers of a warped view once, so that painting it again — at another size, or for another zoom — costs only
 * the resampling. Layers that stay rigid (the warp's `rigid` list) are kept apart, each with its top centre.
 * @returns undefined when there is nothing to paint or no 2D canvas.
 */
export function prepareWarp(layers: readonly PaintLayer[], mirror: boolean, layout: WarpLayout, backdrop: string = BACKDROP): PreparedWarp | undefined {
  if (layers.length === 0) return undefined;
  const rigidParts = layout.warp.rigid ?? [];
  const isRigid = (layer: PaintLayer): boolean => rigidParts.some((part) => layer.url.includes(part));
  const stack = flatten(layers.filter((layer) => !isRigid(layer)).map((layer) => layer.image), mirror, backdrop);
  const photo = stack.getContext('2d')?.getImageData(0, 0, PAINT_SIZE, PAINT_SIZE);
  // The flattened canvas is not needed any more: give its memory back at once (a browser caps the canvases it keeps).
  stack.width = 0;
  stack.height = 0;
  if (!photo) return undefined;
  const rigid = layers.filter(isRigid).flatMap((layer) => {
    const canvas = flatten([layer.image], mirror);
    const anchor = topCentre(canvas);
    return anchor ? [{ canvas, anchor }] : [];
  });
  return { photo, rigid };
}

/**
 * Paints the finished frame of a prepared warped view onto `target`, at the canvas's own pixel size — device pixels, so
 * the screen shows it 1:1 and nothing resamples it a second time (`vamResample.ts` explains why that matters): the
 * flattened photo is resampled once through the warp and the fit's zoom/pan; then the runs' shades go on, then the layers the warp asks to keep rigid — a lamp — each
 * with its top centre where the warp puts that point of the photo, but undistorted. The shades and the lamp are laid in
 * picture coordinates through the same zoom/pan.
 * @returns true when something was drawn.
 */
export function paintPrepared(target: HTMLCanvasElement, prepared: PreparedWarp, layout: WarpLayout, view: WarpView): boolean {
  const ctx = target.getContext('2d');
  if (!ctx) return false;
  const { width, height } = target;
  const pixels = resampleWarp(prepared.photo, layout, view, width, height);
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);

  ctx.save();
  // Picture pixels (0..800) → frame pixels: the fit's zoom about the frame's centre, then its pan.
  ctx.setTransform(
    (width * view.scaleX) / PAINT_SIZE,
    0,
    0,
    (height * view.scaleY) / PAINT_SIZE,
    (width * (50 - 50 * view.scaleX + view.shiftX)) / 100,
    (height * (50 - 50 * view.scaleY + view.shiftY)) / 100,
  );
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const shade of warpShades(layout)) drawShade(ctx, shade);
  for (const { canvas, anchor } of prepared.rigid) {
    const [x, y] = warpPoint(layout, anchor[0], anchor[1]);
    ctx.drawImage(canvas, px(x - anchor[0]), px(y - anchor[1]));
  }
  ctx.restore();
  return true;
}

/** `prepareWarp` and `paintPrepared` in one call, for a view painted once (the saved picture). */
export function paintWarp(target: HTMLCanvasElement, layers: readonly PaintLayer[], mirror: boolean, layout: WarpLayout, view: WarpView, backdrop?: string): boolean {
  const prepared = prepareWarp(layers, mirror, layout, backdrop);
  return prepared ? paintPrepared(target, prepared, layout, view) : false;
}

/**
 * plus the layers of the chosen finishes, stacked on a shared 800x800 canvas.
 * Every furniture and finish layer keeps the exact placement from the source app.
 * A new layer list is preloaded before it replaces the current one so colour
 * changes swap in one step. Children (the tap targets) are drawn over the picture.
 */
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useZoomPan } from './useZoomPan';
import { fitClipPath, fitMatrix, fitPieces, fitTransform, pieceClipPath, pieceTransform, shadeBackground, shadeClipPath } from './vamFit';
import type { SceneFit } from './vamFit';
import { BACKDROP, drawShade, paintPrepared, prepareWarp } from './vamPaint';
import type { PaintLayer, PreparedWarp } from './vamPaint';
import { warpViewOf } from './vamResample';
import { warpLayout } from './vamWarp';
import styles from './VamScene.module.css';

export interface VamSceneHandle {
  /** The current view flattened to an 800x800 canvas. */
  captureCanvas: () => HTMLCanvasElement | null;
}

interface VamSceneProps {
  readonly layers: readonly string[];
  readonly mirror: boolean;
  readonly viewIndex: 0 | 1;
  /** Crop + a few degrees of turn applied to the whole picture (`vamFit.ts`), in the displayed orientation. */
  readonly fit?: SceneFit | undefined;
  readonly children?: ReactNode;
  /** Disambiguates this view's zoom-control labels when more than one view is on screen at once. */
  readonly viewLabel?: string;
}

const SIZE = 800;
/**
 * Bounds of a warped frame's own pixel size: never an empty canvas, and no more than 1.6 times the picture's own 800 px —
 * past that there is no detail left to show, and a paint that size takes the main thread for too long.
 */
const MIN_PIXELS = 120;
const MAX_PIXELS = 1280;
/** How long a frame's size must stay put before its warped picture is repainted at the new size (the old bitmap is stretched meanwhile). */
const RESIZE_SETTLE_MS = 120;

function preload(urls: readonly string[]): Promise<string[]> {
  return Promise.resolve([...urls]);
}

/** The layers of a layer list, in order, once each has loaded (a layer that fails to load is left out). */
function loadImages(urls: readonly string[]): Promise<PaintLayer[]> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<PaintLayer | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ url, image: img });
          img.onerror = () => resolve(null);
          img.src = url;
        }),
    ),
  ).then((layers) => layers.filter((layer): layer is PaintLayer => layer !== null));
}

/**
 * One stacked 2D view.
 * @returns The scene element.
 */
export const VamScene = forwardRef<VamSceneHandle, VamSceneProps>(function VamScene({ layers, mirror, fit, viewIndex, children, viewLabel }, ref) {
  const suffix = viewLabel ? ` — ${viewLabel}` : '';
  const signature = layers.join('|');
  const [shown, setShown] = useState<readonly string[]>(layers);
  const canvasRef = useRef<HTMLDivElement>(null);
  const warpRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const preparedRef = useRef<PreparedWarp | undefined>(undefined);
  const [prepared, setPrepared] = useState<PreparedWarp | undefined>(undefined);
  const [deviceWidth, setDeviceWidth] = useState(SIZE);
  const zoomPan = useZoomPan();
  // A warped far wall (vamWarp.ts) is drawn onto a canvas in place of the picture: the finished frame, resampled once
  // from the picture's own pixels at the size the screen shows (device pixels), so nothing scales it a second time.
  const warp = useMemo(() => (fit?.warp ? warpLayout(fit.warp) : undefined), [fit]);
  const view = useMemo(() => warpViewOf(fit), [fit]);
  const backdrop = fit?.backdrop ?? BACKDROP;
  // Zoomed in, the frame is drawn that much larger (in half steps, so a wheel does not repaint on every tick), so the
  // magnified picture is as sharp as the other frame's, whose layers are the picture's own pixels.
  const zoomStep = Math.max(1, Math.ceil(zoomPan.scale * 2) / 2);
  const pixels = Math.min(MAX_PIXELS, Math.max(MIN_PIXELS, Math.round(deviceWidth * zoomStep)));

  // The width of the frame in device pixels: measured on the canvas itself, as the browser lays it out (window resize, browser
  // zoom, another screen's pixel ratio). The first measure is taken at once; later ones when the size has settled.
  useEffect(() => {
    const target = warpRef.current;
    if (!warp || !target) return undefined;
    let timer: number | undefined;
    let first = true;
    let media: MediaQueryList | undefined;
    // The layout width (the observer's content box: fractional, and not scaled by the zoom's CSS transform) times the page's
    // own pixel ratio. (The observer's device-pixel box is not used: it follows the real monitor's scale, which an emulated
    // or zoomed page can disagree with.)
    let layoutWidth = target.offsetWidth;
    const apply = (): void => {
      const next = Math.round(layoutWidth * (window.devicePixelRatio || 1));
      if (next > 0) setDeviceWidth((now) => (now === next ? now : next));
    };
    const schedule = (): void => {
      window.clearTimeout(timer);
      if (first) {
        first = false;
        apply();
        return;
      }
      timer = window.setTimeout(apply, RESIZE_SETTLE_MS);
    };
    // A change of the screen's pixel ratio that leaves the layout as it is (the window moved to another monitor) fires no resize.
    const watchRatio = (): void => {
      media?.removeEventListener('change', onRatio);
      if (typeof window.matchMedia !== 'function') return;
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      media.addEventListener('change', onRatio);
    };
    const onRatio = (): void => {
      schedule();
      watchRatio();
    };
    const observer = new ResizeObserver((entries) => {
      layoutWidth = entries[entries.length - 1]!.contentRect.width;
      schedule();
    });
    observer.observe(target);
    watchRatio();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      media?.removeEventListener('change', onRatio);
    };
  }, [warp]);

  // The layers are flattened once per layer list; a new size, zoom or turn only repaints from that.
  useEffect(() => {
    if (!warp) return undefined;
    let cancelled = false;
    void loadImages(shown).then((loaded) => {
      if (cancelled) return;
      const next = prepareWarp(loaded, mirror, warp, backdrop);
      preparedRef.current = next;
      setPrepared(next);
    });
    return () => {
      cancelled = true;
    };
  }, [shown, mirror, warp, backdrop]);

  // Painted before the browser shows the frame, so a change of the canvas's size (which clears it) never shows an empty one.
  useLayoutEffect(() => {
    const target = warpRef.current;
    if (!warp || !target || !prepared) return;
    try {
      paintPrepared(target, prepared, warp, view);
    } catch (error) {
      console.error('The warped frame could not be painted', error);
    }
  }, [prepared, warp, view, pixels]);

  useEffect(() => {
    let cancelled = false;
    const wanted = signature ? signature.split('|') : [];
    void preload(wanted).then((preparedLayers) => {
      if (!cancelled) setShown((now) => (now.join('|') === preparedLayers.join('|') ? now : preparedLayers));
    });
    return () => {
      cancelled = true;
    };
  }, [signature, viewIndex]);

  useImperativeHandle(
    ref,
    () => ({
      captureCanvas: () => {
        const root = canvasRef.current;
        // A warped view has no layer stack in the page: the saved picture is painted afresh from the loaded layers.
        if (!root && !(warp && preparedRef.current)) return null;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.fillStyle = fit?.backdrop ?? BACKDROP;
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.save();
        // The crop is in screen space, the turn about the picture's centre — the same order as the CSS below.
        if (fit?.clip && fit.clip.length >= 3) {
          ctx.beginPath();
          fit.clip.forEach(([x, y], i) => {
            const px = (x / 100) * SIZE;
            const py = (y / 100) * SIZE;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.clip();
        }
        if (fit && !warp) {
          const m = fitMatrix(fit);
          const c = SIZE / 2;
          ctx.transform(m.a, m.b, m.c, m.d, c + (m.e / 100) * SIZE - m.a * c - m.c * c, c + (m.f / 100) * SIZE - m.b * c - m.d * c);
        }
        const drawStack = (): void => {
          ctx.save();
          if (mirror) {
            ctx.translate(SIZE, 0);
            ctx.scale(-1, 1);
          }
          for (const img of Array.from(root?.querySelectorAll('img') ?? [])) {
            if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, 0, 0, SIZE, SIZE);
          }
          ctx.restore();
        };
        const pieces = fitPieces(fit);
        if (warp) {
          // The finished frame (zoom and pan included), painted at the saved picture's own size.
          const frame = document.createElement('canvas');
          frame.width = SIZE;
          frame.height = SIZE;
          if (preparedRef.current) paintPrepared(frame, preparedRef.current, warp, view);
          ctx.drawImage(frame, 0, 0, SIZE, SIZE);
        } else if (pieces) {
          // A picture cut along a band: each piece is squeezed, sheared and moved (`translate() matrix()` about the
          // picture's top-left corner) with its clip riding along — a CSS `clip-path` is in the element's own
          // coordinates, but a canvas clip is fixed where it was set, so the transform comes first and the clip
          // rectangle is laid down in the piece's own coordinates through it. Its shade is laid over the wall
          // inside the same transform.
          for (const p of pieces) {
            ctx.save();
            ctx.transform(p.k, p.sl, 0, 1, (p.tx / 100) * SIZE, (p.ty / 100) * SIZE);
            ctx.beginPath();
            ctx.rect((p.x0 / 100) * SIZE, 0, ((p.x1 - p.x0) / 100) * SIZE, SIZE);
            ctx.clip();
            drawStack();
            if (p.shade) drawShade(ctx, p.shade, SIZE);
            ctx.restore();
          }
        } else {
          drawStack();
        }
        ctx.restore();
        return canvas;
      },
    }),
    [mirror, fit, warp, view],
  );

  const clipPath = fitClipPath(fit);
  const pieces = fitPieces(fit);
  const stack = (ref?: React.Ref<HTMLDivElement>): JSX.Element => (
    <div ref={ref} className={`${styles.layers} ${mirror ? styles.mirror : ''}`}>
      {shown.map((url, i) => (
        <img key={`${i}-${url}`} src={url} alt="" className={styles.layer} draggable={false} />
      ))}
    </div>
  );

  return (
    <div
      ref={(el) => {
        frameRef.current = el;
        zoomPan.containerRef(el);
      }}
      className={styles.canvas}
      style={fit?.backdrop ? { background: fit.backdrop } : undefined}
      {...zoomPan.containerHandlers}
    >
      <div className={styles.zoomWrap} style={zoomPan.style}>
        <div className={styles.fitClip} style={clipPath ? { clipPath } : undefined}>
          <div className={styles.fitMove} style={fit && !warp ? { transform: fitTransform(fit) } : undefined}>
            {warp ? (
              <canvas ref={warpRef} className={styles.warpCanvas} width={pixels} height={pixels} />
            ) : pieces ? (
              pieces.map((p, i) => (
                <div
                  key={i}
                  className={styles.fitPiece}
                  style={{ clipPath: pieceClipPath(p), transform: pieceTransform(p), transformOrigin: '0 0' }}
                >
                  {stack(i === 0 ? canvasRef : undefined)}
                  {p.shade ? <div className={styles.fitShade} style={{ clipPath: shadeClipPath(p), background: shadeBackground(p) }} /> : null}
                </div>
              ))
            ) : (
              stack(canvasRef)
            )}
          </div>
        </div>
        {children}
      </div>
      <div className={styles.zoomControls}>
        <button type="button" className={styles.zoomBtn} onClick={zoomPan.zoomIn} disabled={!zoomPan.canZoomIn} aria-label={`Увеличить${suffix}`}>
          +
        </button>
        <button type="button" className={styles.zoomBtn} onClick={zoomPan.zoomOut} disabled={!zoomPan.canZoomOut} aria-label={`Уменьшить${suffix}`}>
          –
        </button>
        <button type="button" className={styles.zoomBtn} onClick={zoomPan.reset} disabled={!zoomPan.isZoomed} aria-label={`Сбросить масштаб${suffix}`}>
          ⟲
        </button>
      </div>
    </div>
  );
});

/**
 * @file VamScene — one 2D camera view of the balcony: the bare background images
 * plus the layers of the chosen finishes, stacked on a shared 800x800 canvas (each
 * layer already sits at its final position). A new layer list is preloaded before
 * it replaces the current one so colour changes swap in one step. Children (the
 * tap targets) are drawn over the picture.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useZoomPan } from './useZoomPan';
import styles from './VamScene.module.css';

export interface VamSceneHandle {
  /** The current view flattened to an 800x800 canvas. */
  captureCanvas: () => HTMLCanvasElement | null;
}

interface VamSceneProps {
  readonly layers: readonly string[];
  readonly mirror: boolean;
  readonly children?: ReactNode;
  /** Disambiguates this view's zoom-control labels when more than one view is on screen at once. */
  readonly viewLabel?: string;
}

const BACKDROP = '#8a8f96';
const SIZE = 800;

function preload(urls: readonly string[]): Promise<void> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  ).then(() => undefined);
}

/**
 * One stacked 2D view.
 * @returns The scene element.
 */
export const VamScene = forwardRef<VamSceneHandle, VamSceneProps>(function VamScene({ layers, mirror, children, viewLabel }, ref) {
  const suffix = viewLabel ? ` — ${viewLabel}` : '';
  const signature = layers.join('|');
  const [shown, setShown] = useState<readonly string[]>(layers);
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomPan = useZoomPan();

  useEffect(() => {
    let cancelled = false;
    const wanted = signature ? signature.split('|') : [];
    void preload(wanted).then(() => {
      if (!cancelled) setShown(wanted);
    });
    return () => {
      cancelled = true;
    };
  }, [signature]);

  useImperativeHandle(
    ref,
    () => ({
      captureCanvas: () => {
        const root = canvasRef.current;
        if (!root) return null;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.fillStyle = BACKDROP;
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.save();
        if (mirror) {
          ctx.translate(SIZE, 0);
          ctx.scale(-1, 1);
        }
        for (const img of Array.from(root.querySelectorAll('img'))) {
          if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, 0, 0, SIZE, SIZE);
        }
        ctx.restore();
        return canvas;
      },
    }),
    [mirror],
  );

  return (
    <div ref={zoomPan.containerRef} className={styles.canvas} {...zoomPan.containerHandlers}>
      <div className={styles.zoomWrap} style={zoomPan.style}>
        <div ref={canvasRef} className={`${styles.layers} ${mirror ? styles.mirror : ''}`}>
          {shown.map((url, i) => (
            <img key={`${i}-${url}`} src={url} alt="" className={styles.layer} draggable={false} />
          ))}
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

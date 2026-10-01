/**
 * @file VamScene — one 2D camera view of the balcony: the bare background images
 * plus the layers of the chosen finishes, stacked on a shared 800x800 canvas (each
 * layer already sits at its final position). A new layer list is preloaded before
 * it replaces the current one so colour changes swap in one step. Children (the
 * tap targets) are drawn over the picture.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './VamScene.module.css';

export interface VamSceneHandle {
  /** The current view flattened to an 800x800 canvas. */
  captureCanvas: () => HTMLCanvasElement | null;
}

interface VamSceneProps {
  readonly layers: readonly string[];
  readonly mirror: boolean;
  readonly children?: ReactNode;
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
export const VamScene = forwardRef<VamSceneHandle, VamSceneProps>(function VamScene({ layers, mirror, children }, ref) {
  const signature = layers.join('|');
  const [shown, setShown] = useState<readonly string[]>(layers);
  const canvasRef = useRef<HTMLDivElement>(null);

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
    <div className={styles.canvas}>
      <div ref={canvasRef} className={`${styles.layers} ${mirror ? styles.mirror : ''}`}>
        {shown.map((url, i) => (
          <img key={`${i}-${url}`} src={url} alt="" className={styles.layer} draggable={false} />
        ))}
      </div>
      {children}
    </div>
  );
});

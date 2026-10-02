/**
 * @file PlanScene — one view of the balcony room, drawn from its plan (`render/`):
 * the picture is painted on a canvas, and every surface gets a round tap target
 * placed from the picture itself (`usePlanViews`), so a target always sits on the
 * surface it opens.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { PlanView } from './usePlanViews';
import type { SurfaceKind } from './planGeometry';
import type { VamSceneHandle } from './VamScene';
import styles from './VamScene.module.css';
import wizard from './Wizard.module.css';

interface PlanSceneProps {
  /** The rendered view; null until the first picture arrives. */
  readonly view: PlanView | null;
  readonly chosen: ReadonlySet<string>;
  readonly activeId: string | null;
  readonly onSpot: (id: string) => void;
  readonly title: (id: string) => string;
}

const DROP = <path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z" />;
// A plank pattern for the floor — the app's own "узор" icon, kept distinct from the
// plain drop shared by walls and ceiling.
const FLOOR_ICON = <path d="M3 19l7-3M3 14l7-3M3 9l7-3M11 21l10-4M11 15l10-4M11 9l10-4" />;
// The app has one "мебель" (furniture) icon — a grid of squares — for every furniture tap
// target (cabinet, dryer, planter alike); matches `FinishStep.tsx`'s `HotspotIcon`.
const FURNITURE_ICON = (
  <>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <rect x="14" y="14" width="6" height="6" rx="1" />
  </>
);
const ICON: Readonly<Record<SurfaceKind, JSX.Element>> = {
  wall: DROP,
  floor: FLOOR_ICON,
  ceiling: DROP,
  frame: <path d="M4 20l5-1 9-9-4-4-9 9-1 5zM13 6l4 4" />,
  light: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />,
  sill: DROP,
  plintus: DROP,
  cabinet: FURNITURE_ICON,
  dryer: FURNITURE_ICON,
  flowers: FURNITURE_ICON,
};

/**
 * A drawn view of the balcony room.
 * @returns The scene element.
 */
export const PlanScene = forwardRef<VamSceneHandle, PlanSceneProps>(function PlanScene({ view, chosen, activeId, onSpot, title }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !view) return;
    if (canvas.width !== view.w) canvas.width = view.w;
    if (canvas.height !== view.h) canvas.height = view.h;
    ctx.putImageData(new ImageData(view.rgba, view.w, view.h), 0, 0);
  }, [view]);

  useImperativeHandle(
    ref,
    () => ({
      captureCanvas: () => {
        if (!view) return null;
        const canvas = document.createElement('canvas');
        canvas.width = view.w;
        canvas.height = view.h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.putImageData(new ImageData(view.rgba, view.w, view.h), 0, 0);
        return canvas;
      },
    }),
    [view],
  );

  return (
    <div className={styles.canvas}>
      <canvas ref={canvasRef} width={800} height={800} className={styles.layer} />
      {view?.spots.map(({ surface, x, y }) => (
        <button
          key={surface.id}
          type="button"
          className={`${wizard.hotspot} ${chosen.has(surface.id) ? wizard.hotspotDone : ''} ${activeId === surface.id ? wizard.hotspotActive : ''}`}
          style={{ left: `${x}%`, top: `${y}%` }}
          onClick={() => onSpot(surface.id)}
          aria-label={title(surface.id)}
          title={title(surface.id)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICON[surface.kind]}
          </svg>
          {surface.kind === 'wall' ? <span className={wizard.badge}>{surface.id.replace('P:w', '')}</span> : null}
        </button>
      ))}
    </div>
  );
});

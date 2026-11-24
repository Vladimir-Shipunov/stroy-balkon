/**
 * @file Read-only re-render of an order's saved configurator state (`metadata.scene2d`,
 * a `VamSelection` — see `Configurator.tsx`'s `requestMeasure()`), for the admin order
 * detail page. Reuses the same scene components the configurator itself uses, with no
 * editing affordances: hotspot taps are no-ops, there is no finishes panel.
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { VamScene } from '../Configurator/VamScene';
import { VAM_AVAILABLE_SHAPES, vamScreen, vamViewLayerUrls } from '../Configurator/vamCatalog';
import type { VamPick, VamSelection } from '../Configurator/vamCatalog';
import styles from './SavedConfigPreview.module.css';

function isVamPick(v: unknown): v is VamPick {
  if (!v || typeof v !== 'object') return false;
  const p = v as Partial<VamPick>;
  return typeof p.o === 'string' && typeof p.k === 'number' && Number.isInteger(p.k) && p.k >= 0;
}

/** `scene2d` is an order's stored `metadata.scene2d` — submitted by the client at order
 * time and only loosely checked server-side (`configValidator.js` validates the app's
 * real photo-mode hotspot ids permissively, by design — see its file header). Treat it
 * as untrusted: check every pick's shape here too, not just the top-level fields, before
 * it reaches `vamViewLayerUrls()` (which builds image URLs from `pick.k`). */
function isVamSelection(v: unknown): v is VamSelection {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<VamSelection>;
  if (typeof s.shape !== 'string' || typeof s.glazing !== 'string') return false;
  if (!s.picks || typeof s.picks !== 'object') return false;
  return Object.values(s.picks).every(isVamPick);
}

function PhotoPreview({ selection }: { readonly selection: VamSelection }): JSX.Element {
  const screen = useMemo(() => vamScreen(selection), [selection]);
  const layerUrls = useMemo(() => screen.views.map((_view, i) => vamViewLayerUrls(screen, i as 0 | 1, selection.picks)), [screen, selection.picks]);
  return (
    <div className={styles.views}>
      {screen.views.map((_view, i) => (
        <div key={i} className={styles.viewCard}>
          <VamScene layers={layerUrls[i]!} mirror={screen.mirror} viewIndex={i as 0 | 1} viewLabel={`кадр ${i + 1}`} />
        </div>
      ))}
    </div>
  );
}

/**
 * The saved configuration re-rendered exactly as the customer last saw it, read-only.
 * @returns The preview, or null when `scene2d` is missing/malformed (older orders, or
 * a shape id that no longer exists in the catalogue) — the caller falls back to the
 * captured screenshot or the text summary in that case.
 */
export function SavedConfigPreview({ scene2d, fallback = null }: { readonly scene2d: unknown; readonly fallback?: ReactNode }): JSX.Element | null {
  if (!isVamSelection(scene2d) || !VAM_AVAILABLE_SHAPES.some((shape) => shape.id === scene2d.shape)) return <>{fallback}</>;
  return <PhotoPreview selection={scene2d} />;
}

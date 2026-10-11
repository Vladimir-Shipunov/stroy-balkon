/**
 * @file Read-only re-render of an order's saved configurator state (`metadata.scene2d`,
 * a `VamSelection` — see `Configurator.tsx`'s `requestMeasure()`), for the admin order
 * detail page. Reuses the same scene components the configurator itself uses, with no
 * editing affordances: hotspot taps are no-ops, there is no finishes panel.
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { PlanScene } from '../Configurator/PlanScene';
import { findVamShape, vamRenderPaint } from '../Configurator/vamCatalog';
import type { VamSelection } from '../Configurator/vamCatalog';
import { PLAN_SHAPES, planFor } from '../Configurator/planShapes';
import { usePlanViews } from '../Configurator/usePlanViews';
import styles from './SavedConfigPreview.module.css';

const EMPTY_SET: ReadonlySet<string> = new Set();
function noopSpot(): void {
  // Read-only preview: tap targets stay visible (they double as a legend) but do nothing.
}
function noopTitle(): string {
  return '';
}

function isVamSelection(v: unknown): v is VamSelection {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<VamSelection>;
  return typeof s.shape === 'string' && typeof s.glazing === 'string' && typeof s.picks === 'object' && s.picks !== null;
}

function PlanPreview({ selection }: { readonly selection: VamSelection }): JSX.Element {
  const geom = useMemo(() => planFor(selection.shape, selection.glazing), [selection.shape, selection.glazing]);
  const paint = useMemo(() => vamRenderPaint(selection), [selection]);
  const { views } = usePlanViews(`${selection.shape}|${selection.glazing}`, geom ?? PLAN_SHAPES.loggia!, paint, true);
  return (
    <div className={styles.views}>
      {([0, 1] as const).map((i) => (
        <div key={i} className={styles.viewCard}>
          <PlanScene view={views[i]!} chosen={EMPTY_SET} activeId={null} onSpot={noopSpot} title={noopTitle} viewLabel={`кадр ${i + 1}`} />
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
  if (!isVamSelection(scene2d) || !findVamShape(scene2d.shape)) return <>{fallback}</>;
  return <PlanPreview selection={scene2d} />;
}

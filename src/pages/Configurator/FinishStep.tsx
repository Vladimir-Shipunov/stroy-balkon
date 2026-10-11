/**
 * @file FinishStep — the second screen, as in the app ("Выбор отделки"): the balcony
 * seen from two sides, with a round tap target on every surface (walls, ceiling,
 * floor, windows, light, furniture). A tap opens that surface's materials and
 * colours in the side panel; nothing is drawn on a surface until it is chosen.
 */
import { useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject } from 'react';
import { Check, DownloadIcon } from '../../components/icons';
import { PlanScene } from './PlanScene';
import { ShapePlan } from './ShapePlan';
import { VamScene } from './VamScene';
import type { VamSceneHandle } from './VamScene';
import { downloadSpecPdf, SpecPdfError } from './exportPdf';
import { SaveProjectButton } from './SaveProjectButton';
import type { Action, ConfigState } from './useConfigurator';
import { findVamShape, hotspotTitle, pickKey, pickedOption, vamPlanHotspots, vamRenderPaint, vamScreen, vamViewLayerUrls } from './vamCatalog';
import { PLAN_SHAPES, planFor } from './planShapes';
import { usePlanViews } from './usePlanViews';
import { downloadSvgElement, svgFilename } from './exportSvg';
import type { AppHotspot, AppSlot, HotspotKind } from './vamCatalog';
import styles from './Wizard.module.css';
import panel from './Configurator.module.css';

interface FinishStepProps {
  readonly state: ConfigState;
  readonly dispatch: Dispatch<Action>;
  readonly sceneRefs: readonly [RefObject<VamSceneHandle>, RefObject<VamSceneHandle>];
}

/** Line icons of the round tap targets (the app draws a drop for every surface). */
function HotspotIcon({ kind }: { readonly kind: HotspotKind }): JSX.Element {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (kind) {
    case 'light':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
        </svg>
      );
    case 'frame':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 20l5-1 9-9-4-4-9 9-1 5zM13 6l4 4" />
        </svg>
      );
    case 'floor':
      // A plank pattern, as the app's own "узор" floor icon — distinct from the plain
      // drop it used to share with walls and ceiling.
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 19l7-3M3 14l7-3M3 9l7-3M11 21l10-4M11 15l10-4M11 9l10-4" />
        </svg>
      );
    // The app has one "мебель" (furniture) icon — a grid of squares — for every
    // furniture tap target, decor (chair/dryer/flowers) included.
    case 'decor':
    case 'cabinet':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z" />
        </svg>
      );
  }
}

interface ActiveSpot {
  readonly view: number;
  readonly id: string;
}

/** Materials + colours of the tapped surface. */
function SurfacePanel({
  hotspot,
  state,
  dispatch,
}: {
  readonly hotspot: AppHotspot;
  readonly state: ConfigState;
  readonly dispatch: Dispatch<Action>;
}): JSX.Element {
  const [slotId, setSlotId] = useState<string>(hotspot.slots[0]?.id ?? 'main');
  const slot: AppSlot | undefined = hotspot.slots.find((s) => s.id === slotId) ?? hotspot.slots[0];
  if (!slot) return <p className={panel.hint}>Для этой поверхности нет вариантов.</p>;
  const key = pickKey(hotspot.id, slot.id);
  const pick = state.vam.picks[key];
  const option = pickedOption(slot, pick) ?? slot.options[0];

  return (
    <>
      <div className={styles.panelHead}>
        <span className={styles.panelTitle}>{hotspotTitle(hotspot)}</span>
        {pick ? (
          <button type="button" className={styles.panelReset} onClick={() => dispatch({ type: 'pick', key, pick: null })}>
            Убрать
          </button>
        ) : null}
      </div>

      {hotspot.slots.length > 1 ? (
        <div className={panel.subTabs} role="group" aria-label="Что выбрать">
          {hotspot.slots.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`${panel.subTab} ${s.id === slot.id ? panel.active : ''}`}
              onClick={() => setSlotId(s.id)}
              aria-pressed={s.id === slot.id}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      {slot.options.length > 1 ? (
        <>
          <p className={panel.hint}>Материал</p>
          <div className={panel.familyRow} role="group" aria-label="Материал">
            {slot.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`${panel.segBtn} ${o.id === option?.id ? panel.active : ''}`}
                onClick={() => {
                  const first = o.colors.find((c) => c.k === pick?.k) ?? o.colors[Math.min(1, o.colors.length - 1)];
                  if (first) dispatch({ type: 'pick', key, pick: { o: o.id, k: first.k } });
                }}
                aria-pressed={o.id === option?.id}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {option ? (
        <>
          <p className={panel.hint}>Цвет</p>
          <div className={panel.swatchGrid} role="group" aria-label="Цвет">
            {option.colors.map((c, i) => {
              const on = pick?.o === option.id && pick.k === c.k;
              const name = c.name ?? `Цвет ${i + 1}`;
              return (
                <button
                  key={c.k}
                  type="button"
                  className={`${panel.swatch} ${on ? panel.active : ''}`}
                  style={c.swatch ? { background: `${c.hex} center / cover url(${c.swatch})` } : { background: c.hex }}
                  onClick={() => dispatch({ type: 'pick', key, pick: { o: option.id, k: c.k } })}
                  title={name}
                  aria-label={`${slot.label}: ${name.toLowerCase()}`}
                  aria-pressed={on}
                >
                  {on ? (
                    <span className={panel.swatchCheck}>
                      <Check size={14} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}

/**
 * Two views of the balcony + the finishes panel.
 * @returns The screen element.
 */
export function FinishStep({ state, dispatch, sceneRefs }: FinishStepProps): JSX.Element {
  const screen = useMemo(() => vamScreen(state.vam), [state.vam]);
  const [active, setActive] = useState<ActiveSpot | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const planSvgRef = useRef<SVGSVGElement>(null);
  const plan = state.vam.mode === 'plan';
  const shape = findVamShape(state.vam.shape);
  const planHotspots = useMemo(() => vamPlanHotspots(state.vam.shape), [state.vam.shape]);
  const planPaint = useMemo(() => vamRenderPaint(state.vam), [state.vam]);
  const planGeom = useMemo(() => planFor(state.vam.shape, state.vam.glazing), [state.vam.shape, state.vam.glazing]);
  const { views: planViews } = usePlanViews(`${state.vam.shape}|${state.vam.glazing}`, planGeom ?? PLAN_SHAPES.loggia!, planPaint, plan);
  const chosenPlan = useMemo(() => new Set(planHotspots.filter((h) => h.slots.some((s) => state.vam.picks[pickKey(h.id, s.id)])).map((h) => h.id)), [planHotspots, state.vam.picks]);
  // Perf audit (docs/PERF_AUDIT_15-20.md #5): avoid rebuilding both views' layer-URL
  // arrays on every render of this component (e.g. toggling an unrelated `extras`
  // checkbox) — only recompute when the screen or the picks actually change.
  const screenLayerUrls = useMemo(
    () => screen.views.map((_view, i) => vamViewLayerUrls(screen, i as 0 | 1, state.vam.picks)),
    [screen, state.vam.picks],
  );
  const activeHotspot = plan
    ? planHotspots.find((h) => h.id === active?.id)
    : active
      ? screen.views[active.view]?.hotspots.find((h) => h.id === active.id)
      : undefined;

  /** Downloads the materials/options spec sheet as a PDF (brief §17, no price — see exportPdf.ts). */
  async function handleDownloadSpecPdf(): Promise<void> {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadSpecPdf({ selection: state.vam, extras: state.extras });
    } catch (err) {
      setPdfError(err instanceof SpecPdfError ? err.message : 'Не удалось сформировать спецификацию. Попробуйте ещё раз.');
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className={styles.finish}>
      <div className={styles.views}>
        {plan
          ? ([0, 1] as const).map((i) => (
              <div key={i} className={styles.viewCard}>
                <PlanScene
                  ref={sceneRefs[i]!}
                  view={planViews[i]!}
                  chosen={chosenPlan}
                  activeId={active?.id ?? null}
                  onSpot={(id) => setActive({ view: i, id })}
                  title={(id) => hotspotTitle(planHotspots.find((h) => h.id === id) ?? planHotspots[0]!)}
                  viewLabel={`кадр ${i + 1}`}
                />
              </div>
            ))
          : screen.views.map((view, i) => (
          <div key={i} className={styles.viewCard}>
            <VamScene ref={sceneRefs[i]!} layers={screenLayerUrls[i]!} mirror={screen.mirror} viewLabel={`кадр ${i + 1}`}>
              {view.hotspots.map((h) => {
                const chosen = h.slots.some((s) => state.vam.picks[pickKey(h.id, s.id)]);
                const isActive = active?.view === i && active.id === h.id;
                const wallNo = h.kind === 'wall' ? h.id.match(/^\d+/)?.[0] : undefined;
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`${styles.hotspot} ${chosen ? styles.hotspotDone : ''} ${isActive ? styles.hotspotActive : ''}`}
                    style={{ left: `${screen.mirror ? 100 - h.x : h.x}%`, top: `${h.y}%` }}
                    onClick={() => setActive({ view: i, id: h.id })}
                    aria-label={hotspotTitle(h)}
                    title={hotspotTitle(h)}
                  >
                    <HotspotIcon kind={h.kind} />
                    {wallNo ? <span className={styles.badge}>{wallNo}</span> : null}
                  </button>
                );
              })}
            </VamScene>
          </div>
        ))}
      </div>
      <div className={styles.side}>
        <div className={styles.sideBody}>
          {activeHotspot ? (
            <SurfacePanel key={`${active?.view}-${activeHotspot.id}`} hotspot={activeHotspot} state={state} dispatch={dispatch} />
          ) : (
            <p className={styles.sideEmpty}>Нажмите на значок на балконе, чтобы выбрать отделку этой поверхности.</p>
          )}
          {plan && shape ? (
            <div className={styles.planCard}>
              <span className={styles.planCardTitle}>Чертёж, мм</span>
              <ShapePlan ref={planSvgRef} shape={shape} glazing={state.vam.glazing} className={styles.planCardSvg} detailed />
              <button
                type="button"
                className={panel.downloadBtn}
                onClick={() => {
                  const svgEl = planSvgRef.current;
                  if (svgEl) downloadSvgElement(svgEl, svgFilename(shape.label));
                }}
              >
                <DownloadIcon size={16} /> Скачать чертёж (SVG)
              </button>
            </div>
          ) : null}
          <div className={styles.planCard}>
            <button type="button" className="btn btn--ghost" disabled={pdfBusy} onClick={handleDownloadSpecPdf}>
              {pdfBusy ? 'Формируем спецификацию…' : 'Скачать спецификацию (PDF)'}
            </button>
            {pdfError ? (
              <p className={styles.sideEmpty} style={{ color: '#c0392b' }} role="alert">
                {pdfError}
              </p>
            ) : null}
          </div>
          <div className={styles.planCard}>
            <SaveProjectButton config={{ extras: state.extras, vam: state.vam }} />
          </div>
        </div>
      </div>
    </div>
  );
}

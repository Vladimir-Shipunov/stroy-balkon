/**
 * @file FinishStep — the second screen, as in the app ("Выбор отделки"): the balcony
 * seen from two sides using the app's own real pre-rendered photo scenes, with a
 * round tap target on every surface (walls, ceiling, floor, windows, light,
 * furniture). A tap opens that surface's materials and colours in the side panel;
 * nothing is drawn on a surface until it is chosen. The "Чертёж, мм" card alongside
 * shows the real, passport-matched geometry (`ShapePlan.tsx`) and is tied to the photos
 * (`photoPlanLink.ts`): it marks where each frame is shot from, the wall numbers on the
 * photos are the drawing's own, and the wall being finished lights up on the plan.
 */
import { useMemo, useState } from 'react';
import type { Dispatch, RefObject } from 'react';
import { Check } from '../../components/icons';
import { ShapePlan } from './ShapePlan';
import { VamScene } from './VamScene';
import type { VamSceneHandle } from './VamScene';
import { PlanScene } from './PlanScene';
import { usePlanViews } from './usePlanViews';
import { downloadSpecPdf, SpecPdfError } from './exportPdf';
import { SaveProjectButton } from './SaveProjectButton';
import type { Action, ConfigState } from './useConfigurator';
import { findVamShape, hotspotTitle, pickKey, pickedOption, surfacePickKey, usesPlanRender, vamPlanHotspots, vamRenderPaint, vamScreen, vamViewLayerUrls } from './vamCatalog';
import { PLAN_SHAPES, planFor } from './planShapes';
import { planCameras, wallNumbersText, wallTitle, wallsAtPhotoX } from './photoPlanLink';
import { fitFor, fitPoint, fitShows, fitTapPoint } from './vamFit';
import type { AppHotspot, AppSlot, HotspotKind } from './vamCatalog';
import styles from './Wizard.module.css';
import panel from './Configurator.module.css';

/** Half the round tap target's width (46 px, `.hotspot` in Wizard.module.css). */
const HOTSPOT_RADIUS_PX = 23;

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
  title,
  state,
  dispatch,
}: {
  readonly hotspot: AppHotspot;
  /** Heading override: a wall is named by its number on the plan, not the app's own id. */
  readonly title?: string | undefined;
  readonly state: ConfigState;
  readonly dispatch: Dispatch<Action>;
}): JSX.Element {
  const [slotId, setSlotId] = useState<string>(hotspot.slots[0]?.id ?? 'main');
  const slot: AppSlot | undefined = hotspot.slots.find((s) => s.id === slotId) ?? hotspot.slots[0];
  if (!slot) return <p className={panel.hint}>Для этой поверхности нет вариантов.</p>;
  const key = surfacePickKey(hotspot, slot.id);
  const pick = state.vam.picks[key];
  const option = pickedOption(slot, pick) ?? slot.options[0];

  return (
    <>
      <div className={styles.panelHead}>
        <span className={styles.panelTitle}>{title ?? hotspotTitle(hotspot)}</span>
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
 * Two real photo views of the balcony + the finishes panel.
 * @returns The screen element.
 */
export function FinishStep({ state, dispatch, sceneRefs }: FinishStepProps): JSX.Element {
  const screen = useMemo(() => vamScreen(state.vam), [state.vam]);
  const [active, setActive] = useState<ActiveSpot | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const shape = findVamShape(state.vam.shape);
  // Perf audit (docs/PERF_AUDIT_15-20.md #5): avoid rebuilding both views' layer-URL
  // arrays on every render of this component (e.g. toggling an unrelated `extras`
  // checkbox) — only recompute when the screen or the picks actually change.
  const screenLayerUrls = useMemo(
    () => screen.views.map((_view, i) => vamViewLayerUrls(screen, i as 0 | 1, state.vam.picks)),
    [screen, state.vam.picks],
  );
  // The crop and turn each frame wears for this shape (vamFit.ts) — none for the shapes the photo fits as it is.
  const sceneFits = useMemo(
    () => ([0, 1] as const).map((i) => fitFor(state.vam.shape, i, screen.mirror)),
    [state.vam.shape, screen.mirror],
  );
  // Always the app's real photos now (usesPlanRender is permanently false, see vamCatalog.ts)
  // — the "Чертёж, мм" card below still draws the exact geometry regardless.
  const planMode = usesPlanRender(state.vam.shape);
  const planHotspots = useMemo(
    () => (planMode ? vamPlanHotspots(state.vam.shape).filter((h) => h.kind !== 'decor') : []),
    [planMode, state.vam.shape],
  );
  const activeHotspot = planMode
    ? planHotspots.find((h) => h.id === active?.id)
    : active
      ? screen.views[active.view]?.hotspots.find((h) =>
          h.id === active.id &&
          h.kind !== 'decor' &&
          !(h.kind === 'cabinet' && active.view === 0),
        )
      : undefined;

  // Photo <-> plan: the plan this selection draws, and which of its walls each wall tap
  // target on the photos sits on (the number is the one printed on the drawing).
  const geom = useMemo(() => planFor(state.vam.shape, state.vam.glazing) ?? PLAN_SHAPES[state.vam.shape], [state.vam.shape, state.vam.glazing]);
  const cameras = useMemo(() => (geom ? planCameras(geom, planMode ? false : screen.mirror) : undefined), [geom, planMode, screen.mirror]);
  const planPaint = useMemo(() => vamRenderPaint(state.vam), [state.vam]);
  // Nothing is rendered unless this shape is drawn by the renderer; the plan itself is already mirrored for right-handed ones.
  const { views: planViews } = usePlanViews(`${state.vam.shape}|${state.vam.glazing}`, geom ?? PLAN_SHAPES.loggia!, planPaint, planMode);
  const chosenPlan = useMemo(() => new Set(planHotspots.filter((h) => h.slots.some((s) => state.vam.picks[pickKey(h.id, s.id)])).map((h) => h.id)), [planHotspots, state.vam.picks]);
  /** Plan edge (0-based) of a plan wall tap target "P:w<N>". */
  const planWallEdge = (id: string): number | undefined => {
    const n = Number(id.replace('P:w', ''));
    return Number.isInteger(n) && n >= 1 ? n - 1 : undefined;
  };
  const wallEdges = useMemo(() => {
    const edges = new Map<string, number[]>();
    if (!geom || planMode) return edges;
    screen.views.forEach((view, i) => {
      for (const h of view.hotspots) {
        if (h.kind !== 'wall') continue;
        const found = wallsAtPhotoX(geom, i as 0 | 1, screen.mirror, screen.mirror ? 100 - h.x : h.x);
        if (found.length > 0) edges.set(`${i}:${h.id}`, found);
      }
    });
    return edges;
  }, [geom, planMode, screen]);
  const planEdge = planMode && activeHotspot?.kind === 'wall' ? planWallEdge(activeHotspot.id) : undefined;
  const activeEdges = planEdge !== undefined ? [planEdge] : active ? wallEdges.get(`${active.view}:${active.id}`) : undefined;
  // The walls of a tapped wall surface light up on the plan; sill and frames sit on every glazed run.
  const highlight = useMemo(() => {
    if (!geom || !activeHotspot) return undefined;
    if (activeHotspot.kind === 'wall') return activeEdges;
    if (activeHotspot.kind === 'sill' || activeHotspot.kind === 'frame') return geom.kinds.flatMap((kind, i) => (kind === 'glazing' ? [i] : []));
    return undefined;
  }, [geom, activeHotspot, activeEdges]);

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
        {planMode
          ? ([0, 1] as const).map((i) => (
              <div key={i} className={styles.viewCard}>
                <PlanScene
                  ref={sceneRefs[i]!}
                  view={planViews[i]}
                  chosen={chosenPlan}
                  activeId={active?.id ?? null}
                  onSpot={(id) => setActive({ view: i, id })}
                  title={(id) => {
                    const h = planHotspots.find((p) => p.id === id);
                    const edge = h?.kind === 'wall' ? planWallEdge(id) : undefined;
                    return edge !== undefined ? wallTitle([edge]) : h ? hotspotTitle(h) : '';
                  }}
                  viewLabel={`кадр ${i + 1}`}
                />
              </div>
            ))
          : screen.views.map((view, i) => (
          <div key={i} className={styles.viewCard}>
            <VamScene ref={sceneRefs[i]!} layers={screenLayerUrls[i]!} mirror={screen.mirror} fit={sceneFits[i]} viewIndex={i as 0 | 1} viewLabel={`кадр ${i + 1}`}>
              {view.hotspots.filter((h) => h.kind !== 'decor').map((h) => {
                if (h.kind === 'cabinet' && i === 0) return null;
                const chosen = h.slots.some((s) => state.vam.picks[surfacePickKey(h, s.id)]);
                const isActive = active?.view === i && active.id === h.id;
                const edges = h.kind === 'wall' ? wallEdges.get(`${i}:${h.id}`) : undefined;
                const wallNo = edges ? wallNumbersText(edges) : h.kind === 'wall' ? h.id.match(/^\d+/)?.[0] : undefined;
                // The tap target rides the photo's fit (it must stay on its actual surface) and goes away with a surface the crop cuts off.
                // A zoom that pushes a point past the frame's edge keeps the ring inside the frame without moving it to an unrelated surface.
                const [fx, fy] = fitPoint(sceneFits[i], screen.mirror ? 100 - h.x : h.x, h.y);
                if (!fitShows(sceneFits[i], fx, fy)) return null;
                const [hx, hy] = fitTapPoint(sceneFits[i], h.id, [fx, fy]);
                const place = (v: number): string => (sceneFits[i] ? `clamp(${HOTSPOT_RADIUS_PX}px, ${v}%, calc(100% - ${HOTSPOT_RADIUS_PX}px))` : `${v}%`);
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`${styles.hotspot} ${chosen ? styles.hotspotDone : ''} ${isActive ? styles.hotspotActive : ''}`}
                    style={{ left: place(hx), top: place(hy) }}
                    onClick={() => setActive({ view: i, id: h.id })}
                    aria-label={edges ? wallTitle(edges) : hotspotTitle(h)}
                    title={edges ? wallTitle(edges) : hotspotTitle(h)}
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
            <SurfacePanel
              key={`${active?.view}-${activeHotspot.id}`}
              hotspot={activeHotspot}
              title={activeHotspot.kind === 'wall' && activeEdges ? wallTitle(activeEdges) : undefined}
              state={state}
              dispatch={dispatch}
            />
          ) : (
            <p className={styles.sideEmpty}>Нажмите на значок на балконе, чтобы выбрать отделку этой поверхности.</p>
          )}
          {shape ? (
            <div className={styles.planCard}>
              <span className={styles.planCardTitle}>Чертёж, мм</span>
              <ShapePlan shape={shape} glazing={state.vam.glazing} className={styles.planCardSvg} detailed cameras={cameras} highlight={highlight} />
              <p className={styles.planCardNote}>Оранжевые точки 1 и 2 — откуда сняты кадры. Стена, которую вы выбираете на фото, подсвечивается на чертеже.</p>
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

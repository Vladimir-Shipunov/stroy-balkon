/**
 * @file Configurator — full-screen balcony configurator, laid out as in the app:
 * step 1 picks the balcony type and glazing, step 2 ("Выбор отделки") shows the
 * balcony from two sides where every surface is tapped to choose its finish, plus
 * a sticky bottom bar with the measurement CTA. Renders on its own route without
 * the marketing shell.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCallModal } from '../../components/CallModal/CallModalProvider';
import { ArrowRight, DownloadIcon, PhoneIcon } from '../../components/icons';
import { Logo } from '../../components/Header/Logo';
import { COMPANY } from '../../data/site';
import { usePageTitle } from '../../lib/usePageTitle';
import { useConfiguratorState } from './ConfiguratorContext';
import { ErrorBoundary } from './ErrorBoundary';
import { FinishStep } from './FinishStep';
import { SetupStep } from './SetupStep';
import type { PlanSceneHandle } from './PlanScene';
import { disposeWorkers } from './render/client';
import { loadConfigFromUrl } from './useSavedConfiguration';
import type { ConfigState } from './useConfigurator';
import { vamGlazingLabel, vamMaterialLabel, vamShapeLabel, vamSummary } from './vamCatalog';
import styles from './Configurator.module.css';
import wizard from './Wizard.module.css';

const EXTRA_LABELS = {
  insulation: 'Утепление',
  ceilingFinish: 'Отделка потолка',
  dismantling: 'Демонтаж',
} as const;

/**
 * The configurator page.
 * @returns The page element.
 */
export function Configurator(): JSX.Element {
  usePageTitle('Конфигуратор балкона');
  const { state, dispatch } = useConfiguratorState();
  const { open } = useCallModal();
  // `?step=finish` deep-links straight to the finishes screen.
  const [step, setStep] = useState<'setup' | 'finish'>(() =>
    new URLSearchParams(window.location.search).get('step') === 'finish' ? 'finish' : 'setup',
  );
  const leftRef = useRef<PlanSceneHandle>(null);
  const rightRef = useRef<PlanSceneHandle>(null);
  const didTryLoadSaved = useRef(false);

  // Restore a configuration from a saved-project link (`?cfgId=&cfgToken=`,
  // see SaveProjectButton.tsx in FinishStep) once, on first mount.
  useEffect(() => {
    if (didTryLoadSaved.current) return;
    didTryLoadSaved.current = true;
    loadConfigFromUrl().then((loaded) => {
      if (!loaded) return;
      // `loaded.config` is a server-round-tripped blob (opaque to useSavedConfiguration) —
      // same trust level as the localStorage blob `init()` merges defensively in
      // useConfigurator.ts's reducer, which is what actually validates/normalizes it.
      dispatch({ type: 'LOAD_CONFIG', payload: loaded.config as Partial<ConfigState> });
    });
  }, [dispatch]);

  // Perf audit (docs/PERF_AUDIT_15-20.md #1): release the render workers (and the
  // room/texture/light caches they hold) when leaving the configurator page
  // entirely — not on every setup/finish step toggle, which would thrash them for
  // no reason (usePlanViews.ts mounts/unmounts with FinishStep, not with this page).
  useEffect(() => disposeWorkers, []);

  /** Both views side by side as one PNG data URL (null before they have drawn). */
  function captureImage(): string | null {
    const left = leftRef.current?.captureCanvas();
    const right = rightRef.current?.captureCanvas();
    if (!left || !right) return null;
    const out = document.createElement('canvas');
    out.width = left.width + right.width;
    out.height = Math.max(left.height, right.height);
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(left, 0, 0);
    ctx.drawImage(right, left.width, 0);
    try {
      return out.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  /** Downloads the current balcony (both views) as a PNG. */
  function handleDownloadImage(): void {
    const dataUrl = captureImage();
    if (!dataUrl) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `balkon-${state.vam.shape}-${stamp}.png`;
    a.click();
  }

  function requestMeasure(): void {
    // Best-effort — a captured frame is a nice-to-have, never blocks the lead.
    const screenshot = captureImage();
    const extras = (Object.keys(EXTRA_LABELS) as (keyof typeof EXTRA_LABELS)[])
      .filter((k) => state.extras[k])
      .map((k) => EXTRA_LABELS[k]);
    const summary = [
      ...vamSummary(state.vam),
      ...(extras.length ? [{ label: 'Дополнительно', value: extras.join(', ') }] : []),
    ];

    open({
      title: 'Заказать замер',
      subtitle: 'Оставьте контакты — приедем, уточним размеры и рассчитаем смету по вашей конфигурации.',
      source: 'configurator',
      endpoint: '/api/orders',
      payload: {
        balconyType: vamShapeLabel(state.vam.shape),
        balconyShape: vamGlazingLabel(state.vam.shape, state.vam.glazing),
        materials: [],
        screenshot,
        metadata: {
          scene2d: state.vam,
          extras: state.extras,
          summary,
        },
      },
      summary,
    });
  }

  return (
    <div className={styles.app}>
      {/* App bar */}
      <header className={styles.bar}>
        <Link to="/" className={styles.barBrand} aria-label="На главную">
          <Logo />
        </Link>
        <span className={styles.barDivider} aria-hidden="true" />
        <span className={styles.barTitle}>Конфигуратор балкона</span>
        <span className={styles.barSpacer} />
        <Link to="/" className={styles.barBack}>
          ← На сайт
        </Link>
        <a href={COMPANY.phonePrimary.href} className={styles.barPhone}>
          <PhoneIcon size={16} /> {COMPANY.phonePrimary.display}
        </a>
      </header>

      <ErrorBoundary>
      {step === 'setup' ? (
        <div className={wizard.scroll}>
          <SetupStep state={state} dispatch={dispatch} onNext={() => setStep('finish')} />
        </div>
      ) : (
        <>
          <div className={wizard.finishHead}>
            <button type="button" className={wizard.backBtn} onClick={() => setStep('setup')} aria-label="Назад к выбору балкона">
              ←
            </button>
            <span className={wizard.headChip}>Выбор отделки</span>
            <span className={wizard.chips}>
              <span className={styles.chip}>{vamShapeLabel(state.vam.shape)}</span>
              <span className={styles.chip}>{vamGlazingLabel(state.vam.shape, state.vam.glazing)}</span>
              {vamMaterialLabel(state.vam) ? <span className={styles.chip}>{vamMaterialLabel(state.vam)}</span> : null}
            </span>
            <span className={styles.toolbarSpacer} />
            <button type="button" className={styles.downloadBtn} onClick={handleDownloadImage} title="Скачать изображение балкона">
              <DownloadIcon size={16} /> Скачать
            </button>
          </div>
          <div className={wizard.scroll}>
            <FinishStep state={state} dispatch={dispatch} sceneRefs={[leftRef, rightRef]} />
          </div>
          <footer className={styles.bottomBar}>
            <p className={styles.bottomText}>Нажимайте на значки на балконе — меняйте стены, пол, окна и свет</p>
            <button className={`btn btn--primary ${styles.bottomCta}`} onClick={requestMeasure} type="button">
              Заказать замер <ArrowRight size={18} />
            </button>
          </footer>
        </>
      )}
      </ErrorBoundary>
    </div>
  );
}

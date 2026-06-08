/**
 * @file StepGlazing — wizard step for choosing the glazing type.
 *
 * Renders a radio OptionGrid over the catalog's glazing types. Each card carries
 * an inline technical cross-section (top-down horizontal section through the
 * glazing) so the buyer can read at a glance how the panes are held and how the
 * façade opens. Selection drives `config.glazingType` via the kernel store.
 */

import { GLAZING_TYPES } from '../../../data/catalog';
import { priceDelta } from '../../../lib/ui/priceDelta';
import { useConfiguratorStore } from '../../../store/configuratorStore';
import { getStepMeta, WIZARD_STEP_COUNT } from '../../../store/wizardSteps';
import { useWizardStore } from '../../../store/wizardStore';
import { GlazingType } from '../../../types/balcony';
import { OptionCard } from '../../primitives/OptionCard';
import { OptionGrid } from '../../primitives/OptionGrid';
import { StepPanel } from '../../primitives/StepPanel';
import styles from './StepGlazing.module.css';

/**
 * A precise, schematic top-down cross-section for one glazing type. Pure
 * line-work using `currentColor` and token strokes — no fills, no decoration.
 */
function GlazingCrossSection({ type }: { type: GlazingType }): JSX.Element {
  switch (type) {
    /* Vertical glass panes with NO mullions — thin butt-joints between panes. */
    case GlazingType.Frameless:
      return (
        <svg
          className={styles.section}
          viewBox="0 0 120 48"
          role="img"
          aria-label="Frameless cross-section: panes meeting at thin butt-joints"
          focusable="false"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <line x1="6" y1="24" x2="114" y2="24" className={styles.glass} />
            <line x1="38" y1="18" x2="38" y2="30" className={styles.joint} />
            <line x1="70" y1="18" x2="70" y2="30" className={styles.joint} />
            <line x1="102" y1="18" x2="102" y2="30" className={styles.joint} />
          </g>
        </svg>
      );

    /* Slim top/bottom rails implied as end caps; frameless vertical joints. */
    case GlazingType.SemiFrameless:
      return (
        <svg
          className={styles.section}
          viewBox="0 0 120 48"
          role="img"
          aria-label="Semi-frameless cross-section: slim end rails with frameless joints"
          focusable="false"
        >
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <rect
              x="6"
              y="20"
              width="6"
              height="8"
              strokeWidth="1.5"
              className={styles.rail}
            />
            <rect
              x="108"
              y="20"
              width="6"
              height="8"
              strokeWidth="1.5"
              className={styles.rail}
            />
            <line
              x1="12"
              y1="24"
              x2="108"
              y2="24"
              strokeWidth="1.5"
              className={styles.glass}
            />
            <line
              x1="44"
              y1="19"
              x2="44"
              y2="29"
              strokeWidth="1.5"
              className={styles.joint}
            />
            <line
              x1="76"
              y1="19"
              x2="76"
              y2="29"
              strokeWidth="1.5"
              className={styles.joint}
            />
          </g>
        </svg>
      );

    /* Each pane in a full perimeter frame — frame rectangles around panes. */
    case GlazingType.Framed:
      return (
        <svg
          className={styles.section}
          viewBox="0 0 120 48"
          role="img"
          aria-label="Framed cross-section: each pane in a full perimeter frame"
          focusable="false"
        >
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <rect
              x="8"
              y="12"
              width="32"
              height="24"
              strokeWidth="1.5"
              className={styles.frame}
            />
            <rect
              x="44"
              y="12"
              width="32"
              height="24"
              strokeWidth="1.5"
              className={styles.frame}
            />
            <rect
              x="80"
              y="12"
              width="32"
              height="24"
              strokeWidth="1.5"
              className={styles.frame}
            />
            <line x1="12" y1="24" x2="36" y2="24" strokeWidth="1.5" className={styles.glass} />
            <line x1="48" y1="24" x2="72" y2="24" strokeWidth="1.5" className={styles.glass} />
            <line x1="84" y1="24" x2="108" y2="24" strokeWidth="1.5" className={styles.glass} />
          </g>
        </svg>
      );

    /* Overlapping panes on two offset tracks — panes slide past on parallel rails. */
    case GlazingType.Sliding:
      return (
        <svg
          className={styles.section}
          viewBox="0 0 120 48"
          role="img"
          aria-label="Sliding cross-section: overlapping panes on two offset tracks"
          focusable="false"
        >
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <line x1="6" y1="16" x2="114" y2="16" strokeWidth="1" className={styles.track} />
            <line x1="6" y1="32" x2="114" y2="32" strokeWidth="1" className={styles.track} />
            <line x1="14" y1="16" x2="66" y2="16" strokeWidth="2" className={styles.glass} />
            <line x1="40" y1="32" x2="92" y2="32" strokeWidth="2" className={styles.glass} />
            <line x1="78" y1="16" x2="110" y2="16" strokeWidth="2" className={styles.glass} />
            <path
              d="M48 22l6 4-6 4"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className={styles.arrow}
            />
          </g>
        </svg>
      );

    default:
      return type satisfies never;
  }
}

/** Step 3 of the wizard: select how the glass panels are held and open. */
export function StepGlazing(): JSX.Element {
  const { index, meta } = getStepMeta('glazing');
  const config = useConfiguratorStore((s) => s.config);
  const updateConfig = useConfiguratorStore((s) => s.updateConfig);
  const attempted = useWizardStore((s) => s.attemptedAdvance);
  const hasError = attempted && !meta.validate(config);

  return (
    <StepPanel
      stepNumber={index + 1}
      totalSteps={WIZARD_STEP_COUNT}
      title={meta.title}
      description={meta.description}
      hasError={hasError}
      errorMessage={meta.invalidMessage}
    >
      <OptionGrid ariaLabel="Glazing type" selectionMode="radio" density="medium">
        {Object.values(GLAZING_TYPES).map((spec) => (
          <OptionCard
            key={spec.id}
            label={spec.name}
            description={spec.description}
            media={<GlazingCrossSection type={spec.id} />}
            priceDelta={priceDelta(config, { glazingType: spec.id })}
            selected={config.glazingType === spec.id}
            onSelect={() => updateConfig({ glazingType: spec.id })}
            selectionMode="radio"
          />
        ))}
      </OptionGrid>
    </StepPanel>
  );
}

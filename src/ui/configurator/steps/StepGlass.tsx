/**
 * @file StepGlass — wizard step for choosing the glass specification.
 *
 * Renders one OptionCard per `GlassType` (radio single-select), each showing a
 * live price delta versus the current selection and a small inline glass-pane
 * icon. Every card surfaces the two glass performance figures inline as the
 * card's `meta`: the thermal transmittance (U-value, W/m²K) and the visible
 * light transmittance (%), rendered as compact labelled spec rows with a muted
 * label and an emphasised, tabular-aligned value.
 */

import { useConfiguratorStore } from '../../../store/configuratorStore';
import { WIZARD_STEP_COUNT, getStepMeta } from '../../../store/wizardSteps';
import { useWizardStore } from '../../../store/wizardStore';
import type { GlassTypeSpec } from '../../../data/catalog';
import { GLASS_TYPES } from '../../../data/catalog';
import { StepPanel } from '../../primitives/StepPanel';
import { OptionGrid } from '../../primitives/OptionGrid';
import { OptionCard } from '../../primitives/OptionCard';
import { formatPercent } from '../../../lib/ui/money';
import { priceDelta } from '../../../lib/ui/priceDelta';
import styles from './StepGlass.module.css';

/** Inline stroke icon evoking a glazed pane with a light glint (glass unit). */
function GlassPaneIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="3.5" width="16" height="17" rx="1" />
      <path d="M8 6.5l-2.5 6M13 6.5l-4 9" />
    </svg>
  );
}

/**
 * The two glass performance figures shown on every card. A small two-row block
 * with muted labels and emphasised, tabular-aligned values so columns line up
 * across cards.
 */
function GlassSpecMeta({ spec }: { readonly spec: GlassTypeSpec }): JSX.Element {
  return (
    <span className={styles.specs}>
      <span className={styles.specRow}>
        <span className={styles.specKey}>U-value</span>
        <span className={styles.specValue}>{spec.uValue} W/m²K</span>
      </span>
      <span className={styles.specRow}>
        <span className={styles.specKey}>Light</span>
        <span className={styles.specValue}>
          {formatPercent(spec.lightTransmittancePct)}
        </span>
      </span>
    </span>
  );
}

/** Wizard step: select the glass unit by thermal performance and appearance. */
export function StepGlass(): JSX.Element {
  const { index, meta } = getStepMeta('glass');
  const config = useConfiguratorStore((s) => s.config);
  const updateConfig = useConfiguratorStore((s) => s.updateConfig);
  const attempted = useWizardStore((s) => s.attemptedAdvance);
  const hasError = attempted && !meta.validate(config);

  const glassTypes = Object.values(GLASS_TYPES);

  return (
    <StepPanel
      stepNumber={index + 1}
      totalSteps={WIZARD_STEP_COUNT}
      title={meta.title}
      description={meta.description}
      hasError={hasError}
      errorMessage={meta.invalidMessage}
    >
      <OptionGrid ariaLabel="Glass specification" selectionMode="radio" density="medium">
        {glassTypes.map((spec) => (
          <OptionCard
            key={spec.id}
            label={spec.name}
            description={spec.description}
            icon={<GlassPaneIcon />}
            meta={<GlassSpecMeta spec={spec} />}
            priceDelta={priceDelta(config, { glassType: spec.id })}
            selected={config.glassType === spec.id}
            onSelect={() => updateConfig({ glassType: spec.id })}
            selectionMode="radio"
          />
        ))}
      </OptionGrid>
    </StepPanel>
  );
}

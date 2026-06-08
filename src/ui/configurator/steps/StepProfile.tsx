/**
 * @file StepProfile — wizard step for choosing the structural profile system.
 *
 * Renders one OptionCard per `ProfileSystem` (radio single-select), each showing
 * a live price delta versus the current selection and a small inline framing
 * icon. Every card carries a spec popover that reveals the system's material
 * rate, price factor and thermal-break status on hover AND keyboard focus
 * (CSS `:hover`/`:focus-within` on the card wrapper), kept available to assistive
 * technology rather than hidden.
 */

import { useConfiguratorStore } from '../../../store/configuratorStore';
import { WIZARD_STEP_COUNT, getStepMeta } from '../../../store/wizardSteps';
import { useWizardStore } from '../../../store/wizardStore';
import type { ProfileSystemSpec } from '../../../data/catalog';
import { PROFILE_SYSTEMS } from '../../../data/catalog';
import { StepPanel } from '../../primitives/StepPanel';
import { OptionGrid } from '../../primitives/OptionGrid';
import { OptionCard } from '../../primitives/OptionCard';
import { formatEur } from '../../../lib/ui/money';
import { priceDelta } from '../../../lib/ui/priceDelta';
import styles from './StepProfile.module.css';

/** Inline stroke icon evoking a glazed frame with mullions (framing). */
function FramingIcon(): JSX.Element {
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
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
      <path d="M12 3.5v17M3.5 12h17" />
    </svg>
  );
}

/**
 * Spec table revealed on hover/focus. Marked-up as a real table so screen
 * readers announce the rows; visibility is purely CSS-driven (no aria-hidden),
 * so the content stays in the accessibility tree.
 */
function SpecPopover({ spec }: { readonly spec: ProfileSystemSpec }): JSX.Element {
  return (
    <span className={styles.popover} role="note">
      <span className={styles.popoverTitle}>System specification</span>
      <span className={styles.specRow}>
        <span className={styles.specKey}>Material rate</span>
        <span className={styles.specValue}>{formatEur(spec.pricePerSqmEur)} / m²</span>
      </span>
      <span className={styles.specRow}>
        <span className={styles.specKey}>Price factor</span>
        <span className={styles.specValue}>×{spec.priceMultiplier}</span>
      </span>
      <span className={styles.specRow}>
        <span className={styles.specKey}>Thermal break</span>
        <span className={styles.specValue}>{spec.thermallyBroken ? 'Yes' : 'No'}</span>
      </span>
    </span>
  );
}

/** Wizard step: select the structural profile system the glazing is built on. */
export function StepProfile(): JSX.Element {
  const { index, meta } = getStepMeta('profile');
  const config = useConfiguratorStore((s) => s.config);
  const updateConfig = useConfiguratorStore((s) => s.updateConfig);
  const attempted = useWizardStore((s) => s.attemptedAdvance);
  const hasError = attempted && !meta.validate(config);

  const systems = Object.values(PROFILE_SYSTEMS);

  return (
    <StepPanel
      stepNumber={index + 1}
      totalSteps={WIZARD_STEP_COUNT}
      title={meta.title}
      description={meta.description}
      hasError={hasError}
      errorMessage={meta.invalidMessage}
    >
      <OptionGrid ariaLabel="Profile system" selectionMode="radio" density="medium">
        {systems.map((spec) => (
          <span key={spec.id} className={styles.cardWrap}>
            <OptionCard
              label={spec.name}
              description={spec.description}
              icon={<FramingIcon />}
              priceDelta={priceDelta(config, { profileSystem: spec.id })}
              selected={config.profileSystem === spec.id}
              onSelect={() => updateConfig({ profileSystem: spec.id })}
              selectionMode="radio"
            />
            <SpecPopover spec={spec} />
          </span>
        ))}
      </OptionGrid>
    </StepPanel>
  );
}

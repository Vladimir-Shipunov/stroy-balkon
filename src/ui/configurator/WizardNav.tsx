/**
 * @file WizardNav — Back / Reset / Continue controls for the wizard footer.
 *
 * "Continue" calls `goNext`, which validates the current step; if it is an
 * invalid required step the wizard reveals the panel error instead of advancing.
 * "Reset" clears both the kernel config and the wizard navigation.
 */

import { useConfiguratorStore } from '../../store/configuratorStore';
import { useWizardStore } from '../../store/wizardStore';
import { WIZARD_STEP_COUNT } from '../../store/wizardSteps';
import styles from './WizardNav.module.css';

export function WizardNav(): JSX.Element {
  const currentIndex = useWizardStore((s) => s.currentIndex);
  const goPrev = useWizardStore((s) => s.goPrev);
  const goNext = useWizardStore((s) => s.goNext);
  const resetWizard = useWizardStore((s) => s.resetWizard);
  const resetConfig = useConfiguratorStore((s) => s.resetConfig);

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === WIZARD_STEP_COUNT - 1;

  const handleReset = (): void => {
    resetConfig();
    resetWizard();
  };

  return (
    <div className={styles.nav}>
      <button
        type="button"
        className={styles.secondary}
        onClick={goPrev}
        disabled={isFirst}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M10 3.5L5.5 8l4.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back
      </button>

      <button type="button" className={styles.ghost} onClick={handleReset}>
        Reset
      </button>

      <button type="button" className={styles.primary} onClick={goNext}>
        {isLast ? 'Finish' : 'Continue'}
        {!isLast ? (
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path
              d="M6 3.5L10.5 8 6 12.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>
    </div>
  );
}

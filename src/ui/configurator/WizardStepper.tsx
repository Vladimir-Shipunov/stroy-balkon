/**
 * @file WizardStepper — the compact numbered step rail with a progress line.
 *
 * Reflects the presentation wizard's current step and lets the user jump to any
 * already-reachable step. Forward jumps past the first invalid required step are
 * disabled (reachability comes from the kernel config).
 */

import { useConfiguratorStore } from '../../store/configuratorStore';
import { useWizardStore } from '../../store/wizardStore';
import { WIZARD_STEPS, maxReachableIndex } from '../../store/wizardSteps';
import styles from './WizardStepper.module.css';

const CheckIcon = (): JSX.Element => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
    <path
      d="M3.5 8.5l3 3 6-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function WizardStepper(): JSX.Element {
  const currentIndex = useWizardStore((s) => s.currentIndex);
  const goToIndex = useWizardStore((s) => s.goToIndex);
  const config = useConfiguratorStore((s) => s.config);
  const reachable = maxReachableIndex(config);

  return (
    <nav className={styles.rail} aria-label="Configuration steps">
      <ol className={styles.list}>
        {WIZARD_STEPS.map((step, index) => {
          const state =
            index === currentIndex ? 'current' : index < currentIndex ? 'done' : 'upcoming';
          const disabled = index > currentIndex && index > reachable;
          const isLast = index === WIZARD_STEPS.length - 1;

          return (
            <li key={step.id} className={styles.item}>
              <button
                type="button"
                className={styles.step}
                data-state={state}
                aria-current={index === currentIndex ? 'step' : undefined}
                disabled={disabled}
                onClick={() => goToIndex(index)}
              >
                <span className={styles.marker} aria-hidden="true">
                  {index < currentIndex ? <CheckIcon /> : index + 1}
                </span>
                <span className={styles.label}>{step.shortLabel}</span>
              </button>
              {!isLast ? (
                <span
                  className={styles.connector}
                  data-filled={index < currentIndex}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

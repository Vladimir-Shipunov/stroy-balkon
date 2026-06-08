/**
 * @file StepPanel — the chrome wrapping a single configuration step.
 *
 * Renders the numbered step indicator with a progress line, the step title and
 * description, an optional header aside (e.g. a live readout), a validation
 * error region that appears when the user tries to skip a required step, and the
 * step body (the option grid) as children.
 */

import type { ReactNode } from 'react';
import styles from './StepPanel.module.css';

export interface StepPanelProps {
  /** 1-based position of this step. */
  readonly stepNumber: number;
  /** Total number of steps in the flow. */
  readonly totalSteps: number;
  /** Step title. */
  readonly title: string;
  /** One-line description shown under the title. */
  readonly description: string;
  /** When true, render the validation error region. */
  readonly hasError?: boolean;
  /** Error text shown when `hasError` is true. */
  readonly errorMessage?: string;
  /** Optional right-aligned header content (e.g. a live m² readout). */
  readonly headerAside?: ReactNode;
  /** The step body — typically an `OptionGrid` of `OptionCard`s. */
  readonly children: ReactNode;
}

const WarningIcon = (): JSX.Element => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path
      d="M8 1.5l6.5 11.5h-13L8 1.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M8 6.5v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="11.6" r="0.9" fill="currentColor" />
  </svg>
);

export function StepPanel({
  stepNumber,
  totalSteps,
  title,
  description,
  hasError = false,
  errorMessage,
  headerAside,
  children,
}: StepPanelProps): JSX.Element {
  const progress = Math.max(0, Math.min(1, stepNumber / totalSteps));
  const showError = hasError && errorMessage !== undefined && errorMessage.length > 0;

  return (
    <section className={styles.panel} aria-labelledby="stepPanelTitle">
      <header className={styles.header}>
        <div className={styles.indicator}>
          <span className={styles.badge} aria-hidden="true">
            {stepNumber}
          </span>
          <div className={styles.indicatorText}>
            <span className={styles.eyebrow}>
              Step {stepNumber} of {totalSteps}
            </span>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalSteps}
              aria-valuenow={stepNumber}
              aria-label={`Step ${stepNumber} of ${totalSteps}`}
            >
              <span
                className={styles.progressFill}
                style={{ transform: `scaleX(${progress})` }}
              />
            </div>
          </div>
        </div>
        {headerAside !== undefined ? (
          <div className={styles.headerAside}>{headerAside}</div>
        ) : null}
      </header>

      <div className={styles.titleBlock}>
        <h2 id="stepPanelTitle" className={styles.title}>
          {title}
        </h2>
        <p className={styles.description}>{description}</p>
      </div>

      {showError ? (
        <div className={styles.error} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            <WarningIcon />
          </span>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className={styles.body}>{children}</div>
    </section>
  );
}

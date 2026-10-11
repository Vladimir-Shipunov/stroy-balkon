/**
 * @file InlineError — reusable inline error-message banner for the configurator.
 *
 * Uses `role="alert"` so assistive tech announces it as soon as it mounts,
 * shows a warning icon + message, and optionally a retry button.
 */
import styles from './InlineError.module.css';

interface InlineErrorProps {
  /** Human-readable error message (in Russian, matching the app's tone). */
  readonly message: string;
  /** Optional callback for a "Повторить" retry button. Omit to hide the button. */
  readonly onRetry?: () => void;
  /** Optional extra class name. */
  readonly className?: string;
}

/**
 * Inline error banner with an optional retry action.
 * @returns The error element.
 */
export function InlineError({ message, onRetry, className }: InlineErrorProps): JSX.Element {
  return (
    <div className={`${styles.wrap} ${className ?? ''}`} role="alert">
      <svg
        className={styles.icon}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className={styles.body}>
        <span className={styles.message}>{message}</span>
        {onRetry ? (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Повторить
          </button>
        ) : null}
      </div>
    </div>
  );
}

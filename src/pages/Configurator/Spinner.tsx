/**
 * @file Spinner — small reusable loading indicator for the configurator.
 *
 * Announces itself to screen readers via `role="status"` + `aria-label`
 * (defaults to "Загрузка…"), and respects `prefers-reduced-motion` in CSS
 * (falls back to a pulsing-opacity indicator instead of a spin animation).
 */
import styles from './Spinner.module.css';

interface SpinnerProps {
  /** Diameter in pixels. Defaults to 22. */
  readonly size?: number;
  /** Border thickness in pixels. Defaults to a proportion of `size`. */
  readonly thickness?: number;
  /** Screen-reader label. Defaults to "Загрузка…". */
  readonly label?: string;
  /** Optional extra class name for positioning. */
  readonly className?: string;
}

/**
 * Small circular loading spinner.
 * @returns The spinner element.
 */
export function Spinner({ size = 22, thickness, label = 'Загрузка…', className }: SpinnerProps): JSX.Element {
  const border = thickness ?? Math.max(2, Math.round(size / 8));
  return (
    <span className={`${styles.wrap} ${className ?? ''}`} role="status" aria-label={label}>
      <span
        className={styles.spinner}
        style={{ width: size, height: size, borderWidth: border }}
        aria-hidden="true"
      />
    </span>
  );
}

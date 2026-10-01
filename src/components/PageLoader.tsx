/**
 * @file PageLoader — minimal branded fallback shown while a route chunk loads.
 */
import styles from './PageLoader.module.css';

/**
 * Lazy-route loading indicator.
 * @returns The loader element.
 */
export function PageLoader(): JSX.Element {
  return (
    <div className={styles.wrap} role="status" aria-label="Загрузка">
      <span className={styles.spinner} />
    </div>
  );
}

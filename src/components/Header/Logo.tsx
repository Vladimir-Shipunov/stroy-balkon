/**
 * @file Logo — gold badge with a stylised glazed-balcony glyph + wordmark.
 */
import styles from './Logo.module.css';

interface LogoProps {
  /** Render light text for use on dark backgrounds. */
  readonly onDark?: boolean;
  readonly compact?: boolean;
}

/**
 * The brand logo.
 * @returns The logo element.
 */
export function Logo({ onDark = false, compact = false }: LogoProps): JSX.Element {
  return (
    <span className={`${styles.logo} ${onDark ? styles.onDark : ''}`}>
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <rect x="6" y="4" width="20" height="24" rx="2" fill="rgba(255,255,255,0.16)" />
          <rect x="6" y="4" width="20" height="24" rx="2" fill="none" stroke="#fff" strokeWidth="1.6" />
          <path d="M16 4v24M6 16h20" stroke="#fff" strokeWidth="1.4" />
          <rect x="9" y="20.5" width="14" height="4" rx="1" fill="#fff" opacity="0.9" />
        </svg>
      </span>
      {!compact && (
        <span className={styles.word}>
          STROY<span className={styles.msk}>-BALKON</span>
        </span>
      )}
    </span>
  );
}

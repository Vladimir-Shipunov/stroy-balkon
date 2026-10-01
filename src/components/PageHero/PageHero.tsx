/**
 * @file PageHero — consistent header band for inner pages.
 */
import type { ReactNode } from 'react';
import styles from './PageHero.module.css';

interface PageHeroProps {
  readonly eyebrow: string;
  readonly title: ReactNode;
  readonly subtitle?: string;
  readonly children?: ReactNode;
}

/**
 * Inner-page hero band.
 * @returns The header element.
 */
export function PageHero({ eyebrow, title, subtitle, children }: PageHeroProps): JSX.Element {
  return (
    <section className={`${styles.hero} grain`}>
      <div className={`container container--wide ${styles.inner}`}>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {children ? <div className={styles.extra}>{children}</div> : null}
      </div>
    </section>
  );
}

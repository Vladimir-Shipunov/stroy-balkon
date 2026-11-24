/**
 * @file ServiceCard — a single service offering (used on Home and Services).
 */
import type { Service } from '../../data/site';
import { Check } from '../icons';
import styles from './ServiceCard.module.css';

interface ServiceCardProps {
  readonly service: Service;
  /** Show the full feature list (Services page) vs a trimmed one (Home). */
  readonly detailed?: boolean;
}

const TONE_GLYPH: Record<Service['tone'], JSX.Element> = {
  sky: (
    <path d="M14 40v-18l18-12 18 12v18M22 40v-12h20v12" />
  ),
  gold: (
    <path d="M14 40l18-26 18 26M22 40v-10h20v10M28 30h8" />
  ),
  wood: (
    <path d="M14 18h36M14 26h36M14 34h36M22 18v22M40 18v22" />
  ),
  slate: (
    <path d="M12 24l20-12 20 12M16 24v16h32V24M24 40V30h16v10" />
  ),
};

/**
 * Service offering card.
 * @returns The card element.
 */
export function ServiceCard({ service, detailed = false }: ServiceCardProps): JSX.Element {
  const features = detailed ? service.features : service.features.slice(0, 3);

  return (
    <article className={`${styles.card} ${styles[`tone_${service.tone}`]}`}>
      <div className={styles.head}>
        <span className={styles.glyph} aria-hidden="true">
          <svg viewBox="0 0 64 52" width="40" height="34" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            {TONE_GLYPH[service.tone]}
          </svg>
        </span>
      </div>

      <h3 className={styles.title}>{service.title}</h3>
      <p className={styles.tagline}>{service.tagline}</p>

      <ul className={styles.features}>
        {features.map((f) => (
          <li key={f}>
            <Check size={16} /> {f}
          </li>
        ))}
      </ul>
    </article>
  );
}

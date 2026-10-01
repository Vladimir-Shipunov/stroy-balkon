/**
 * @file Portfolio — filterable gallery of completed projects. Thumbnails are
 * drawn in SVG (tone-based) so the page has no external image dependency.
 */
import { useMemo, useState } from 'react';
import { useCallModal } from '../../components/CallModal/CallModalProvider';
import { PageHero } from '../../components/PageHero/PageHero';
import { Reveal } from '../../components/Reveal';
import { PROJECTS } from '../../data/site';
import type { ProjectItem } from '../../data/site';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Portfolio.module.css';

const FILTERS = ['Все', 'Лоджия', 'Балкон', 'Под ключ', 'Объединение'] as const;
type Filter = (typeof FILTERS)[number];

const TONE: Record<ProjectItem['tone'], { sky: string; wall: string; floor: string }> = {
  gold: { sky: '#f4dca2', wall: '#efe7d8', floor: '#b78a55' },
  sky: { sky: '#bcd9ea', wall: '#e9eef1', floor: '#9aa7ad' },
  wood: { sky: '#f0d3a8', wall: '#e7d9c2', floor: '#9a6f3e' },
  slate: { sky: '#cdd5dd', wall: '#e4e7ea', floor: '#6b7079' },
  stone: { sky: '#e2d6c4', wall: '#ded6c8', floor: '#8c7c66' },
};

function ProjectThumb({ item }: { item: ProjectItem }): JSX.Element {
  const t = TONE[item.tone];
  return (
    <svg
      className={styles.thumb}
      viewBox="0 0 400 280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="400" height="280" fill={t.wall} />
      <rect x="40" y="34" width="320" height="190" rx="6" fill={t.sky} />
      <g fill="#8aa0ad" opacity="0.5">
        <rect x="60" y="140" width="34" height="83" />
        <rect x="100" y="110" width="26" height="113" />
        <rect x="250" y="120" width="30" height="103" />
        <rect x="290" y="150" width="36" height="73" />
      </g>
      <g stroke="#3a3a36" strokeWidth="6" fill="none" opacity="0.9">
        <rect x="40" y="34" width="320" height="190" rx="6" />
        <line x1="200" y1="34" x2="200" y2="224" />
        <line x1="40" y1="129" x2="360" y2="129" />
      </g>
      <rect x="0" y="223" width="400" height="57" fill={t.floor} />
    </svg>
  );
}

/**
 * The portfolio page.
 * @returns The page element.
 */
export function Portfolio(): JSX.Element {
  usePageTitle('Портфолио работ');
  const { open } = useCallModal();
  const [filter, setFilter] = useState<Filter>('Все');

  const visible = useMemo(
    () => (filter === 'Все' ? PROJECTS : PROJECTS.filter((p) => p.category === filter)),
    [filter],
  );

  return (
    <>
      <PageHero
        eyebrow="Портфолио"
        title={
          <>
            Балконы, которыми мы&nbsp;<em>гордимся</em>
          </>
        }
        subtitle="Более 2 400 завершённых проектов в Москве и области. Несколько примеров — от компактных «хрущёвок» до панорамных лоджий и объединений с комнатой."
      />

      <section className={`container container--wide ${styles.wrap}`}>
        <div className={styles.filters} role="tablist" aria-label="Фильтр проектов">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`${styles.filter} ${filter === f ? styles.filterActive : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {visible.map((item, i) => (
            <Reveal key={item.id} delay={(i % 3) * 70}>
              <article className={styles.card}>
                <div className={styles.media}>
                  <ProjectThumb item={item} />
                  <span className={styles.badge}>{item.category}</span>
                </div>
                <div className={styles.body}>
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  <p className={styles.summary}>{item.summary}</p>
                  <div className={styles.meta}>
                    <span>
                      <span className={styles.metaLabel}>Площадь</span>
                      {item.area}
                    </span>
                    <span>
                      <span className={styles.metaLabel}>Срок</span>
                      {item.term}
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className={styles.cta}>
          <h2 className={styles.ctaTitle}>Хотите такой же балкон?</h2>
          <p className={styles.ctaText}>
            Покажем больше работ на замере и подберём решение под ваш бюджет.
          </p>
          <button className="btn btn--primary btn--lg" onClick={() => open()} type="button">
            Заказать замер
          </button>
        </Reveal>
      </section>
    </>
  );
}

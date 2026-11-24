/**
 * @file Portfolio — filterable gallery of completed projects.
 */
import { useMemo, useState } from 'react';
import { useCallModal } from '../../components/CallModal/CallModalProvider';
import { PageHero } from '../../components/PageHero/PageHero';
import { Reveal } from '../../components/Reveal';
import { PROJECTS, type ProjectItem } from '../../data/site';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Portfolio.module.css';

type Filter = 'Все' | ProjectItem['category'];

/**
 * The portfolio page.
 * @returns The page element.
 */
export function Portfolio(): JSX.Element {
  usePageTitle('Портфолио работ');
  const { open } = useCallModal();
  const [filter, setFilter] = useState<Filter>('Все');

  const filters = useMemo(() => {
    const counts = new Map<ProjectItem['category'], number>();
    PROJECTS.forEach((project) => {
      counts.set(project.category, (counts.get(project.category) ?? 0) + 1);
    });
    return [
      { label: 'Все' as const, count: PROJECTS.length },
      ...Array.from(counts, ([label, count]) => ({ label, count })),
    ];
  }, []);

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
          {filters.map(({ label, count }) => (
            <button
              key={label}
              role="tab"
              aria-selected={filter === label}
              className={`${styles.filter} ${filter === label ? styles.filterActive : ''}`}
              onClick={() => setFilter(label)}
              type="button"
            >
              {label}
              <span className={styles.filterCount}>{count}</span>
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {visible.map((item, i) => (
            <Reveal key={item.id} delay={(i % 3) * 70}>
              <article className={styles.card}>
                <div className={styles.media}>
                  <img className={styles.thumb} src={item.image} alt={item.imageAlt} loading="lazy" decoding="async" />
                  <span className={styles.badge}>{item.category}</span>
                </div>
                <div className={styles.body}>
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  <p className={styles.summary}>{item.summary}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className={styles.cta}>
          <h2 className={styles.ctaTitle}>Хотите такой же балкон?</h2>
          <p className={styles.ctaText}>
            Покажем больше работ и поможем выбрать подходящее решение.
          </p>
          <button className="btn btn--primary btn--lg" onClick={() => open()} type="button">
            Заказать замер
          </button>
        </Reveal>
      </section>
    </>
  );
}

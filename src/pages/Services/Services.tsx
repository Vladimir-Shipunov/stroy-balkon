/**
 * @file Services — full list of offerings and a closing CTA.
 */
import { Link } from 'react-router-dom';
import { useCallModal } from '../../components/CallModal/CallModalProvider';
import { ArrowRight, Check } from '../../components/icons';
import { PageHero } from '../../components/PageHero/PageHero';
import { Reveal } from '../../components/Reveal';
import { ServiceCard } from '../../components/ServiceCard/ServiceCard';
import { SERVICES } from '../../data/site';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Services.module.css';

const INCLUDED: readonly string[] = [
  'Выезд замерщика и обсуждение задач',
  'Доставка и подъём материалов',
  'Демонтаж старых конструкций',
  'Монтаж, отделка и уборка после работ',
  'Гарантия 5 лет и сервисное обслуживание',
];

/**
 * The services page.
 * @returns The page element.
 */
export function Services(): JSX.Element {
  usePageTitle('Услуги');
  const { open } = useCallModal();

  return (
    <>
      <PageHero
        eyebrow="Услуги"
        title={
          <>
            Что мы делаем с&nbsp;<em>балконами</em>
          </>
        }
        subtitle="От холодного остекления до объединения с комнатой. Подберём подходящее решение после замера."
      />

      <section className={`container container--wide ${styles.grid}`}>
        {SERVICES.map((service, i) => (
          <Reveal key={service.id} delay={(i % 3) * 80}>
            <ServiceCard service={service} detailed />
          </Reveal>
        ))}
      </section>

      <section className={styles.includedBand}>
        <div className={`container container--wide ${styles.includedInner}`}>
          <Reveal className={styles.includedCopy}>
            <span className="eyebrow">Полный цикл работ</span>
            <h2 className={styles.includedTitle}>Что входит в работу</h2>
            <p className={styles.includedText}>
              Одна команда выполняет весь комплекс работ — от замера и доставки материалов до
              монтажа, отделки и уборки.
            </p>
            <Link to="/configurator" className="btn btn--primary btn--lg">
              Подобрать решение <ArrowRight size={20} />
            </Link>
          </Reveal>
          <Reveal className={styles.includedList} delay={120}>
            <ul>
              {INCLUDED.map((item) => (
                <li key={item}>
                  <Check size={18} /> {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className={`container container--wide ${styles.ctaWrap}`}>
        <Reveal className={styles.cta}>
          <h2 className={styles.ctaTitle}>Не знаете, с чего начать?</h2>
          <p className={styles.ctaText}>
            Оставьте заявку — подскажем решение с учётом особенностей вашего балкона.
          </p>
          <button className="btn btn--primary btn--lg" onClick={() => open()} type="button">
            Получить консультацию
          </button>
        </Reveal>
      </section>
    </>
  );
}

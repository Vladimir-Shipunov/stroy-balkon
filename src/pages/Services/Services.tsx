/**
 * @file Services — full list of offerings with prices and a closing CTA.
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
  'Выезд замерщика и расчёт сметы',
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
  usePageTitle('Услуги и цены');
  const { open } = useCallModal();

  return (
    <>
      <PageHero
        eyebrow="Услуги и цены"
        title={
          <>
            Что мы делаем с&nbsp;<em>балконами</em>
          </>
        }
        subtitle="От холодного остекления до объединения с комнатой. Точную стоимость считаем по итогам бесплатного замера — цена в договоре фиксируется и не меняется."
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
            <span className="eyebrow">Без скрытых доплат</span>
            <h2 className={styles.includedTitle}>Что входит в стоимость</h2>
            <p className={styles.includedText}>
              Мы не дробим смету на десятки мелких позиций. В цену уже включён полный цикл — вы
              платите за результат, а не за каждый шуруп.
            </p>
            <Link to="/configurator" className="btn btn--primary btn--lg">
              Рассчитать в конфигураторе <ArrowRight size={20} />
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
            Оставьте заявку — подскажем оптимальное решение под ваш балкон и бюджет.
          </p>
          <button className="btn btn--primary btn--lg" onClick={() => open()} type="button">
            Получить консультацию
          </button>
        </Reveal>
      </section>
    </>
  );
}

/**
 * @file Home — landing page: hero, stats, services, configurator promo, why-us,
 * process, reviews and a closing CTA.
 */
import { Link } from 'react-router-dom';
import { useCallModal } from '../../components/CallModal/CallModalProvider';
import { ArrowRight, ArrowUpRight, Check, ShieldIcon, Star } from '../../components/icons';
import { Reveal } from '../../components/Reveal';
import { ServiceCard } from '../../components/ServiceCard/ServiceCard';
import { REASONS, REVIEWS, SERVICES, STATS, STEPS } from '../../data/site';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Home.module.css';

/**
 * The home page.
 * @returns The page element.
 */
export function Home(): JSX.Element {
  usePageTitle('Отделка и остекление балконов под ключ в Москве');
  const { open } = useCallModal();

  return (
    <>
      {/* ===== Hero ===== */}
      <section className={`${styles.hero} grain`}>
        <div className={`container container--wide ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <span className="eyebrow">Балконы и лоджии под ключ · {STATS[0]?.value} в Москве</span>
            <h1 className={styles.heroTitle}>
              Балкон, в котором <em>хочется</em> жить
            </h1>
            <p className={styles.heroLead}>
              Остекление, утепление и отделка под ключ. Соберите свой балкон в конфигураторе —
              выберите планировку, остекление, отделку, мебель и свет, а мы воплотим его
              за&nbsp;7–14&nbsp;дней.
            </p>
            <div className={styles.heroActions}>
              <Link to="/configurator" className="btn btn--primary btn--lg">
                Собрать свой балкон <ArrowRight size={20} />
              </Link>
              <button className="btn btn--ghost btn--lg" onClick={() => open()} type="button">
                Бесплатный замер
              </button>
            </div>
            <div className={styles.heroTrust}>
              <div className={styles.heroRating}>
                <div className={styles.stars} aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={16} />
                  ))}
                </div>
                <span>
                  <strong>4.9</strong> · отзывы на Авито и Яндекс
                </span>
              </div>
              <div className={styles.heroGuarantee}>
                <ShieldIcon size={20} /> Гарантия 5 лет по договору
              </div>
            </div>
          </div>

          <div className={styles.heroArtWrap}>
            <div className={styles.heroArtFrame}>
              <img
                className={styles.heroArt}
                src="/vam/showcase/hero.webp"
                width={800}
                height={800}
                alt="Угловой балкон, отделанный вагонкой, с подвесными светильниками"
                // @ts-expect-error fetchpriority is valid HTML but missing from the installed @types/react@18.3.31 JSX typings
                fetchpriority="high"
                decoding="async"
              />
            </div>
            <div className={`${styles.chip} ${styles.chipTop}`}>
              <span className={styles.chipLabel}>Срок монтажа</span>
              <span className={styles.chipValue}>7–14 дней</span>
            </div>
            <div className={`${styles.chip} ${styles.chipBottom}`}>
              <span className={styles.chipDot} aria-hidden="true" />
              <span>
                <span className={styles.chipLabel}>Уже собрано</span>
                <span className={styles.chipValue}>2 400+ балконов</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Stats ===== */}
      <section className={styles.statsBand}>
        <div className={`container container--wide ${styles.statsInner}`}>
          {STATS.map((s, i) => (
            <Reveal className={styles.stat} key={s.label} delay={i * 80}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== Services ===== */}
      <section className={`container container--wide ${styles.section}`}>
        <Reveal className={styles.sectionHead}>
          <div>
            <span className="eyebrow">Услуги</span>
            <h2 className={styles.sectionTitle}>Полный цикл работ с&nbsp;балконом</h2>
          </div>
          <Link to="/services" className={styles.sectionLink}>
            Все услуги и цены <ArrowUpRight size={18} />
          </Link>
        </Reveal>
        <div className={styles.servicesGrid}>
          {SERVICES.map((service, i) => (
            <Reveal key={service.id} delay={(i % 3) * 90}>
              <ServiceCard service={service} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== Configurator promo ===== */}
      <section className={styles.promo}>
        <div className={`container container--wide ${styles.promoInner}`}>
          <div className={`${styles.promoArt} grain`}>
            <img
              className={styles.promoArtImg}
              src="/vam/showcase/promo.webp"
              width={800}
              height={800}
              alt="Длинная лоджия с голубой вагонкой и светильником"
              loading="lazy"
              decoding="async"
            />
          </div>
          <Reveal className={styles.promoCopy}>
            <span className="eyebrow">Конфигуратор</span>
            <h2 className={styles.promoTitle}>
              Соберите свой балкон <br /> прямо в браузере
            </h2>
            <p className={styles.promoText}>
              Загляните «внутрь» будущего балкона и меняйте всё в реальном времени: планировку и
              остекление, отделку стен и пола, плинтус, мебель и светильники. Видите результат —
              заказываете замер.
            </p>
            <ul className={styles.promoList}>
              <li>
                <Check size={18} /> Вид изнутри — как будто вы уже там
              </li>
              <li>
                <Check size={18} /> Материалы и мебель меняются мгновенно
              </li>
              <li>
                <Check size={18} /> Сохраняем конфигурацию к замеру
              </li>
            </ul>
            <Link to="/configurator" className="btn btn--primary btn--lg">
              Открыть конфигуратор <ArrowRight size={20} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ===== Why us ===== */}
      <section className={`container container--wide ${styles.section}`}>
        <Reveal className={styles.sectionHeadCenter}>
          <span className="eyebrow eyebrow--center">Почему мы</span>
          <h2 className={styles.sectionTitle}>
            6&nbsp;причин выбрать <em>БАЛКОН-МСК</em>
          </h2>
        </Reveal>
        <div className={styles.reasonsGrid}>
          {REASONS.map((r, i) => (
            <Reveal className={styles.reason} key={r.title} delay={(i % 3) * 80}>
              <span className={styles.reasonNum}>{String(i + 1).padStart(2, '0')}</span>
              <h3 className={styles.reasonTitle}>{r.title}</h3>
              <p className={styles.reasonBody}>{r.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== Process ===== */}
      <section className={styles.processBand}>
        <div className={`container container--wide ${styles.section}`}>
          <Reveal className={styles.sectionHeadCenter}>
            <span className="eyebrow eyebrow--center">Как мы работаем</span>
            <h2 className={styles.sectionTitle}>Четыре шага до готового балкона</h2>
          </Reveal>
          <div className={styles.steps}>
            {STEPS.map((step, i) => (
              <Reveal className={styles.step} key={step.n} delay={i * 90}>
                <span className={styles.stepNum}>{step.n}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Reviews ===== */}
      <section className={`container container--wide ${styles.section}`}>
        <Reveal className={styles.sectionHeadCenter}>
          <span className="eyebrow eyebrow--center">Отзывы</span>
          <h2 className={styles.sectionTitle}>Что говорят клиенты</h2>
        </Reveal>
        <div className={styles.reviews}>
          {REVIEWS.map((review, i) => (
            <Reveal className={styles.review} key={review.author} delay={(i % 2) * 90}>
              <div className={styles.reviewStars} aria-label={`Оценка ${review.rating} из 5`}>
                {Array.from({ length: review.rating }).map((_, s) => (
                  <Star key={s} size={16} />
                ))}
              </div>
              <p className={styles.reviewText}>«{review.text}»</p>
              <div className={styles.reviewMeta}>
                <span className={styles.reviewAvatar} aria-hidden="true">
                  {review.author.charAt(0)}
                </span>
                <div>
                  <strong>{review.author}</strong>
                  <span>{review.meta}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className={`container container--wide`}>
        <Reveal className={`${styles.cta} grain`}>
          <div className={styles.ctaCopy}>
            <h2 className={styles.ctaTitle}>Готовы преобразить свой балкон?</h2>
            <p className={styles.ctaText}>
              Замер — бесплатно и ни к чему не обязывает. Приедем в удобное время, всё измерим и
              рассчитаем точную смету.
            </p>
          </div>
          <div className={styles.ctaActions}>
            <button className="btn btn--primary btn--lg" onClick={() => open()} type="button">
              Заказать бесплатный замер
            </button>
            <Link to="/configurator" className={styles.ctaLink}>
              или соберите балкон сами <ArrowRight size={18} />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}

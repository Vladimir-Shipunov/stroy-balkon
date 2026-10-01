/**
 * @file About — company story, principles, stats and a closing CTA.
 */
import { useCallModal } from '../../components/CallModal/CallModalProvider';
import { PageHero } from '../../components/PageHero/PageHero';
import { Reveal } from '../../components/Reveal';
import { STATS, STEPS } from '../../data/site';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './About.module.css';

const PRINCIPLES: readonly { title: string; body: string }[] = [
  {
    title: 'Честность в смете',
    body: 'Называем итоговую цену на замере и фиксируем её в договоре. Без «вылезших» доплат в процессе работ.',
  },
  {
    title: 'Качество материалов',
    body: 'Работаем с проверенными профилями Rehau, KBE, Provedal и материалами, которые служат десятилетиями.',
  },
  {
    title: 'Ответственность',
    body: 'Даём гарантию 5 лет и не пропадаем после сдачи: регулируем фурнитуру и помогаем по гарантии.',
  },
  {
    title: 'Уважение к дому',
    body: 'Защищаем квартиру, работаем аккуратно и убираем за собой. Балкон — часть вашего дома.',
  },
];

/**
 * The about page.
 * @returns The page element.
 */
export function About(): JSX.Element {
  usePageTitle('О компании');
  const { open } = useCallModal();

  return (
    <>
      <PageHero
        eyebrow="О компании"
        title={
          <>
            Делаем балконы в&nbsp;Москве с&nbsp;<em>2013&nbsp;года</em>
          </>
        }
        subtitle="БАЛКОН-МСК — команда замерщиков, монтажников и отделочников, которая превращает балконы и лоджии в тёплые, удобные и красивые комнаты."
      />

      <section className={`container container--wide ${styles.story}`}>
        <Reveal className={styles.storyCopy}>
          <span className="eyebrow">Наша история</span>
          <h2 className={styles.h2}>Начали с остекления — выросли в отделку под ключ</h2>
          <p>
            Мы начинали как небольшая бригада по остеклению в южных районах Москвы. Со временем
            клиенты стали просить «доделать балкон полностью» — утеплить, обшить, провести свет.
            Так появилась полноценная компания полного цикла.
          </p>
          <p>
            Сегодня мы собрали более 2 400 балконов и лоджий. У нас свои бригады без посредников,
            собственный конфигуратор, в котором клиент видит будущий балкон ещё до начала работ, и
            фиксированные сметы, которым можно доверять.
          </p>
        </Reveal>
        <Reveal className={styles.storyArt} delay={120}>
          <div className={styles.artFrame}>
            <img
              src="/vam/showcase/story.webp"
              width={800}
              height={800}
              alt="Балкон со стеновым паркетом и барным стулом"
              loading="lazy"
              decoding="async"
            />
          </div>
        </Reveal>
      </section>

      <section className={styles.statsBand}>
        <div className={`container container--wide ${styles.statsInner}`}>
          {STATS.map((s, i) => (
            <Reveal className={styles.stat} key={s.label} delay={i * 70}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={`container container--wide ${styles.section}`}>
        <Reveal className={styles.headCenter}>
          <span className="eyebrow eyebrow--center">Принципы</span>
          <h2 className={styles.h2}>Во что мы верим</h2>
        </Reveal>
        <div className={styles.principles}>
          {PRINCIPLES.map((p, i) => (
            <Reveal className={styles.principle} key={p.title} delay={(i % 2) * 80}>
              <h3 className={styles.principleTitle}>{p.title}</h3>
              <p className={styles.principleBody}>{p.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.processBand}>
        <div className={`container container--wide ${styles.section}`}>
          <Reveal className={styles.headCenter}>
            <span className="eyebrow eyebrow--center">Процесс</span>
            <h2 className={styles.h2}>От заявки до готового балкона</h2>
          </Reveal>
          <div className={styles.steps}>
            {STEPS.map((step, i) => (
              <Reveal className={styles.step} key={step.n} delay={i * 80}>
                <span className={styles.stepNum}>{step.n}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className={`container container--wide ${styles.ctaWrap}`}>
        <Reveal className={styles.cta}>
          <h2 className={styles.ctaTitle}>Давайте обсудим ваш балкон</h2>
          <p className={styles.ctaText}>
            Расскажите о задаче — предложим решение и приедем на бесплатный замер.
          </p>
          <button className="btn btn--primary btn--lg" onClick={() => open()} type="button">
            Связаться с нами
          </button>
        </Reveal>
      </section>
    </>
  );
}

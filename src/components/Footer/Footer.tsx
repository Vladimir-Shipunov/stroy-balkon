/**
 * @file Footer — dark brand footer with contacts, navigation, socials and CTA.
 */
import { Link } from 'react-router-dom';
import { COMPANY, NAV_LINKS } from '../../data/site';
import { useCallModal } from '../CallModal/CallModalProvider';
import {
  ArrowUpRight,
  Avito,
  Clock,
  Instagram,
  MailIcon,
  MapPin,
  PhoneIcon,
  Telegram,
  Vk,
} from '../icons';
import { Logo } from '../Header/Logo';
import styles from './Footer.module.css';

const YEAR = 2025;

/**
 * The site footer.
 * @returns The footer element.
 */
export function Footer(): JSX.Element {
  const { open } = useCallModal();

  return (
    <footer className={`${styles.footer} grain`}>
      <div className={`container container--wide ${styles.top}`}>
        <div className={styles.brandCol}>
          <Logo onDark />
          <p className={styles.brandText}>
            Остекление, утепление и отделка балконов и лоджий под ключ в Москве и области.
            Свои бригады, фиксированная смета, гарантия 5 лет.
          </p>
          <div className={styles.socials}>
            <a href={COMPANY.social.instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer">
              <Instagram />
            </a>
            <a href={COMPANY.social.vk} aria-label="ВКонтакте" target="_blank" rel="noopener noreferrer">
              <Vk />
            </a>
            <a href={COMPANY.social.telegram} aria-label="Telegram" target="_blank" rel="noopener noreferrer">
              <Telegram />
            </a>
            <a href={COMPANY.social.avito} aria-label="Авито" target="_blank" rel="noopener noreferrer">
              <Avito />
            </a>
          </div>
        </div>

        <div className={styles.linksCol}>
          <h3 className={styles.colTitle}>Меню</h3>
          <ul>
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
            <li>
              <Link to="/configurator">Конфигуратор</Link>
            </li>
          </ul>
        </div>

        <div className={styles.contactCol}>
          <h3 className={styles.colTitle}>Контакты</h3>
          <a href={COMPANY.phonePrimary.href} className={styles.contactItem}>
            <PhoneIcon size={18} /> {COMPANY.phonePrimary.display}
          </a>
          <a href={COMPANY.phoneSecondary.href} className={styles.contactItem}>
            <PhoneIcon size={18} /> {COMPANY.phoneSecondary.display}
          </a>
          <a href={COMPANY.email.href} className={styles.contactItem}>
            <MailIcon size={18} /> {COMPANY.email.display}
          </a>
          <p className={styles.contactItem}>
            <MapPin size={18} /> {COMPANY.address}
          </p>
          <p className={styles.contactItem}>
            <Clock size={18} /> {COMPANY.hours}
          </p>
          <a
            href={COMPANY.mapHref}
            className={styles.mapLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть на Яндекс.Картах <ArrowUpRight size={15} />
          </a>
        </div>

        <div className={styles.ctaCol}>
          <h3 className={styles.colTitle}>Бесплатный замер</h3>
          <p className={styles.ctaText}>Приедем в удобное время, замерим и рассчитаем смету.</p>
          <button className="btn btn--primary" onClick={() => open()} type="button">
            Заказать звонок
          </button>
        </div>
      </div>

      <div className={`container container--wide ${styles.bottom}`}>
        <span>© {COMPANY.legalNote.replace('2025', String(YEAR))}</span>
        <a href="/privacy" className={styles.policy}>
          Политика конфиденциальности
        </a>
      </div>
    </footer>
  );
}

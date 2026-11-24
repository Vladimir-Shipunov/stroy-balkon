/**
 * @file Header — sticky brand header with nav, phone, call + configurator CTAs,
 * and a mobile drawer. The configurator is intentionally a button, not a nav
 * link (per spec).
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { COMPANY, NAV_LINKS } from '../../data/site';
import { useCallModal } from '../CallModal/CallModalProvider';
import { ArrowUpRight, CloseIcon, MenuIcon, PhoneIcon } from '../icons';
import { Logo } from './Logo';
import styles from './Header.module.css';

/**
 * The site header.
 * @returns The header element.
 */
export function Header(): JSX.Element {
  const { open } = useCallModal();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the drawer on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('modal-open', menuOpen);
    return () => document.body.classList.remove('modal-open');
  }, [menuOpen]);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`container container--wide ${styles.inner}`}>
        <Link to="/" className={styles.brand} aria-label="STROY-BALKON, на главную">
          <Logo />
        </Link>

        <nav className={styles.nav} aria-label="Основная навигация">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.actions}>
          <a href={COMPANY.phonePrimary.href} className={styles.phone}>
            <PhoneIcon size={17} />
            <span>{COMPANY.phonePrimary.display}</span>
          </a>
          <Link to="/configurator" className={styles.configBtn}>
            Конфигуратор <ArrowUpRight size={16} />
          </Link>
          <button className={`btn btn--primary ${styles.callBtn}`} onClick={() => open()} type="button">
            Заказать замер
          </button>
          <button
            className={styles.burger}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            type="button"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile drawer — only mounted while open, so it adds no page width. */}
      {menuOpen ? (
        <>
          <div className={styles.drawer}>
            <nav className={styles.drawerNav} aria-label="Мобильная навигация">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `${styles.drawerLink} ${isActive ? styles.drawerLinkActive : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Link to="/configurator" className={styles.drawerConfig}>
            Открыть конфигуратор <ArrowUpRight size={16} />
          </Link>
        </nav>
        <div className={styles.drawerFoot}>
          <a href={COMPANY.phonePrimary.href} className={styles.drawerPhone}>
            <PhoneIcon size={18} /> {COMPANY.phonePrimary.display}
          </a>
          <button
            className="btn btn--primary"
            onClick={() => {
              setMenuOpen(false);
              open();
            }}
            type="button"
          >
            Заказать звонок
          </button>
            </div>
          </div>
          <div className={styles.scrim} onClick={() => setMenuOpen(false)} aria-hidden="true" />
        </>
      ) : null}
    </header>
  );
}

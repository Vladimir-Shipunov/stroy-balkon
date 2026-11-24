import { Link, useLocation } from 'react-router-dom';
import { Logo } from '../../components/Header/Logo';
import styles from './AdminPanel.module.css';

export function AdminNav({ title, onLogout }: { title: string; onLogout: () => void }): JSX.Element {
  const location = useLocation();
  const links = [
    ['Заказы', '/admin/orders'],
    ['Заказ замера', '/admin/calls'],
    ['Чаты', '/admin/chats'],
  ] as const;
  return (
    <header className={styles.bar}>
      <Link to="/" aria-label="На главную"><Logo /></Link>
      <span className={styles.title}>{title}</span>
      <nav className={styles.nav} aria-label="Разделы админ-панели">
        {links.map(([label, href]) => (
          <Link key={href} to={href} className={`${styles.navLink} ${location.pathname.startsWith(href) ? styles.active : ''}`}>
            {label}
          </Link>
        ))}
      </nav>
      <span className={styles.spacer} />
      <button type="button" className={styles.navLink} onClick={onLogout}>Выйти</button>
    </header>
  );
}

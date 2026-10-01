/**
 * @file NotFound — friendly 404 within the marketing shell.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from '../../components/icons';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './NotFound.module.css';

/**
 * The 404 page.
 * @returns The page element.
 */
export function NotFound(): JSX.Element {
  usePageTitle('Страница не найдена');

  return (
    <section className={`container ${styles.wrap}`}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Такой страницы нет</h1>
      <p className={styles.text}>
        Возможно, ссылка устарела. Вернитесь на главную или соберите свой балкон в конфигураторе.
      </p>
      <div className={styles.actions}>
        <Link to="/" className="btn btn--primary btn--lg">
          На главную
        </Link>
        <Link to="/configurator" className="btn btn--ghost btn--lg">
          Открыть конфигуратор <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

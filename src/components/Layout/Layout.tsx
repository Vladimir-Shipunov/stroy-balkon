/**
 * @file Layout — marketing shell: header, routed page, footer. The configurator
 * route opts out of this shell to render full-screen.
 */
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Footer } from '../Footer/Footer';
import { Header } from '../Header/Header';
import { PageLoader } from '../PageLoader';
import styles from './Layout.module.css';

/**
 * The marketing layout wrapper.
 * @returns The shell element.
 */
export function Layout(): JSX.Element {
  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

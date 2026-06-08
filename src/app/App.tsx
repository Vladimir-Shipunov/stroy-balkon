/**
 * @file Application root — a compact professional top bar over the configurator.
 */

import { useConfiguratorStore } from '../store/configuratorStore';
import { formatEurPrecise } from '../lib/ui/money';
import { ConfiguratorPage } from '../ui/configurator/ConfiguratorPage';
import styles from './App.module.css';

export function App(): JSX.Element {
  const total = useConfiguratorStore((s) => s.currentPrice.total);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M12 3v18M3 12h18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Balcony Glazing</span>
            <span className={styles.brandSub}>Configurator &amp; Quote</span>
          </span>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.totalLabel}>Live total (incl. VAT)</span>
          <span className={styles.totalValue}>{formatEurPrecise(total)}</span>
        </div>
      </header>

      <ConfiguratorPage />
    </div>
  );
}

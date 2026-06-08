/**
 * @file ConfiguratorPage — the two-column configurator layout.
 *
 * Left column (~60%): the wizard stepper, the active step panel, and the
 * footer navigation. Right column (~40%): the sticky summary sidebar with the
 * live price and visual schematic. Collapses to a single column below 1280px.
 */

import { WizardStepper } from './WizardStepper';
import { ActiveStep } from './ActiveStep';
import { WizardNav } from './WizardNav';
import { SummarySidebar } from './SummarySidebar';
import styles from './ConfiguratorPage.module.css';

export function ConfiguratorPage(): JSX.Element {
  return (
    <div className={styles.layout}>
      <main className={styles.content} aria-label="Configuration">
        <WizardStepper />
        <div className={styles.panel}>
          <ActiveStep />
        </div>
        <WizardNav />
      </main>

      <aside className={styles.sidebar} aria-label="Quote summary">
        <SummarySidebar />
      </aside>
    </div>
  );
}

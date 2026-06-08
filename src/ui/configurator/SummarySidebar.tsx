/**
 * @file SummarySidebar — the sticky right-column summary of the configurator.
 *
 * Renders, top to bottom: the live {@link BalconySchematic} visual, a compact
 * synopsis of the current selections, the itemised live price breakdown, and a
 * totals block (subtotal, VAT, gross total). It is read-only: every value is
 * pulled from the kernel store via selectors, so it always reflects the latest
 * configuration and derived price. The component takes no props — the page owns
 * the layout column; the card sticks itself within that column.
 */

import { useConfiguratorStore } from '../../store/configuratorStore';
import { PriceUnit } from '../../types/balcony';
import { formatEurPrecise, formatPercent } from '../../lib/ui/money';
import {
  getColorFinish,
  getGlassType,
  getGlazing,
  getProfileSystem,
} from '../../data/catalog';
import { BalconySchematic } from './BalconySchematic';
import styles from './SummarySidebar.module.css';

/** Centimetres → millimetres, rounded to a whole millimetre for display. */
const cmToMm = (cm: number): number => Math.round(cm * 10);

/**
 * Build the muted quantity sub-line for a line item, e.g. `12.46 m² × 45 €/m²`.
 * Returns `null` for flat charges, where a quantity line carries no meaning.
 */
function formatQuantityLine(
  quantity: number,
  unit: PriceUnit,
  unitPrice: number,
): string | null {
  if (unit === PriceUnit.Flat) {
    return null;
  }
  const qty = quantity.toFixed(2);
  const price = Math.round(unitPrice);
  return `${qty} ${unit} × ${price} €/${unit}`;
}

/**
 * The sticky configuration summary shown in the right column of the
 * configurator: live visual, selection synopsis, price breakdown and totals.
 */
export function SummarySidebar(): JSX.Element {
  const config = useConfiguratorStore((s) => s.config);
  const price = useConfiguratorStore((s) => s.currentPrice);

  const synopsis: readonly { readonly label: string; readonly value: string }[] = [
    { label: 'Profile', value: getProfileSystem(config.profileSystem).name },
    { label: 'Glazing', value: getGlazing(config.glazingType).name },
    { label: 'Glass', value: getGlassType(config.glassType).name },
    { label: 'Finish', value: getColorFinish(config.colorFinish).name },
    {
      label: 'Dimensions',
      value: `${cmToMm(config.widthCm)} × ${cmToMm(config.heightCm)} mm`,
    },
    { label: 'Glazed area', value: `${price.glazedAreaSqm.toFixed(2)} m²` },
  ];

  return (
    <aside className={styles.sidebar} aria-label="Configuration summary">
      <div className={styles.visual}>
        <BalconySchematic />
      </div>

      <section className={styles.synopsis} aria-label="Current selections">
        <dl className={styles.synopsisList}>
          {synopsis.map((row) => (
            <div key={row.label} className={styles.synopsisRow}>
              <dt className={styles.synopsisLabel}>{row.label}</dt>
              <dd className={styles.synopsisValue}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.breakdown} aria-label="Price breakdown">
        <h2 className={styles.sectionTitle}>Price breakdown</h2>
        <ul className={styles.lineItems}>
          {price.lineItems.map((item) => {
            const qtyLine = formatQuantityLine(item.quantity, item.unit, item.unitPrice);
            return (
              <li key={item.id} className={styles.lineItem}>
                <div className={styles.lineItemLabel}>
                  <span className={styles.lineItemName}>{item.label}</span>
                  {qtyLine !== null && (
                    <span className={styles.lineItemQty}>{qtyLine}</span>
                  )}
                </div>
                <span className={styles.lineItemAmount}>
                  {formatEurPrecise(item.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.totals} aria-label="Totals">
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Subtotal (net)</span>
          <span className={styles.totalValue}>{formatEurPrecise(price.subtotal)}</span>
        </div>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>VAT {formatPercent(price.vatRate * 100)}</span>
          <span className={styles.totalValue}>{formatEurPrecise(price.vatAmount)}</span>
        </div>
        <div className={styles.grandTotalRow}>
          <span className={styles.grandTotalLabel}>Total (incl. VAT)</span>
          <span className={styles.grandTotalValue}>{formatEurPrecise(price.total)}</span>
        </div>
      </section>
    </aside>
  );
}

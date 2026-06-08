/**
 * @file Money formatting helpers for the configurator UI (presentation layer).
 *
 * All amounts are EUR. Formatting uses the Finnish locale (`fi-FI`), which
 * renders the euro sign as a suffix with a non-breaking space and a comma
 * decimal separator (e.g. `4 820,00 €`). These helpers are display-only — they
 * never feed back into the pricing engine.
 */

const eur0 = new Intl.NumberFormat('fi-FI', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const eur2 = new Intl.NumberFormat('fi-FI', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format an amount as whole euros, e.g. `4 820 €`. */
export const formatEur = (amount: number): string => eur0.format(amount);

/** Format an amount with cents, e.g. `4 820,50 €`. */
export const formatEurPrecise = (amount: number): string => eur2.format(amount);

/**
 * Format a signed price delta for an option card.
 * - `0`        → `'Included'`
 * - positive   → `'+240 €'`
 * - negative   → `'−90 €'` (true minus sign, not a hyphen)
 */
export const formatDelta = (delta: number): string => {
  const rounded = Math.round(delta);
  if (rounded === 0) {
    return 'Included';
  }
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${formatEur(Math.abs(rounded))}`;
};

/** Format a percentage value, e.g. `90 %`. */
export const formatPercent = (value: number): string =>
  new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 0 }).format(value) + ' %';

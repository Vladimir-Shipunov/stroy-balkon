/**
 * @file Live price-delta helpers for option cards (presentation layer).
 *
 * Each option card shows what choosing that option would do to the price,
 * relative to the CURRENT configuration. We compute that by running the pure
 * pricing engine on a hypothetical config and diffing the net subtotal — so the
 * delta is always exact and stays in sync with the catalog, with zero duplicated
 * pricing logic. These functions are pure and cheap (a couple of engine calls).
 */

import type { AccessoryType, BalconyConfig } from '../../types/balcony';
import { calculatePrice } from '../../lib/pricingEngine';

/** Round to whole cents to avoid floating-point noise in displayed deltas. */
const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * The signed change in net subtotal (EUR) if `patch` were applied to `config`.
 * Positive = more expensive, negative = cheaper, 0 = no change.
 */
export function priceDelta(config: BalconyConfig, patch: Partial<BalconyConfig>): number {
  const base = calculatePrice(config).subtotal;
  const next = calculatePrice({ ...config, ...patch }).subtotal;
  return round2(next - base);
}

/**
 * The signed change in net subtotal (EUR) of toggling a single accessory on or
 * off, relative to the current selection. If the accessory is currently
 * selected, this is the saving from removing it (typically negative); otherwise
 * it is the cost of adding it.
 */
export function accessoryDelta(config: BalconyConfig, accessory: AccessoryType): number {
  const isSelected = config.accessories.includes(accessory);
  const nextAccessories = isSelected
    ? config.accessories.filter((a) => a !== accessory)
    : [...config.accessories, accessory];
  return priceDelta(config, { accessories: nextAccessories });
}

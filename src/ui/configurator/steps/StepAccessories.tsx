/**
 * @file StepAccessories — the optional "Accessories" presentation step.
 *
 * Multi-select step (checkbox semantics) letting the user add optional extras
 * such as insect screens, integrated blinds, trickle vents and drainage. Each
 * accessory renders as an {@link OptionCard} with a small inline icon, its
 * description, a pricing-mode chip (flat / per-m² / per-m), and a live signed
 * price delta for toggling it. Selecting none is valid, so this step almost
 * never shows a validation error — but the standard `hasError` wiring is kept
 * for consistency with the other step panels.
 */

import type { ReactNode } from 'react';
import { ACCESSORIES } from '../../../data/catalog';
import type { AccessorySpec } from '../../../data/catalog';
import { accessoryDelta } from '../../../lib/ui/priceDelta';
import { formatEur } from '../../../lib/ui/money';
import { useConfiguratorStore } from '../../../store/configuratorStore';
import { getStepMeta, WIZARD_STEP_COUNT } from '../../../store/wizardSteps';
import { useWizardStore } from '../../../store/wizardStore';
import { AccessoryType, PriceUnit } from '../../../types/balcony';
import { OptionCard } from '../../primitives/OptionCard';
import { OptionGrid } from '../../primitives/OptionGrid';
import { StepPanel } from '../../primitives/StepPanel';
import styles from './StepAccessories.module.css';

/**
 * Human-readable pricing-mode chip for an accessory, e.g. `85 € flat`,
 * `45 €/m²` or `28 €/m`, derived from its {@link AccessorySpec.pricingMode}.
 */
function pricingChip(spec: AccessorySpec): string {
  const amount = formatEur(spec.price);
  switch (spec.pricingMode) {
    case PriceUnit.SquareMeter:
      return `${amount}/m²`;
    case PriceUnit.LinearMeter:
      return `${amount}/m`;
    case PriceUnit.Flat:
      return `${amount} flat`;
  }
}

/** Simple inline stroke icon for each accessory (24×24, currentColor). */
function accessoryIcon(id: AccessoryType): ReactNode {
  switch (id) {
    case AccessoryType.MosquitoNet:
      // Mesh screen — frame with a cross-hatch grid.
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M9 4v16M14 4v16M4 9h16M4 14h16"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case AccessoryType.Blinds:
      // Pleated blind — horizontal slats with a pull cord.
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <rect x="4" y="3" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 9h14M5 12.5h14M5 16h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M12 19v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case AccessoryType.Ventilation:
      // Trickle vent — airflow arcs through a slot.
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <rect x="3" y="10" width="18" height="4" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7 9c0-2 2-2 2-4M12 9c0-2 2-2 2-4M17 9c0-2 2-2 2-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case AccessoryType.Drainage:
      // Drainage channel — U-profile with a falling water drop.
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <path
            d="M4 7v8a3 3 0 003 3h10a3 3 0 003-3V7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M12 3c1.6 1.8 2.5 3.1 2.5 4.2A2.5 2.5 0 0112 9.7 2.5 2.5 0 019.5 7.2C9.5 6.1 10.4 4.8 12 3z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

/**
 * The Accessories step. Takes no props; reads the kernel + wizard stores and the
 * static {@link ACCESSORIES} catalog, and toggles entries in `config.accessories`.
 */
export function StepAccessories(): JSX.Element {
  const { index, meta } = getStepMeta('accessories');
  const config = useConfiguratorStore((s) => s.config);
  const updateConfig = useConfiguratorStore((s) => s.updateConfig);
  const attempted = useWizardStore((s) => s.attemptedAdvance);
  const hasError = attempted && !meta.validate(config);

  const selectedCount = config.accessories.length;

  return (
    <StepPanel
      stepNumber={index + 1}
      totalSteps={WIZARD_STEP_COUNT}
      title={meta.title}
      description={meta.description}
      hasError={hasError}
      errorMessage={meta.invalidMessage}
      headerAside={
        <span className={styles.countReadout}>
          {selectedCount === 0
            ? 'No extras'
            : `${selectedCount} selected`}
        </span>
      }
    >
      <OptionGrid ariaLabel="Optional accessories" selectionMode="checkbox" density="medium">
        {Object.values(ACCESSORIES).map((spec) => {
          const selected = config.accessories.includes(spec.id);
          const onSelect = (): void => {
            const next = selected
              ? config.accessories.filter((a) => a !== spec.id)
              : [...config.accessories, spec.id];
            updateConfig({ accessories: next });
          };

          return (
            <OptionCard
              key={spec.id}
              label={spec.name}
              description={spec.description}
              icon={accessoryIcon(spec.id)}
              meta={<span className={styles.chip}>{pricingChip(spec)}</span>}
              priceDelta={accessoryDelta(config, spec.id)}
              selected={selected}
              onSelect={onSelect}
              selectionMode="checkbox"
            />
          );
        })}
      </OptionGrid>

      <p className={styles.helper}>
        Accessories are optional — leave them all unselected if none are needed.
      </p>
    </StepPanel>
  );
}

/**
 * @file StepFinish — frame finish selection step.
 *
 * Presents the catalogue of RAL colour finishes as a swatch grid of
 * `OptionCard`s, each previewing the finish colour and labelled with its RAL
 * code. A controlled `<input type="search">` filters the finishes by name OR
 * RAL code (case-insensitive), with a live result count and an empty-state
 * message when nothing matches. Edits the `colorFinish` field of the kernel
 * config; reads/writes only through the documented stores.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import type { ColorFinishSpec } from '../../../data/catalog';
import { COLOR_FINISHES } from '../../../data/catalog';
import { formatEur } from '../../../lib/ui/money';
import { priceDelta } from '../../../lib/ui/priceDelta';
import {
  WIZARD_STEP_COUNT,
  getStepMeta,
} from '../../../store/wizardSteps';
import { useConfiguratorStore } from '../../../store/configuratorStore';
import { useWizardStore } from '../../../store/wizardStore';
import { OptionCard } from '../../primitives/OptionCard';
import { OptionGrid } from '../../primitives/OptionGrid';
import { StepPanel } from '../../primitives/StepPanel';
import styles from './StepFinish.module.css';

/** Leading magnifier glyph for the filter input (stroke-only, currentColor). */
const SearchIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
    <path
      d="M16.5 16.5L21 21"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Frame-finish wizard step. Takes no props — it derives its step number/title
 * from `getStepMeta('finish')` and drives the `colorFinish` config field.
 */
export function StepFinish(): JSX.Element {
  const { index, meta } = getStepMeta('finish');
  const config = useConfiguratorStore((s) => s.config);
  const updateConfig = useConfiguratorStore((s) => s.updateConfig);
  const attempted = useWizardStore((s) => s.attemptedAdvance);
  const hasError = attempted && !meta.validate(config);

  const [query, setQuery] = useState('');

  /**
   * Render one finish card. Builds the `meta` chip only when there is an
   * upcharge and omits the prop entirely otherwise (required by
   * `exactOptionalPropertyTypes`).
   */
  const renderCard = (spec: ColorFinishSpec): JSX.Element => {
    const swatch: ReactNode = (
      <span className={styles.swatch} style={{ backgroundColor: spec.hex }} />
    );
    const upchargeChip: ReactNode | undefined =
      spec.upchargePerSqmEur > 0 ? (
        <span className={styles.upcharge}>{formatEur(spec.upchargePerSqmEur)} / m²</span>
      ) : undefined;

    return (
      <OptionCard
        key={spec.id}
        label={spec.name}
        description={spec.ralCode}
        media={swatch}
        priceDelta={priceDelta(config, { colorFinish: spec.id })}
        selected={config.colorFinish === spec.id}
        onSelect={() => updateConfig({ colorFinish: spec.id })}
        {...(upchargeChip !== undefined ? { meta: upchargeChip } : {})}
      />
    );
  };

  const finishes = Object.values(COLOR_FINISHES);
  const needle = query.trim().toLowerCase();
  const visible =
    needle.length === 0
      ? finishes
      : finishes.filter(
          (spec) =>
            spec.name.toLowerCase().includes(needle) ||
            spec.ralCode.toLowerCase().includes(needle),
        );

  const resultCount = `${visible.length} of ${finishes.length}`;

  return (
    <StepPanel
      stepNumber={index + 1}
      totalSteps={WIZARD_STEP_COUNT}
      title={meta.title}
      description={meta.description}
      hasError={hasError}
      errorMessage={meta.invalidMessage}
    >
      <div className={styles.toolbar}>
        <label className={styles.search} htmlFor="finishSearch">
          <span className={styles.searchIcon} aria-hidden="true">
            <SearchIcon />
          </span>
          <span className={styles.searchLabel}>Filter finishes</span>
          <input
            id="finishSearch"
            type="search"
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or RAL code…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <span className={styles.count} aria-live="polite">
          {resultCount} finishes
        </span>
      </div>

      {visible.length === 0 ? (
        <p className={styles.empty} role="status">
          No finishes match “{query.trim()}”. Try a colour name or RAL code.
        </p>
      ) : (
        <OptionGrid ariaLabel="Frame finish" density="narrow">
          {visible.map(renderCard)}
        </OptionGrid>
      )}
    </StepPanel>
  );
}

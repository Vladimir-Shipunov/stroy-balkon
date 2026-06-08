/**
 * @file StepDimensions — the first wizard step: enter the balcony opening
 * dimensions (width / height / depth).
 *
 * Boundary convention: the kernel stores CENTIMETRES, but glazing professionals
 * specify openings in MILLIMETRES. This component presents and edits millimetres
 * and converts at the kernel boundary (display mm = cm × 10; store cm = mm ÷ 10).
 * Millimetre bounds are derived from `DIMENSION_LIMITS` (× 10) — never hard-coded.
 *
 * Glazed (façade) area = width × height; floor depth does not affect it. The live
 * area is read straight from the priced kernel state so it always matches price.
 */

import { DIMENSION_LIMITS } from '../../../store/configuratorStore';
import { useConfiguratorStore } from '../../../store/configuratorStore';
import { WIZARD_STEP_COUNT, getStepMeta } from '../../../store/wizardSteps';
import { useWizardStore } from '../../../store/wizardStore';
import type { BalconyConfig } from '../../../types/balcony';
import { StepPanel } from '../../primitives/StepPanel';
import styles from './StepDimensions.module.css';

/** Step in millimetres (one centimetre) for stepper buttons and the input. */
const STEP_MM = 10;

/** The three editable dimension fields, keyed to the kernel's cm fields. */
type DimensionKey = 'widthCm' | 'heightCm' | 'depthCm';

/** Static descriptor for one dimension field. */
interface FieldSpec {
  readonly key: DimensionKey;
  readonly label: string;
  readonly limit: { readonly min: number; readonly max: number };
}

/** Field definitions — bounds taken verbatim from the kernel (centimetres). */
const FIELDS: readonly FieldSpec[] = [
  { key: 'widthCm', label: 'Width', limit: DIMENSION_LIMITS.width },
  { key: 'heightCm', label: 'Height', limit: DIMENSION_LIMITS.height },
  { key: 'depthCm', label: 'Depth', limit: DIMENSION_LIMITS.depth },
];

/** Convert a centimetre value to millimetres for display. */
const toMm = (cm: number): number => Math.round(cm * 10);

/** Millimetre bounds for a field, derived from its centimetre limit. */
const mmBounds = (limit: {
  readonly min: number;
  readonly max: number;
}): { readonly min: number; readonly max: number } => ({
  min: limit.min * 10,
  max: limit.max * 10,
});

/** Clamp a millimetre value into the field's allowed range. */
const clampMm = (
  valueMm: number,
  bounds: { readonly min: number; readonly max: number },
): number => Math.min(bounds.max, Math.max(bounds.min, valueMm));

/** Minus / plus glyphs for the stepper buttons (precise line SVGs). */
const MinusIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PlusIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * StepDimensions — three millimetre numeric fields with steppers, per-field
 * validation, and a live glazed-area readout (also surfaced in the panel header).
 */
export function StepDimensions(): JSX.Element {
  const { index, meta } = getStepMeta('dimensions');
  const config = useConfiguratorStore((s) => s.config);
  const updateConfig = useConfiguratorStore((s) => s.updateConfig);
  const area = useConfiguratorStore((s) => s.currentPrice.glazedAreaSqm);
  const attempted = useWizardStore((s) => s.attemptedAdvance);
  const hasError = attempted && !meta.validate(config);

  /** Persist a millimetre value to the kernel (clamped, converted to cm). */
  const commitMm = (key: DimensionKey, rawMm: number, bounds: { min: number; max: number }): void => {
    if (!Number.isFinite(rawMm)) {
      return;
    }
    const clamped = clampMm(rawMm, bounds);
    updateConfig({ [key]: clamped / 10 } as Partial<BalconyConfig>);
  };

  const areaLabel = `${area.toFixed(2)} m²`;

  return (
    <StepPanel
      stepNumber={index + 1}
      totalSteps={WIZARD_STEP_COUNT}
      title={meta.title}
      description={meta.description}
      hasError={hasError}
      errorMessage={meta.invalidMessage}
      headerAside={
        <div className={styles.areaBadge}>
          <span className={styles.areaBadgeLabel}>Glazed area</span>
          <span className={styles.areaBadgeValue}>{areaLabel}</span>
        </div>
      }
    >
      <div className={styles.fields} role="group" aria-label="Opening dimensions in millimetres">
        {FIELDS.map((field) => {
          const bounds = mmBounds(field.limit);
          const valueMm = toMm(config[field.key]);
          const invalid = valueMm < bounds.min || valueMm > bounds.max;
          const inputId = `dim-${field.key}`;
          const hintId = `${inputId}-hint`;
          const errorId = `${inputId}-error`;
          const describedBy = invalid ? `${hintId} ${errorId}` : hintId;

          return (
            <div key={field.key} className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={inputId}>
                {field.label}
              </label>

              <div className={styles.control} data-invalid={invalid || undefined}>
                <button
                  type="button"
                  className={styles.stepper}
                  onClick={() => commitMm(field.key, valueMm - STEP_MM, bounds)}
                  disabled={valueMm - STEP_MM < bounds.min}
                  aria-label={`Decrease ${field.label.toLowerCase()} by ${STEP_MM} millimetres`}
                >
                  <MinusIcon />
                </button>

                <div className={styles.inputWrap}>
                  <input
                    id={inputId}
                    className={styles.input}
                    type="number"
                    inputMode="numeric"
                    min={bounds.min}
                    max={bounds.max}
                    step={STEP_MM}
                    value={valueMm}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    onChange={(e) => {
                      const next = e.target.valueAsNumber;
                      if (Number.isNaN(next)) {
                        return;
                      }
                      // Store the raw entry while typing; clamp on blur so an
                      // in-progress value (e.g. a leading digit) is not snapped.
                      updateConfig({ [field.key]: next / 10 } as Partial<BalconyConfig>);
                    }}
                    onBlur={(e) => commitMm(field.key, e.target.valueAsNumber, bounds)}
                  />
                  <span className={styles.unit} aria-hidden="true">
                    mm
                  </span>
                </div>

                <button
                  type="button"
                  className={styles.stepper}
                  onClick={() => commitMm(field.key, valueMm + STEP_MM, bounds)}
                  disabled={valueMm + STEP_MM > bounds.max}
                  aria-label={`Increase ${field.label.toLowerCase()} by ${STEP_MM} millimetres`}
                >
                  <PlusIcon />
                </button>
              </div>

              <span id={hintId} className={styles.hint}>
                {bounds.min}–{bounds.max} mm
              </span>

              {invalid ? (
                <span id={errorId} className={styles.fieldError} role="alert">
                  Enter a value between {bounds.min} and {bounds.max} mm.
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={styles.areaRow}>
        <div className={styles.areaReadout}>
          <span className={styles.areaLabel}>Glazed area</span>
          <span className={styles.areaValue}>{areaLabel}</span>
        </div>
        <p className={styles.areaNote}>
          Glazed area is width × height (the façade). Floor depth does not change it.
        </p>
      </div>
    </StepPanel>
  );
}

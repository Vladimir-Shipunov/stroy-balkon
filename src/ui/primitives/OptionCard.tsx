/**
 * @file OptionCard — the selectable card used by every configuration step.
 *
 * A keyboard-accessible card rendered as a native `<button>` with `radio` or
 * `checkbox` semantics. Shows an optional icon/media, a label, an optional
 * description, optional spec metadata, and an optional signed price delta. The
 * selected state gets a strong accent border and a corner checkmark.
 *
 * Presentation only — it raises `onSelect` and reflects `selected`; it holds no
 * state of its own.
 */

import type { ReactNode } from 'react';
import { formatDelta } from '../../lib/ui/money';
import styles from './OptionCard.module.css';

export interface OptionCardProps {
  /** Primary label, e.g. the option name. */
  readonly label: string;
  /** Optional supporting line under the label. */
  readonly description?: string;
  /** Optional leading icon (inline SVG/element). */
  readonly icon?: ReactNode;
  /** Optional large media area above the body (e.g. a swatch or cross-section). */
  readonly media?: ReactNode;
  /** Optional extra content under the description (spec rows, chips, etc.). */
  readonly meta?: ReactNode;
  /** Signed price delta in EUR relative to the current selection. Omit to hide. */
  readonly priceDelta?: number;
  /** Whether this option is currently selected. */
  readonly selected: boolean;
  /** Raised when the user activates the card. */
  readonly onSelect: () => void;
  /** `radio` (single-select group) or `checkbox` (multi-select). Default `radio`. */
  readonly selectionMode?: 'radio' | 'checkbox';
  /** Disable selection. */
  readonly disabled?: boolean;
  /** Extra class for layout tweaks from the parent grid. */
  readonly className?: string;
}

const CheckIcon = (): JSX.Element => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
    <path
      d="M3.5 8.5l3 3 6-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function OptionCard({
  label,
  description,
  icon,
  media,
  meta,
  priceDelta,
  selected,
  onSelect,
  selectionMode = 'radio',
  disabled = false,
  className,
}: OptionCardProps): JSX.Element {
  const classes = [styles.card, selected ? styles.selected : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      role={selectionMode}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className={classes}
      onClick={onSelect}
    >
      <span className={styles.check} aria-hidden="true">
        <CheckIcon />
      </span>

      {media !== undefined ? <span className={styles.media}>{media}</span> : null}

      <span className={styles.body}>
        <span className={styles.header}>
          {icon !== undefined ? (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <span className={styles.label}>{label}</span>
        </span>

        {description !== undefined ? (
          <span className={styles.description}>{description}</span>
        ) : null}

        {meta !== undefined ? <span className={styles.meta}>{meta}</span> : null}

        {priceDelta !== undefined ? (
          <span
            className={styles.delta}
            data-direction={priceDelta > 0 ? 'up' : priceDelta < 0 ? 'down' : 'zero'}
          >
            {formatDelta(priceDelta)}
          </span>
        ) : null}
      </span>
    </button>
  );
}

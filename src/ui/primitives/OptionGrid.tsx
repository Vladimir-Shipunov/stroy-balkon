/**
 * @file OptionGrid — responsive grid wrapper with the correct group semantics
 * for a set of OptionCards. Use `radiogroup` for single-select steps and
 * `group` (multi-select checkboxes) for accessories.
 */

import type { ReactNode } from 'react';
import styles from './OptionGrid.module.css';

export interface OptionGridProps {
  /** Accessible label for the group of options. */
  readonly ariaLabel: string;
  /** `radio` → role=radiogroup; `checkbox` → role=group. Default `radio`. */
  readonly selectionMode?: 'radio' | 'checkbox';
  /** Preferred minimum column width. Default `'medium'`. */
  readonly density?: 'narrow' | 'medium' | 'wide';
  readonly children: ReactNode;
}

export function OptionGrid({
  ariaLabel,
  selectionMode = 'radio',
  density = 'medium',
  children,
}: OptionGridProps): JSX.Element {
  return (
    <div
      role={selectionMode === 'checkbox' ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
      className={styles.grid}
      data-density={density}
    >
      {children}
    </div>
  );
}

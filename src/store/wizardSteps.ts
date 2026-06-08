/**
 * @file Presentation-layer wizard step model.
 *
 * The audited kernel store (`configuratorStore`) owns the *domain* step model
 * (`ConfigStepId`, a coarse 7-step flow used for pricing milestones). This
 * module defines the *presentation* flow the configurator UI walks the user
 * through — six focused steps — without touching the kernel. Each step knows
 * which part of `BalconyConfig` it edits and how to validate it.
 *
 * Validators reuse the kernel's `DIMENSION_LIMITS` so there is a single source
 * of truth for dimension bounds.
 */

import type { BalconyConfig } from '../types/balcony';
import {
  ColorFinish,
  GlassType,
  GlazingType,
  ProfileSystem,
} from '../types/balcony';
import { DIMENSION_LIMITS } from './configuratorStore';

/** Identifier for a presentation wizard step. */
export type WizardStepId =
  | 'dimensions'
  | 'profile'
  | 'glazing'
  | 'glass'
  | 'finish'
  | 'accessories';

/** Static metadata + validator for one presentation wizard step. */
export interface WizardStepMeta {
  readonly id: WizardStepId;
  /** Full step title shown in the panel header. */
  readonly title: string;
  /** Short label shown in the compact stepper rail. */
  readonly shortLabel: string;
  /** One-line description shown under the title. */
  readonly description: string;
  /** Whether the step may be left in its default/empty state and still advance. */
  readonly optional: boolean;
  /** Message shown if the user tries to advance while the step is invalid. */
  readonly invalidMessage: string;
  /** Returns `true` when the current config satisfies this step. */
  readonly validate: (config: BalconyConfig) => boolean;
}

const isWithin = (value: number, range: { min: number; max: number }): boolean =>
  Number.isFinite(value) && value >= range.min && value <= range.max;

/** The ordered presentation flow. Array order defines navigation order. */
export const WIZARD_STEPS: readonly WizardStepMeta[] = [
  {
    id: 'dimensions',
    title: 'Dimensions',
    shortLabel: 'Dimensions',
    description: 'Enter the opening width, height and floor depth in millimetres.',
    optional: false,
    invalidMessage: 'Enter width, height and depth within the allowed ranges to continue.',
    validate: (c) =>
      isWithin(c.widthCm, DIMENSION_LIMITS.width) &&
      isWithin(c.heightCm, DIMENSION_LIMITS.height) &&
      isWithin(c.depthCm, DIMENSION_LIMITS.depth),
  },
  {
    id: 'profile',
    title: 'Profile system',
    shortLabel: 'Profile',
    description: 'Choose the structural framing the glazing is built on.',
    optional: false,
    invalidMessage: 'Select a profile system to continue.',
    validate: (c) => Object.values(ProfileSystem).includes(c.profileSystem),
  },
  {
    id: 'glazing',
    title: 'Glazing type',
    shortLabel: 'Glazing',
    description: 'Select how the glass panels are held and how the façade opens.',
    optional: false,
    invalidMessage: 'Select a glazing type to continue.',
    validate: (c) => Object.values(GlazingType).includes(c.glazingType),
  },
  {
    id: 'glass',
    title: 'Glass specification',
    shortLabel: 'Glass',
    description: 'Pick the glass unit by thermal performance and appearance.',
    optional: false,
    invalidMessage: 'Select a glass specification to continue.',
    validate: (c) => Object.values(GlassType).includes(c.glassType),
  },
  {
    id: 'finish',
    title: 'Frame finish',
    shortLabel: 'Finish',
    description: 'Choose the frame colour finish by RAL reference.',
    optional: false,
    invalidMessage: 'Select a frame finish to continue.',
    validate: (c) => Object.values(ColorFinish).includes(c.colorFinish),
  },
  {
    id: 'accessories',
    title: 'Accessories',
    shortLabel: 'Accessories',
    description: 'Add optional extras. This step is optional — select none if not needed.',
    optional: true,
    invalidMessage: '',
    validate: (c) =>
      c.accessories.every((a, i) => c.accessories.indexOf(a) === i),
  },
];

/** Total number of presentation steps. */
export const WIZARD_STEP_COUNT = WIZARD_STEPS.length;

/**
 * Resolve a step's metadata and its 0-based index by id. Throws on an unknown
 * id (ids are static, so this never happens at runtime) — this keeps callers
 * free of `undefined` handling under `noUncheckedIndexedAccess`.
 */
export function getStepMeta(id: WizardStepId): {
  readonly index: number;
  readonly meta: WizardStepMeta;
} {
  const index = WIZARD_STEPS.findIndex((step) => step.id === id);
  const meta = WIZARD_STEPS[index];
  if (index < 0 || !meta) {
    throw new Error(`Unknown wizard step id: ${id}`);
  }
  return { index, meta };
}

/**
 * The furthest step index the user may reach given the current config: every
 * step up to and including the first invalid required step is reachable, but
 * not steps beyond it. Optional steps never block forward reach.
 */
export function maxReachableIndex(config: BalconyConfig): number {
  for (let i = 0; i < WIZARD_STEPS.length; i += 1) {
    const step = WIZARD_STEPS[i];
    if (step && !step.optional && !step.validate(config)) {
      return i;
    }
  }
  return WIZARD_STEPS.length - 1;
}

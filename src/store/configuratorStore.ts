/**
 * @file Zustand store for the balcony configurator.
 *
 * Owns the live configuration, the user's wizard progress, and the derived
 * price. The price (`currentPrice`) and the per-step validity (`steps`) are
 * recomputed synchronously inside every mutating action, so consumers can read
 * them directly from state without selectors or effects — they are always in
 * sync with `config`.
 *
 * Usage in a React component:
 * ```tsx
 * const total = useConfiguratorStore((s) => s.currentPrice.total);
 * const update = useConfiguratorStore((s) => s.updateConfig);
 * update({ glassType: GlassType.Triple });
 * ```
 */

import { create } from 'zustand';
import {
  AccessoryType,
  type BalconyConfig,
  ColorFinish,
  type ConfigStep,
  ConfigStepId,
  GlassType,
  GlazingType,
  InstallationType,
  type PriceBreakdown,
  ProfileSystem,
  RailingType,
} from '../types/balcony';
import { calculatePrice } from '../lib/pricingEngine';

/* -------------------------------------------------------------------------- */
/*  Defaults & validation bounds                                             */
/* -------------------------------------------------------------------------- */

/** Inclusive dimension bounds (centimetres) used for step validation. */
export const DIMENSION_LIMITS = {
  width: { min: 100, max: 800 },
  height: { min: 150, max: 350 },
  depth: { min: 60, max: 250 },
} as const;

/**
 * The starting configuration: a mid-range, fully valid balcony so the price is
 * meaningful from the very first render.
 */
export const DEFAULT_CONFIG: BalconyConfig = {
  widthCm: 300,
  heightCm: 250,
  depthCm: 120,
  profileSystem: ProfileSystem.AluminumThermal,
  glazingType: GlazingType.SemiFrameless,
  glassType: GlassType.LowE,
  colorFinish: ColorFinish.WhiteRal9016,
  railing: RailingType.Glass,
  accessories: [],
  installationType: InstallationType.StandardInstallation,
};

/* -------------------------------------------------------------------------- */
/*  Step definitions                                                          */
/* -------------------------------------------------------------------------- */

/** Static metadata + validator for one wizard step. */
interface StepDefinition {
  readonly id: ConfigStepId;
  readonly label: string;
  /** Returns `true` when the configuration satisfies this step. */
  readonly validate: (config: BalconyConfig) => boolean;
}

const isWithin = (value: number, range: { min: number; max: number }): boolean =>
  Number.isFinite(value) && value >= range.min && value <= range.max;

/**
 * Ordered list of wizard steps. The array order defines navigation order for
 * {@link ConfiguratorActions.nextStep} / `prevStep`.
 */
export const STEP_DEFINITIONS: readonly StepDefinition[] = [
  {
    id: ConfigStepId.Dimensions,
    label: 'Dimensions',
    validate: (c) =>
      isWithin(c.widthCm, DIMENSION_LIMITS.width) &&
      isWithin(c.heightCm, DIMENSION_LIMITS.height) &&
      isWithin(c.depthCm, DIMENSION_LIMITS.depth),
  },
  {
    id: ConfigStepId.Structure,
    label: 'Profile & glazing',
    validate: (c) =>
      Object.values(ProfileSystem).includes(c.profileSystem) &&
      Object.values(GlazingType).includes(c.glazingType),
  },
  {
    id: ConfigStepId.Glass,
    label: 'Glass & finish',
    validate: (c) =>
      Object.values(GlassType).includes(c.glassType) &&
      Object.values(ColorFinish).includes(c.colorFinish),
  },
  {
    id: ConfigStepId.Railing,
    label: 'Railing',
    validate: (c) => Object.values(RailingType).includes(c.railing),
  },
  {
    id: ConfigStepId.Accessories,
    label: 'Accessories',
    // Accessories are optional; any selection (including none) is valid as long
    // as every entry is a known accessory and there are no duplicates.
    validate: (c) =>
      c.accessories.every((a) => Object.values(AccessoryType).includes(a)) &&
      new Set(c.accessories).size === c.accessories.length,
  },
  {
    id: ConfigStepId.Installation,
    label: 'Installation',
    validate: (c) => Object.values(InstallationType).includes(c.installationType),
  },
  {
    id: ConfigStepId.Summary,
    label: 'Summary',
    // The summary is reachable only when every preceding step is valid.
    validate: (c) => STEP_DEFINITIONS.slice(0, -1).every((step) => step.validate(c)),
  },
];

/** Navigation order of step ids, derived from {@link STEP_DEFINITIONS}. */
export const STEP_ORDER: readonly ConfigStepId[] = STEP_DEFINITIONS.map((step) => step.id);

/**
 * Build the derived {@link ConfigStep} list from the current config and the set
 * of completed step ids.
 */
function buildSteps(config: BalconyConfig, completed: readonly ConfigStepId[]): ConfigStep[] {
  const completedSet = new Set(completed);
  return STEP_DEFINITIONS.map((step) => ({
    id: step.id,
    label: step.label,
    isValid: step.validate(config),
    isComplete: completedSet.has(step.id),
  }));
}

/* -------------------------------------------------------------------------- */
/*  Store shape                                                               */
/* -------------------------------------------------------------------------- */

/** Reactive state held by the configurator store. */
export interface ConfiguratorState {
  /** The live balcony configuration. */
  readonly config: BalconyConfig;
  /** Id of the step the user is currently on. */
  readonly currentStep: ConfigStepId;
  /** Ids of steps the user has completed, in completion order. */
  readonly completedSteps: readonly ConfigStepId[];
  /** Derived per-step validity/completion, kept in sync with `config`. */
  readonly steps: readonly ConfigStep[];
  /** Derived price breakdown, recomputed on every config change. */
  readonly currentPrice: PriceBreakdown;
}

/** Actions exposed by the configurator store. */
export interface ConfiguratorActions {
  /**
   * Merge a partial configuration into the current one and recompute the
   * derived price and step validity.
   */
  updateConfig: (patch: Partial<BalconyConfig>) => void;
  /**
   * Mark the current step complete (if valid) and advance to the next step.
   * No-op on the final step or when the current step is invalid.
   */
  nextStep: () => void;
  /** Move to the previous step. No-op on the first step. */
  prevStep: () => void;
  /** Jump directly to a specific step. */
  goToStep: (step: ConfigStepId) => void;
  /** Reset configuration, progress and price back to their defaults. */
  resetConfig: () => void;
}

/** Full store type: state plus actions. */
export type ConfiguratorStore = ConfiguratorState & ConfiguratorActions;

/* -------------------------------------------------------------------------- */
/*  Store implementation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Produce the derived slice (`steps`, `currentPrice`) for a given config and
 * progress. Centralised so every action stays consistent.
 */
const deriveState = (
  config: BalconyConfig,
  completedSteps: readonly ConfigStepId[],
): Pick<ConfiguratorState, 'steps' | 'currentPrice'> => ({
  steps: buildSteps(config, completedSteps),
  currentPrice: calculatePrice(config),
});

/**
 * The configurator store hook. Outside React, use `useConfiguratorStore.getState()`
 * and `useConfiguratorStore.setState()`.
 */
export const useConfiguratorStore = create<ConfiguratorStore>()((set, get) => ({
  config: DEFAULT_CONFIG,
  currentStep: STEP_ORDER[0] ?? ConfigStepId.Dimensions,
  completedSteps: [],
  ...deriveState(DEFAULT_CONFIG, []),

  updateConfig: (patch) => {
    const nextConfig: BalconyConfig = { ...get().config, ...patch };
    set({ config: nextConfig, ...deriveState(nextConfig, get().completedSteps) });
  },

  nextStep: () => {
    const { currentStep, completedSteps, steps } = get();
    const index = STEP_ORDER.indexOf(currentStep);
    const current = steps.find((step) => step.id === currentStep);

    // Don't advance from an invalid step or past the last step.
    if (index < 0 || index >= STEP_ORDER.length - 1 || !current?.isValid) {
      return;
    }

    const nextCompleted = completedSteps.includes(currentStep)
      ? completedSteps
      : [...completedSteps, currentStep];
    const nextStepId = STEP_ORDER[index + 1] ?? currentStep;

    set({
      currentStep: nextStepId,
      completedSteps: nextCompleted,
      ...deriveState(get().config, nextCompleted),
    });
  },

  prevStep: () => {
    const index = STEP_ORDER.indexOf(get().currentStep);
    if (index <= 0) {
      return;
    }
    const prevStepId = STEP_ORDER[index - 1];
    if (prevStepId !== undefined) {
      set({ currentStep: prevStepId });
    }
  },

  goToStep: (step) => {
    if (STEP_ORDER.includes(step)) {
      set({ currentStep: step });
    }
  },

  resetConfig: () => {
    set({
      config: DEFAULT_CONFIG,
      currentStep: STEP_ORDER[0] ?? ConfigStepId.Dimensions,
      completedSteps: [],
      ...deriveState(DEFAULT_CONFIG, []),
    });
  },
}));

/**
 * @file Presentation wizard navigation store (Zustand).
 *
 * Owns ONLY navigation state for the configurator UI — which step is active,
 * which steps have been visited, and whether the user just attempted to advance
 * past an invalid step (so the panel can surface a validation error). The actual
 * configuration and price live in the kernel `configuratorStore`; this store
 * reads kernel `config` at action time to gate forward navigation but never
 * owns or mutates it.
 */

import { create } from 'zustand';
import { useConfiguratorStore } from './configuratorStore';
import { WIZARD_STEPS, maxReachableIndex } from './wizardSteps';

interface WizardState {
  /** Index into `WIZARD_STEPS` of the active step. */
  readonly currentIndex: number;
  /** Indices of steps the user has advanced past at least once. */
  readonly visited: readonly number[];
  /**
   * True when the user pressed "Continue" on an invalid required step. The panel
   * uses this to reveal its validation message. Reset on any successful move.
   */
  readonly attemptedAdvance: boolean;
}

interface WizardActions {
  /** Validate the current step against kernel config; advance if it passes. */
  goNext: () => void;
  /** Move to the previous step. No-op on the first step. */
  goPrev: () => void;
  /** Jump to a step by index, subject to forward-reachability gating. */
  goToIndex: (index: number) => void;
  /** Reset navigation to the first step. */
  resetWizard: () => void;
}

type WizardStore = WizardState & WizardActions;

const clampIndex = (index: number): number =>
  Math.max(0, Math.min(index, WIZARD_STEPS.length - 1));

const withVisited = (visited: readonly number[], index: number): readonly number[] =>
  visited.includes(index) ? visited : [...visited, index];

export const useWizardStore = create<WizardStore>()((set, get) => ({
  currentIndex: 0,
  visited: [0],
  attemptedAdvance: false,

  goNext: () => {
    const { currentIndex, visited } = get();
    const step = WIZARD_STEPS[currentIndex];
    if (!step) {
      return;
    }
    const config = useConfiguratorStore.getState().config;

    // Required step that does not validate → block and reveal the error.
    if (!step.optional && !step.validate(config)) {
      set({ attemptedAdvance: true });
      return;
    }

    if (currentIndex >= WIZARD_STEPS.length - 1) {
      set({ attemptedAdvance: false, visited: withVisited(visited, currentIndex) });
      return;
    }

    const nextIndex = currentIndex + 1;
    set({
      currentIndex: nextIndex,
      visited: withVisited(withVisited(visited, currentIndex), nextIndex),
      attemptedAdvance: false,
    });
  },

  goPrev: () => {
    const { currentIndex } = get();
    if (currentIndex <= 0) {
      return;
    }
    set({ currentIndex: currentIndex - 1, attemptedAdvance: false });
  },

  goToIndex: (index) => {
    const { currentIndex, visited } = get();
    const target = clampIndex(index);

    // Backward (or same) navigation is always allowed.
    if (target <= currentIndex) {
      set({ currentIndex: target, attemptedAdvance: false });
      return;
    }

    // Forward navigation is capped at the furthest reachable step; if the user
    // clicks beyond it, land on the first blocking step and reveal its error.
    const config = useConfiguratorStore.getState().config;
    const reachable = maxReachableIndex(config);
    if (target <= reachable) {
      set({
        currentIndex: target,
        visited: withVisited(visited, target),
        attemptedAdvance: false,
      });
    } else {
      set({ currentIndex: reachable, attemptedAdvance: true });
    }
  },

  resetWizard: () => set({ currentIndex: 0, visited: [0], attemptedAdvance: false }),
}));

/**
 * @file Configurator state — a `useReducer` store: the 2D scene selection
 * (`vam`, see vamCatalog.ts) plus the extra services the customer ticks. It is
 * persisted to localStorage so a returning visitor keeps their configuration.
 */
import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';
import { DEFAULT_VAM_SELECTION, normalizeVamSelection } from './vamCatalog';
import type { VamPick, VamSelection } from './vamCatalog';

export interface Extras {
  readonly insulation: boolean;
  readonly ceilingFinish: boolean;
  readonly dismantling: boolean;
}

export interface ConfigState {
  readonly extras: Extras;
  /** Layout / finishes / colours / furniture of the 2D scene. */
  readonly vam: VamSelection;
}

export const DEFAULT_STATE: ConfigState = {
  extras: { insulation: true, ceilingFinish: true, dismantling: false },
  vam: DEFAULT_VAM_SELECTION,
};

export type Action =
  | { type: 'extra'; key: keyof Extras }
  | { type: 'vam'; value: Partial<VamSelection> }
  | { type: 'pick'; key: string; pick: VamPick | null }
  | { type: 'reset' };

function reducer(state: ConfigState, action: Action): ConfigState {
  switch (action.type) {
    case 'extra':
      return { ...state, extras: { ...state.extras, [action.key]: !state.extras[action.key] } };
    case 'vam':
      return { ...state, vam: normalizeVamSelection({ ...state.vam, ...action.value }) };
    case 'pick': {
      const picks = { ...state.vam.picks };
      if (action.pick) picks[action.key] = action.pick;
      else delete picks[action.key];
      return { ...state, vam: normalizeVamSelection({ ...state.vam, picks }) };
    }
    case 'reset':
      return DEFAULT_STATE;
    default:
      return state;
  }
}

// v4: photo mode (the app's real scenes) is the default again — plan mode's canvas
// render looked far less realistic, so a stale v3 save defaulted into it.
const STORAGE_KEY = 'balkon-msk-config-v4';

/** Load a saved configuration, merged defensively over the defaults (older saves carry extra fields — ignored). */
function init(): ConfigState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<ConfigState>;
    return {
      extras: { ...DEFAULT_STATE.extras, ...(parsed.extras ?? {}) },
      vam: normalizeVamSelection(parsed.vam),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * The configurator store.
 * @returns `[state, dispatch]`.
 */
export function useConfigurator(): [ConfigState, Dispatch<Action>] {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable (private mode / quota) — non-fatal */
    }
  }, [state]);

  return [state, dispatch];
}

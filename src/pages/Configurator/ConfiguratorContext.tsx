/**
 * @file ConfiguratorContext — lifts the configurator state to app scope so the
 * AI chat widget (mounted globally) can read the live configuration and apply
 * AI-driven changes from any page.
 */
import { createContext, useContext, useMemo } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { useConfigurator } from './useConfigurator';
import type { Action, ConfigState } from './useConfigurator';

interface ConfiguratorContextValue {
  readonly state: ConfigState;
  readonly dispatch: Dispatch<Action>;
}

const ConfiguratorContext = createContext<ConfiguratorContextValue | null>(null);

/**
 * Provider owning the (persisted) configurator reducer.
 * @returns The provider element.
 */
export function ConfiguratorProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useConfigurator();
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <ConfiguratorContext.Provider value={value}>{children}</ConfiguratorContext.Provider>;
}

/**
 * Access the shared configurator state.
 * @returns `{ state, dispatch }`.
 */
export function useConfiguratorState(): ConfiguratorContextValue {
  const ctx = useContext(ConfiguratorContext);
  if (!ctx) {
    throw new Error('useConfiguratorState must be used within <ConfiguratorProvider>.');
  }
  return ctx;
}

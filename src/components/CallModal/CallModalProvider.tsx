/**
 * @file CallModalProvider — app-wide callback-request modal.
 *
 * Any component can call `useCallModal().open(...)` to raise the modal, optionally
 * passing a heading and a configuration summary (used by the configurator's
 * "Заказать замер" button). The form posts to the existing Express endpoint
 * `POST /api/request-call` ({ name, phone }).
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CallModal } from './CallModal';

export interface SummaryRow {
  readonly label: string;
  readonly value: string;
}

export interface CallModalOptions {
  readonly title?: string;
  readonly subtitle?: string;
  readonly summary?: readonly SummaryRow[];
  /** Sent to the backend so the team knows where the lead came from. */
  readonly source?: string;
  /**
   * Overrides the submit target (default `/api/request-call`, body `{ name, phone }`).
   * When set, the form instead POSTs `{ clientName, clientPhone, ...payload }` —
   * used by the configurator to submit a full order to `/api/orders`.
   */
  readonly endpoint?: string;
  readonly payload?: Record<string, unknown>;
}

interface CallModalContextValue {
  readonly open: (options?: CallModalOptions) => void;
  readonly close: () => void;
}

const CallModalContext = createContext<CallModalContextValue | null>(null);

/**
 * Access the global call-modal controls.
 * @returns `{ open, close }`.
 */
export function useCallModal(): CallModalContextValue {
  const ctx = useContext(CallModalContext);
  if (!ctx) {
    throw new Error('useCallModal must be used within <CallModalProvider>.');
  }
  return ctx;
}

/**
 * Provider that owns modal state and renders the modal.
 * @returns The provider element.
 */
export function CallModalProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<CallModalOptions>({});

  const open = useCallback((opts: CallModalOptions = {}) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CallModalContextValue>(() => ({ open, close }), [open, close]);

  return (
    <CallModalContext.Provider value={value}>
      {children}
      <CallModal isOpen={isOpen} options={options} onClose={close} />
    </CallModalContext.Provider>
  );
}

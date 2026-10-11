/**
 * @file ErrorBoundary — catches unhandled render errors inside the configurator
 * and shows a friendly Russian fallback instead of a blank white screen.
 *
 * Must be a class component: React error boundaries can only be implemented
 * with `componentDidCatch`/`getDerivedStateFromError`, which hooks can't do.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import styles from './InlineError.module.css';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  /** Called once per catch, e.g. for logging to an error-reporting service. */
  readonly onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * Wraps configurator content and recovers from render errors in place.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    // eslint-disable-next-line no-console -- surfaced for local debugging; onError covers real reporting.
    console.error('[ErrorBoundary] configurator render error:', error, info);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
          <div className={styles.wrap} style={{ maxWidth: 440, alignItems: 'center', flexDirection: 'column', textAlign: 'center', gap: 14 }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className={styles.body} style={{ alignItems: 'center' }}>
              <span className={styles.message}>
                Что-то пошло не так при отображении конфигуратора. Попробуйте повторить — обычно это помогает.
              </span>
              <button type="button" className={styles.retry} onClick={this.reset}>
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

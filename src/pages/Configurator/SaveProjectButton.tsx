/**
 * @file SaveProjectButton — brief §14: "Сохранить проект" button + a small
 * panel showing the resulting shareable link once saved. Fully self-contained
 * (owns its own save-state via `useSavedConfiguration`) so it can be dropped
 * into `Configurator.tsx` / `FinishStep.tsx` without touching either file.
 *
 * Does not know anything about `ConfigState`'s shape — the caller passes the
 * current config as an opaque value plus a `formatVersion` tag.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useSavedConfiguration } from './useSavedConfiguration';
import type { SavedConfigPayload } from './useSavedConfiguration';
import styles from './SaveProjectButton.module.css';

export interface SaveProjectButtonProps {
  /** The current configurator state to persist — `{ extras, vam }` from `useConfigurator`'s `ConfigState`. */
  readonly config: SavedConfigPayload;
  /** Button label override (default "Сохранить проект"). */
  readonly label?: string;
  readonly className?: string;
}

/**
 * Save-to-server button for the configurator. Shows a loading spinner while
 * saving, then a copyable share-link panel on success, or an error message on
 * failure.
 */
export function SaveProjectButton({
  config,
  label = 'Сохранить проект',
  className,
}: SaveProjectButtonProps): ReactElement {
  const { saveConfig, isSaving, saveError, shareUrl } = useSavedConfiguration();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function handleSave(): Promise<void> {
    setCopyState('idle');
    await saveConfig(config);
  }

  async function handleCopy(): Promise<void> {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopyState('copied');
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      setCopyState('error');
    }
  }

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.saveBtn}
        onClick={handleSave}
        disabled={isSaving}
        aria-busy={isSaving}
      >
        {isSaving && <span className={styles.spinner} aria-hidden="true" />}
        {isSaving ? 'Сохраняем…' : label}
      </button>

      {saveError && <p className={styles.errorText}>{saveError}</p>}

      {shareUrl && !saveError && (
        <div className={styles.panel}>
          <span className={styles.panelLabel}>Ссылка на проект</span>
          <div className={styles.linkRow}>
            <input
              type="text"
              readOnly
              value={shareUrl}
              className={styles.linkInput}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className={styles.copyBtn} onClick={handleCopy}>
              Скопировать ссылку
            </button>
          </div>
          {copyState === 'copied' && <span className={styles.copyHint}>Скопировано.</span>}
          {copyState === 'error' && (
            <span className={styles.errorText}>
              Не удалось скопировать — выделите ссылку и скопируйте вручную.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

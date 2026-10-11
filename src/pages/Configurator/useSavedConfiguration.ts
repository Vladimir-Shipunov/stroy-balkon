/**
 * @file useSavedConfiguration — brief §14: save the current configurator state
 * to the server and get back a shareable link; load a configuration back from
 * a `cfgId`/`cfgToken` pair found in the page URL.
 *
 * Talks to the real, already-wired `/api/projects` REST contract
 * (server/routes/projects.js). Two separate tokens, per a security fix: `accessToken`
 * is read-only (safe to put in the share URL), `editToken` grants write access and
 * must never appear in a URL — it's sent only via the `X-Project-Token` header.
 *  - `POST /api/projects` body `{ config }` → `201 { success: true, id, accessToken, editToken, createdAt }`
 *  - `GET /api/projects/:id?token=<accessToken-or-editToken>` → `{ success: true, project: { id, config, configVersion, createdAt, updatedAt } }`
 *  - `PUT /api/projects/:id` header `X-Project-Token: <editToken>`, body `{ config }` → `{ success: true, project: {...} }`
 *  - any failure → `{ success: false, error: string, errors?: string[] }`
 *
 * `server/validators/configValidator.js` requires the posted `config` to be
 * shaped like `VamSelection` (`{ shape, glazing, mode, picks }`) — it does not
 * know about this app's full `ConfigState` (`{ extras, vam }`). So this hook
 * flattens `extras` onto the `vam` object before sending (the validator
 * ignores unknown extra keys) and splits it back apart on load — callers of
 * this hook never see that wrapping/unwrapping.
 *
 * Decoupled from the configurator reducer: it does not dispatch anything. The
 * caller applies a loaded config back into state itself.
 */
import { useCallback, useRef, useState } from 'react';

const PROJECTS_ENDPOINT = '/api/projects';

/** The shape this hook actually sends/receives server-side: VamSelection + extras flattened in. */
interface StoredConfig {
  readonly extras?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

/**
 * What callers pass in/get back — this app's full configurator state, `{ extras, vam }`.
 * Typed as `object` (not `Record<string, unknown>`) so concrete sealed interfaces like
 * `Extras`/`VamSelection` — which have no index signature — are assignable here.
 */
export interface SavedConfigPayload {
  readonly extras: object;
  readonly vam: object;
}

function toStoredConfig(payload: SavedConfigPayload): StoredConfig {
  return { ...(payload.vam as Record<string, unknown>), extras: payload.extras as Record<string, unknown> };
}

function fromStoredConfig(stored: unknown): SavedConfigPayload | null {
  if (!stored || typeof stored !== 'object') return null;
  const { extras, ...vam } = stored as StoredConfig;
  return {
    extras: (extras && typeof extras === 'object' ? extras : {}) as Record<string, unknown>,
    vam,
  };
}

interface ProjectRow {
  readonly id: string;
  readonly config: unknown;
  readonly configVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface CreateResponse {
  readonly success: boolean;
  readonly id?: string;
  readonly accessToken?: string;
  readonly editToken?: string;
  readonly createdAt?: string;
  readonly error?: string;
  readonly errors?: readonly string[];
}

interface ProjectResponse {
  readonly success: boolean;
  readonly project?: ProjectRow;
  readonly error?: string;
  readonly errors?: readonly string[];
}

export interface LoadedConfig {
  readonly config: SavedConfigPayload;
  readonly formatVersion: number;
  readonly updatedAt: string;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || 'Не удалось сохранить проект.';
  return 'Не удалось сохранить проект.';
}

function responseErrorMessage(payload: { error?: string; errors?: readonly string[] }, status: number): string {
  if (payload.errors?.length) return payload.errors.join('; ');
  return payload.error ?? `Сервер вернул ошибку (${status}).`;
}

/** Builds the shareable URL for a saved configuration, preserving the current path. */
function buildShareUrl(id: string, accessToken: string): string {
  const { origin, pathname } = window.location;
  const params = new URLSearchParams({ cfgId: id, cfgToken: accessToken });
  return `${origin}${pathname}?${params.toString()}`;
}

interface SavedIds {
  readonly id: string;
  /** Read-only — safe in a URL. */
  readonly accessToken: string;
  /** Write-only credential — never put this in a URL; sent only via the `X-Project-Token` header. */
  readonly editToken: string;
}

export interface UseSavedConfigurationResult {
  /** POSTs the config to the server; on success populates `shareUrl`. */
  readonly saveConfig: (config: SavedConfigPayload) => Promise<void>;
  /** Re-saves (PUT) over an already-saved configuration — same id/editToken as the last successful save. */
  readonly updateConfig: (config: SavedConfigPayload) => Promise<void>;
  readonly isSaving: boolean;
  readonly saveError: string | null;
  readonly shareUrl: string | null;
  /** The ids from the most recent successful save, if any — for building a `PUT` later. */
  readonly savedIds: SavedIds | null;
  /** Clears `shareUrl`/`saveError` (e.g. before starting a new save). */
  readonly reset: () => void;
}

/**
 * Save-to-server + shareable-link hook for the configurator (brief §14).
 */
export function useSavedConfiguration(): UseSavedConfigurationResult {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const savedIdsRef = useRef<SavedIds | null>(null);
  const [savedIds, setSavedIds] = useState<SavedIds | null>(null);

  const saveConfig = useCallback(async (config: SavedConfigPayload): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(PROJECTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: toStoredConfig(config) }),
      });
      const payload: CreateResponse = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !payload.success || !payload.id || !payload.accessToken || !payload.editToken) {
        throw new Error(responseErrorMessage(payload, res.status));
      }
      const ids: SavedIds = { id: payload.id, accessToken: payload.accessToken, editToken: payload.editToken };
      savedIdsRef.current = ids;
      setSavedIds(ids);
      setShareUrl(buildShareUrl(ids.id, ids.accessToken));
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateConfig = useCallback(async (config: SavedConfigPayload): Promise<void> => {
    const ids = savedIdsRef.current;
    if (!ids) {
      setSaveError('Сначала сохраните проект, чтобы получить ссылку.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${PROJECTS_ENDPOINT}/${encodeURIComponent(ids.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Project-Token': ids.editToken },
        body: JSON.stringify({ config: toStoredConfig(config) }),
      });
      const payload: ProjectResponse = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !payload.success || !payload.project) {
        throw new Error(responseErrorMessage(payload, res.status));
      }
      setShareUrl(buildShareUrl(ids.id, ids.accessToken));
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const reset = useCallback((): void => {
    setShareUrl(null);
    setSaveError(null);
  }, []);

  return { saveConfig, updateConfig, isSaving, saveError, shareUrl, savedIds, reset };
}

/**
 * Reads `cfgId`/`cfgToken` from the current page URL and, if both are present,
 * fetches the saved configuration from the server. Returns `null` when the
 * params are absent or the fetch fails (the reason is logged, never thrown).
 */
export async function loadConfigFromUrl(): Promise<LoadedConfig | null> {
  let id: string | null;
  let token: string | null;
  try {
    const params = new URLSearchParams(window.location.search);
    id = params.get('cfgId');
    token = params.get('cfgToken');
  } catch (err) {
    console.error('loadConfigFromUrl: failed to parse URL params', err);
    return null;
  }

  if (!id || !token) {
    return null;
  }

  try {
    const res = await fetch(`${PROJECTS_ENDPOINT}/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });
    const payload: ProjectResponse = await res.json().catch(() => ({ success: false }));
    if (!res.ok || !payload.success || !payload.project) {
      console.error(`loadConfigFromUrl: ${responseErrorMessage(payload, res.status)}`);
      return null;
    }
    const config = fromStoredConfig(payload.project.config);
    if (!config) {
      console.error('loadConfigFromUrl: stored config was not an object');
      return null;
    }
    return {
      config,
      formatVersion: payload.project.configVersion,
      updatedAt: payload.project.updatedAt,
    };
  } catch (err) {
    console.error('loadConfigFromUrl: network error while loading saved configuration', err);
    return null;
  }
}

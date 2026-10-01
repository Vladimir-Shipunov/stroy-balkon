/**
 * Minimal typing for the Vite `import.meta.env` fields the app reads. Declared
 * locally (rather than referencing `vite/client`) to avoid duplicating the CSS
 * Module declaration in `css-modules.d.ts`.
 */
interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMetaGlobOptions {
  readonly eager?: boolean;
  readonly query?: string | Record<string, string>;
  readonly import?: string;
  readonly as?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  /**
   * Vite's build-time file-glob import. With `{ eager: true, query: '?url',
   * import: 'default' }` it resolves to a `Record<sourcePath, assetUrl>`.
   */
  glob<T = unknown>(
    pattern: string | string[],
    options?: ImportMetaGlobOptions,
  ): Record<string, T>;
}

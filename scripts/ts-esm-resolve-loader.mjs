/**
 * Minimal Node ESM resolution hook: this project's TS sources use extensionless
 * relative imports (`./planShapes`), which is how Vite/`moduleResolution: "Bundler"`
 * expect them — but Node's native ESM resolver requires an explicit extension. Rather
 * than add `.ts` extensions everywhere (which would need `allowImportingTsExtensions`
 * in the shared tsconfig.json, affecting the whole project) or add a bundler-based
 * test runner dependency, this loader just tries `.ts` for a relative specifier that
 * doesn't resolve as-is. Combined with `--experimental-strip-types` (a built-in Node
 * flag, no package needed) this lets plain `node --test` run the geometry validator's
 * tests directly against the real TS source — see package.json's `test:geometry`.
 *
 * Deliberately narrow: only touches relative specifiers (`./`/`../`) with no
 * extension, and only tries `.ts`. Anything else falls through to Node's default
 * resolution unchanged.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(specifier);

  if (isRelative && !hasExtension && context.parentURL) {
    const basePath = fileURLToPath(new URL(specifier, context.parentURL));
    if (existsSync(`${basePath}.ts`)) {
      return nextResolve(`${specifier}.ts`, context);
    }
  }

  return nextResolve(specifier, context);
}

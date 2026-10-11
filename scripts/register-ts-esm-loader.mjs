/** Registers ts-esm-resolve-loader.mjs as a module customization hook. See that file for why. */
import { register } from 'node:module';

register('./ts-esm-resolve-loader.mjs', import.meta.url);

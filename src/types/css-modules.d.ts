/**
 * Ambient type declarations for CSS Modules so `import styles from './x.module.css'`
 * is typed (Vite handles the runtime transform). Class names are typed as a
 * string record.
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

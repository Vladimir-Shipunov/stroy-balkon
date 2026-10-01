/**
 * @file usePageTitle — sets `document.title` for the current page and restores
 * the brand title on unmount.
 */
import { useEffect } from 'react';

const SUFFIX = 'БАЛКОН-МСК';

/**
 * Set the document title to `"<title> — БАЛКОН-МСК"` while mounted.
 * @param title Page-specific title. Pass an empty string to use the brand alone.
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} — ${SUFFIX}` : SUFFIX;
  }, [title]);
}

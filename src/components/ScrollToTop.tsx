/**
 * @file ScrollToTop — scrolls to the top of the document on each route change
 * (but respects in-page hash anchors). Renders nothing.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Route-change scroll restoration.
 * @returns `null`.
 */
export function ScrollToTop(): null {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);

  return null;
}

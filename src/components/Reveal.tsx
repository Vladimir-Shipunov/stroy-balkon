/**
 * @file Reveal — wraps content and fades/slides it in once it scrolls into view.
 *
 * Uses IntersectionObserver (no animation library) so it stays cheap for the
 * Lighthouse budget. Honours `prefers-reduced-motion` via the global CSS, which
 * neutralises the transform when motion is reduced.
 */
import { useEffect, useRef, useState } from 'react';
import type { ElementType, ReactNode } from 'react';

interface RevealProps {
  readonly children: ReactNode;
  /** Element to render. Defaults to a `div`. */
  readonly as?: ElementType;
  readonly className?: string | undefined;
  /** Stagger delay in milliseconds. */
  readonly delay?: number;
  readonly id?: string | undefined;
}

/**
 * Reveal wrapper.
 * @returns The element, animated in on first intersection.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  className,
  delay = 0,
  id,
}: RevealProps): JSX.Element {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      id={id}
      data-reveal=""
      className={[visible ? 'is-visible' : '', className].filter(Boolean).join(' ')}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

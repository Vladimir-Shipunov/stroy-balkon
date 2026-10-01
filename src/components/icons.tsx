/**
 * @file Inline SVG icon set (stroke icons on a 24px grid + brand glyphs).
 * Kept dependency-free; `currentColor` makes them inherit text colour.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { readonly size?: number };

function base(size: number): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

export function PhoneIcon({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6.5 3.5h-2A1.5 1.5 0 0 0 3 5c0 8.3 6.7 15 15 15a1.5 1.5 0 0 0 1.5-1.5v-2a1.5 1.5 0 0 0-1.2-1.47l-2.7-.54a1.5 1.5 0 0 0-1.5.66l-.6.9a11.6 11.6 0 0 1-5.2-5.2l.9-.6a1.5 1.5 0 0 0 .66-1.5l-.54-2.7A1.5 1.5 0 0 0 6.5 3.5z" />
    </svg>
  );
}

export function MenuIcon({ size = 22, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={2} {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ size = 22, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={2} {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function DownloadIcon({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function ArrowRight({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowUpRight({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} {...p}>
      <path d="M7 17L17 7M8 7h9v9" />
    </svg>
  );
}

export function Check({ size = 18, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={2.2} {...p}>
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}

export function Star({ size = 16, ...p }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.4l-5.8 3 1.1-6.45L2.6 9.35l6.5-.95z" />
    </svg>
  );
}

export function MapPin({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function Clock({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function MailIcon({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6 8.5-6" />
    </svg>
  );
}

export function ShieldIcon({ size = 22, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 3l7 2.5v5c0 5-3.4 8.4-7 9.5-3.6-1.1-7-4.5-7-9.5v-5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/* ---- Brand / social glyphs (filled) ------------------------------------- */

export function Instagram({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Telegram({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M21.8 4.2 2.9 11.5c-1 .4-1 1.8 0 2.1l4.6 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.7 3.5c.7.5 1.7.1 1.9-.7l3.2-15c.2-1-.8-1.9-1.8-1.7zM9.4 14.5l8.3-5.2c.2-.1.4.2.2.3l-6.7 6.2c-.2.2-.4.5-.4.8l-.2 2-1.5-3.8c-.1-.2 0-.4.2-.5z" />
    </svg>
  );
}

export function Vk({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12.8 16.5c-5.4 0-8.7-3.8-8.8-10h2.8c.1 4.6 2.1 6.5 3.6 6.9V6.5h2.6v4c1.5-.2 3-1.9 3.6-4h2.6c-.4 2.6-2.1 4.3-3.3 5 1.2.6 3.1 2.1 3.8 4.5h-2.9c-.5-1.7-1.9-3-3.8-3.2v3.2z" />
    </svg>
  );
}

export function Avito({ size = 20, ...p }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="7" cy="14.5" r="3.2" />
      <circle cx="16" cy="16" r="2.3" />
      <circle cx="17.5" cy="8" r="3" />
      <circle cx="10" cy="6.5" r="1.8" />
    </svg>
  );
}

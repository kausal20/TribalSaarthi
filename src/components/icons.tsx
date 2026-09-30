import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false } as const;

export const SearchIcon = (p: P) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const ArrowIcon = (p: P) => (<svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const BackIcon = (p: P) => (<svg {...base} {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const CheckIcon = (p: P) => (<svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const ExternalIcon = (p: P) => (<svg {...base} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);
export const SparkleIcon = (p: P) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}>
    <path d="M12 2c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7Z" />
    <path d="M19 15c.25 2 1 2.75 3 3-2 .25-2.75 1-3 3-.25-2-1-2.75-3-3 2-.25 2.75-1 3-3Z" opacity=".7" />
  </svg>
);

/** TribalSaarthi mark: a path rising into a leaf/sun over a stylised figure. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#111827" />
      <path d="M16 6c5 1.2 8 4.6 8 9.4 0 3.2-2 5.6-5.2 5.6-1.5 0-2.8-.5-3.8-1.4C14 21 13 23 11 25c-.9-6 .8-9.6 3-11.6-1.2-2 .2-5.2 2-7.4Z" fill="#0F8B78" />
      <circle cx="21.5" cy="9.5" r="2.3" fill="#F4B740" />
      <path d="M8 26c3.5-1.4 6-1.4 9.5 0" stroke="#DDF4ED" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

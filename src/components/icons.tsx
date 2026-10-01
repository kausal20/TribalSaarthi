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

/** TribalSaarthi mark: a single route-like S with a small guiding star. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#10231f" />
      <path d="M22.4 8.7c-1.9-1.8-5.5-2.1-8.4-.6-2.7 1.4-3.6 4.3-1.3 5.9 1.3.9 3.6 1.2 5.5 1.8 2.8.8 2.8 3.1.7 4.5-2.5 1.7-6.3.9-8.1-1.1" fill="none" stroke="#33b39a" strokeWidth="3.1" strokeLinecap="round" />
      <path d="M9.2 23.2c2.1 1.6 5.1 1.8 7.7.7" fill="none" stroke="#d8f0e7" strokeWidth="1.35" strokeLinecap="round" opacity=".9" />
      <path d="m23.5 6.5.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" fill="#f4b740" />
    </svg>
  );
}

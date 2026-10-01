import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const ClipIcon = (p: P) => (<svg {...base} {...p}><path d="m21 11.5-8.6 8.6a5 5 0 0 1-7.1-7.1l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.7 1.7 0 0 1-2.4-2.4l8.3-8.3" /></svg>);
export const SendIcon = (p: P) => (<svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const UploadIcon = (p: P) => (<svg {...base} {...p}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>);
export const PencilIcon = (p: P) => (<svg {...base} {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /></svg>);
export const CompassIcon = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2z" /></svg>);
export const ShieldIcon = (p: P) => (<svg {...base} {...p}><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3z" /><path d="m9 12 2 2 4-4" /></svg>);
export const SkipIcon = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>);

/** A check mark that draws itself (used when a file is verified). */
export function DrawnCheck({ animate = true }: { animate?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path className={animate ? 'cmp-draw' : undefined} d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

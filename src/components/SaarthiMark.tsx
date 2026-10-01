/** The Saarthi AI mark: the same compact route and guiding star used in the brand lockup. */
export function SaarthiMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="18" fill="#10231f" />
      <path d="M44.8 17.4c-3.8-3.6-11-4.2-16.8-1.2-5.4 2.8-7.2 8.6-2.6 11.8 2.6 1.8 7.2 2.4 11 3.6 5.6 1.6 5.6 6.2 1.4 9-5 3.4-12.6 1.8-16.2-2.2" fill="none" stroke="#33b39a" strokeWidth="6.2" strokeLinecap="round" />
      <path d="M18.4 46.4c4.2 3.2 10.2 3.6 15.4 1.4" fill="none" stroke="#d8f0e7" strokeWidth="2.7" strokeLinecap="round" opacity=".9" />
      <path d="m47 13 .9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4Z" fill="#f4b740" />
    </svg>
  );
}

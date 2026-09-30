// Handoff from the TribalSaarthi website: the URL fragment carries ONLY a scheme id (no personal data).
export const HANDOFF_RE = /[#&?]tsaarthi=([a-z0-9-]{1,40})(?=&|$)/i;
export const HANDOFF_MAX_AGE_MS = 30 * 60 * 1000;

export function parseHandoff(hash) {
  const m = HANDOFF_RE.exec(String(hash || ''));
  return m ? m[1].toLowerCase() : null;
}

// What we honestly know about how each website demo entry relates to MahaDBT.
const SCHEMES = {
  'postmatric-demo': {
    title: 'Post-matric scholarship',
    text: 'On MahaDBT, post-matric schemes are under the “Post Matric Scholarship” menu, and applying needs you to log in. I cannot tell which specific scheme suits you — open a scheme and read its requirements. Ask me to “take me to Post Matric Scholarship” if you like.',
  },
  'prematric-demo': {
    title: 'Pre-matric support',
    text: 'On MahaDBT, “Pre Matric Scholarship” opens a separate portal (prematric.mahait.org) with its own login. This guide currently works only on mahadbt.maharashtra.gov.in.',
  },
  'nfst-demo': {
    title: 'Research fellowship',
    text: 'I do not know of a matching research-fellowship scheme on MahaDBT, so I cannot point you to one. I can still explain MahaDBT pages and check forms and documents here. For this fellowship, use its own official page.',
  },
  'nos-demo': {
    title: 'Overseas study support',
    text: 'I do not know of a matching overseas-study scheme on MahaDBT, so I cannot point you to one. I can still explain MahaDBT pages and check forms and documents here. For overseas schemes, use their own official pages.',
  },
};

/** Greeting for a fresh handoff. Unknown ids get a generic, safe greeting. */
export function handoffMessage(id, portal = { id: 'mahadbt', name: 'MahaDBT' }) {
  if (portal.id === 'nsp') return 'You came from TribalSaarthi to the National Scholarship Portal. Start with “Students” for One Time Registration and applications, or “Schemes on NSP” to inspect current scholarships. The example you saw on TribalSaarthi is practice only; check the exact scheme requirements here.';
  const s = SCHEMES[id];
  if (!s) return 'You came from TribalSaarthi. Ask me where to go on MahaDBT, or to check the form or documents on this page.';
  return `You came from “${s.title}” on TribalSaarthi.\n\n${s.text}`;
}

export function isFresh(h, now = Date.now()) {
  return !!h && typeof h.id === 'string' && typeof h.ts === 'number' && now - h.ts >= 0 && now - h.ts <= HANDOFF_MAX_AGE_MS;
}

// Handoff from the TribalSaarthi website: the URL fragment carries ONLY a scheme id (no personal data).
export const HANDOFF_RE = /[#&?]tsaarthi=([a-z0-9-]{1,40})(?=&|$)/i;
export const HANDOFF_MAX_AGE_MS = 30 * 60 * 1000;

export function parseHandoff(hash) {
  const m = HANDOFF_RE.exec(String(hash || ''));
  return m ? m[1].toLowerCase() : null;
}

// What we honestly know about how each website entry relates to the portals. Ids are the website's scheme ids.
// Scheme names below are the ones MahaDBT's own home page lists under the Tribal Development Department.
const NOT_ON_MAHADBT = 'This scheme is not applied for on MahaDBT, so I cannot point you to it here. Use its own official page, linked on TribalSaarthi. I can still explain MahaDBT pages and check forms and documents here.';
const SCHEMES = {
  'postmatric-demo': {
    title: 'Post-matric scholarship',
    text: 'On MahaDBT, post-matric schemes are under the “Post Matric Scholarship” menu, and applying needs you to log in. I cannot tell which specific scheme suits you — open a scheme and read its requirements. Ask me to “take me to Post Matric Scholarship” if you like.',
  },
  'prematric-demo': {
    title: 'Pre-matric support',
    text: 'On MahaDBT, “Pre Matric Scholarship” opens a separate portal (prematric.mahait.org) with its own login. This guide currently works only on the MahaDBT and National Scholarship Portal websites.',
  },
  'nfst-demo': {
    title: 'Research fellowship',
    text: 'I do not know of a matching research-fellowship scheme on MahaDBT, so I cannot point you to one. I can still explain MahaDBT pages and check forms and documents here. For this fellowship, use its own official page.',
  },
  'nos-demo': {
    title: 'Overseas study support',
    text: 'I do not know of a matching overseas-study scheme on MahaDBT, so I cannot point you to one. I can still explain MahaDBT pages and check forms and documents here. For overseas schemes, use their own official pages.',
  },
  'mh-st-post-matric': {
    title: 'Post Matric Scholarship for ST Students — Maharashtra',
    text: 'On MahaDBT, look for “Post Matric Scholarship Scheme (Government Of India)” under the Tribal Development Department. Applying needs you to log in, and the scheme renews every year. Read its requirements on the scheme page; only the provider decides who is eligible.',
  },
  'mh-st-freeship': {
    title: 'Tuition Fee & Exam Fee for Tribal Students (Freeship)',
    text: 'On MahaDBT, look for “Tuition Fee & Exam Fee for Tribal Students (Freeship)” under the Tribal Development Department. Applying needs you to log in. Read its requirements on the scheme page; only the provider decides who is eligible.',
  },
  'mh-st-iti-fee': {
    title: 'ITI fee reimbursement for ST students',
    text: 'On MahaDBT, the vocational fee schemes are listed under the Tribal Development Department. Applying needs you to log in. Read the scheme page for its requirements; only the provider decides who is eligible.',
  },
  'st-post-matric': {
    title: 'Post Matric Scholarship for ST Students',
    text: 'This is a national scheme that each State runs. In Maharashtra it is applied for on MahaDBT under the Tribal Development Department (“Post Matric Scholarship Scheme (Government Of India)”). In other States, use your State’s scholarship portal or the National Scholarship Portal.',
  },
  'st-pre-matric': {
    title: 'Pre Matric Scholarship for ST Students',
    text: 'On MahaDBT, “Pre Matric Scholarship” opens a separate portal (prematric.mahait.org) with its own login. In other States, use your State’s portal or the National Scholarship Portal. Read the scheme’s own requirements there.',
  },
  'st-top-class': { title: 'Top Class scholarship for ST students', text: NOT_ON_MAHADBT },
  'st-nfst': { title: 'National Fellowship for ST students (NFST)', text: NOT_ON_MAHADBT },
  'st-nos': { title: 'National Overseas Scholarship for ST students (NOS)', text: NOT_ON_MAHADBT },
};

/** Greeting for a fresh handoff. Unknown ids get a generic, safe greeting. */
export function handoffMessage(id, portal = { id: 'mahadbt', name: 'MahaDBT' }) {
  const s = SCHEMES[id];
  if (portal.id === 'tribal') return 'You came from TribalSaarthi to the Ministry of Tribal Affairs scholarship information page. Choose a scheme, review its guidelines and follow its official application link. I can explain the visible page and help you find the relevant section.';
  if (portal.id === 'nsp') {
    const practice = /-demo$/.test(String(id || ''));
    const from = s && !practice ? `You came from “${s.title}” on TribalSaarthi to the National Scholarship Portal.` : 'You came from TribalSaarthi to the National Scholarship Portal.';
    return `${from} Start with “Students” for One Time Registration and applications, or “Schemes on NSP” to inspect current scholarships. ${practice ? 'The example you saw on TribalSaarthi is practice only; check' : 'Check'} the exact scheme requirements here; only the provider decides who is eligible.`;
  }
  if (!s) return 'You came from TribalSaarthi. Ask me where to go on MahaDBT, or to check the form or documents on this page.';
  return `You came from “${s.title}” on TribalSaarthi.\n\n${s.text}`;
}

export function isFresh(h, now = Date.now()) {
  return !!h && typeof h.id === 'string' && typeof h.ts === 'number' && now - h.ts >= 0 && now - h.ts <= HANDOFF_MAX_AGE_MS;
}

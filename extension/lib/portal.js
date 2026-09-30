// Portal knowledge for MahaDBT. Only facts observed on the public landing page (checked 2026-09-30).
// Anything behind login (per-scheme document lists, form layout) is NOT known here; the guide reads the live page instead.
export const SOURCE_NOTE = 'MahaDBT public home page (checked 30 Sep 2026); the portal may change. Verify on the portal.';

export const PORTAL = {
  id: 'mahadbt',
  name: 'MahaDBT',
  hosts: ['mahadbt.maharashtra.gov.in'],
  homePath: '/Home/LandingPage',
  // Default upload limits are NOT verified. The portal shows its own limit next to each upload field.
  docLimits: { maxBytes: 1_000_000, accepted: ['application/pdf', 'image/jpeg', 'image/png'], verified: false },
  menus: ['Home', 'Post Matric Scholarship', 'Pre Matric Scholarship', 'Pension Schemes', 'Farmer Schemes', 'Labour Schemes', 'Special Assistance Schemes'],
  dashboard: ['Home', 'Profile', 'All Schemes', 'My Applied Scheme'],
  facts: {
    register:
      'On the MahaDBT home page use the “New Registration” button. The portal offers Aadhaar-based registration (OTP or biometric) or non-Aadhaar enrolment. You enter any Aadhaar, OTP or biometric details yourself — I never see or handle them.',
    login:
      'On the home page choose your user type, then enter your username, password and the CAPTCHA yourself. I cannot log in for you and never ask for your password, OTP or CAPTCHA.',
    forgot: 'Use the “Forgot User Name / Password” link on the home page.',
    schemes:
      'After login, the dashboard has Home, Profile, All Schemes and My Applied Scheme. “All Schemes” lists schemes you can apply for; “My Applied Scheme” shows applications you already made.',
    postMatric:
      'The “Post Matric Scholarship” menu on the home page lists post-matric schemes. Applying requires login. Each scheme has its own requirements — read them on the scheme page.',
    preMatric: 'Pre Matric Scholarship opens a separate portal (prematric.mahait.org) with its own login. This guide currently works only on mahadbt.maharashtra.gov.in.',
    documents:
      'I do not have a verified document list for any specific scheme. Each scheme lists its own required documents on its application page — I can read the upload fields shown on the page you are on and check your files against basic rules.',
  },
};

export const NSP_PORTAL = {
  id: 'nsp',
  name: 'National Scholarship Portal',
  hosts: ['scholarships.gov.in'],
  homePath: '/home',
  docLimits: { maxBytes: 1_000_000, accepted: ['application/pdf', 'image/jpeg', 'image/png'], verified: false },
  menus: ['Students', 'Schemes on NSP', 'OTR', 'Apply For Scholarship'],
  dashboard: [],
  facts: {
    register: 'The Students section has One Time Registration (OTR). The portal says OTR is needed before applying. Complete registration, identity checks and any OTP yourself on NSP.',
    login: 'In the Students section, use “Apply For Scholarship” to sign in with your OTR ID and password. Enter credentials yourself; I cannot log in for you.',
    forgot: 'Look for the recovery options in the official Students or OTR section. I cannot see your account or reset it.',
    schemes: 'Use “Schemes on NSP” to browse the current schemes and read each scheme’s specification, FAQ and dates. Availability changes by academic year.',
    postMatric: 'NSP hosts multiple schemes. Search “Schemes on NSP” and inspect each scheme’s current rules; there is no single universal post-matric application.',
    preMatric: 'Check “Schemes on NSP” for currently listed school-level schemes and their own requirements.',
    documents: 'I do not have a verified document list for a specific scheme. Read its current specification and application page. I can check visible upload fields and basic file properties on this device.',
  },
};

export const portalForHost = (host) => [PORTAL, NSP_PORTAL].find((portal) => portal.hosts.includes(host)) || null;
export const isPortalHost = (host) => !!portalForHost(host);
export const sourceNoteFor = (portal) => portal.id === 'nsp'
  ? 'National Scholarship Portal public Students and Schemes pages (checked 30 Sep 2026); verify current details on NSP.'
  : SOURCE_NOTE;

// Portal knowledge for MahaDBT. Only facts observed on the public landing page (checked 2026-09-30).
// Anything behind login (per-scheme document lists, form layout) is NOT known here; the guide reads the live page instead.
export const SOURCE_NOTE = 'MahaDBT public home page (checked 30 Sep 2026); the portal may change. Verify on the portal.';

export const PORTAL = {
  id: 'mahadbt',
  name: 'MahaDBT',
  // MahaDBT 1.0 and MahaDBT 2.0 are two sites; the guide works on both.
  hosts: ['mahadbt.maharashtra.gov.in', 'mahadbt2.maharashtra.gov.in'],
  homePath: '/Home/LandingPage',
  // Link texts the guide may take the student to. MahaDBT 2.0 shows Marathi labels by default.
  labels: {
    register: ['New Registration', 'Register', 'नोंदणी करा'],
    login: ['Login', 'Citizen Login', 'नागरिकांसाठी लॉगिन', 'लॉगिन'],
    home: ['Home', 'मुख्यपृष्ठ'],
    schemes: ['All Schemes'],
  },
  // Default upload limits are NOT verified. The portal shows its own limit next to each upload field.
  docLimits: { maxBytes: 1_000_000, accepted: ['application/pdf', 'image/jpeg', 'image/png'], verified: false },
  menus: ['Home', 'Post Matric Scholarship', 'Pre Matric Scholarship', 'Pension Schemes', 'Farmer Schemes', 'Labour Schemes', 'Special Assistance Schemes'],
  dashboard: ['Home', 'Profile', 'All Schemes', 'My Applied Scheme'],
  facts: {
    register:
      'On the MahaDBT home page use the “New Registration” button (MahaDBT 2.0 shows “Register”). The portal offers Aadhaar-based registration (OTP or biometric) or non-Aadhaar enrolment. You enter any Aadhaar, OTP or biometric details yourself — I never see or handle them.',
    login:
      'On the home page choose your user type, then enter your username, password and the CAPTCHA yourself. I cannot log in for you and never ask for your password, OTP or CAPTCHA.',
    forgot: 'Use the “Forgot User Name / Password” link on the home page.',
    schemes:
      'After login, the dashboard has Home, Profile, All Schemes and My Applied Scheme. “All Schemes” lists schemes you can apply for; “My Applied Scheme” shows applications you already made.',
    postMatric:
      'The “Post Matric Scholarship” menu on the home page lists post-matric schemes. Applying requires login. Each scheme has its own requirements — read them on the scheme page.',
    preMatric: 'Pre Matric Scholarship opens a separate portal (prematric.mahait.org) with its own login. This guide currently works only on mahadbt.maharashtra.gov.in.',
    mahadbt2:
      'MahaDBT 2.0 (mahadbt2.maharashtra.gov.in) is a separate site from MahaDBT 1.0. Its public home page shows Login and Register options, opens in Marathi and has an “english” switch. A notice on the home page says which portal accepts applications for which academic year: read it before you start.',
    documents:
      'I do not have a verified document list for any specific scheme. Each scheme lists its own required documents on its application page — I can read the upload fields shown on the page you are on and check your files against basic rules.',
  },
};

export const NSP_PORTAL = {
  id: 'nsp',
  name: 'National Scholarship Portal',
  hosts: ['scholarships.gov.in'],
  homePath: '/home',
  labels: { register: ['OTR'], login: ['Apply For Scholarship', 'Students'], home: ['Home'], schemes: ['Schemes on NSP'] },
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

export const TRIBAL_PORTAL = {
  id: 'tribal', name: 'Ministry of Tribal Affairs', hosts: ['tribal.nic.in'], homePath: '/ScholarshiP.aspx',
  labels: { register: [], login: [], home: ['Home'], schemes: ['Scholarship', 'National Scholarship', 'Pre Matric', 'Post Matric'] },
  docLimits: { maxBytes: 1_000_000, accepted: ['application/pdf', 'image/jpeg', 'image/png'], verified: false },
  menus: ['Pre Matric', 'Post Matric', 'National Scholarship', 'National Fellowship', 'National Overseas', 'DBT'], dashboard: [],
  facts: {
    register: 'This Ministry page explains scholarship schemes. Registration happens on the application portal linked under the relevant scheme. Choose your scheme first and follow its official application link.',
    login: 'This is a scholarship information page, not a shared student login. Follow the relevant scheme’s official application link and enter credentials yourself there.',
    forgot: 'Use account recovery on the application portal where you registered, rather than this Ministry information page.',
    schemes: 'This page describes Pre Matric, Post Matric, National Scholarship, National Fellowship and National Overseas schemes. Read the relevant section and its current guidelines, then follow its application link.',
    preMatric: 'Pre Matric applications are handled through States/UTs using their portal or NSP. Read the Ministry’s Pre Matric section and the current application guidance for your State.',
    postMatric: 'Post Matric applications are handled through States/UTs using their portal or NSP. Read the Ministry’s Post Matric section and your State’s current application guidance.',
    documents: 'Required documents depend on the scheme and application portal. Read the current scheme guidelines; this information page may have no upload fields. A local file check does not upload or verify authenticity.',
  },
};
export const portalForHost = (host) => [PORTAL, NSP_PORTAL, TRIBAL_PORTAL].find((portal) => portal.hosts.includes(host)) || null;
export const isPortalHost = (host) => !!portalForHost(host);
export const sourceNoteFor = (portal) => portal.id === 'tribal'
  ? 'Ministry of Tribal Affairs Scholarship & DBT page (checked 1 Oct 2026); verify current guidelines on the official application portal.'
  : portal.id === 'nsp'
  ? 'National Scholarship Portal public Students and Schemes pages (checked 30 Sep 2026); verify current details on NSP.'
  : SOURCE_NOTE;

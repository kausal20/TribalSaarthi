import type { Knowledge, OfficialInfo, OppDocument, OppField, OppSection, Opportunity } from './types';

/**
 * Real scholarship schemes for ST students. Every fact below was read from the cited official source on CHECKED.
 * Amounts, dates and rules change every academic year: the UI and the guide always tell students to confirm the
 * current notice on the official portal. Do not add a fact here without an official source.
 */
const CHECKED = '2026-09-30';
const ANY = ['application/pdf', 'image/png', 'image/jpeg'];
const MOTA = 'https://tribal.nic.in/ScholarshiP.aspx';
const MAHADBT_2 = 'https://mahadbt2.maharashtra.gov.in/';
const scheme = (str: string) => `https://mahadbt.maharashtra.gov.in/SchemeData/SchemeData?str=${str}`;
const MAHADBT_NOTE = 'MahaDBT notice (checked 30 Sep 2026): fresh and renewal applications for academic year 2026-27 are accepted only on the MahaDBT 2.0 portal (mahadbt2.maharashtra.gov.in).';

const practiceFields: OppField[] = [
  { key: 'full_name', label: 'Full name', type: 'text', required: true, help: 'Your name exactly as on your certificates. In this practice form, use a fictional name.' },
  { key: 'institution', label: 'School / college / institute', type: 'text', required: true, help: 'Where you are studying now. Use a fictional name in practice.' },
  { key: 'course_name', label: 'Class or course', type: 'text', required: true, help: 'For example “Class 9”, “B.A. 2nd year” or “ITI Electrician”.' },
];

const doc = (key: string, label: string, note = 'Practice with a sample file here; the real document comes from the issuing authority.'): OppDocument => ({ key, label, acceptedTypes: ANY, note });

interface Def {
  id: string;
  title: string;
  providerName: string;
  level: Opportunity['level'];
  location: Opportunity['location'];
  category: string;
  tagline: string;
  purpose: string;
  eligibility: string[];
  docs: OppDocument[];
  deadline: string;
  sourceUrl: string;
  official: Omit<OfficialInfo, 'checkedOn'>;
}

const SRC_NOTE = (d: Def) => `${d.official.sourceTitle} (checked ${CHECKED}). Confirm the current year's notice on the official portal.`;

function sections(d: Def): OppSection[] {
  return [
    { id: 'overview', title: 'Overview', body: [d.purpose, `Source: ${d.official.sourceTitle}.`], summary: `${d.title}: ${d.tagline}` },
    { id: 'eligibility', title: 'Eligibility', body: d.eligibility, summary: `Eligibility as per the official source: ${d.eligibility.join(' ')}` },
    { id: 'documents', title: 'Documents', body: ['Documents listed by the official source:', ...d.docs.map((x) => `• ${x.label}`)], summary: `Documents: ${d.docs.map((x) => x.label).join('; ')}.` },
    { id: 'form', title: 'Application form', body: ['Practise a short sample form here with fictional details. The real application is on the official portal.'], summary: 'A short practice form; the real form is on the official portal.' },
    { id: 'status', title: 'Status', body: ['Your practice progress. Nothing is sent to the provider.'], summary: 'Practice progress only.' },
  ];
}

function knowledge(d: Def): Knowledge[] {
  const src = SRC_NOTE(d);
  return [
    { id: 'eligibility', questionPatterns: ['eligib', 'who apply', 'can apply', 'qualify'], answer: `As per the official source: ${d.eligibility.join(' ')} Only the provider decides.`, targetSectionId: 'eligibility', sourceNote: src },
    { id: 'documents', questionPatterns: ['document list', 'what document', 'documents need', 'required document', 'what upload', 'what should upload'], answer: `Documents listed: ${d.docs.map((x) => x.label).join('; ')}. Check the portal for the complete current list.`, targetSectionId: 'documents', sourceNote: src },
    { id: 'benefits', questionPatterns: ['benefit', 'how much', 'amount', 'money'], answer: `Benefits as per the official source: ${d.official.benefits.join(' ')}`, targetSectionId: 'overview', sourceNote: src },
    { id: 'where-apply', questionPatterns: ['where apply', 'how apply', 'official website', 'portal'], answer: `Apply ${d.official.applyVia}: ${d.official.applyUrl}`, targetSectionId: 'overview', sourceNote: src },
    { id: 'deadline', questionPatterns: ['deadline', 'last date', 'closing date'], answer: `${d.deadline} Always confirm the current dates on the official portal.`, targetSectionId: 'overview', sourceNote: src },
  ];
}

function make(d: Def): Opportunity {
  return {
    id: d.id,
    title: d.title,
    providerName: d.providerName,
    level: d.level,
    location: d.location,
    category: d.category,
    tagline: d.tagline,
    purpose: d.purpose,
    status: 'Open in demo',
    verifiedSourceUrl: d.sourceUrl,
    demoOnly: false,
    official: { ...d.official, checkedOn: CHECKED },
    deadline: { text: d.deadline, set: false },
    documents: d.docs,
    fields: practiceFields,
    sections: sections(d),
    assistantKnowledge: knowledge(d),
  };
}

export const OFFICIAL_SCHEMES: Opportunity[] = [
  make({
    id: 'st-post-matric',
    title: 'Post Matric Scholarship for ST Students',
    providerName: 'Ministry of Tribal Affairs, Government of India (implemented by States/UTs)',
    level: 'undergraduate',
    location: 'India',
    category: 'Scholarship',
    tagline: 'For ST students in any recognised course after Class 10 — Class 11 up to post-graduation.',
    purpose: 'A centrally sponsored scheme. States/UTs invite applications on their State portal or the National Scholarship Portal, verify eligibility and pay the scholarship directly to the student’s bank account (DBT).',
    eligibility: [
      'Belongs to a Scheduled Tribe.',
      'Studying a recognised course at a recognised institution for which the qualification is Matriculation (Class 10) or above.',
      'Family income from all sources not above ₹2.5 lakh a year.',
    ],
    docs: [doc('st_certificate', 'ST (caste) certificate'), doc('income_certificate', 'Family income certificate'), doc('marksheet', 'Previous year’s marksheet')],
    deadline: 'Dates are set by each State/UT portal and change every year.',
    sourceUrl: MOTA,
    official: {
      sourceTitle: 'Ministry of Tribal Affairs scholarship page; State post-matric guidelines (Goa Tribal Welfare) for the income limit',
      benefits: ['Compulsory fees charged by the institution, up to the limit fixed by the State.', 'A maintenance amount of about ₹230 to ₹1,200 a month, depending on the course.'],
      applyUrl: 'https://scholarships.gov.in/',
      applyVia: 'on your State’s scholarship portal or the National Scholarship Portal (Maharashtra students: MahaDBT)',
      guidedPortal: 'nsp',
    },
  }),
  make({
    id: 'st-pre-matric',
    title: 'Pre Matric Scholarship for ST Students (Class 9–10)',
    providerName: 'Ministry of Tribal Affairs, Government of India (implemented by States/UTs)',
    level: 'school',
    location: 'India',
    category: 'Scholarship',
    tagline: 'For ST students studying in Class 9 and Class 10.',
    purpose: 'Supports ST children in Classes 9 and 10 so fewer students drop out after elementary school. States/UTs run the applications and pay directly to the student’s bank account.',
    eligibility: [
      'Belongs to a Scheduled Tribe of the State/UT where the student is domiciled.',
      'Studying in Class 9 or 10 in a Government school or a school recognised by the Government or a Central/State Board.',
      'Family income from all sources not above ₹2.5 lakh a year (an orphan supported by a guardian is exempt).',
      'Has a bank account in a Scheduled Bank linked with Aadhaar and mobile number.',
      'Is not getting any other scholarship. The scholarship is given once per class.',
    ],
    docs: [doc('aadhaar', 'Aadhaar number (entered on the portal)', 'Typed on the official portal yourself. Never share it with the guide.'), doc('domicile', 'Domicile certificate'), doc('st_certificate', 'ST certificate from the State’s competent authority'), doc('income_certificate', 'Family income certificate (self-declarations are not accepted)'), doc('photo', 'Passport-size photograph'), doc('disability', 'Disability certificate (only if applicable)')],
    deadline: 'Dates are set by each State/UT portal and change every year.',
    sourceUrl: MOTA,
    official: {
      sourceTitle: 'Ministry of Tribal Affairs Pre-Matric guidelines (17 Oct 2022) and rate revision (20 Dec 2019)',
      benefits: ['₹225 a month for day scholars and ₹525 a month for hostellers, for 10 months a year.', 'Extra monthly grant for students with disabilities.'],
      applyUrl: 'https://scholarships.gov.in/',
      applyVia: 'on your State’s scholarship portal or the National Scholarship Portal',
      guidedPortal: 'nsp',
    },
  }),
  make({
    id: 'st-top-class',
    title: 'National Scholarship for Higher Education of ST Students (Top Class)',
    providerName: 'Ministry of Tribal Affairs, Government of India',
    level: 'undergraduate',
    location: 'India',
    category: 'Scholarship',
    tagline: 'For ST students admitted to prescribed courses at institutions of excellence such as IITs, AIIMS, IIMs and NITs.',
    purpose: 'The scholarship part of the Central Sector scheme “National Fellowship & Scholarship for Higher Education of ST Students” (earlier called Top Class Education for ST Students). Priority is given to girls.',
    eligibility: [
      'Belongs to a Scheduled Tribe.',
      'Studying a prescribed course in one of the institutions of excellence identified by the Ministry (for example IITs, AIIMS, IIMs, NITs).',
      'Family income from all sources not above ₹6 lakh a year.',
    ],
    docs: [doc('st_certificate', 'ST certificate'), doc('income_certificate', 'Family income certificate'), doc('admission', 'Proof of admission to the institution')],
    deadline: 'The application window is announced each year on the Ministry’s portal.',
    sourceUrl: MOTA,
    official: {
      sourceTitle: 'Ministry of Tribal Affairs scheme note “National Fellowship & Scholarship for Higher Education of ST Students”',
      benefits: ['Covers tuition fees, living expenses, and allowances for books and a computer.'],
      applyUrl: MOTA,
      applyVia: 'through the online portal announced on the Ministry of Tribal Affairs scholarship page',
    },
  }),
  make({
    id: 'st-nfst',
    title: 'National Fellowship for Higher Education of ST Students (NFST)',
    providerName: 'Ministry of Tribal Affairs, Government of India',
    level: 'research',
    location: 'India',
    category: 'Fellowship',
    tagline: 'Fellowship for ST students pursuing a PhD in India.',
    purpose: 'The fellowship part of the Central Sector scheme “National Fellowship & Scholarship for Higher Education of ST Students”. The 2025-26 call offered 750 fellowships for PhD programmes.',
    eligibility: [
      'Belongs to a Scheduled Tribe.',
      'Has passed the post-graduation examination and is registered for a regular, full-time PhD at a UGC-recognised university, institute or college.',
    ],
    docs: [doc('st_certificate', 'ST certificate'), doc('pg_marksheet', 'Post-graduation marksheet / degree'), doc('phd_registration', 'Proof of PhD registration')],
    deadline: 'The 2025-26 window was 1 Aug to 30 Sep 2025. The next window is announced on the portal.',
    sourceUrl: MOTA,
    official: {
      sourceTitle: 'Ministry of Tribal Affairs notice inviting NFST applications for 2025-26, and scheme note',
      benefits: ['A monthly fellowship with a yearly contingency grant. The rates were revised from 1 Jan 2023 — check the current rates on the portal.'],
      applyUrl: 'https://fellowship.tribal.gov.in/',
      applyVia: 'on the National Tribal Fellowship portal',
    },
  }),
  make({
    id: 'st-nos',
    title: 'National Overseas Scholarship for ST Students (NOS)',
    providerName: 'Ministry of Tribal Affairs, Government of India',
    level: 'postgraduate',
    location: 'Overseas',
    category: 'Scholarship',
    tagline: 'For ST students going abroad for a Master’s or PhD at a top-1000 QS-ranked university.',
    purpose: 'Supports ST students for Master’s and PhD programmes abroad. About 20 awards a year (the number may vary), of which 6 are earmarked for women.',
    eligibility: [
      'Belongs to a Scheduled Tribe; some awards are for Particularly Vulnerable Tribal Groups (PVTG).',
      'Wants to study for a Master’s or PhD at a university in the top 1000 of the QS World Ranking.',
      'Maximum age on 1 July of the selection year: 32 for a Master’s, 35 for a PhD.',
      'At least 55% in the Bachelor’s degree (for a Master’s) or in the Master’s degree (for a PhD).',
      'Family (parents’) income from all sources not above ₹6 lakh a year; not applicable to orphans. Only one child of the same parents can get it, once.',
    ],
    docs: [doc('st_certificate', 'ST certificate'), doc('income_certificate', 'Income certificate from a State officer not below Tehsildar rank, for the latest financial year'), doc('marksheets', 'Bachelor’s / Master’s marksheets'), doc('admission', 'Admission letter from the foreign university (if already admitted)'), doc('declaration', 'Declaration if father’s income is not reported, or father’s death certificate if applicable')],
    deadline: 'Applications are invited once a year on the NOS portal; check the current advertisement.',
    sourceUrl: 'https://overseas.tribal.gov.in/',
    official: {
      sourceTitle: 'Ministry of Tribal Affairs “FAQs for National Overseas Scholarship Scheme 2026-27”',
      benefits: ['Scholarship support for study abroad as set in the NOS guidelines — see the current guidelines on the portal for the amounts.'],
      applyUrl: 'https://overseas.tribal.gov.in/',
      applyVia: 'on the National Overseas Scholarship portal',
    },
  }),
  make({
    id: 'mh-st-post-matric',
    title: 'Post Matric Scholarship for ST Students — Maharashtra (MahaDBT)',
    providerName: 'Tribal Development Department, Government of Maharashtra',
    level: 'undergraduate',
    location: 'India',
    category: 'Scholarship',
    tagline: 'Maharashtra’s route for the Government of India Post Matric Scholarship for ST students.',
    purpose: 'Scheme of Post Matric Scholarships to ST students for studies in India, applied for on MahaDBT. It must be renewed every year.',
    eligibility: [
      'Only for ST students.',
      'Family income up to ₹2,50,000 a year.',
      'Minimum Class 10 pass.',
      'Not allowed if you had a gap of two years back-to-back.',
      'Renewal: you must pass the previous year’s exam and apply for renewal; no scholarship for a year you fail.',
    ],
    docs: [doc('caste_certificate', 'Caste certificate'), doc('income_certificate', 'Income certificate'), doc('marksheet', 'Previous year’s marksheet'), doc('caste_validity', 'Caste validity certificate (mandatory for professional courses)')],
    deadline: 'Check the notice on MahaDBT for the current academic year.',
    sourceUrl: scheme('E9DDFA703C38E51A668ED132B54E2162E54C475F826D85C79DA948301E5F7772'),
    official: {
      sourceTitle: 'MahaDBT scheme page “Post Matric Scholarship Scheme (Government Of India)”',
      benefits: ['Maintenance allowance per month (hostellers / day scholars): Group 1 ₹1,200 / ₹550; Group 2 ₹820 / ₹530; Group 3 ₹570 / ₹300; Group 4 ₹380 / ₹230.', 'Book grant ₹1,200 a year; study tour and thesis typing ₹1,600 a year each; extra allowances for students with disabilities.'],
      applyUrl: MAHADBT_2,
      applyVia: 'on MahaDBT (2026-27 applications on MahaDBT 2.0)',
      guidedPortal: 'mahadbt',
      notes: [MAHADBT_NOTE],
    },
  }),
  make({
    id: 'mh-st-freeship',
    title: 'Tuition Fee & Exam Fee for Tribal Students (Freeship) — Maharashtra',
    providerName: 'Tribal Development Department, Government of Maharashtra',
    level: 'undergraduate',
    location: 'India',
    category: 'Fee reimbursement',
    tagline: 'For ST students in Maharashtra whose family income is above ₹2.5 lakh — tuition and exam fees reimbursed.',
    purpose: 'A State-sponsored scheme for ST students whose parents’ income is more than ₹2.5 lakh, so they are outside the Post Matric Scholarship. Only tuition fee and exam fee are reimbursed.',
    eligibility: [
      'Only for ST students.',
      'Family annual income above ₹2,50,000.',
      'Renewal: you must pass the previous year’s exam; no reimbursement for a year you fail.',
    ],
    docs: [doc('caste_certificate', 'Caste certificate'), doc('marksheet', 'Previous year’s marksheet'), doc('caste_validity', 'Caste validity certificate')],
    deadline: 'Check the notice on MahaDBT for the current academic year.',
    sourceUrl: scheme('E9DDFA703C38E51AE7C10C1B9446574716EB93196C4CB29808753F77C61BEF29'),
    official: {
      sourceTitle: 'MahaDBT scheme page “Tuition Fee & Exam Fee for Tribal Students (Freeship)”',
      benefits: ['Tuition fee and exam fee as per the approved college fee structure.'],
      applyUrl: MAHADBT_2,
      applyVia: 'on MahaDBT (2026-27 applications on MahaDBT 2.0)',
      guidedPortal: 'mahadbt',
      notes: [MAHADBT_NOTE],
    },
  }),
  make({
    id: 'mh-st-iti-fee',
    title: 'Vocational Training (ITI) Fee Reimbursement for ST Students — Maharashtra',
    providerName: 'Tribal Development Department, Government of Maharashtra',
    level: 'vocational',
    location: 'India',
    category: 'Fee reimbursement',
    tagline: 'ITI course fees for ST students admitted through Maharashtra’s central online admission (PPP seats).',
    purpose: 'Fee reimbursement for ST students admitted to PPP-scheme seats in Government ITIs and private ITIs through the Centralised Admission Process. No reimbursement for management-quota admissions.',
    eligibility: [
      'ST category with a caste validity certificate; domicile of Maharashtra.',
      'SSC (Class 10) pass or fail can apply.',
      'Admitted to a DGT or MSCVT approved course through the central online admission process (PPP seat).',
      'Family (father + mother) income: SSC pass up to ₹2.5 lakh gets benefits as per the GOI scholarship; SSC pass with ₹2.5–8 lakh, or SSC fail up to ₹8 lakh, gets 100% course fee reimbursement.',
      'Only for 2 children per family; must not have received this benefit or a government-sponsored training before; attendance and exams are compulsory.',
    ],
    docs: [doc('aadhaar', 'Aadhaar card', 'Uploaded on the official portal yourself. Never share it with the guide.'), doc('ration_card', 'Ration card'), doc('marksheet', 'SSC / HSC marksheet (previous year’s for renewal)'), doc('domicile', 'Domicile certificate'), doc('income_certificate', 'Income certificate from the competent authority'), doc('caste_certificate', 'Caste certificate and caste validity certificate'), doc('leaving_certificate', 'Original leaving / transfer certificate')],
    deadline: 'Check the notice on MahaDBT for the current academic year.',
    sourceUrl: scheme('E9DDFA703C38E51A1CE86EBA1BA63DA13D68304CE1D46C55A5B53B49580C2589'),
    official: {
      sourceTitle: 'MahaDBT scheme page “Vocational Training Fee reimbursement for the students belonging to Scheduled Tribe Category”',
      benefits: ['Up to 100% of the course fee, depending on SSC result and family income (see eligibility).'],
      applyUrl: MAHADBT_2,
      applyVia: 'on MahaDBT (2026-27 applications on MahaDBT 2.0)',
      guidedPortal: 'mahadbt',
      notes: [MAHADBT_NOTE],
    },
  }),
];

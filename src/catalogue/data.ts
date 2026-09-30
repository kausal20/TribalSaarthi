import type { Knowledge, OppDocument, OppField, OppSection, Opportunity } from './types';
import { OFFICIAL_SCHEMES } from './officialSchemes';

const SOURCE = 'https://tribal.nic.in/ScholarshiP.aspx';
const ANY = ['application/pdf', 'image/png', 'image/jpeg'];
const NOTE = 'Demo catalogue entry. Illustrative content; verify on the provider portal.';

const fullName: OppField = {
  key: 'full_name',
  label: 'Full name',
  type: 'text',
  required: true,
  help: 'Enter your name as it appears on your academic records. In this demo, use a fictional name.',
};
const academicRecord: OppDocument = {
  key: 'academic_record',
  label: 'Academic record (sample)',
  acceptedTypes: ANY,
  note: 'Illustrative: a record of your previous study. Use a fictional sample file here.',
};

function sections(title: string, overview: string, eligibility: string[], docs: OppDocument[], fields: OppField[]): OppSection[] {
  return [
    {
      id: 'overview',
      title: 'Overview',
      body: [overview, 'This is a simulated provider page for demonstration. It is not the real portal.'],
      summary: `Overview of ${title}: purpose and how this simulated portal is organised.`,
    },
    {
      id: 'eligibility',
      title: 'Eligibility',
      body: [...eligibility, 'Illustrative only. Actual eligibility rules are set by the provider; check the official page.'],
      summary: 'Illustrative eligibility points. The provider sets the real criteria.',
    },
    {
      id: 'documents',
      title: 'Documents',
      body: [`This scheme configuration lists ${docs.length} document(s) (illustrative):`, ...docs.map((d) => `• ${d.label} — ${d.note}`)],
      summary: `The document list: ${docs.map((d) => d.label).join('; ')}.`,
    },
    {
      id: 'form',
      title: 'Application form',
      body: [`Fill ${fields.filter((f) => f.required).length} required field(s), then review and submit on this simulated page yourself.`],
      summary: `The application form has ${fields.length} fields: ${fields.map((f) => f.label).join(', ')}.`,
    },
    {
      id: 'status',
      title: 'Status',
      body: ['Your draft progress and simulated submission state appear here. No real application is created.'],
      summary: 'Your draft and simulated submission status.',
    },
  ];
}

function knowledge(title: string, docs: OppDocument[], fields: OppField[], deadline: string, eligibility: string[]): Knowledge[] {
  const docList = docs.map((d) => d.label).join('; ');
  return [
    {
      id: 'where-apply',
      questionPatterns: ['where apply', 'how apply', 'start application', 'application form'],
      answer: `The application form is on the "Application form" page of this simulated portal. It has ${fields.length} fields (${fields.map((f) => f.label).join(', ')}). You review and submit it yourself.`,
      targetSectionId: 'form',
      sourceNote: NOTE,
    },
    {
      id: 'documents',
      questionPatterns: ['document list', 'which page document', 'what upload', 'what document', 'documents need', 'required document', 'what should upload'],
      answer: `The Documents page lists: ${docList}. These are illustrative — verify the real list on the provider portal.`,
      targetSectionId: 'documents',
      sourceNote: NOTE,
    },
    {
      id: 'eligibility',
      questionPatterns: ['eligib', 'who apply', 'can apply', 'qualify'],
      answer: `Illustrative points on this page: ${eligibility.join(' ')} I cannot tell you whether you personally qualify; the provider decides.`,
      targetSectionId: 'eligibility',
      sourceNote: NOTE,
    },
    {
      id: 'registration',
      questionPatterns: ['registration', 'register', 'sign up', 'create account', 'login'],
      answer: 'This simulated portal has no separate registration or login page, and I cannot create accounts or log in for you. The Application form page is where you start. On the real provider portal, follow its own registration steps yourself.',
      targetSectionId: 'form',
      sourceNote: NOTE,
    },
    {
      id: 'deadline',
      questionPatterns: ['deadline', 'last date', 'closing date', 'when close'],
      answer: `Deadline shown in this demo catalogue: ${deadline}. This is not verified — check the official provider page for the real date.`,
      targetSectionId: 'overview',
      sourceNote: NOTE,
    },
    {
      id: 'status',
      questionPatterns: ['status', 'track', 'progress', 'submitted'],
      answer: `The Status page shows your local draft progress for ${title} and whether you have marked it submitted on this simulated page. It is not connected to any real application.`,
      targetSectionId: 'status',
      sourceNote: NOTE,
    },
    {
      id: 'award',
      questionPatterns: ['will get', 'will select', 'chance', 'how much', 'amount', 'award'],
      answer: 'I do not have verified information for that. Selection and amounts are decided by the provider, not by this guide.',
      targetSectionId: 'overview',
      sourceNote: 'No verified source in this demo.',
    },
  ];
}

function make(o: {
  id: string;
  title: string;
  providerName: string;
  level: Opportunity['level'];
  location: Opportunity['location'];
  category: string;
  tagline: string;
  purpose: string;
  status: Opportunity['status'];
  deadline: Opportunity['deadline'];
  eligibility: string[];
  docs: OppDocument[];
  fields: OppField[];
  sourceUrl?: string;
}): Opportunity {
  return {
    id: o.id,
    title: o.title,
    providerName: o.providerName,
    level: o.level,
    location: o.location,
    category: o.category,
    tagline: o.tagline,
    purpose: o.purpose,
    status: o.status,
    verifiedSourceUrl: o.sourceUrl ?? SOURCE,
    demoOnly: true,
    deadline: o.deadline,
    documents: o.docs,
    fields: o.fields,
    sections: sections(o.title, o.purpose, o.eligibility, o.docs, o.fields),
    assistantKnowledge: knowledge(o.title, o.docs, o.fields, o.deadline.text, o.eligibility),
  };
}

const PRACTICE_EXAMPLES: Opportunity[] = [
  make({
    id: 'nfst-demo',
    tagline: 'For research scholars pursuing MPhil, PhD or post-doctoral work.',
    title: 'Research fellowship',
    providerName: 'Demo provider (NFST-inspired)',
    level: 'research',
    location: 'India',
    category: 'Fellowship',
    purpose: 'Illustrative flow for a domestic research fellowship: the applicant shows enrolment in a research programme.',
    status: 'Open in demo',
    deadline: { text: '15 Dec 2026 (illustrative)', set: true },
    eligibility: ['Enrolment in a research programme at a recognised institution (illustrative).'],
    docs: [
      { key: 'study_proof', label: 'Proof of enrolment in research programme', acceptedTypes: ANY, note: 'Illustrative: shows you are enrolled in a research programme.' },
      academicRecord,
    ],
    fields: [
      fullName,
      { key: 'institution', label: 'Institution', type: 'text', required: true, help: 'The university or institute where you are enrolled. Use a fictional name in this demo.' },
      { key: 'study_type', label: 'Study type', type: 'select', required: true, options: ['MPhil', 'PhD', 'Post-doctoral'], help: 'Choose the research programme type you are enrolled in.' },
      { key: 'research_topic', label: 'Research topic', type: 'text', required: true, help: 'A short title of your research work. Any fictional topic works in this demo.' },
    ],
  }),
  make({
    id: 'nos-demo',
    tagline: 'For students heading to postgraduate or doctoral study abroad.',
    title: 'Overseas study support',
    providerName: 'Demo provider (NOS-inspired)',
    level: 'postgraduate',
    location: 'Overseas',
    category: 'Scholarship',
    purpose: 'Illustrative flow for study abroad: the applicant shows admission to a course overseas.',
    status: 'Open in demo',
    deadline: { text: 'To be confirmed on the provider portal', set: false },
    eligibility: ['Admission to a postgraduate or doctoral course abroad (illustrative).'],
    docs: [
      { key: 'overseas_admission_proof', label: 'Overseas admission proof', acceptedTypes: ['application/pdf'], note: 'Illustrative: proof of admission to a course abroad. PDF only in this demo.' },
      academicRecord,
    ],
    fields: [
      fullName,
      { key: 'institution', label: 'Home institution', type: 'text', required: true, help: 'Your current or most recent institution in India. Use a fictional name.' },
      { key: 'study_type', label: 'Study type', type: 'select', required: true, options: ['Master’s abroad', 'PhD abroad'], help: 'Choose the level of the course you will study abroad.' },
      { key: 'destination_country', label: 'Destination country', type: 'text', required: true, help: 'The country where the course is offered.' },
      { key: 'course_name', label: 'Course name', type: 'text', required: true, help: 'The name of the course you have been admitted to.' },
    ],
  }),
  make({
    id: 'postmatric-demo',
    sourceUrl: 'https://mahadbt.maharashtra.gov.in/',
    tagline: 'For students pursuing education after Class 10.',
    title: 'Post-matric scholarship',
    providerName: 'Demo provider (post-matric-inspired)',
    level: 'undergraduate',
    location: 'India',
    category: 'Scholarship',
    purpose: 'Illustrative flow for college-level study after class 10: the applicant shows current admission.',
    status: 'Open in demo',
    deadline: { text: '31 Oct 2026 (illustrative)', set: true },
    eligibility: ['Current admission to a recognised post-matric course (illustrative).'],
    docs: [
      { key: 'admission_proof', label: 'Proof of current admission', acceptedTypes: ANY, note: 'Illustrative: shows you are admitted to a course.' },
      { key: 'fee_receipt', label: 'Fee receipt (sample)', acceptedTypes: ANY, note: 'Illustrative: a fictional fee receipt.' },
    ],
    fields: [
      fullName,
      { key: 'institution', label: 'Institution', type: 'text', required: true, help: 'Where you are currently studying. Use a fictional name.' },
      { key: 'course_name', label: 'Course', type: 'text', required: true, help: 'Your course or programme name.' },
      { key: 'year_of_study', label: 'Year of study', type: 'select', required: true, options: ['1st year', '2nd year', '3rd year', '4th year'], help: 'The year you are currently in.' },
    ],
  }),
  make({
    id: 'prematric-demo',
    tagline: 'For school students; catalogue entry only.',
    title: 'Pre-matric support',
    providerName: 'Demo provider (pre-matric-inspired)',
    level: 'school',
    location: 'India',
    category: 'Scholarship',
    purpose: 'Catalogue entry for school-level support. No simulated workspace has been built for it yet.',
    status: 'Catalogue only',
    deadline: { text: 'To be confirmed on the provider portal', set: false },
    eligibility: ['School-level enrolment (illustrative).'],
    docs: [{ key: 'school_proof', label: 'Proof of school enrolment', acceptedTypes: ANY, note: 'Illustrative.' }],
    fields: [fullName],
  }),
];

/** Real schemes first; practice examples (fictional, for learning the flow) after. */
export const OPPORTUNITIES: Opportunity[] = [...OFFICIAL_SCHEMES, ...PRACTICE_EXAMPLES];

export const findOpportunity = (id: string) => OPPORTUNITIES.find((o) => o.id === id);

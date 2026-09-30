import type { Scheme } from '../types';

const PDF_IMG = ['application/pdf', 'image/png', 'image/jpeg'];
const DISCLAIMER = 'ILLUSTRATIVE — consult current official guidelines. Not an official rule set.';

/** Seed schemes. Requirements are demonstration examples, not authoritative criteria. */
export const SEED_SCHEMES: Scheme[] = [
  {
    id: 'scheme-a',
    name: 'Scheme A — Domestic research fellowship (NFST-inspired)',
    version: 1,
    description:
      'Illustrative flow for a domestic research fellowship. Demonstrates a scheme that asks for proof of enrolment in a research programme.',
    fields: [
      { key: 'full_name', label: 'Full name', required: true, type: 'text' },
      { key: 'institution', label: 'Institution', required: true, type: 'text' },
      {
        key: 'study_type',
        label: 'Study type',
        required: true,
        type: 'select',
        options: ['MPhil', 'PhD', 'Post-doctoral'],
      },
      { key: 'research_topic', label: 'Research topic', required: true, type: 'text' },
      { key: 'statement', label: 'Short statement (optional)', required: false, type: 'textarea' },
    ],
    requiredDocuments: [
      {
        key: 'study_proof',
        label: 'Proof of enrolment in research programme',
        acceptedTypes: PDF_IMG,
        why: 'Demo rule: this scheme configuration asks for proof that the applicant is enrolled in a research programme.',
      },
      {
        key: 'academic_record',
        label: 'Academic record (sample)',
        acceptedTypes: PDF_IMG,
        why: 'Demo rule: an academic record lets the officer see prior study. Not scored by this prototype.',
      },
    ],
    publishedAt: '2026-01-01T00:00:00.000Z',
    demoDisclaimer: DISCLAIMER,
  },
  {
    id: 'scheme-b',
    name: 'Scheme B — Overseas study support (NOS-inspired)',
    version: 1,
    description:
      'Illustrative flow for overseas study support. Same form and checker as Scheme A; the difference comes only from this configuration data.',
    fields: [
      { key: 'full_name', label: 'Full name', required: true, type: 'text' },
      { key: 'institution', label: 'Home institution', required: true, type: 'text' },
      {
        key: 'study_type',
        label: 'Study type',
        required: true,
        type: 'select',
        options: ['Master’s abroad', 'PhD abroad'],
      },
      { key: 'destination_country', label: 'Destination country', required: true, type: 'text' },
      { key: 'course_name', label: 'Course name', required: true, type: 'text' },
    ],
    requiredDocuments: [
      {
        key: 'overseas_admission_proof',
        label: 'Overseas admission proof',
        acceptedTypes: ['application/pdf'],
        why: 'Demo rule: this scheme configuration asks for proof of admission to a course abroad (PDF only in this demo).',
      },
      {
        key: 'academic_record',
        label: 'Academic record (sample)',
        acceptedTypes: PDF_IMG,
        why: 'Demo rule: an academic record lets the officer see prior study. Not scored by this prototype.',
      },
    ],
    publishedAt: '2026-01-01T00:00:00.000Z',
    demoDisclaimer: DISCLAIMER,
  },
];

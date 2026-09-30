export type Level = 'school' | 'undergraduate' | 'postgraduate' | 'research' | 'vocational';
export type Location = 'India' | 'Overseas';
export type SectionId = 'overview' | 'eligibility' | 'documents' | 'form' | 'status';

export interface OppSection {
  id: SectionId;
  title: string;
  /** Text shown on the simulated provider page */
  body: string[];
  /** One-line summary the assistant reads out when navigating here */
  summary: string;
}

export interface OppField {
  key: string;
  label: string;
  type: 'text' | 'select';
  required: boolean;
  options?: string[];
  /** Configured help text; the assistant reads exactly this */
  help: string;
}

export interface OppDocument {
  key: string;
  label: string;
  acceptedTypes: string[];
  note: string;
}

export interface Knowledge {
  id: string;
  /** Each pattern is a space-separated set of keywords; it matches when all keywords (prefix match) occur in the question */
  questionPatterns: string[];
  answer: string;
  targetSectionId: SectionId;
  sourceNote: string;
}

export interface OfficialInfo {
  /** ISO date the official source was read */
  checkedOn: string;
  /** Name of the official document/page the facts come from */
  sourceTitle: string;
  benefits: string[];
  /** Where students actually apply */
  applyUrl: string;
  applyVia: string;
  /** Portal with TribalSaarthi browser-guide support, if any */
  guidedPortal?: 'mahadbt' | 'nsp';
  notes?: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  providerName: string;
  level: Level;
  location: Location;
  category: string;
  /** One-line description for cards */
  tagline: string;
  purpose: string;
  /** 'Open in demo' has a simulated provider workspace; 'Catalogue only' has a detail page but no workspace. */
  status: 'Open in demo' | 'Catalogue only';
  verifiedSourceUrl: string;
  /** true for practice examples; false for real schemes taken from an official source */
  demoOnly: boolean;
  /** Present only for real schemes: facts copied from the official source on `checkedOn`. */
  official?: OfficialInfo;
  deadline: { text: string; set: boolean };
  documents: OppDocument[];
  fields: OppField[];
  sections: OppSection[];
  assistantKnowledge: Knowledge[];
}

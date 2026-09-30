export type FieldType = 'text' | 'textarea' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: FieldType;
  options?: string[];
  help?: string;
}

export interface DocDef {
  key: string;
  label: string;
  /** MIME types accepted for this document slot */
  acceptedTypes: string[];
  /** Plain-language "why we need this" shown to the applicant (config text) */
  why: string;
}

export interface Scheme {
  id: string;
  name: string;
  version: number;
  description: string;
  fields: FieldDef[];
  requiredDocuments: DocDef[];
  publishedAt: string;
  demoDisclaimer: string;
}

export type Status =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'NEEDS_CORRECTION'
  | 'RESUBMITTED'
  | 'UNDER_REVIEW'
  | 'READY_FOR_SELECTION_REVIEW';

export type Role = 'STUDENT' | 'OFFICER' | 'ADMIN' | 'SYSTEM';

export type Verification = 'UNVERIFIED' | 'HUMAN_REVIEWED';

export interface AttachedDoc {
  key: string;
  name: string;
  mime: string;
  size: number;
  attachedAt: string;
  verification: Verification;
  /** data URL of the fictional sample file (<= 1 MB), persisted in localStorage */
  dataUrl: string;
}

export type EventType =
  | 'APPLICATION_CREATED'
  | 'DRAFT_SAVED'
  | 'DOCUMENT_ATTACHED'
  | 'DOCUMENT_REMOVED'
  | 'DOCUMENT_HUMAN_REVIEWED'
  | 'SUBMITTED'
  | 'DEFICIENCY_FOUND'
  | 'CORRECTION_REQUESTED'
  | 'RESUBMITTED'
  | 'REVIEW_STARTED'
  | 'READY_FOR_SELECTION_REVIEW'
  | 'POST_SELECTION_FOLLOWUP_DEMO';

export interface AppEvent {
  id: string;
  timestamp: string;
  actorRole: Role;
  type: EventType;
  message: string;
  ruleId?: string;
}

export interface Application {
  id: string;
  schemeId: string;
  schemeVersion: number;
  /** Immutable copy of the scheme as it was when the application was created */
  schemeSnapshot: Scheme;
  applicantId: string;
  applicantName: string;
  studentFields: Record<string, string>;
  documents: AttachedDoc[];
  status: Status;
  createdAt: string;
  updatedAt: string;
  events: AppEvent[];
}

export type Severity = 'MISSING' | 'NEEDS_REVIEW' | 'INFO';

export type CheckState =
  | 'missing'
  | 'wrong_type'
  | 'present_unverified'
  | 'human_reviewed'
  | 'field_supplied';

export interface CheckResult {
  ruleId: string;
  kind: 'FIELD' | 'DOC';
  key: string;
  label: string;
  severity: Severity;
  state: CheckState;
  explanation: string;
  remedy: string;
  why?: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });

import {
  fail,
  ok,
  type AppEvent,
  type Application,
  type AttachedDoc,
  type EventType,
  type Result,
  type Role,
  type Scheme,
  type Status,
} from '../types';
import { evaluate, deficiencies } from './evaluator';
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES } from './files';

/** Central transition table: from -> to -> role allowed to perform it. No status exists for an award. */
const TRANSITIONS: Record<Status, Partial<Record<Status, Role>>> = {
  DRAFT: { SUBMITTED: 'STUDENT' },
  SUBMITTED: { RESUBMITTED: 'STUDENT', NEEDS_CORRECTION: 'OFFICER', UNDER_REVIEW: 'OFFICER' },
  RESUBMITTED: { NEEDS_CORRECTION: 'OFFICER', UNDER_REVIEW: 'OFFICER' },
  NEEDS_CORRECTION: { RESUBMITTED: 'STUDENT' },
  UNDER_REVIEW: { NEEDS_CORRECTION: 'OFFICER', READY_FOR_SELECTION_REVIEW: 'OFFICER' },
  READY_FOR_SELECTION_REVIEW: {},
};

export const EDITABLE: Status[] = ['DRAFT', 'SUBMITTED', 'NEEDS_CORRECTION'];
export const OFFICER_STATUS_ORDER: Status[] = ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW', 'NEEDS_CORRECTION', 'READY_FOR_SELECTION_REVIEW'];
export const PENDING_REVIEW: Status[] = ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'];
export const FOLLOWUP_OPTIONS = ['Follow-up call scheduled', 'Next-stage documents requested', 'Progress check recorded'];

export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  NEEDS_CORRECTION: 'Needs your action',
  RESUBMITTED: 'Resubmitted',
  UNDER_REVIEW: 'Under officer review',
  READY_FOR_SELECTION_REVIEW: 'Ready for selection review',
};

const uuid = () => crypto.randomUUID();
const stamp = () => new Date().toISOString();

const event = (actorRole: Role, type: EventType, message: string, ruleId?: string): AppEvent => ({
  id: uuid(),
  timestamp: stamp(),
  actorRole,
  type,
  message,
  ruleId,
});

const touch = (app: Application, events: AppEvent[], patch: Partial<Application> = {}): Application => ({
  ...app,
  ...patch,
  updatedAt: stamp(),
  events: [...app.events, ...events], // append only
});

export function canTransition(from: Status, to: Status, role: Role): boolean {
  return TRANSITIONS[from]?.[to] === role;
}

function transition(app: Application, to: Status, role: Role): Result<null> {
  const allowed = TRANSITIONS[app.status]?.[to];
  if (allowed === undefined) return fail(`Invalid transition: ${app.status} → ${to} is not allowed.`);
  if (allowed !== role) return fail(`Only ${allowed} can move ${app.status} → ${to}.`);
  return ok(null);
}

export function createApplication(scheme: Scheme, applicantId: string, applicantName: string): Application {
  const now = stamp();
  return {
    id: `APP-${uuid().slice(0, 8).toUpperCase()}`,
    schemeId: scheme.id,
    schemeVersion: scheme.version,
    schemeSnapshot: structuredClone(scheme),
    applicantId,
    applicantName,
    studentFields: { full_name: applicantName },
    documents: [],
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
    events: [event('STUDENT', 'APPLICATION_CREATED', `Application created under ${scheme.name} v${scheme.version}.`)],
  };
}

const requireEditable = (app: Application): Result<null> =>
  EDITABLE.includes(app.status) ? ok(null) : fail(`Application is locked while status is ${app.status}.`);

function cleanFields(app: Application, fields: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const f of app.schemeSnapshot.fields) out[f.key] = fields[f.key] ?? '';
  return out;
}

export function saveDraft(app: Application, fields: Record<string, string>): Result<Application> {
  const e = requireEditable(app);
  if (!e.ok) return e;
  return ok(touch(app, [event('STUDENT', 'DRAFT_SAVED', 'Draft saved.')], { studentFields: cleanFields(app, fields) }));
}

export function attachDocument(
  app: Application,
  input: { key: string; name: string; mime: string; size: number; dataUrl: string },
): Result<Application> {
  const e = requireEditable(app);
  if (!e.ok) return e;
  const def = app.schemeSnapshot.requiredDocuments.find((d) => d.key === input.key);
  if (!def) return fail(`Unknown document slot "${input.key}" for this scheme version.`);
  if (!def.acceptedTypes.includes(input.mime)) return fail(`"${def.label}" does not accept ${input.mime}.`);
  if (input.size > MAX_FILE_BYTES) return fail('File exceeds the per-file size limit.');
  const others = app.documents.filter((d) => d.key !== input.key).reduce((n, d) => n + d.size, 0);
  if (others + input.size > MAX_TOTAL_BYTES) return fail('Total attachment size limit exceeded.');
  const doc: AttachedDoc = {
    key: input.key,
    name: input.name,
    mime: input.mime,
    size: input.size,
    dataUrl: input.dataUrl,
    attachedAt: stamp(),
    verification: 'UNVERIFIED', // a new file is never verified
  };
  return ok(
    touch(
      app,
      [
        event(
          'STUDENT',
          'DOCUMENT_ATTACHED',
          `Attached "${input.name}" for "${def.label}". Authenticity not verified.`,
          `DOC_${input.key}`,
        ),
      ],
      { documents: [...app.documents.filter((d) => d.key !== input.key), doc] },
    ),
  );
}

export function removeDocument(app: Application, key: string): Result<Application> {
  const e = requireEditable(app);
  if (!e.ok) return e;
  const doc = app.documents.find((d) => d.key === key);
  if (!doc) return fail('No such attachment.');
  return ok(
    touch(app, [event('STUDENT', 'DOCUMENT_REMOVED', `Removed "${doc.name}".`, `DOC_${key}`)], {
      documents: app.documents.filter((d) => d.key !== key),
    }),
  );
}

/** Submit (from DRAFT) or resubmit (from SUBMITTED / NEEDS_CORRECTION). Empty mandatory fields block; document gaps do not. */
export function submit(app: Application, fields: Record<string, string>, note = ''): Result<Application> {
  const to: Status = app.status === 'DRAFT' ? 'SUBMITTED' : 'RESUBMITTED';
  const t = transition(app, to, 'STUDENT');
  if (!t.ok) return t;
  const merged = { ...app, studentFields: cleanFields(app, fields) };
  const gaps = deficiencies(evaluate(app.schemeSnapshot, merged));
  const fieldGaps = gaps.filter((r) => r.kind === 'FIELD');
  if (fieldGaps.length) return fail(`Cannot submit: ${fieldGaps.map((r) => r.label).join(', ')} required.`);
  const docGaps = gaps.filter((r) => r.kind === 'DOC');
  const evs: AppEvent[] = [
    event(
      'STUDENT',
      to === 'SUBMITTED' ? 'SUBMITTED' : 'RESUBMITTED',
      to === 'SUBMITTED'
        ? 'Application submitted.'
        : `Application resubmitted.${note.trim() ? ` Applicant note: "${note.trim()}"` : ''}`,
    ),
    ...docGaps.map((r) => event('SYSTEM', 'DEFICIENCY_FOUND', `${r.explanation} (${r.ruleId})`, r.ruleId)),
  ];
  return ok(touch(merged, evs, { status: to }));
}

export function startReview(app: Application): Result<Application> {
  const t = transition(app, 'UNDER_REVIEW', 'OFFICER');
  if (!t.ok) return t;
  return ok(touch(app, [event('OFFICER', 'REVIEW_STARTED', 'Officer started review.')], { status: 'UNDER_REVIEW' }));
}

export function requestCorrection(app: Application, reason: string): Result<Application> {
  if (reason.trim().length < 5) return fail('A reason of at least 5 characters is required to request a correction.');
  const t = transition(app, 'NEEDS_CORRECTION', 'OFFICER');
  if (!t.ok) return t;
  return ok(touch(app, [event('OFFICER', 'CORRECTION_REQUESTED', reason.trim())], { status: 'NEEDS_CORRECTION' }));
}

export function markDocumentReviewed(app: Application, key: string): Result<Application> {
  if (app.status !== 'UNDER_REVIEW') return fail('Start review before marking documents as human-reviewed.');
  const doc = app.documents.find((d) => d.key === key);
  if (!doc) return fail('No such attachment.');
  const label = app.schemeSnapshot.requiredDocuments.find((d) => d.key === key)?.label ?? key;
  return ok(
    touch(
      app,
      [
        event(
          'OFFICER',
          'DOCUMENT_HUMAN_REVIEWED',
          `Officer reviewed the original file for "${label}". This is a human review, not an authenticity guarantee.`,
          `DOC_${key}`,
        ),
      ],
      { documents: app.documents.map((d) => (d.key === key ? { ...d, verification: 'HUMAN_REVIEWED' as const } : d)) },
    ),
  );
}

export function markReadyForSelectionReview(app: Application, reason: string): Result<Application> {
  if (reason.trim().length < 5) return fail('A reason of at least 5 characters is required.');
  const t = transition(app, 'READY_FOR_SELECTION_REVIEW', 'OFFICER');
  if (!t.ok) return t;
  const open = evaluate(app.schemeSnapshot, app).filter((r) => r.severity !== 'INFO');
  if (open.length) {
    return fail(
      `Cannot mark ready: still open — ${open.map((r) => r.ruleId).join(', ')}. Missing items need correction; attached documents need human review first.`,
    );
  }
  return ok(
    touch(
      app,
      [
        event(
          'OFFICER',
          'READY_FOR_SELECTION_REVIEW',
          `Marked ready for selection review by an officer. Reason: ${reason.trim()} (This is not an award.)`,
        ),
      ],
      { status: 'READY_FOR_SELECTION_REVIEW' },
    ),
  );
}

/** Event only. Does not change status and is not an award or payment. */
export function recordFollowup(app: Application, label: string, note = ''): Result<Application> {
  if (app.status !== 'READY_FOR_SELECTION_REVIEW') {
    return fail('A simulated follow-up can only be recorded after "Ready for selection review".');
  }
  if (!FOLLOWUP_OPTIONS.includes(label)) return fail('Unknown follow-up type.');
  return ok(
    touch(app, [
      event(
        'OFFICER',
        'POST_SELECTION_FOLLOWUP_DEMO',
        `SIMULATED follow-up: ${label}.${note.trim() ? ` Note: ${note.trim()}` : ''} Not an award, selection or payment.`,
      ),
    ]),
  );
}

/** Guard probe: any move to an unknown status (e.g. an award) is rejected. */
export function checkTransition(app: Application, to: string, role: Role): Result<null> {
  return transition(app, to as Status, role);
}

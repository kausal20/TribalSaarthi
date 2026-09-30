import { acceptedLabel } from '../engine/evaluator';
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES } from '../engine/files';
import { OPPORTUNITIES } from './data';
import { LEVEL_LABEL } from './filters';
import type { Opportunity, SectionId } from './types';
import type { Draft } from './drafts';

export interface AIReply {
  text: string;
  /** Section the server validated for navigation (only this scheme's own sections). */
  section?: SectionId;
}

export type AIHealth = { state: 'on'; model: string } | { state: 'off'; reason: string };

const SECTIONS: SectionId[] = ['overview', 'eligibility', 'documents', 'form', 'status'];

/** Scheme context for the model: demo config plus progress as LABELS ONLY (never typed values or file contents). */
export function buildSchemeContext(opp: Opportunity, draft: Draft | undefined, currentSection: SectionId) {
  const filled = new Set(Object.entries(draft?.fields ?? {}).filter(([, v]) => v.trim()).map(([k]) => k));
  return {
    id: opp.id,
    kind: opp.official ? 'official' : 'practice',
    title: opp.title,
    tagline: opp.tagline,
    purpose: opp.purpose,
    ...officialFacts(opp),
    provider: opp.providerName,
    category: opp.category,
    level: LEVEL_LABEL[opp.level],
    studyLocation: opp.location,
    deadline: opp.deadline.text,
    officialUrl: opp.verifiedSourceUrl,
    eligibility: eligibilityPoints(opp),
    uploadRules: `Each file up to ${MAX_FILE_BYTES / 1_000_000} MB, up to ${MAX_TOTAL_BYTES / 1_000_000} MB in total per application (limits of this TribalSaarthi practice demo; the official portal sets its own).`,
    howToApply: opp.official ? [
      'Check the eligibility points and keep the listed documents ready.',
      'Optionally practise the short form here with fictional details.',
      `Apply ${opp.official.applyVia}: ${opp.official.applyUrl}. You submit it yourself; TribalSaarthi does not submit applications.`,
    ] : [
      'Read the eligibility points and the document list in this guide.',
      'Practise the application form here with fictional details and attach sample files; you confirm each upload yourself.',
      `Apply for real on the official provider website (${opp.verifiedSourceUrl}); TribalSaarthi does not submit applications.`,
    ],
    currentSection,
    sections: opp.sections.map((s) => ({ id: s.id, title: s.title, summary: s.summary })),
    documents: opp.documents.map((d) => ({ label: d.label, acceptedTypes: acceptedLabel(d.acceptedTypes), note: d.note })),
    fields: opp.fields.map((f) => ({ label: f.label, required: f.required, help: f.help })),
    progress: {
      fieldsFilled: opp.fields.filter((f) => filled.has(f.key)).map((f) => f.label),
      documentsAttached: opp.documents.filter((d) => draft?.docs.some((x) => x.key === d.key)).map((d) => d.label),
      documentsConfirmed: opp.documents.filter((d) => draft?.docs.some((x) => x.key === d.key && x.confirmed)).map((d) => d.label),
    },
  };
}

/** Eligibility points from the scheme's own eligibility section, without the generic disclaimer line. */
function eligibilityPoints(opp: Opportunity): string[] {
  const body = opp.sections.find((s) => s.id === 'eligibility')?.body ?? [];
  return body.filter((b) => !/^illustrative only/i.test(b.trim()));
}

/** Official-source facts (only for real schemes). */
function officialFacts(opp: Opportunity) {
  const o = opp.official;
  return o ? { checkedOn: o.checkedOn, sourceTitle: o.sourceTitle, benefits: o.benefits, applyVia: o.applyVia, applyUrl: o.applyUrl, notes: o.notes ?? [] } : {};
}

/** Compact catalogue summary so the homepage guide can recommend among the demo entries only. */
export function buildCatalogueContext() {
  return OPPORTUNITIES.map((o) => ({
    id: o.id,
    kind: o.official ? 'official' : 'practice',
    title: o.title,
    tagline: o.tagline,
    provider: o.providerName,
    benefits: o.official?.benefits ?? [],
    applyVia: o.official?.applyVia ?? '',
    level: LEVEL_LABEL[o.level],
    studyLocation: o.location,
    category: o.category,
    deadline: o.deadline.text,
    guidedDemo: o.status === 'Open in demo',
    documents: o.documents.map((d) => d.label),
    eligibility: eligibilityPoints(o),
  }));
}

/** Asks the live AI guide. Returns null on ANY failure so the caller can fall back to built-in answers. */
export async function askAI(
  opp: Opportunity,
  draft: Draft | undefined,
  section: SectionId,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<AIReply | null> {
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-10), scheme: buildSchemeContext(opp, draft, section), catalogue: buildCatalogueContext() }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string; actions?: { type: string; urlPath?: string }[] };
    if (!data.text?.trim()) return null;
    let target: SectionId | undefined;
    for (const a of data.actions ?? []) {
      const m = a.type === 'navigateTo' && a.urlPath ? /^\/guide\/([a-z0-9-]+)\/([a-z]+)$/.exec(a.urlPath) : null;
      if (m && m[1] === opp.id && (SECTIONS as string[]).includes(m[2])) target = m[2] as SectionId;
    }
    return { text: data.text.trim(), section: target };
  } catch {
    return null;
  }
}

export async function aiHealth(): Promise<AIHealth> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
    const h = (await res.json()) as { keyConfigured?: boolean; canAnswer?: boolean; model?: string };
    if (!h.keyConfigured) return { state: 'off', reason: 'no API key on the server' };
    if (!h.canAnswer) return { state: 'off', reason: 'the AI account balance is empty' };
    return { state: 'on', model: h.model ?? 'AI' };
  } catch {
    return { state: 'off', reason: 'the assistant server is not running' };
  }
}

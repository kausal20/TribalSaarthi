import type { Opportunity, SectionId } from './types';
import { OPPORTUNITIES } from './data';
import { LEVEL_LABEL } from './filters';

export const FALLBACK = "I don't have verified information for that. Please check the official provider page.";

export interface AssistantContext {
  activeField?: string;
  /** keys of documents currently attached in the draft */
  attachedKeys: string[];
  /** keys of form fields currently filled in the draft */
  filledFieldKeys?: string[];
}

export interface AssistantReply {
  text: string;
  source?: string;
  navigate?: { section: SectionId; field?: string };
  kind: 'answer' | 'navigate' | 'fallback' | 'safety';
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** All words of `pattern` must appear (prefix match) among the message words. */
function matches(pattern: string, words: string[]): boolean {
  return norm(pattern)
    .split(' ')
    .every((p) => words.some((w) => w.startsWith(p) || (p.length > 4 && p.startsWith(w) && w.length > 3)));
}

const SENSITIVE = /\b(password|otp|pin|cvv|aadhaar|aadhar|bank account|card number|passcode)\b/;

const SECTION_WORDS: [SectionId, RegExp][] = [
  ['eligibility', /eligib/],
  ['documents', /document/],
  ['form', /\b(form|apply|application)\b/],
  ['status', /\bstatus\b/],
  ['overview', /\boverview\b/],
];

/** Deterministic, grounded reply. Uses only the selected opportunity's local data. */
export function respond(opp: Opportunity, message: string, ctx: AssistantContext): AssistantReply {
  const text = norm(message);
  if (!text) return { text: 'Ask me about the documents, eligibility, the form, or a field. I only use this demo scheme’s configured information.', kind: 'fallback' };

  if (/^(hi|hii|hello|hey|namaste|namaskar|good (morning|afternoon|evening))\b/.test(text) && text.split(' ').length <= 4) {
    return { text: `Hello! I can help with the documents, eligibility points and form fields for “${opp.title}”, or check what you have completed. What would you like to know?`, kind: 'answer' };
  }

  // Small talk and "what can you do" are answered like a person would, never with the missing-facts line.
  if (/\b(your name|you name|who are you|who r you|what are you|what can you|what do you do|what you do|how can you help|can you help|help me|what can u)\b/.test(text) || /\bwhat\b.*\byou\b.*\b(do|hel\w*)\b/.test(text)) {
    return { text: `I'm Saarthi AI. I help ST students find scholarships and get their documents and forms ready. For “${opp.title}” you can ask me who can apply, which documents you'll need, what you get, or how to apply. Or tap “Don't know which scholarship you qualify for?” and I'll suggest some.`, kind: 'answer' };
  }
  if (/^(thanks|thank you|thx|ok|okay|great|nice|good|cool|shukriya|dhanyavad)\b/.test(text) && text.split(' ').length <= 4) {
    return { text: "You're welcome! Ask me anything else about this scheme whenever you like.", kind: 'answer' };
  }
  if (/\b(how are you|how r you|kaise ho)\b/.test(text)) {
    return { text: "I'm doing well, thanks for asking! What would you like to know about this scholarship?", kind: 'answer' };
  }

  if (SENSITIVE.test(text)) {
    return {
      text: 'Please do not share passwords, OTPs, PINs or ID/bank numbers with me. I never need them, and I cannot log in or submit for you. You stay in control of every submit and upload.',
      kind: 'safety',
    };
  }

  const words = text.split(' ');

  // Recommendation questions are advice, not missing facts: list the demo entries by level and ask for the missing detail.
  if (/\b(best|suit|suits|suitable|recommend|which scholar|which scheme|for me|can i get)\b/.test(text) && !/\b(document|deadline|last date|field)\b/.test(text)) {
    const lines = OPPORTUNITIES.filter((o) => o.official).map((o) => `• ${o.title} — ${LEVEL_LABEL[o.level]}, ${o.location === 'Overseas' ? 'abroad' : 'India'}`);
    return {
      text: `Real scholarship schemes in TribalSaarthi:\n${lines.join('\n')}\n\nWhich class or course are you in now, and do you want to study in India or abroad? Then I can point you to the closest match. Only the provider decides eligibility; verify on the official portal.`,
      kind: 'answer',
    };
  }

  if (/\b(uploaded|attached|completed|done|progress)\b/.test(text) || /check .*(list|files|documents)/.test(text)) {
    const filled = ctx.filledFieldKeys ?? [];
    const fieldLines = opp.fields.map((f) => `• ${f.label}: ${filled.includes(f.key) ? 'filled' : 'empty'}`);
    const lines = opp.documents.map((d) => `• ${d.label}: ${ctx.attachedKeys.includes(d.key) ? 'attached — not verified' : 'not attached yet'}`);
    const missing = opp.documents.filter((d) => !ctx.attachedKeys.includes(d.key)).length;
    const empty = opp.fields.filter((f) => !filled.includes(f.key)).length;
    return {
      text: `Form fields:\n${fieldLines.join('\n')}\n\nDocuments:\n${lines.join('\n')}\n\n${missing || empty ? `${empty} field(s) empty and ${missing} document(s) still to attach.` : 'Everything listed is filled or attached. Nothing here is verified, and you still confirm each upload and the final submit yourself.'}`,
      navigate: { section: empty ? 'form' : missing ? 'documents' : 'status' },
      source: 'Your local draft and this scheme’s configured fields and documents.',
      kind: 'answer',
    };
  }

  if (/(explain|what).*(this )?field|what does this (mean|field)/.test(text) && !opp.fields.some((f) => text.includes(norm(f.label)))) {
    const f = opp.fields.find((x) => x.key === ctx.activeField);
    if (!f) return { text: 'Click or tab into a field on the Application form first, then ask me to explain it.', navigate: { section: 'form' }, kind: 'navigate' };
    return { text: `${f.label}: ${f.help}`, navigate: { section: 'form', field: f.key }, source: 'Configured field help for this scheme.', kind: 'answer' };
  }

  const mentioned = opp.fields.find((f) => text.includes(norm(f.label)));
  if (mentioned) {
    return { text: `${mentioned.label}: ${mentioned.help}`, navigate: { section: 'form', field: mentioned.key }, source: 'Configured field help for this scheme.', kind: 'answer' };
  }

  let best: { score: number; i: number } | null = null;
  opp.assistantKnowledge.forEach((k, i) => {
    for (const p of k.questionPatterns) {
      if (matches(p, words)) {
        const score = norm(p).split(' ').length;
        if (!best || score > best.score) best = { score, i };
      }
    }
  });
  if (best) {
    const k = opp.assistantKnowledge[(best as { i: number }).i];
    return { text: k.answer, navigate: { section: k.targetSectionId }, source: k.sourceNote, kind: 'answer' };
  }

  if (/\b(take me|open|go to|show|navigate|move to)\b/.test(text)) {
    for (const [id, re] of SECTION_WORDS) {
      if (re.test(text)) {
        const s = opp.sections.find((x) => x.id === id)!;
        return { text: `Opened “${s.title}”. ${s.summary}`, navigate: { section: id }, source: NOTE_SOURCE, kind: 'navigate' };
      }
    }
  }

  return { text: `${FALLBACK} I can help with who can apply, the documents you'll need, what you get, and how to apply. Try one of those?`, kind: 'fallback' };
}

const NOTE_SOURCE = 'Demo catalogue entry. Illustrative content; verify on the provider portal.';

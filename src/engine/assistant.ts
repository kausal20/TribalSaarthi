import type { Application, Scheme } from '../types';
import { acceptedLabel, deficiencies, evaluate } from './evaluator';
import { STATUS_LABEL } from './workflow';

export const ASSISTANT_LABEL = 'Guided demo assistant (not an LLM)';

export const SUGGESTIONS = [
  'What documents do I need?',
  'What is missing on my application?',
  'What does "unverified" mean?',
  'Who decides selection?',
  'What is my status?',
];

/** Deterministic keyword answers grounded only in the scheme snapshot and evaluator output. */
export function answer(question: string, scheme: Scheme, app?: Application): string {
  const q = question.toLowerCase();
  if (/missing|lack|deficien|wrong/.test(q)) {
    if (!app) return 'Start an application first; then I can list what is missing.';
    const gaps = deficiencies(evaluate(app.schemeSnapshot, app));
    if (!gaps.length) {
      return 'Nothing is missing under the demo rules. Potentially complete under demo rules; pending officer verification.';
    }
    return 'Open items:\n' + gaps.map((g) => `• ${g.ruleId}: ${g.explanation} ${g.remedy}`).join('\n');
  }
  if (/unverified|verif|genuine|authentic/.test(q)) {
    return 'In this demo, "Document attached; authenticity not verified" means a file exists in the application. Only a human officer can mark it reviewed, and even that is a review, not a guarantee of authenticity.';
  }
  if (/select|award|decide|approve|money|payment|fund/.test(q)) {
    return 'Nothing in this prototype selects or awards anyone. Rules only check completeness. An officer can mark an application "Ready for selection review"; any selection decision is outside this demo.';
  }
  if (/status|where|stage/.test(q)) {
    return app ? `Application ${app.id} is "${STATUS_LABEL[app.status]}".` : 'No application selected.';
  }
  if (/document|need|require|upload|attach|file/.test(q)) {
    return (
      `Under ${scheme.name} v${scheme.version} (demo configuration), required documents are:\n` +
      scheme.requiredDocuments.map((d) => `• ${d.label} — ${acceptedLabel(d.acceptedTypes)}. ${d.why}`).join('\n')
    );
  }
  return 'I can only answer questions about the configured demo requirements, missing items, verification wording, and status. Try one of the suggested questions.';
}

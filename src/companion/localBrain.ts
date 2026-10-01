import { cleanFillValue, parseRupees } from '../../server/companion.mjs';
import { DOC_LABEL, type BridgeAction, type CompanionResponse, type DocType, type FormState, type TargetId } from './bridge';
import type { FileMeta } from './files';

/**
 * The built-in demo brain. It answers in the same shape as the AI service (`{ text, actions }`), so the form behaves the
 * same when the AI is off or the network is down. It only reads what the student typed in the chat.
 */

const CONNECTORS = new Set(['and', 'aur', 'ani', 'my', 'i', 'family', 'income', 'annual', 'yearly', 'from', 'studying', 'in', 'of', 'is', 'am', 'age', 'aged', 'years', 'year', 'old', 'hai', 'ahe', 'earn', 'earns', 'salary', 'please', 'pls', 'thanks', 'thank']);
const NOT_A_NAME = new Set(['a', 'an', 'the', 'not', 'here', 'studying', 'student', 'applying', 'looking', 'interested', 'trying', 'going', 'ready', 'sure', 'fine', 'good', 'ok', 'okay', 'from', 'in', 'at', 'on', 'very', 'so', 'just', 'also', 'still', 'currently', 'confused', 'new', 'your', 'my', 'st', 'sc', 'obc', 'poor', 'unable', 'having', 'facing', 'wondering', 'asking']);
const STRONG = /(?:my\s+(?:full\s+)?name\s+is|my\s+name['’]s|full\s+name\s*(?:is|:|=)|name\s*(?::|=)|call\s+me|mera\s+naam(?:\s+hai)?|maza\s+naav|माझे\s+नाव|मेरा\s+नाम)\s+/i;
const WEAK = /(?:\b[Ii]\s+am|\b[Ii]['’]m|\b[Tt]his\s+is)\s+/;

/** Up to four words that look like a person's name, starting at the beginning of `rest`. */
function takeName(rest: string, needCapitals: boolean): string | null {
  const words: string[] = [];
  for (const token of rest.split(/\s+/)) {
    const ends = /[,;!?]$/.test(token);
    const word = token.replace(/[,;!?]+$/, '');
    const initial = /^\p{L}\.$/u.test(word);
    const plain = initial ? word : word.replace(/\.+$/, '');
    if (!plain || !/^[\p{L}\p{M}][\p{L}\p{M}.'’-]*$/u.test(plain)) break;
    if (words.length > 0 && CONNECTORS.has(plain.toLowerCase())) break;
    if (needCapitals && /\p{Ll}/u.test(plain[0]) && !/[ऀ-ॿ]/.test(plain[0])) break;
    words.push(plain);
    if (ends || (word.endsWith('.') && !initial) || words.length === 4) break;
  }
  if (!words.length || NOT_A_NAME.has(words[0].toLowerCase())) return null;
  return cleanFillValue('name', words.join(' '));
}

/** "My name is Asha Pawar", "I am Asha Pawar", "मेरा नाम आशा पवार" -> "Asha Pawar". Null when no name is given. */
export function extractName(text: string): string | null {
  const strong = STRONG.exec(text);
  if (strong) return takeName(text.slice(strong.index + strong[0].length), false);
  const weak = WEAK.exec(text);
  if (weak) return takeName(text.slice(weak.index + weak[0].length), true);
  return null;
}

const AMOUNT = String.raw`(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crore|lakhs?|lacs?|thousand|hajar|k|l)?`;
const AFTER_WORD = new RegExp(String.raw`(?:\bincome|\bearn(?:s|ing|ed)?|\bsalary|\bkamai|उत्पन्न|आय)[^\d₹]{0,40}?${AMOUNT}`, 'i');
const BEFORE_WORD = new RegExp(`${AMOUNT}\\s*(?:a\\s+year|per\\s+year|yearly|annual(?:ly)?|per\\s+annum)?\\s*(?:family\\s+)?(?:income|salary)`, 'i');

/** "family income is 1.8 lakh", "I earn ₹1,80,000", "2 lakh income" -> "180000" / "200000". Null when no amount is given. */
export function extractIncome(text: string): string | null {
  const m = AFTER_WORD.exec(text) ?? BEFORE_WORD.exec(text);
  if (!m) return null;
  if (/certificate|proof|document|issued|dated/i.test(m[0])) return null;
  const hasUnit = !!m[2] || /[₹]|\brs\b|\binr\b/i.test(m[0]);
  const plain = Number(m[1].replace(/,/g, ''));
  if (!hasUnit && plain >= 1990 && plain <= 2100) return null; // a year, not an amount
  return parseRupees(`${m[1]} ${m[2] ?? ''}`.trim());
}

const formatRupees = (digits: string) => `₹${Number(digits).toLocaleString('en-IN')}`;

function intentTarget(q: string): TargetId | null {
  const go = /\b(show|go|take|open|where|find|move|scroll|see|start|next)\b/.test(q);
  if (/\b(document|documents|upload|attach|certificate|file|files)\b/.test(q)) return 'documents';
  if (/\b(instruction|instructions|overview|help|how does|what is this|about)\b/.test(q)) return 'instructions';
  if (/\bincome\b/.test(q) && go) return 'income_details';
  if (/\b(name|personal|aadhaar number)\b/.test(q) && go) return 'personal_details';
  if (/\b(form|application|apply|fill|begin)\b/.test(q)) return 'form_section';
  return null;
}

export const SUGGESTIONS = [
  'Show me the application form',
  'My name is Asha Pawar and my family income is 1.8 lakh',
  'What documents do I need?',
];

function fileReply(meta: FileMeta): CompanionResponse {
  if (meta.check === 'failed') {
    return { text: `“${meta.name}” did not pass the check on your device. ${meta.notes.join(' ')} Fix the file and add it again.`, actions: [] };
  }
  if (!meta.guess) return { text: `Which document is “${meta.name}”? Tell me and I will attach it to the right box.`, actions: [] };
  const warn = meta.check === 'warning' ? ` One thing to look at: ${meta.notes[0]}` : '';
  return {
    text: `This looks like your ${DOC_LABEL[meta.guess]}. “${meta.name}” passed the check on your device, so I am attaching it to the form.${warn}`,
    actions: [{ action: 'NAVIGATE', target: 'documents' }, { action: 'MAP_FILE', documentType: meta.guess, fileName: meta.name }],
  };
}

export function localReply(input: { text: string; state: FormState; files?: FileMeta[] }): CompanionResponse {
  if (input.files?.length) return fileReply(input.files[0]);
  const q = input.text.toLowerCase();
  const name = extractName(input.text);
  const income = extractIncome(input.text);
  const actions: BridgeAction[] = [];
  const filled: string[] = [];
  if (name) { actions.push({ action: 'NAVIGATE', target: 'personal_details' }, { action: 'AUTO_FILL', field: 'name', value: name }); filled.push('your name'); }
  if (income) { actions.push({ action: 'NAVIGATE', target: 'income_details' }, { action: 'AUTO_FILL', field: 'income', value: income }); filled.push(`your yearly family income of ${formatRupees(income)}`); }
  if (filled.length) {
    const haveName = !!name || !!input.state.values.name.trim();
    const haveIncome = !!income || !!input.state.values.income.trim();
    if (haveName && haveIncome) {
      actions.push({ action: 'NAVIGATE', target: 'documents' });
      return { text: `Filling in ${filled.join(' and ')}. Next: your Aadhaar card and income certificate. Drop them here and I will check them on your device.`, actions };
    }
    const next = haveName ? 'Tell me your family’s yearly income when you are ready.' : 'Tell me your full name when you are ready.';
    return { text: `Filling in ${filled.join(' and ')}. ${next}`, actions };
  }
  const target = intentTarget(q);
  if (target === 'documents') {
    return { text: 'You need two documents for this practice form: your Aadhaar card and your income certificate. Drop each file here and I will check it on your device, then attach it to the right box. I never see what is inside a file.', actions: [{ action: 'NAVIGATE', target }] };
  }
  if (target) {
    const say: Record<TargetId, string> = {
      instructions: 'Here is how this practice form works.',
      form_section: 'Here is the application form. Tell me your name and family income and I will fill them in.',
      personal_details: 'Here are your personal details. Type your Aadhaar number yourself; I never fill it in.',
      income_details: 'Here is the income section. Tell me your yearly family income and I will fill it in.',
      documents: '',
    };
    return { text: say[target], actions: [{ action: 'NAVIGATE', target }] };
  }
  return {
    text: 'I can fill in your name and family income from what you tell me, take you to any part of the form, and check your Aadhaar card and income certificate on your device. Try: “My name is Asha Pawar and my family income is 1.8 lakh”.',
    actions: [],
  };
}

export const SECRET_REPLY = 'Please do not type your Aadhaar number, an OTP or a password here. I never need them and cannot enter them for you. Type your Aadhaar number in its box on the form yourself.';

export const docFromText = (text: string): DocType | null => (/aadhaar|aadhar|adhar/i.test(text) ? 'Aadhaar' : /income/i.test(text) ? 'Income' : null);

// What counts as private in the panel. Nothing here sends data anywhere.

// Field labels / names that hold secrets or identity numbers. content.js cannot import modules, so it carries a
// copy of this pattern; lib.test.js fails if the two ever differ.
// Note: only whole words count, so "Passport size photograph" or "Passing year" are NOT private.
export const FIELD_PATTERN = String.raw`password|passcode|passwd|\bpwd\b|(?:^|[^a-z])otp|otp(?:$|[^a-z])|captcha|\bcvv\b|\bpin\b(?![ _-]*code)|aadhaar|aadhar|\buid\b|bank|account|ifsc|biometric`;
const FIELD = new RegExp(FIELD_PATTERN, 'i');

/** "txtOTP" -> "txt OTP", "pin_code" -> "pin code", so ids and names read like words. */
export const splitWords = (s) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
export const isSensitiveField = (...parts) => FIELD.test(splitWords(parts.filter(Boolean).join(' ')));

// ---------- chat messages ----------
const KEYWORD = /\b(?:password|passcode|passwd|otp|captcha|cvv|pin(?![ _-]*code)|aadhaar|aadhar|bank account|account number|card number|ifsc|biometric)\b/i;
const AADHAAR_LIKE = /(?<!\d)\d{4}[ -]?\d{4}[ -]?\d{4}(?!\d)/;
const CARD_LIKE = /(?<!\d)(?:\d{4}[ -]?){3}\d{4}(?!\d)/;
const PLAIN_WORDS = new Set(['not', 'wrong', 'invalid', 'incorrect', 'required', 'needed', 'expired', 'sent', 'received', 'missing', 'lost', 'forgotten', 'blocked', 'locked', 'correct', 'coming', 'working', 'valid', 'here', 'there', 'what', 'where', 'how', 'why', 'the', 'this', 'that', 'for', 'and', 'but', 'now', 'shown', 'showing', 'asked', 'asking', 'mandatory', 'optional', 'different', 'same', 'too', 'very']);
const HANDLE = /\b(?:enter|type|fill|put|write|use|share|give|send|save|remember)\b[^.?!]{0,30}\b(?:password|passcode|passwd|otp|captcha|pin(?![ _-]*code)|aadhaar|aadhar|cvv)\b/i;

/** Mentions a secret-type word at all (used to keep document requests away from identity documents). */
export const mentionsPrivate = (message) => KEYWORD.test(String(message || ''));

/** The message contains an actual secret value, e.g. "my otp is 482913" or a 12-digit number. */
export function sharesSecret(message) {
  const m = String(message || '');
  if (AADHAAR_LIKE.test(m) || CARD_LIKE.test(m)) return true;
  const k = KEYWORD.exec(m);
  if (!k) return false;
  const before = m.slice(Math.max(0, k.index - 30), k.index);
  const after = m.slice(k.index + k[0].length, k.index + k[0].length + 48);
  if (/\d{4,}/.test(before) || /\d{3,}/.test(after)) return true;
  const value = /^\s*(?:is|was|=|:|-)\s*([^\s.,;!?]+)/i.exec(after);
  return !!value && value[1].length >= 3 && !PLAIN_WORDS.has(value[1].toLowerCase());
}

/** The student asks the guide to type or keep a secret for them ("enter my password"). */
export const asksToHandleSecret = (message) => HANDLE.test(String(message || ''));

export const HIDDEN_TEXT = 'Message hidden: it looked like a password, OTP or ID number.';

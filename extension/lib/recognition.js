export const SPOKEN_LANGUAGES = ['hi-IN', 'en-IN'];
export const spokenLanguage = saved => SPOKEN_LANGUAGES.includes(saved) ? saved : 'hi-IN';

/** Results are cumulative for this recognition session; rebuilding avoids duplicates. */
export function recognitionTranscript(results, base = '') {
  const parts = Array.from(results || [], result => String(result?.[0]?.transcript || '').trim()).filter(Boolean);
  return [base.trim(), ...parts].filter(Boolean).join(' ').slice(0, 4000);
}

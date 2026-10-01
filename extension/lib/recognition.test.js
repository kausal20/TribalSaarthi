import { describe, it, expect } from 'vitest';
import { spokenLanguage, recognitionTranscript } from './recognition.js';
describe('Hindi dictation', () => {
  it('defaults to Hindi and preserves an explicit supported language', () => {
    expect(spokenLanguage()).toBe('hi-IN');
    expect(spokenLanguage('en-US')).toBe('hi-IN');
    for (const lang of ['hi-IN', 'en-IN']) expect(spokenLanguage(lang)).toBe(lang);
  });
  it('keeps Devanagari and mixed-language words without repeated interim text', () => {
    const results = [[{transcript:'मुझे छात्रवृत्ति चाहिए'}],[{transcript:'income certificate कहाँ लगेगा'}]];
    expect(recognitionTranscript(results,'नमस्ते')).toBe('नमस्ते मुझे छात्रवृत्ति चाहिए income certificate कहाँ लगेगा');
    expect(recognitionTranscript(results,'नमस्ते')).toBe(recognitionTranscript(results,'नमस्ते'));
    expect(recognitionTranscript([[{transcript:'अ'.repeat(5000)}]])).toHaveLength(4000);
  });
});

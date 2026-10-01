import { useCallback, useSyncExternalStore } from 'react';
import { hi } from './hi';

/**
 * Site language. English text is the key: `t('Search scholarships')` returns the English text unchanged, or its Hindi or
 * Hindi version from the dictionary. Official scheme facts (eligibility, benefits, documents) are shown as the
 * official source publishes them and are never machine-translated.
 */
export type Lang = 'en' | 'hi';
export const LANGS: { id: Lang; label: string; speech: string }[] = [
  { id: 'en', label: 'English', speech: 'en-IN' },
  { id: 'hi', label: 'हिन्दी', speech: 'hi-IN' },
];
export const LANG_NAME: Record<Lang, string> = { en: 'English', hi: 'Hindi' };

const KEY = 'tribalsaarthi.lang';
const DICTS: Record<'hi', Record<string, string>> = { hi };

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'hi') return saved;
  } catch { /* storage blocked */ }
  const browser = typeof navigator === 'undefined' ? '' : (navigator.language || '').toLowerCase();
  return browser.startsWith('hi') ? 'hi' : 'en';
}

let current: Lang = initial();
const subscribers = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function setLang(next: Lang) {
  current = next;
  try { localStorage.setItem(KEY, next); } catch { /* the choice just will not be remembered */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  subscribers.forEach((s) => s());
}
export const getLang = () => current;
export const useLang = (): Lang => useSyncExternalStore((cb) => { subscribers.add(cb); return () => void subscribers.delete(cb); }, () => current);

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  const out = lang === 'en' ? text : DICTS[lang][text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : out;
}

export type TFn = (text: string, vars?: Record<string, string | number>) => string;
/** The translate function for the current language; components using it re-render when the language changes. */
export function useT(): TFn {
  const lang = useLang();
  return useCallback((text, vars) => translate(lang, text, vars), [lang]);
}

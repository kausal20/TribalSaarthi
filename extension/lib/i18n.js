// Panel language (English and Hindi). English text is the key, as on the website.
// Official portal wording, scheme facts and the built-in fallback answers stay in English; the AI answers in the chosen language.
import { HI, PATTERNS } from './i18n-text.js';

export const LANGS = ['en', 'hi'];
export const SPEECH = { en: 'en-IN', hi: 'hi-IN' };
const DICT = { hi: HI };

export function trans(lang, text, vars) {
  const out = lang === 'en' ? text : DICT[lang]?.[text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : out;
}

/** Messages from the on-device checks that have a value inside ("“Email” does not look like an email address."). */
export function translateCheck(lang, text) {
  if (lang === 'en') return text;
  if (DICT[lang][text]) return DICT[lang][text];
  for (const [re, key] of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const vars = {};
    m.slice(1).forEach((v, i) => { vars[`v${i + 1}`] = v; });
    return trans(lang, key, vars);
  }
  return text;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'SELECT', 'INPUT']);
const ATTRS = ['aria-label', 'title', 'placeholder'];
// A text node plus <br> is the only markup a translatable element may contain.
const plain = (node) => [...node.childNodes].every((c) => c.nodeType === 3 || c.nodeName === 'BR');
const readText = (node) => [...node.childNodes].map((c) => (c.nodeName === 'BR' ? '\n' : c.textContent)).join('').replace(/[ \t]*\n[ \t]*/g, '\n').trim();
function writeText(node, text) {
  node.replaceChildren(...text.split('\n').flatMap((part, i) => (i ? [document.createElement('br'), document.createTextNode(part)] : [document.createTextNode(part)])));
}

/**
 * Translates the panel's fixed text in place (and back to English). An element is only rewritten while it still shows
 * what this function last put there, so text the panel set itself (page status, file names) is never overwritten.
 */
export function applyStatic(root, lang) {
  for (const node of root.querySelectorAll('*')) {
    if (!SKIP.has(node.tagName) && plain(node) && node.childNodes.length) {
      const shown = readText(node);
      const rec = node.dataset.i18n ? JSON.parse(node.dataset.i18n) : null;
      const en = rec && rec.shown === shown ? rec.en : shown;
      // Text the panel set itself since the last pass is already in the right language.
      if (en && (!rec || rec.shown === shown)) {
        const next = trans(lang, en);
        if (next !== shown) writeText(node, next);
        if (next !== en || rec) node.dataset.i18n = JSON.stringify({ en, shown: next });
      }
    }
    for (const attr of ATTRS) {
      const v = node.getAttribute(attr);
      if (!v) continue;
      const key = `i18n${attr.replace(/-/g, '')}`;
      const rec = node.dataset[key] ? JSON.parse(node.dataset[key]) : null;
      const en = rec && rec.shown === v ? rec.en : v;
      const next = trans(lang, en);
      if (next !== v) node.setAttribute(attr, next);
      if (next !== en || rec) node.dataset[key] = JSON.stringify({ en, shown: next });
    }
  }
}

import { PORTAL, sourceNoteFor } from './portal.js';
import { asksToHandleSecret, mentionsPrivate, sharesSecret } from './sensitive.js';

export const FALLBACK = "I don't have verified information for that. Please check the official MahaDBT page.";

// Letters (including Devanagari and its vowel marks) and digits survive; everything else becomes a space.
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const sameLink = (link, label) => { const a = norm(link), b = norm(label); return !!b && (a === b || a.includes(b)); };

// Capability requests are handled locally: document bytes never enter the AI request.
export function documentAssistance(message) {
  const q = String(message || '').toLowerCase();
  if (mentionsPrivate(q) || /\b(submit|pay)\b|सबमिट|भुगतान/.test(q)) return null;
  const wantsAttachment = /\b(upload|uplode|uplod|attach)\b|अपलोड|अटैच/.test(q);
  const requestsHelp = /\b(you|help|can|will|please|my|mine|myn|give|do it)\b|आप|मेरे|मेरा|कर दो|कर सकते/.test(q);
  if (!wantsAttachment || !requestsHelp) return null;
  return {
    kind: 'action',
    text: /[ऀ-ॿ]/.test(q)
      ? 'हाँ, मैं मदद कर सकता हूँ। पहले दस्तावेज़ चुनें; फ़ाइल की बुनियादी जाँच आपके डिवाइस पर होगी। पोर्टल का दस्तावेज़ वाला पेज खोलें और Refresh दबाएँ। फिर सही फ़ील्ड में फ़ाइल चुनने की अनुमति दें। कुछ पोर्टल फ़ाइल चुनते ही अपलोड करते हैं। अलग दस्तावेज़ Upload बटन मिलने पर आपकी अनुमति से मैं उसे दबा सकता हूँ। पोर्टल का परिणाम जाँचें; आवेदन का अंतिम Submit आप करेंगे।'
      : 'Yes—I can help attach your document. Choose a file for a basic check on this device. Open the portal’s document step, then select Refresh. Choose the matching upload field and confirm before I place your file there. Some portals upload immediately when a file is selected. I can also press a separate document Upload button after confirmation, when it is clearly linked to this field. You check the portal’s result and submit the application yourself.',
    actions: [{ type: 'scan-uploads' }],
  };
}

/** Menu/link labels the guide is allowed to take the student to (never actions like submit/pay/logout). */
export const BLOCKED_LINK = /log\s*out|sign\s*out|delete|remove|\bpay(ment)?\b|submit|final|confirm|cancel/i;

/**
 * Deterministic, grounded reply for the MahaDBT panel.
 * ctx: { links: string[] visible link/menu texts on the page, uploads: {label}[], title }
 * returns { text, source?, actions?: [{type:'goto'|'scan-form'|'scan-uploads', label?}], kind }
 */
export function respond(message, ctx = {}, portal = PORTAL) {
  const q = norm(message);
  const links = ctx.links || [];
  const src = sourceNoteFor(portal);
  const labels = portal.labels || {};
  const ext = ctx.external || [];
  if (!q) return { kind: 'fallback', text: `Ask me where to go on ${portal.name}, what a page needs, or to check the form on this page.` };

  // Secrets are refused before anything else, so a greeting or question around them cannot slip through.
  if (sharesSecret(message) || asksToHandleSecret(message)) {
    return { kind: 'safety', text: 'Please do not share passwords, OTPs, CAPTCHA, Aadhaar or bank details with me. I never need them and cannot enter them for you. You type them on the portal yourself.' };
  }
  if (/^(hi|hii|hello|hey|namaste|namaskar|good (morning|afternoon|evening))\b/.test(q) && q.split(' ').length <= 4) {
    return { kind: 'answer', text: `Hello! I can explain ${portal.name} pages, take you to a visible menu, check the fields on this page, and check your documents on this device. What would you like to do?` };
  }
  if (/\b(submit|pay)\b.*\b(for me|on my behalf)\b|\bfill\b.*\b(for me|my form)\b|auto ?(fill|submit)/.test(q)) {
    return { kind: 'safety', text: 'I do not fill or submit the application for you. I can explain fields, check what you entered, and take you to the right page. You enter the details and click submit yourself.' };
  }

  const attachment = documentAssistance(message);
  if (attachment) return attachment;

  const go = /\b(take me|go to|open|show me|navigate)\b/.test(q);
  if (portal.id === 'tribal' && /\b(status|track|profile)\b/.test(q)) return { kind: 'answer', text: 'This Ministry information page does not show your application account. Open the official application portal for your scheme to check your profile or application status.', source: src };

  if (/\b(check|scan|review|verify)\b.*\b(form|page|application|fields)\b|\bmistake/.test(q)) {
    return { kind: 'action', text: 'I will scan the fields on this page for empty required fields and obvious format problems. Sensitive fields (password, OTP, CAPTCHA, Aadhaar, bank) are skipped and their values are never read.', actions: [{ type: 'scan-form' }] };
  }
  if (/\b(document|upload|attach|certificate|file)s?\b/.test(q)) {
    const n = (ctx.uploads || []).length;
    return {
      kind: 'action',
      text: `${portal.facts.documents}${n ? ` This page has ${n} upload field(s): ${(ctx.uploads || []).map((u) => u.label).join('; ')}.` : ' I do not see an upload field on this page.'}`,
      source: src,
      actions: [{ type: 'scan-uploads' }],
    };
  }
  if (/\b(forgot|reset)\b/.test(q)) return { kind: 'answer', text: portal.facts.forgot, source: src };
  if (portal.id === 'tribal' && /\b(register|registration|sign ?up|new user|otr|login|log in|sign in)\b/.test(q)) return { kind: 'answer', text: portal.facts.register, source: src };
  if (/\b(register|registration|sign ?up|new user|otr)\b/.test(q)) return goOr(links, labels.register || (portal.id === 'nsp' ? 'OTR' : 'New Registration'), portal.facts.register, src, ext);
  if (/\b(login|log in|sign in)\b/.test(q)) {
    // Explaining how to log in never moves the page; only an explicit "take me to login" does.
    return go ? goOr(links, labels.login || 'Login', portal.facts.login, src, ext) : { kind: 'answer', text: portal.facts.login, source: src };
  }
  if (/pre ?matric/.test(q)) return { kind: 'answer', text: portal.facts.preMatric, source: src };
  if (/post ?matric/.test(q)) return portal.id === 'nsp' ? goOr(links, 'Schemes on NSP', portal.facts.postMatric, src, ext) : goOr(links, portal.id === 'tribal' ? 'Post Matric' : 'Post Matric Scholarship', portal.facts.postMatric, src, ext);
  if (portal.id === 'tribal' && /\bmy applied|applied scheme|my application|track|status|profile\b/.test(q)) return { kind: 'answer', text: 'This Ministry information page does not show your application account. Open the official application portal for your scheme to check your profile or application status.', source: src };
  if (/\bmy applied|applied scheme|my application|track|status\b/.test(q)) return portal.id === 'nsp'
    ? { kind: 'answer', text: 'Use the Students section to sign in and check your application status. I cannot see an account status from this page.', source: src }
    : goOr(links, 'My Applied Scheme', 'Your submitted applications and their status are under “My Applied Scheme” on the dashboard (after login).', src, ext);
  if (/\ball schemes|apply|schemes?\b|where.*(start|apply)/.test(q)) return goOr(links, labels.schemes || (portal.id === 'nsp' ? 'Schemes on NSP' : 'All Schemes'), portal.facts.schemes, src, ext);
  if (/\bprofile\b/.test(q)) return goOr(links, 'Profile', 'Complete your Profile first; scheme forms usually reuse it (verify on the portal).', src, ext);
  if (/\bhome\b|main page/.test(q)) return goOr(links, labels.home || 'Home', 'The Home link takes you to the portal landing page.', src, ext);

  if (go) {
    const hit = links.find((l) => q.includes(norm(l)) && norm(l).length > 3);
    if (hit && !BLOCKED_LINK.test(hit)) return { kind: 'navigate', text: `Taking you to “${hit}”.`, actions: [{ type: 'goto', label: hit }], source: src };
  }
  return { kind: 'fallback', text: portal.id === 'mahadbt' ? FALLBACK : `I don't have verified information for that. Please check the official ${portal.name} page.` };
}

function goOr(links, wanted, text, source, external = []) {
  const options = [].concat(wanted);
  const label = options.find((option) => links.some((l) => sameLink(l, option)));
  if (label) return { kind: 'navigate', text: `${text}\n\nI can take you to “${label}” from here.`, source, actions: [{ type: 'goto', label }] };
  // Some menu items open a different official website; the guide never follows those, so it says where to click.
  const outside = options.find((option) => external.some((l) => sameLink(l, option)));
  if (outside) return { kind: 'answer', text: `${text}\n\nLook for “${outside}” on this page. It opens a different official website, so I cannot open it for you; click it yourself.`, source };
  return { kind: 'answer', text: `${text}\n\n(I do not see a “${options[0]}” link on this page.)`, source };
}

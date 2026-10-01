import { PORTAL, portalForHost, sourceNoteFor } from './lib/portal.js';
import { respond, documentAssistance } from './lib/rules.js';
import { acceptsFile, checkDocument, checkFields, detectType, fieldFit, isSensitive, rankSlots, summarise } from './lib/checks.js';
import { handoffMessage, isFresh } from './lib/handoff.js';
import { HIDDEN_TEXT, asksToHandleSecret, sharesSecret } from './lib/sensitive.js';
import { buildReadiness } from './lib/readiness.js';
import { applyStatic, trans, translateCheck } from './lib/i18n.js';
import { placementProblem } from './lib/document-policy.js';
import { renderDocumentPages } from './pdf.bundle.js';
import { navigateSteps, pageFingerprint } from './lib/navigation.js';
import { speakChunks, stopSpeech } from './lib/speech.js';
import { spokenLanguage, recognitionTranscript } from './lib/recognition.js';

let API = 'https://tribalsaarthi.vercel.app/api';
// Developers can point the panel at a local server (only localhost is accepted) with chrome.storage.local.tsApiBase.
const apiReady = chrome.storage.local.get('tsApiBase').then(({ tsApiBase }) => {
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}\/api$/.test(String(tsApiBase || ''))) API = tsApiBase;
}).catch(() => {});
let aiModel = '';
const $ = (id) => document.getElementById(id);
// Panel language and spoken language are kept in chrome.storage.local.
let LANG = 'en';
let SPOKEN = 'hi-IN';
const tr = (text, vars) => trans(LANG, text, vars);
const trc = (text) => translateCheck(LANG, text);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let tabId = null;
let portal = PORTAL;
let page = { links: [], title: '' };
let fields = [];
const docs = []; // { name, size, bytes, type, checks, hash } — memory only
const conversation = [];
let asking = false;
const panelBack = $('panel-back');
panelBack.addEventListener('click', () => { showTab('t-chat'); $('ask').focus(); });

// ---------- tabs ----------
for (const b of document.querySelectorAll('[role=tab]')) {
  b.addEventListener('click', () => {
    for (const t of document.querySelectorAll('[role=tab]')) {
      const on = t === b;
      t.setAttribute('aria-selected', String(on));
      $(t.getAttribute('aria-controls')).hidden = !on;
      if (on) window.TribalMotion?.reveal?.($(t.getAttribute('aria-controls')));
    }
    // Every tool tab needs a way back to the conversation; only the conversation itself does not.
    panelBack.hidden = b.id === 't-chat';
  });
}
const showTab = (id) => $(id).click();
const tabButtons = [...document.querySelectorAll('[role=tab]')];
for (const button of tabButtons) {
  button.tabIndex = button.getAttribute('aria-selected') === 'true' ? 0 : -1;
  button.addEventListener('click', () => { for (const tab of tabButtons) tab.tabIndex = tab === button ? 0 : -1; });
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabButtons.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabButtons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length;
    tabButtons[next].click(); tabButtons[next].focus();
  });
}

// ---------- talking to the page ----------
async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}
async function send(msg) {
  if (tabId == null) throw new Error('no-tab');
  const targetTab = tabId;
  try {
    return await chrome.tabs.sendMessage(targetTab, msg);
  } catch (e) {
    if (['upload-document', 'attach', 'goto'].includes(msg.type)) throw e; // Never retry mutations with an uncertain result.
    // The page script is missing (tab opened before the extension was installed/reloaded): inject it, retry once.
    const r = await chrome.runtime.sendMessage({ type: 'inject', tabId: targetTab }).catch(() => null);
    if (!r?.ok) throw e;
    await new Promise((res) => setTimeout(res, 250));
    return chrome.tabs.sendMessage(targetTab, msg);
  }
}
async function readPage() {
  fields = []; page = { links: [], title: '' };
  const t = await activeTab().catch(() => null);
  tabId = t?.id ?? null;
  let host = '';
  try { host = new URL(t.url).host; } catch { /* not a normal page */ }
  const currentPortal = portalForHost(host);
  if (!t || !currentPortal) {
    $('status').textContent = tr('Open MahaDBT, NSP or the Ministry of Tribal Affairs scholarship site to use the guide.');
    page = { links: [], title: '' }; fields = [];
    return false;
  }
  portal = currentPortal;
  try {
    const r = await send({ type: 'page-info' });
    if (!r?.ok || !r.info || !Array.isArray(r.fields)) throw new Error('Page unavailable');
    page = { ...r.info }; fields = r.fields;
    // Skip the page title when it only repeats the portal name.
    const title = (page.title || '').trim();
    const repeats = !title || title.toLowerCase().includes(portal.name.toLowerCase()) || (portal.id === 'nsp' && /\bNSP\b/.test(title));
    const shownPath = String(page.path || '').replace(/;[^/]*/g, '');
    const where = repeats ? (shownPath && shownPath !== '/' ? shownPath : '') : title;
    $('status').textContent = where ? `${portal.name} · ${where}` : portal.name;
    return true;
  } catch {
    $('status').textContent = tr('Reload the {portal} tab once so the guide can read it.', { portal: portal.name });
    return false;
  }
}
// Reads run one after another: two overlapping reads (tab switch + a question) could otherwise finish out of order
// and leave the fields of the wrong tab in memory.
let readQueue = Promise.resolve(true);
const refresh = () => (readQueue = readQueue.then(readPage, readPage));

async function pageChanged() {
  $('scan-summary').textContent = tr('Page changed — check again for current results.');
  lastScan = null; renderReadiness();
  $('issues').replaceChildren(); $('slots').replaceChildren();
  const ok = await refresh();
  renderQuick();
  await renderSlots(ok);
}
chrome.tabs.onActivated.addListener(pageChanged);
chrome.tabs.onUpdated.addListener((id, info) => { if (id === tabId && info.status === 'complete') pageChanged(); });

// The address sent to the AI service: the portal page only, never a query string, fragment or ";jsessionid=" style path parameter.
function portalPageUrl(raw) {
  try {
    const u = new URL(raw);
    return portalForHost(u.host) ? `${u.origin}${u.pathname.replace(/;[^/]*/g, '')}` : '';
  } catch { return ''; }
}

// ---------- chat ----------
const scrollLog = () => { $('log').scrollTop = $('log').scrollHeight; };
function addListen(m, text, source) {
  if (source) m.append(el('div', 'src', `${tr('Source')}: ${source}`));
  const listen = el('button', 'speak-reply');
  listen.type = 'button';
  listen.setAttribute('aria-label', tr('Listen to this answer'));
  listen.title = tr('Listen to this answer');
  listen.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/></svg>';
  listen.addEventListener('click', () => speakReply(text, listen));
  m.append(listen);
}
function say(text, who = 'bot', source) {
  $('welcome').hidden = true;
  $('p-chat').classList.add('has-conversation');
  const m = el('div', `msg ${who}`);
  m.append(document.createTextNode(text));
  if (who === 'bot') addListen(m, text, source);
  $('log').append(m);
  scrollLog();
}
/**
 * A guide turn that shows its work: a live list of steps ("Reading this page", "Asking the AI"…) that folds into one
 * line when done, followed by the answer streaming in. Falls back to plain text if the motion bundle is missing.
 */
function startTurn(title) {
  $('welcome').hidden = true;
  $('p-chat').classList.add('has-conversation');
  const m = el('div', 'msg bot turn');
  const host = el('div', 'proc-host');
  const answer = el('div', 'answer');
  m.append(host, answer);
  $('log').append(m);
  scrollLog();
  let proc = null;
  try { proc = window.TribalMotion?.mountProcess?.(host, { title }) || null; } catch { proc = null; }
  if (!proc) host.remove();
  const noop = () => {};
  const p = proc || { step: noop, done: noop, fail: noop, title: noop, collapse: noop };
  return {
    step: (...a) => { p.step(...a); scrollLog(); },
    done: p.done, fail: p.fail, title: p.title,
    /** Folds the steps, streams the answer in, then adds the source and the listen button. */
    async finish(text, source, summary) {
      p.collapse(summary);
      if (window.TribalMotion?.typeText) await window.TribalMotion.typeText(answer, text, { onProgress: scrollLog });
      else answer.textContent = text;
      addListen(m, text, source);
      scrollLog();
      return m;
    },
  };
}
let activeUtteranceButton = null;
async function speakReply(text, button) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    $('voice-status').hidden = false;
    $('voice-status').textContent = tr('Speech playback is not available in this browser.');
    return;
  }
  if (activeUtteranceButton === button) {
    stopSpeech(); button.classList.remove('speaking'); button.setAttribute('aria-label', tr('Listen to this answer')); activeUtteranceButton = null; return;
  }
  window.speechSynthesis.cancel();
  document.querySelectorAll('.speak-reply.speaking').forEach(b => b.classList.remove('speaking'));
  activeUtteranceButton = button;
  button.classList.add('speaking');
  button.setAttribute('aria-label', tr('Stop reading answer'));
  $('voice-status').hidden = false;
  try {
    await speakChunks(text, $('voice-language').value === 'hi-IN' ? 'hi-IN' : 'en-IN', status => { $('voice-status').textContent = status; });
    if (activeUtteranceButton === button) $('voice-status').hidden = true;
  } catch (error) { $('voice-status').hidden = false; $('voice-status').textContent = error.message; }
  finally {
    button.classList.remove('speaking'); button.setAttribute('aria-label', tr('Listen to this answer'));
    if (activeUtteranceButton === button) activeUtteranceButton = null;
  }
}
const GOTO_WHY = {
  blocked: 'that is a button I never press for you',
  'not-found': 'I cannot see that link on this page',
  'external-link': 'it opens a different website, so please open it yourself',
};
async function runActions(actions = []) {
  for (const a of actions) {
    if (a.type === 'goto') {
      const r = await send({ type: 'goto', label: a.label }).catch(() => ({ ok: false }));
      if (!r.ok) say(tr('I could not open “{label}”: {why}.', { label: a.label, why: tr(GOTO_WHY[r.reason] || 'the link is not available on this page') }));
    } else if (a.type === 'scan-form') {
      showTab('t-form');
      const result = await doScan();
      if (result) say(`${tr('I checked the visible form fields.')} ${result.summary}${result.findings.length ? `\n${result.findings.slice(0, 2).join('\n')}` : ''}`, 'bot');
    }
    else if (a.type === 'scan-uploads') { showTab('t-docs'); await renderSlots(); }
  }
}
async function continueNavigation(initial, question) {
  const owner = (await activeTab())?.id;
  const read = async () => {
    if ((await activeTab())?.id !== owner || !(await refresh())) return null;
    return { ...page, url: (await activeTab())?.url };
  };
  return navigateSteps({ initial, read,
    report: text => say(text),
    confirm: label => new Promise(resolve => {
      const box = el('div', 'msg bot');
      box.append(el('p', '', `Next step: open “${label}”?`));
      let timer;
      const finish = yes => { clearTimeout(timer); box.remove(); resolve(yes); };
      for (const [text, yes] of [['Continue', true], ['Stop', false]]) {
        const b = el('button', 'attach-btn', text); b.type = 'button'; b.onclick = () => finish(yes); box.append(b);
      }
      timer = setTimeout(() => finish(false), 60000);
      $('log').append(box); scrollLog();
    }),
    act: async (action, before) => {
      if ((await activeTab())?.id !== owner) return false;
      const result = await chrome.tabs.sendMessage(owner, { type: 'goto', label: action.label }).catch(() => null);
      if (!result?.ok) return false;
      const original = pageFingerprint(before);
      let stable = '', count = 0;
      for (let tick = 0; tick < 24; tick++) {
        await new Promise(r => setTimeout(r, 500));
        const after = await read();
        if (!after) { if ((await activeTab())?.id !== owner) return false; continue; }
        const value = pageFingerprint(after);
        if (value === original) continue;
        count = value === stable ? count + 1 : 1; stable = value;
        if (count >= 2) return true;
      }
      return false;
    },
    plan: async (_after, label) => askService(`Continue my original request: ${question}\nThe browser observed a page update after opening ${label}. Use ONLY the newly supplied page. If the requested destination is reached, answer without another navigation tool. Otherwise propose only the next necessary link. Stop if login or manual details are needed.`, uploadSlots()),
  });
}
async function checkPageFromChat() {
  say(tr('I’m checking the visible form fields now. Passwords, OTPs and other sensitive fields are skipped.'), 'bot');
  showTab('t-form');
  const result = await doScan();
  if (result) {
    const findings = result.findings.length ? `\n${result.findings.slice(0, 2).join('\n')}` : '';
    say(`${tr('Form check complete.')} ${result.summary}${findings}`, 'bot');
    showTab('t-chat');
  }
}
document.addEventListener('tribal:tool', (event) => {
  if (event.detail === 'check-form') void checkPageFromChat();
  if (event.detail === 'documents') showTab('t-docs');
  if (event.detail === 'upload') $('chat-pick').click();
});
const toolTrigger = $('tool-trigger');
const toolMenu = $('guide-tool-menu');
function closeToolMenu(restoreFocus = false) {
  toolMenu.hidden = true;
  toolTrigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) toolTrigger.focus();
}
toolTrigger.addEventListener('click', () => {
  const open = toolMenu.hidden;
  toolMenu.hidden = !open;
  toolTrigger.setAttribute('aria-expanded', String(open));
  if (open) window.TribalMotion?.reveal?.(toolMenu);
});
toolMenu.addEventListener('click', (event) => {
  const action = event.target.closest('[data-guide-tool]')?.dataset.guideTool;
  if (!action) return;
  closeToolMenu();
  document.dispatchEvent(new CustomEvent('tribal:tool', { detail: action }));
});
document.addEventListener('pointerdown', (event) => {
  if (!toolMenu.hidden && !event.target.closest('.tool-menu-wrap')) closeToolMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !toolMenu.hidden) closeToolMenu(true);
});

class AiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
// What a student reads when the AI service fails: a plain reason, never a raw exception or an operator message.
function aiErrorMessage(error) {
  const status = error?.status;
  if (status === 429) return tr('The AI guide is busy right now. Try again in a minute.');
  if (status >= 500) return tr('The AI guide has a problem on its side right now.');
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return tr('The AI guide took too long to reply.');
  if (error instanceof TypeError) return tr('I could not reach the AI guide. Check your internet connection.');
  return tr('The AI guide could not answer just now.');
}
async function askService(question, uploads) {
  await apiReady;
  const tab = await activeTab().catch(() => null);
  const response = await fetch(`${API}/assistant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      messages: [...conversation.slice(-15), { role: 'user', content: question }],
      page: { title: page.title, url: portalPageUrl(tab?.url), links: page.links, externalLinks: page.externalLinks || [], uploadLabels: uploads.map((f) => f.label).filter(Boolean) },
      context: { language: LANG },
    }),
  });
  let data = null;
  try { data = await response.json(); } catch { /* a gateway error page is not JSON */ }
  if (!response.ok || !data) {
    console.warn('[TribalSaarthi] AI service error', response.status, data?.error || '');
    throw new AiError(data?.error || `HTTP ${response.status}`, response.status);
  }
  return data;
}
async function ask(text, plain = text) {
  const q = text.trim();
  const rq = plain.trim();
  if (!q || asking) return;
  asking = true;
  stopSpeech();
  $('send').disabled = true;
  try {
    // Secrets never leave the panel: the built-in rules answer, the AI service is not called, and the value is
    // neither shown again nor kept in the conversation.
    const secret = sharesSecret(q);
    if (secret || asksToHandleSecret(q)) {
      say(secret ? HIDDEN_TEXT : q, 'me');
      say(respond(rq, {}, portal).text, 'bot');
      return;
    }
    say(q, 'me');
    const turn = startTurn(tr('Working on your question'));
    turn.step('read', tr('Reading this {portal} page', { portal: portal.name }));
    const ok = await refresh();
    if (ok) turn.done('read', tr('{a} menu items · {b} form fields', { a: page.links.length, b: fields.length }));
    else turn.fail('read', tr('Open MahaDBT or NSP in this tab for page help'));
    const uploads = fields.filter((f) => f.type === 'file');

    const attachment = documentAssistance(rq);
    if (attachment && !/take me|go to|navigate|open.*page|ले चल|पेज खोल/i.test(rq)) {
      turn.step('rules', tr('Matched a built-in answer about documents'));
      conversation.push({ role: 'user', content: q }, { role: 'assistant', content: attachment.text });
      await turn.finish(attachment.text);
      await runActions(attachment.actions);
      return;
    }
    let data;
    turn.step('ai', tr('Asking the TribalSaarthi AI'), aiModel ? `${aiModel} · ${tr('only your question and page menu names are sent')}` : tr('Only your question and page menu names are sent'));
    try {
      data = await askService(q, uploads);
    } catch (error) {
      turn.fail('ai', aiErrorMessage(error));
      const local = respond(rq, { links: page.links, external: page.externalLinks || [], uploads }, portal);
      turn.step('rules', tr('Using the built-in guide instead'));
      setAI('off', tr('AI guide unavailable — using local answers'));
      await turn.finish(`${aiErrorMessage(error)} ${tr('Here is what the built-in guide can tell you (in English):')}\n\n${local.text}`, local.source, tr('AI unavailable · answered from the built-in guide'));
      await runActions(local.actions);
      return;
    }
    turn.done('ai');
    setAI('on', tr('AI guide connected'));
    const actions = data.actions || [];
    for (const a of actions) {
      if (a.type === 'goto') turn.step(`act-${a.label}`, tr('Opening “{label}” on the page', { label: a.label }));
      else if (a.type === 'scan-form') turn.step('act-form', tr('Checking the form on this page'));
      else if (a.type === 'scan-uploads') turn.step('act-docs', tr('Opening your documents'));
    }
    const reply = data.text || tr('I could not find a clear answer. Which section do you mean?');
    conversation.push({ role: 'user', content: q }, { role: 'assistant', content: reply });
    await turn.finish(reply);
    if (actions[0]?.type === 'goto') {
      const final = await continueNavigation(data, q);
      if (final) { if (final.text) say(final.text); await runActions(final.actions || []); }
    } else await runActions(actions);
  } catch (error) {
    say(error?.message || 'The action could not be completed. Please try again.');
  } finally {
    asking = false;
    $('send').disabled = false;
  }
}
$('composer').addEventListener('submit', (e) => { e.preventDefault(); if (asking || !$('ask').value.trim()) return; const v = $('ask').value; $('ask').value = ''; $('ask').style.height = ''; ask(v); });
$('ask').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('composer').requestSubmit(); }
});
$('ask').addEventListener('input', () => { $('ask').style.height = 'auto'; $('ask').style.height = `${Math.min($('ask').scrollHeight, 140)}px`; });
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceButton = $('voice-input');
let recognition = null;
let recognitionActive = false;
let recognitionStarting = false;
let voiceConsentGiven = false;
let voiceBaseText = '';
let listeningMotion = null;
if (!SpeechRecognition) {
  voiceButton.disabled = true;
  voiceButton.title = tr('Speech recognition is not available in this browser');
  $('voice-status').hidden = false;
  $('voice-status').textContent = tr('Voice input is unavailable here. You can still type your question.');
}
  const LISTENING = {
    'hi-IN': 'सुन रहा है… बोलना समाप्त होने पर रुकें।',
    'en-IN': 'Listening… Stop when you have finished speaking.',
};
function initRecognition() {
  recognition = new SpeechRecognition();
  recognition.lang = SPOKEN;
  // Allow a longer pause for Hindi dictation without cutting off a sentence.
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  let quiet = 0;
  let failed = false;
  const stopAfter = (ms) => { clearTimeout(quiet); quiet = setTimeout(() => recognition?.stop(), ms); };
  recognition.onstart = () => {
    stopAfter(10000);
    recognitionActive = true;
    recognitionStarting = false;
    $('voice-language').disabled = true;
    voiceButton.classList.add('listening');
    voiceButton.setAttribute('aria-label', tr('Stop listening'));
    $('voice-status').hidden = false;
    $('voice-status').textContent = LISTENING[SPOKEN];
    listeningMotion = window.TribalMotion?.setListening?.(voiceButton, true);
  };
  recognition.onresult = event => {
    stopAfter(SPOKEN === 'en-IN' ? 2500 : 4000);
    $('ask').value = recognitionTranscript(event.results, voiceBaseText);
    $('ask').dispatchEvent(new Event('input', { bubbles: true }));
  };
  recognition.onerror = event => {
    failed = true;
    const messages = {
      'not-allowed': tr('Microphone access is blocked. Allow microphone access for this extension in Chrome settings.'),
      'service-not-allowed': tr('Chrome’s speech service is unavailable. You can type your question instead.'),
      'audio-capture': tr('No microphone was found. Connect a microphone or type your question.'),
      'no-speech': tr('No speech detected. Tap the microphone and try again.'),
      network: tr('Speech recognition needs an internet connection. Your typed chat is still available.'),
    };
    $('voice-status').hidden = false;
    $('voice-status').textContent = messages[event.error] || tr('Could not recognize that speech. Please try again or type your question.');
    if (event.error === 'language-not-supported' || event.error === 'language-unavailable') {
      $('voice-status').textContent = SPOKEN === 'hi-IN'
        ? 'इस ब्राउज़र में हिन्दी पहचान उपलब्ध नहीं है। Chrome अपडेट करें और इंटरनेट कनेक्शन जाँचें। आप हिन्दी में टाइप भी कर सकते हैं।'
        : 'The speech service does not support the selected language here. Update Chrome and check your connection, or type your message.';
    }
    if (event.error === 'not-allowed') openMicSetup();
  };
  recognition.onend = () => {
    clearTimeout(quiet);
    recognitionActive = false;
    recognitionStarting = false;
    $('voice-language').disabled = false;
    voiceButton.classList.remove('listening');
    voiceButton.setAttribute('aria-label', tr('Speak your message'));
    listeningMotion?.stop?.();
    listeningMotion = null;
    if (!failed && $('ask').value.trim() !== voiceBaseText) $('voice-status').textContent = SPOKEN === 'hi-IN' ? 'आपकी बात लिख दी गई है। पढ़कर जाँच लें, फिर भेजें।' : tr('Words added. Review them, then send your message.');
    else if (!failed) $('voice-status').textContent = tr('No speech detected. Tap the microphone and try again.');
  };
}
// Chrome cannot show its microphone prompt inside a side panel, which is why voice input failed with "not-allowed".
// The permission is asked once in a normal extension tab (mic.html); after that the panel can listen.
async function micState() {
  try { return (await navigator.permissions.query({ name: 'microphone' })).state; } catch { return 'prompt'; }
}
function openMicSetup() {
  chrome.tabs.create({ url: chrome.runtime.getURL('mic.html') }).catch(() => {});
  $('voice-status').hidden = false;
  $('voice-status').textContent = tr('A tab opened to allow the microphone. Choose Allow there, then press the microphone here again.');
}
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'mic-permission') return;
  $('voice-status').hidden = false;
  $('voice-status').textContent = msg.granted
    ? tr('Microphone allowed. Press the microphone and speak in English or Hindi.')
    : tr('The microphone is still blocked. Allow it in the tab that opened, or type your question.');
});
voiceButton.addEventListener('click', async () => {
  if (!SpeechRecognition) return;
  if (recognitionActive) { recognition?.stop(); return; }
  if (recognitionStarting) return;
  recognitionStarting = true;
  try {
  if (!voiceConsentGiven) {
    const choice = await ask3($('voice-consent'));
    if (choice !== 'start') return;
    voiceConsentGiven = true;
  }
  if ((await micState()) !== 'granted') { openMicSetup(); return; }
  voiceBaseText = $('ask').value.trim();
  initRecognition();
  stopSpeech();
  $('voice-language').disabled = true;
  try { recognition.start(); }
  catch { $('voice-language').disabled = false; $('voice-status').hidden = false; $('voice-status').textContent = tr('Could not start the microphone. Check Chrome’s microphone permission and try again.'); }
  } finally { if (!$('voice-language').disabled) recognitionStarting = false; }
});
$('voice-language').addEventListener('change', () => {
  SPOKEN = spokenLanguage($('voice-language').value);
  $('voice-language').value = SPOKEN;
  chrome.storage.local.set({ tsSpeechLang: SPOKEN }).catch(() => {});
  $('voice-status').hidden = false;
  $('voice-status').textContent = SPOKEN === 'hi-IN' ? 'हिन्दी चुनी गई है। माइक दबाकर हिन्दी में बोलें।' : 'English selected. Press the microphone and speak.';
});
function renderQuick() {
  $('quick').replaceChildren();
  for (const q of ['Where do I register?', portal.id === 'tribal' ? 'What schemes are on this page?' : portal.id === 'nsp' ? 'Take me to Schemes on NSP' : 'Take me to All Schemes', 'What documents does this page need?', 'Check this form']) {
    const b = el('button', '', tr(q)); b.type = 'button'; b.addEventListener('click', () => ask(tr(q), q)); $('quick').append(b);
  }
}

// ---------- form check ----------
async function doScan() {
  const button = $('scan');
  if (button.disabled) return null;
  button.disabled = true; button.textContent = tr('Checking…');
  $('scan-summary').textContent = tr('Reading the current page…');
  const ul = $('issues'); ul.replaceChildren();
  try {
    if (!(await refresh())) throw new Error(tr('Could not read the portal. Open a supported portal tab, reload it, and try again.'));
    const sens = fields.map(f => ({ ...f, sensitive: f.sensitive || isSensitive(f) }));
    const s = summarise(sens);
    const issues = checkFields(sens);
    $('scan-summary').textContent = s.total ? tr('{a} fields · {b} missing · {c} private fields skipped', { a: s.total, b: s.requiredEmpty, c: s.sensitiveSkipped }) : tr('No form found on this page');
    if (!s.total || s.total === s.sensitiveSkipped) {
      const empty = el('li', 'empty-state');
      empty.append(el('strong', '', s.total ? tr('Only private fields found') : tr('Open your application form first')), el('p', '', s.total ? tr('Passwords, OTPs and identity fields are excluded. Complete those yourself on the portal.') : tr('This page has no visible editable fields to check. Go to the application form, then check again.')));
      ul.append(empty);
    } else if (!issues.length) {
      ul.append(el('li', 'card ok', tr('No basic issues detected in the visible fields. Review your entries yourself; this is not confirmation that the application is correct.')));
    }
    const findings = [];
    for (const i of issues) {
      findings.push(trc(i.text));
      const li = el('li', `card ${i.level}`, trc(i.text));
      const b = el('button', '', tr('Show field')); b.type = 'button';
      const checkedTab = tabId, checkedPath = page.path;
      b.addEventListener('click', async () => {
        if (!(await refresh()) || tabId !== checkedTab || page.path !== checkedPath) { b.textContent = tr('Page changed — check again'); b.disabled = true; return; }
        const result = await send({ type: 'highlight', id: i.id }).catch(() => null);
        if (!result?.ok) b.textContent = tr('Field changed — check again');
      });
      li.append(document.createElement('br'), b); ul.append(li);
    }
    lastScan = { issues, fields: sens };
    renderReadiness();
    return { summary: $('scan-summary').textContent, findings };
  } catch (error) {
    $('scan-summary').textContent = tr('Check unavailable');
    ul.append(el('li', 'card warn', error.message));
    return { summary: error.message, findings: [] };
  } finally { button.disabled = false; button.textContent = tr('Check this page →'); }
}
$('scan').addEventListener('click', doScan);
$('diag').addEventListener('click', async () => {
  if (!(await refresh())) { $('diag-out').value = tr('Open a supported official portal first.'); return; }
  const r = await send({ type: 'diagnostics' }).catch(() => null);
  $('diag-out').value = r?.ok ? JSON.stringify(r.data, null, 2) : tr('Could not read the page. Reload the portal tab and try again.');
});
$('diag-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('diag-out').value); $('diag-copy').textContent = tr('Copied'); } catch { $('diag-out').select(); }
});

// ---------- documents ----------
async function sha(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function dims(file, bytes) {
  const realType = detectType(bytes);
  if (!realType?.startsWith('image/')) return undefined;
  file = new Blob([bytes], { type: realType });
  try { const b = await createImageBitmap(file); const d = { w: b.width, h: b.height }; b.close(); return d; } catch { return { invalid: true }; }
}
// Resolves with the clicked button's value (or "cancel" on Esc/close). Uses click handlers so it does not
// depend on the dialog "close" event alone.
function ask3(dlg) {
  if (dlg.open) return Promise.resolve('cancel');
  return new Promise((res) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      dlg.removeEventListener('close', onClose);
      dlg.removeEventListener('click', onClick);
      res(v);
    };
    const onClose = () => finish(dlg.returnValue || 'cancel');
    const onClick = (e) => { const b = e.target.closest('button[value]'); if (b && !b.disabled) finish(b.value); };
    dlg.addEventListener('close', onClose);
    dlg.addEventListener('click', onClick);
    dlg.returnValue = '';
    dlg.showModal();
  });
}
function askConsent(name) {
  $('c-file').textContent = name;
  return ask3($('consent'));
}
// One path for every way a student can hand over a file: the Documents tab, the chat "+" menu, or drag and drop.
// The student is asked for consent for each file; the check runs on this device.
let checkingFile = false;
const AI_SCAN_MAX = 3_000_000;
const toBase64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const uploadSlots = () => fields.filter((f) => f.type === 'file' && !f.disabled && !f.sensitive);
/** Sends ONE file the student chose "Scan with AI" for. The server returns only its type, readability and best field. */
async function scanWithAI(doc, labels) {
  await apiReady;
  const pages = doc.type === 'application/pdf' ? await renderDocumentPages(doc.bytes) : [{ mime: doc.type, b64: toBase64(doc.bytes) }];
  const response = await fetch(`${API}/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(50000),
    body: JSON.stringify({ name: doc.name, pages, fields: labels,
      requirements: uploadSlots().filter(f => f.requirements).map(f => ({ label: f.label, text: f.requirements })),
      context: { language: LANG } }),
  });
  let data = null;
  try { data = await response.json(); } catch { /* not JSON */ }
  if (!response.ok || !data?.kind) throw new AiError(data?.error || `HTTP ${response.status}`, response.status);
  return data;
}
async function handleFile(file, origin) {
  const inChat = origin === 'chat';
  const tell = (text) => { $('doc-status').textContent = text; if (inChat) say(text, 'bot'); };
  if (checkingFile) return;
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) { tell(tr('I can check PDF, JPG or PNG files. Please choose one of those.')); return; }
  if (file.size > 20 * 1024 * 1024 || docs.reduce((n, d) => n + d.size, 0) + file.size > 40 * 1024 * 1024) {
    tell(tr('Local check limit: 20 MB per file and 40 MB total. Remove a file or choose a smaller one. This is not the portal’s upload limit.'));
    return;
  }
  checkingFile = true;
  let turn = null;
  try {
    const choice = await askConsent(`${file.name} (${Math.round(file.size / 1000)} KB)`);
    if (choice !== 'scan' && choice !== 'local') return;
    $('doc-status').textContent = tr('Checking your file…');
    if (inChat) turn = startTurn(tr('Checking “{name}”', { name: file.name }));
    turn?.step('local', tr('Checking the file on this device'), tr('File type, size and image quality'));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = await sha(bytes);
    if (docs.some(d => d.hash === hash && !d.scanError)) {
      turn?.fail('local', tr('Already checked'));
      const text = tr('This file is already in your checked documents.');
      $('doc-status').textContent = text;
      if (turn) await turn.finish(text);
      return;
    }
    const checks = checkDocument({ name: file.name, size: file.size, bytes, dims: await dims(file, bytes) }, portal.docLimits);
    const doc = { name: file.name, size: file.size, type: detectType(bytes) || file.type, bytes, hash, checks, scanRequested: choice === 'scan' };
    const problems = checks.filter((c) => c.level === 'error' || c.level === 'warn').length;
    const broken = checks.some((c) => c.level === 'error');
    turn?.done('local', problems ? (problems > 1 ? tr('{n} things to look at', { n: problems }) : tr('1 thing to look at')) : tr('Looks fine'));
    if (choice === 'scan' && !broken) {
      turn?.step('ai', tr('Reading the document with AI'), tr('Sent once to the TribalSaarthi AI service, never stored'));
      if (doc.type !== 'application/pdf' && doc.size > AI_SCAN_MAX) { doc.scanError = tr('The file is over 3 MB, which is too large for the AI scan'); turn?.fail('ai', tr('Over 3 MB, so only the device check ran')); }
      else {
        await refresh();
        try {
          doc.reviewScope = JSON.stringify([portal.id, page.path, uploadSlots().map(f => [f.label, f.requirements || ''])]);
          doc.scan = await scanWithAI(doc, uploadSlots().map((f) => f.label).filter(Boolean));
          turn?.done('ai', `${doc.scan.label}${doc.scan.readable ? ` · ${tr('readable')}` : ` · ${tr('may be hard to read')}`}`);
        } catch (error) {
          // A 404 means the TribalSaarthi server has not been updated with the scan service yet.
          doc.scanError = error?.status === 404 ? tr('The AI scan is not switched on yet on the TribalSaarthi server') : (error?.message || aiErrorMessage(error)).replace(/[.।]$/, '');
          turn?.fail('ai', `${doc.scanError}. ${tr('Checked on this device only.')}`);
        }
      }
    }
    const previous = docs.findIndex(d => d.hash === hash);
    if (previous >= 0) docs.splice(previous, 1);
    docs.push(doc);
    renderDocs();
    $('doc-status').textContent = tr('File checked. Review the findings below.');
    await renderSlots();
    if (inChat) await reportFile(doc, turn);
  } catch {
    if (turn) await turn.finish(tr('Could not read this file. Try selecting it again or use a different file.'));
    else tell(tr('Could not read this file. Try selecting it again or use a different file.'));
  }
  finally { checkingFile = false; }
}
/** The field this file most likely belongs in: the AI's choice when it named one, otherwise the best name match. */
function pickBest(doc, slots) {
  if (doc.scan?.field) {
    const named = slots.find((s) => s.label === doc.scan.field);
    if (named) return named;
  }
  const ranked = rankSlots(`${doc.name} ${doc.scan?.label || ''}`, slots);
  return ranked[0]?.fit > 0 && (ranked.length === 1 || ranked[1].fit < ranked[0].fit) ? ranked[0] : null;
}
async function reportFile(doc, turn) {
  const scan = doc.scan;
  // Only errors and warnings are problems; "info" lines (page count, image size, "passed") are not.
  const problems = [...doc.checks.filter((c) => c.level === 'error' || c.level === 'warn').map((c) => trc(c.text)), ...(scan?.issues || [])];
  const blocked = placementProblem(doc);
  const broken = !!blocked;
  const lines = [];
  if (blocked) lines.push(blocked);
  if (scan?.review?.length) {
    lines.push('Review against requirements shown on this portal:');
    for (const r of scan.review) lines.push(`${r.status.toUpperCase()} · ${r.label}: ${r.requirement}\n${r.reason}`);
  } else if (scan) lines.push('No explicit upload requirements were found here. Scheme compliance has not been checked.');
  if (scan) lines.push('Authenticity, issuer records and consistency with your other documents still require verification. This is not an officer’s approval.');
  if (scan) lines.push(`${tr('This looks like your {label}.', { label: scan.label.toLowerCase() })}${scan.readable ? ` ${tr('It is clear enough to read.')}` : ` ${tr('It may be hard to read, so a clearer scan is safer.')}`}`);
  else lines.push(doc.scanError ? tr('{why}, so I checked “{name}” on this device only.', { why: doc.scanError, name: doc.name }) : tr('I checked “{name}” on this device.', { name: doc.name }));
  if (problems.length) lines.push(`${tr('Please look at these:')}\n${problems.map((p) => `• ${p}`).join('\n')}`);
  else if (!scan) lines.push(tr('Format, size and image size look fine for a basic check. This does not read the document or confirm it is accepted.'));
  turn?.step('fields', tr('Finding the right upload field on this page'));
  await refresh();
  const slots = broken ? [] : uploadSlots().filter((f) => acceptsFile(f.accept, doc.name, doc.type));
  const best = pickBest(doc, slots);
  if (broken) turn?.fail('fields', tr('Fix the file first'));
  else if (!slots.length) {
    turn?.fail('fields', tr('No upload field on this page yet'));
    lines.push(tr('Next step: this page has no place to upload documents. Open the page of your application where the portal asks for documents; I am watching, and as soon as the upload box appears I will offer to put this file in it.'));
  } else turn?.done('fields', best ? tr('Best match: “{label}”', { label: best.label }) : slots.length > 1 ? tr('{n} fields found', { n: slots.length }) : tr('1 field found'));
  const text = lines.join('\n\n');
  if (turn) await turn.finish(text, scan ? tr('AI document scan and on-device checks') : undefined, scan ? tr('Scanned with AI · {label}', { label: scan.label }) : undefined);
  else say(text, 'bot');
  if (broken) return;
  if (!slots.length) { watchForUploadFields(); return; }
  offerPlacement(doc, slots, best);
}
/** One click to place the file in the field it belongs to (that click is the student's confirmation). */
function offerPlacement(doc, slots, best) {
  if (placementProblem(doc)) { say(placementProblem(doc)); return; }
  const box = el('div', 'msg bot attach-offer');
  const slotTab = tabId, slotPath = page.path, slotDocument = page.documentId;
  const place = (slot, button) => { button.disabled = true; void confirmAttach({ ...slot, tabId: slotTab, path: slotPath, documentId: slotDocument }, doc, { asked: true }).finally(() => { button.disabled = false; }); };
  const fieldButton = (slot, cls = 'attach-btn') => {
    const b = el('button', cls, tr('Put in “{label}”', { label: slot.label || tr('Upload field') })); b.type = 'button';
    b.addEventListener('click', () => place(slot, b));
    return b;
  };
  if (best) {
    box.append(el('div', '', tr('Put “{name}” in “{label}”? Some portals upload as soon as a file is selected.', { name: doc.name, label: best.label })));
    const yes = el('button', 'attach-btn primary-offer', tr('Yes, put it in “{label}”', { label: best.label })); yes.type = 'button';
    yes.addEventListener('click', () => place(best, yes));
    box.append(yes);
    const others = slots.filter((s) => s.id !== best.id);
    if (others.length) {
      const more = el('button', 'attach-btn ghost-offer', tr('Choose another field')); more.type = 'button';
      more.addEventListener('click', () => { more.remove(); for (const s of others) box.append(fieldButton(s)); scrollLog(); });
      box.append(more);
    }
  } else {
    box.append(el('div', '', tr('Which field should this file go in? Some portals upload as soon as a file is selected.')));
    for (const s of rankSlots(doc.name, slots)) box.append(fieldButton(s));
  }
  $('log').append(box);
  scrollLog();
}
for (const [id, origin] of [['pick', 'docs'], ['chat-pick', 'chat']]) {
  $(id).addEventListener('change', (e) => {
    const input = e.target, file = input.files[0];
    input.value = '';
    if (file) void handleFile(file, origin);
  });
}
let dragDepth = 0;
document.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { dragDepth++; document.body.classList.add('dragging'); } });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dragging'); });
document.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
  showTab('t-chat');
  void handleFile(e.dataTransfer.files[0], 'chat');
});
function renderDocs() {
  const ul = $('docs'); ul.replaceChildren();
  if (!docs.length) { const empty = el('li', 'empty-state'); empty.append(el('strong', '', tr('Your files will appear here')), el('p', '', tr('Choose a document to see its local check results. You can prepare files before opening an upload page.'))); ul.append(empty); }
  docs.forEach((d, i) => {
    const worst = d.checks.some((c) => c.level === 'error') ? 'error' : d.checks.some((c) => c.level === 'warn') ? 'warn' : 'ok';
    const li = el('li', `card ${worst}`);
    li.append(el('strong', '', d.name), el('span', 'note', ` · ${Math.round(d.size / 1000)} KB · ${tr('checked on this device')}`));
    const cl = document.createElement('ul');
    for (const c of d.checks) cl.append(el('li', `lvl-${c.level}`, trc(c.text)));
    if (d.scanError) cl.append(el('li', 'lvl-error', d.scanError));
    for (const issue of d.scan?.issues || []) cl.append(el('li', 'lvl-error', issue));
    for (const r of d.scan?.review || []) cl.append(el('li', r.status === 'fail' ? 'lvl-error' : 'note', `${r.status.toUpperCase()} · ${r.requirement}: ${r.reason}`));
    const blocked = placementProblem(d);
    if (blocked) cl.append(el('li', 'lvl-error', blocked));
    li.append(cl);
    const next = el('div', 'next-steps');
    next.append(el('strong', '', tr('What happens next')));
    const steps = document.createElement('ol');
    for (const t of ['Open the portal page where this document is uploaded.', 'Press “Use this file on the portal” and confirm the destination field.', 'Choose “Upload this document” in chat. If a separate Upload control is available, I can press it after confirmation. Check the portal for its result.']) steps.append(el('li', '', tr(t)));
    next.append(steps);
    if (worst !== 'error' && !blocked) {
      const use = el('button', 'primary', tr('Use this file on the portal →')); use.type = 'button';
      use.addEventListener('click', () => useOnPortal(d));
      next.append(use);
    }
    li.append(next);
    const rm = el('button', '', tr('Remove')); rm.type = 'button'; rm.addEventListener('click', () => { docs.splice(i, 1); renderDocs(); renderSlots(); });
    li.append(rm); ul.append(li);
  });
  renderReadiness();
}
async function useOnPortal(d) {
  if (placementProblem(d)) { say(placementProblem(d)); return; }
  const ok = await refresh();
  const matching = ok ? fields.filter((f) => f.type === 'file' && !f.disabled && !f.sensitive && acceptsFile(f.accept, d.name, d.type)) : [];
  await renderSlots(ok);
  $('slots').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (matching.length) {
    $('doc-status').textContent = tr('Choose “Select ‘{name}’ on portal” under the field you want.', { name: d.name });
    return;
  }
  $('doc-status').textContent = tr('This page has no matching upload field yet. Open the portal step where documents are uploaded. I will show the button here as soon as it appears.');
  watchForUploadFields();
}
let slotWatch = null;
function watchForUploadFields() {
  clearInterval(slotWatch);
  let ticks = 0;
  slotWatch = setInterval(async () => {
    if (++ticks > 48 || !docs.length) { clearInterval(slotWatch); return; }
    if (!(await refresh())) return;
    if (!fields.some((f) => f.type === 'file' && !f.disabled && !f.sensitive)) return;
    clearInterval(slotWatch);
    await renderSlots(true);
    $('doc-status').textContent = tr('Upload field found. Choose “Select … on portal” below.');
    const doc = [...docs].reverse().find((d) => !placementProblem(d));
    const slots = doc ? uploadSlots().filter((f) => acceptsFile(f.accept, doc.name, doc.type)) : [];
    if (!doc || !slots.length) { say(tr('I found an upload field on this page. Open “+” → Review documents to place a checked file.'), 'bot'); return; }
    say(tr('I found an upload field on this page for “{name}”.', { name: doc.name }), 'bot');
    offerPlacement(doc, slots, pickBest(doc, slots));
  }, 2500);
}
// known: the result of a read the caller just made, so the page is not read twice in a row.
async function renderSlots(known) {
  const ul = $('slots'); ul.replaceChildren();
  const ok = typeof known === 'boolean' ? known : await refresh();
  if (!ok) { ul.append(el('li', 'empty-state', tr('Could not read the portal. Open a supported page and refresh to find upload fields.'))); return; }
  const slots = fields.filter((f) => f.type === 'file' && !f.disabled && !f.sensitive);
  if (!slots.length) { ul.append(el('li', 'empty-state', tr('No upload fields on this page. Open the application’s document step, then select Refresh. You can still check files here.'))); return; }
  const slotTab = tabId, slotPath = page.path, slotDocument = page.documentId;
  for (const s of slots) {
    const li = el('li', 'card', s.label || tr('Upload field'));
    if (s.accept) li.append(el('div', 'note', `${tr('Accepted here')}: ${s.accept}`));
    li.append(el('div', 'note', s.filled ? `${tr('Portal shows a file selected')}: ${s.fileName || tr('yes')}` : tr('No file selected yet')));
    const usable = docs.filter((d) => !placementProblem(d) && acceptsFile(s.accept, d.name, d.type));
    if (!usable.length) li.append(el('div', 'note', tr('Choose a file that passes basic checks and matches this field’s accepted types.')));
    for (const d of usable) {
      const b = el('button', '', `${tr('Select “{name}” on portal', { name: d.name })}${fieldFit(d.name, s.label) > 0 ? ` ${tr('(looks right)')}` : ''}`); b.type = 'button';
      b.addEventListener('click', () => confirmAttach({ ...s, tabId: slotTab, path: slotPath, documentId: slotDocument }, d));
      li.append(b);
    }
    const sh = el('button', '', tr('Show field')); sh.type = 'button'; sh.addEventListener('click', async () => {
      if (!(await refresh()) || tabId !== slotTab || page.path !== slotPath) { sh.textContent = tr('Page changed — refresh'); return; }
      const result = await send({ type: 'highlight', id: s.id }).catch(() => null);
      if (!result?.ok) sh.textContent = tr('Field unavailable — refresh');
    });
    li.append(sh); ul.append(li);
  }
}
const ATTACH_WHY = {
  'no-input': 'that upload field is no longer on the page',
  'private field': 'that field is for identity or bank details, which I never handle',
  'upload control is not visible': 'the upload control is hidden on the page',
  'file type not accepted by this field': 'that field does not accept this file type',
  'the portal did not keep the file in its field': 'the portal did not keep the file in its field',
};
async function confirmAttach(slot, d, { asked = false } = {}) {
  if (!docs.includes(d)) { say('This document was removed. Select it again before attaching it.'); return; }
  if (placementProblem(d)) { say(placementProblem(d)); return; }
  if (!asked) {
    $('a-text').textContent = tr('Select “{name}” in the field “{label}”?', { name: d.name, label: slot.label });
    if (await ask3($('attach')) !== 'yes') return;
  }
  if (!(await refresh()) || tabId !== slot.tabId || page.path !== slot.path || page.documentId !== slot.documentId || !fields.some(f => f.id === slot.id && f.type === 'file' && f.label === slot.label && !f.disabled)) { say(tr('The page or upload field changed. Refresh the document fields and choose the file again.')); showTab('t-chat'); return; }
  if (d.scan?.review?.length && d.reviewScope !== JSON.stringify([portal.id, page.path, uploadSlots().map(f => [f.label, f.requirements || ''])])) {
    say('The scheme page or its document requirements changed after this review. Remove the checked file and select it again to review against the current requirements.'); return;
  }
  const r = await send({ type: 'attach', id: slot.id, name: d.name, mime: d.type || 'application/octet-stream', b64: toBase64(d.bytes) }).catch(() => ({ ok: false }));
  if (r.ok && r.receiptId) void observeReceipt(slot.tabId, r.receiptId, d, false);
  say(r.ok ? tr('I selected “{name}” in “{label}”. Check the portal: it may upload automatically, or need a separate Upload click. You can request that below.', { name: d.name, label: slot.label }) : tr('I could not select the file: {why}. Please choose it in the portal yourself.', { why: tr(ATTACH_WHY[r.reason] || 'the field may have changed') }));
  showTab('t-chat');
  if (r.ok) {
    const box = el('div', 'msg bot attach-offer');
    box.append(el('div', '', tr('File selected. If this field has a separate Upload button, I can press it after you confirm. Check the portal for its result.')));
    const upload = el('button', 'attach-btn', tr('Upload this document')); upload.type = 'button';
    upload.addEventListener('click', async () => {
      upload.disabled = true;
      try {
        if (!(await refresh()) || tabId !== slot.tabId || page.path !== slot.path) throw new Error(tr('The page changed. Select the file again on the correct page.'));
        const targetTab = tabId;
        const offer = await send({ type: 'prepare-upload', id: slot.id });
        if (!offer?.ok) throw new Error(tr('No separate, unambiguous Upload button was found for this file. It may already be uploading. Check the portal and use its button if needed.'));
        $('upload-detail').textContent = tr('Upload “{name}” to {host} using its “{label}” button?', { name: offer.name, host: offer.host, label: offer.label });
        if (await ask3($('upload-confirm')) !== 'yes') return;
        if ((await activeTab())?.id !== targetTab) throw new Error(tr('The active tab changed. Return to the document page and try again.'));
        upload.textContent = tr('Requesting upload…');
        // Address the confirmed tab directly, with no injection or retry after an uncertain response.
        const result = await chrome.tabs.sendMessage(targetTab, { type: 'upload-document', token: offer.token });
        if (!result?.ok) throw new Error(tr('The file or Upload button changed. Check the portal before trying again.'));
        upload.textContent = tr('Upload requested');
        say(tr('I pressed the portal’s Upload button for this document. Check its success message or document list to confirm receipt. Your application has not been submitted.'));
        await observeReceipt(targetTab, result.receiptId, d, true);
        return;
      } catch (error) {
        say(`${error.message || tr('The upload result is unknown.')} ${tr('I will not retry automatically.')}`);
      } finally {
        if (upload.textContent !== tr('Upload requested')) { upload.disabled = false; upload.textContent = tr('Upload this document'); }
      }
    });
    box.append(upload);
    const show = el('button', 'attach-btn', tr('Show me the portal’s button')); show.type = 'button';
    show.addEventListener('click', async () => {
      const res = await send({ type: 'highlight-action', id: slot.id }).catch(() => null);
      show.textContent = res?.ok ? tr('Highlighted “{label}” on the page', { label: res.label }) : tr('I could not find it. Look for the Upload or Save button near the field.');
    });
    box.append(show);
    $('log').append(box);
    $('log').scrollTop = $('log').scrollHeight;
  }
  await renderSlots();
}
async function observeReceipt(targetTab, receiptId, doc, announceUnknown) {
  let status = 'unknown';
  for (let i = 0; receiptId && i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const result = await chrome.tabs.sendMessage(targetTab, { type: 'upload-result', receiptId }).catch(() => null);
    status = result?.status || 'unknown';
    if (status !== 'pending') break;
  }
  doc.uploadStatus = status === 'pending' ? 'unknown' : status;
  if (status === 'confirmed') say(`The portal displayed an upload-success message beside “${doc.name}”. This confirms the portal message, not scholarship approval.`);
  else if (status === 'failed') say(`The portal displayed an upload error for “${doc.name}”. Check the message beside its upload field.`);
  else if (announceUnknown) say(`I could not confirm receipt of “${doc.name}”. Check the portal’s document list before retrying. I will not upload it again automatically.`);
}
$('rescan').addEventListener('click', () => renderSlots());

// Greeting for a student who arrived from the TribalSaarthi website (scheme id only, valid 30 min, used once).
async function showHandoff() {
  try {
    const { tsHandoff } = await chrome.storage.local.get('tsHandoff');
    if (!isFresh(tsHandoff) || !portal.hosts.includes(tsHandoff.host)) return;
    await chrome.storage.local.remove('tsHandoff');
    say(handoffMessage(tsHandoff.id, portal), 'bot', `TribalSaarthi website handoff; ${sourceNoteFor(portal)}`);
  } catch { /* storage unavailable: skip the greeting */ }
}
// The panel may already be open when a new handoff arrives from the website.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.tsHandoff?.newValue) void refresh().then(showHandoff);
});

// Shows the extension version and whether the AI server is reachable, so a stale install or a stopped server is visible.
const VERSION = chrome.runtime.getManifest?.().version || '?';
function setAI(state, text) {
  const e = $('ai-status');
  e.className = `ai-status ${state}`;
  e.textContent = `v${VERSION} · ${text}`;
}
let lastHealthCheck = 0;
async function checkAI() {
  lastHealthCheck = Date.now();
  await apiReady;
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) });
    const h = await r.json();
    aiModel = String(h.model || '').replace(/^google\//, '');
    if (!h.keyConfigured) setAI('off', tr('AI guide off: no API key on the server — using local answers'));
    else if (!h.canAnswer) setAI('off', tr('AI guide off: Mesh balance is empty — using local answers'));
    else setAI('on', `${tr('AI guide connected')} (${h.model})`);
  } catch {
    setAI('off', tr('AI guide offline: check your connection and try again — using local answers'));
  }
}
// Coming back to the panel after a while re-checks the service, so "offline" does not stick after it recovers.
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastHealthCheck > 60000) void checkAI(); });

// ---------- rejection risk: everything found, as one card ----------
let lastScan = null; // { issues, fields } from the last "Check this page"
function renderReadiness() {
  const box = $('readiness');
  if (!lastScan) { box.hidden = true; box.replaceChildren(); return; }
  const items = [];
  for (const i of lastScan.issues) {
    const f = lastScan.fields.find((x) => x.id === i.id);
    if (f?.type === 'file' && i.level === 'error') items.push({ kind: 'missing-doc', text: f.label || tr('Upload field') });
    else items.push({ kind: i.level === 'error' ? 'form-error' : 'form-warning', text: trc(i.text) });
  }
  for (const d of docs) {
    const problems = [...d.checks.filter((c) => c.level === 'error' || c.level === 'warn').map((c) => trc(c.text)), ...(d.scan?.issues || [])];
    if (placementProblem(d)) problems.push(placementProblem(d));
    for (const p of problems) items.push({ kind: 'doc-problem', text: `${d.name}: ${p}` });
  }
  const r = buildReadiness(items);
  const n = r.blocking || r.total;
  const headline = r.level === 'high' ? (n === 1 ? tr('Fix 1 thing before you apply') : tr('Fix {n} things before you apply', { n }))
    : r.level === 'medium' ? (n === 1 ? tr('1 thing to double-check') : tr('{n} things to double-check', { n }))
      : tr('Nothing obvious is missing');
  box.hidden = false;
  box.className = `readiness ${r.level}`;
  box.replaceChildren(el('strong', '', headline));
  for (const g of r.groups) {
    const part = el('div', 'rg');
    part.append(el('span', 'rg-t', tr(g.title)));
    const ul = document.createElement('ul');
    for (const t of g.items) ul.append(el('li', '', t));
    part.append(ul);
    box.append(part);
  }
  box.append(el('small', '', tr(r.note)));
}

// ---------- language preferences ----------
function applyLang() {
  document.documentElement.lang = LANG;
  applyStatic(document.body, LANG);
  $('voice-language').value = SPOKEN;
  renderQuick(); renderDocs(); void renderSlots(); renderReadiness();
  void refresh();
  lastHealthCheck = 0; void checkAI();
}
async function setupPrefs() {
  const saved = await chrome.storage.local.get(['tsLang', 'tsSpeechLang']).catch(() => ({}));
  SPOKEN = spokenLanguage(saved.tsSpeechLang);
  const browser = (navigator.language || '').toLowerCase();
    LANG = ['en', 'hi'].includes(saved.tsLang) ? saved.tsLang : browser.startsWith('hi') ? 'hi' : 'en';
  $('ui-language').value = LANG;
}
$('ui-language').addEventListener('change', () => {
  LANG = $('ui-language').value;
  chrome.storage.local.set({ tsLang: LANG }).catch(() => {});
  applyLang();
});
setupPrefs().then(async () => {
  applyStatic(document.body, LANG);
  document.documentElement.lang = LANG;
  $('voice-language').value = SPOKEN;
  renderDocs();
  const ok = await refresh();
  renderQuick(); await renderSlots(ok); await showHandoff();
  void checkAI();
});

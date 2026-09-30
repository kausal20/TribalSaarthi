import { PORTAL, portalForHost, sourceNoteFor } from './lib/portal.js';
import { respond } from './lib/rules.js';
import { acceptsFile, checkDocument, checkFields, detectType, isSensitive, summarise } from './lib/checks.js';
import { handoffMessage, isFresh } from './lib/handoff.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let tabId = null;
let portal = PORTAL;
let page = { links: [], title: '' };
let fields = [];
const docs = []; // { name, size, bytes, type, checks, hash } — memory only
const conversation = [];

// ---------- tabs ----------
for (const b of document.querySelectorAll('[role=tab]')) {
  b.addEventListener('click', () => {
    for (const t of document.querySelectorAll('[role=tab]')) {
      const on = t === b;
      t.setAttribute('aria-selected', String(on));
      $(t.getAttribute('aria-controls')).hidden = !on;
    }
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
    // The page script is missing (tab opened before the extension was installed/reloaded): inject it, retry once.
    const r = await chrome.runtime.sendMessage({ type: 'inject', tabId: targetTab }).catch(() => null);
    if (!r?.ok) throw e;
    await new Promise((res) => setTimeout(res, 250));
    return chrome.tabs.sendMessage(targetTab, msg);
  }
}
async function refresh() {
  fields = []; page = { links: [], title: '' };
  const t = await activeTab().catch(() => null);
  tabId = t?.id ?? null;
  let host = '';
  try { host = new URL(t.url).host; } catch { /* not a normal page */ }
  const currentPortal = portalForHost(host);
  if (!t || !currentPortal) {
    $('status').textContent = 'Open MahaDBT or the National Scholarship Portal in this tab to use the guide.';
    page = { links: [], title: '' }; fields = [];
    return false;
  }
  portal = currentPortal;
  try {
    const r = await send({ type: 'page-info' });
    if (!r?.ok || !r.info || !Array.isArray(r.fields)) throw new Error('Page unavailable');
    page = { ...r.info }; fields = r.fields;
    $('status').textContent = `${portal.name} · ${page.title || page.path}`;
    return true;
  } catch {
    $('status').textContent = `Reload the ${portal.name} tab once so the guide can read it.`;
    return false;
  }
}
async function pageChanged() {
  $('scan-summary').textContent = 'Page changed — check again for current results.';
  $('issues').replaceChildren(); $('slots').replaceChildren();
  await refresh(); renderQuick(); await renderSlots();
}
chrome.tabs.onActivated.addListener(pageChanged);
chrome.tabs.onUpdated.addListener((id, info) => { if (id === tabId && info.status === 'complete') pageChanged(); });

// ---------- chat ----------
function say(text, who = 'bot', source) {
  const m = el('div', `msg ${who}`);
  m.append(document.createTextNode(text));
  if (source) m.append(el('div', 'src', `Source: ${source}`));
  $('log').append(m);
  $('log').scrollTop = $('log').scrollHeight;
}
async function runActions(actions = []) {
  for (const a of actions) {
    if (a.type === 'goto') {
      const r = await send({ type: 'goto', label: a.label }).catch(() => ({ ok: false }));
      if (!r.ok) say(`I could not open “${a.label}” from this page (${r.reason || 'link not available'}).`);
    } else if (a.type === 'scan-form') { showTab('t-form'); await doScan(); }
    else if (a.type === 'scan-uploads') { showTab('t-docs'); await renderSlots(); }
  }
}
async function ask(text) {
  const q = text.trim();
  if (!q) return;
  say(q, 'me');
  await refresh();
  const uploads = fields.filter((f) => f.type === 'file');
  conversation.push({ role: 'user', content: q });
  const pending = el('div', 'msg bot working', 'Thinking…');
  $('log').append(pending);
  $('log').scrollTop = $('log').scrollHeight;
  try {
    const response = await fetch('http://localhost:4501/api/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: conversation.slice(-16),
        page: { title: page.title, url: (await activeTab())?.url || '', links: page.links, uploadLabels: uploads.map((f) => f.label).filter(Boolean) },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'AI service unavailable');
    pending.remove();
    setAI('on', 'AI guide connected');
    const reply = data.text || 'I could not find a clear answer. Which section do you mean?';
    conversation.push({ role: 'assistant', content: reply });
    say(reply, 'bot');
    await runActions(data.actions || []);
  } catch (error) {
    pending.remove();
    const r = respond(q, { links: page.links, uploads }, portal);
    conversation.pop();
    const reason = error instanceof Error ? error.message : 'AI service unavailable';
    setAI('off', 'AI guide unavailable — using local answers');
    say(`The AI guide could not answer: ${reason}\n\nLocal guide: ${r.text}`, 'bot', r.source);
    await runActions(r.actions);
  }
}
$('composer').addEventListener('submit', (e) => { e.preventDefault(); const v = $('ask').value; $('ask').value = ''; ask(v); });
function renderQuick() {
  $('quick').replaceChildren();
  for (const q of ['Where do I register?', portal.id === 'nsp' ? 'Take me to Schemes on NSP' : 'Take me to All Schemes', 'What documents does this page need?', 'Check this form']) {
    const b = el('button', '', q); b.type = 'button'; b.addEventListener('click', () => ask(q)); $('quick').append(b);
  }
}
say('Hi! I can explain the official portal page, take you to a visible menu, check its fields, and check document files on this device. You type your details, upload and submit yourself.');

// ---------- form check ----------
async function doScan() {
  const button = $('scan');
  if (button.disabled) return;
  button.disabled = true; button.textContent = 'Checking…';
  $('scan-summary').textContent = 'Reading the current page…';
  const ul = $('issues'); ul.replaceChildren();
  try {
    if (!(await refresh())) throw new Error('Could not read the portal. Open a supported portal tab, reload it, and try again.');
    const sens = fields.map(f => ({ ...f, sensitive: f.sensitive || isSensitive(f) }));
    const s = summarise(sens);
    const issues = checkFields(sens);
    $('scan-summary').textContent = s.total ? `${s.total} fields · ${s.requiredEmpty} missing · ${s.sensitiveSkipped} private fields skipped` : 'No form found on this page';
    if (!s.total || s.total === s.sensitiveSkipped) {
      const empty = el('li', 'empty-state');
      empty.append(el('strong', '', s.total ? 'Only private fields found' : 'Open your application form first'), el('p', '', s.total ? 'Passwords, OTPs and identity fields are excluded. Complete those yourself on the portal.' : 'This page has no visible editable fields to check. Go to the application form, then check again.'));
      ul.append(empty);
    } else if (!issues.length) {
      ul.append(el('li', 'card ok', 'No basic issues detected in the visible fields. Review your entries yourself; this is not confirmation that the application is correct.'));
    }
    for (const i of issues) {
      const li = el('li', `card ${i.level}`, i.text);
      const b = el('button', '', 'Show field'); b.type = 'button';
      const checkedTab = tabId, checkedPath = page.path;
      b.addEventListener('click', async () => {
        if (!(await refresh()) || tabId !== checkedTab || page.path !== checkedPath) { b.textContent = 'Page changed — check again'; b.disabled = true; return; }
        const result = await send({ type: 'highlight', id: i.id }).catch(() => null);
        if (!result?.ok) b.textContent = 'Field changed — check again';
      });
      li.append(document.createElement('br'), b); ul.append(li);
    }
  } catch (error) {
    $('scan-summary').textContent = 'Check unavailable';
    ul.append(el('li', 'card warn', error.message));
  } finally { button.disabled = false; button.textContent = 'Check this page →'; }
}
$('scan').addEventListener('click', doScan);
$('diag').addEventListener('click', async () => {
  if (!(await refresh())) { $('diag-out').value = 'Open a supported official portal first.'; return; }
  const r = await send({ type: 'diagnostics' }).catch(() => null);
  $('diag-out').value = r?.ok ? JSON.stringify(r.data, null, 2) : 'Could not read the page. Reload the portal tab and try again.';
});
$('diag-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('diag-out').value); $('diag-copy').textContent = 'Copied'; } catch { $('diag-out').select(); }
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
$('pick').addEventListener('change', async (e) => {
  const input = e.target, file = input.files[0];
  input.value = '';
  if (!file) return;
  if (file.size > 20 * 1024 * 1024 || docs.reduce((n, d) => n + d.size, 0) + file.size > 40 * 1024 * 1024) {
    $('doc-status').textContent = 'Local check limit: 20 MB per file and 40 MB total. Remove a file or choose a smaller one. This is not the portal’s upload limit.';
    return;
  }
  input.disabled = true;
  try {
    if (await askConsent(`${file.name} (${Math.round(file.size / 1000)} KB)`) !== 'local') return;
    $('doc-status').textContent = 'Checking your file on this device…';
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = await sha(bytes);
    if (docs.some(d => d.hash === hash)) { $('doc-status').textContent = 'This file is already in your checked documents.'; return; }
    const checks = checkDocument({ name: file.name, size: file.size, bytes, dims: await dims(file, bytes) }, portal.docLimits);
    docs.push({ name: file.name, size: file.size, type: detectType(bytes) || file.type, bytes, hash, checks });
    renderDocs();
    $('doc-status').textContent = 'File checked. Review the findings below.';
    await renderSlots();
  } catch { $('doc-status').textContent = 'Could not read this file. Try selecting it again or use a different file.'; }
  finally { input.disabled = false; }
});
function renderDocs() {
  const ul = $('docs'); ul.replaceChildren();
  if (!docs.length) { const empty = el('li', 'empty-state'); empty.append(el('strong', '', 'Your files will appear here'), el('p', '', 'Choose a document to see its local check results. You can prepare files before opening an upload page.')); ul.append(empty); }
  docs.forEach((d, i) => {
    const worst = d.checks.some((c) => c.level === 'error') ? 'error' : d.checks.some((c) => c.level === 'warn') ? 'warn' : 'ok';
    const li = el('li', `card ${worst}`);
    li.append(el('strong', '', d.name), el('span', 'note', ` · ${Math.round(d.size / 1000)} KB · checked on this device`));
    const cl = document.createElement('ul');
    for (const c of d.checks) cl.append(el('li', `lvl-${c.level}`, c.text));
    li.append(cl);
    const rm = el('button', '', 'Remove'); rm.type = 'button'; rm.addEventListener('click', () => { docs.splice(i, 1); renderDocs(); renderSlots(); });
    li.append(rm); ul.append(li);
  });
}
async function renderSlots() {
  const ul = $('slots'); ul.replaceChildren();
  if (!(await refresh())) { ul.append(el('li', 'empty-state', 'Could not read the portal. Open a supported page and refresh to find upload fields.')); return; }
  const slots = fields.filter((f) => f.type === 'file' && !f.disabled && !f.sensitive);
  if (!slots.length) { ul.append(el('li', 'empty-state', 'No upload fields on this page. Open the application’s document step, then select Refresh. You can still check files here.')); return; }
  const slotTab = tabId, slotPath = page.path;
  for (const s of slots) {
    const li = el('li', 'card', s.label || 'Upload field');
    if (s.accept) li.append(el('div', 'note', `Accepted here: ${s.accept}`));
    li.append(el('div', 'note', s.filled ? `Portal shows a file selected: ${s.fileName || 'yes'}` : 'No file selected yet'));
    const usable = docs.filter((d) => !d.checks.some((c) => c.level === 'error') && acceptsFile(s.accept, d.name, d.type));
    if (!usable.length) li.append(el('div', 'note', 'Choose a file that passes basic checks and matches this field’s accepted types.'));
    for (const d of usable) {
      const b = el('button', '', `Use “${d.name}”`); b.type = 'button';
      b.addEventListener('click', () => confirmAttach({ ...s, tabId: slotTab, path: slotPath }, d));
      li.append(b);
    }
    const sh = el('button', '', 'Show field'); sh.type = 'button'; sh.addEventListener('click', async () => {
      if (!(await refresh()) || tabId !== slotTab || page.path !== slotPath) { sh.textContent = 'Page changed — refresh'; return; }
      const result = await send({ type: 'highlight', id: s.id }).catch(() => null);
      if (!result?.ok) sh.textContent = 'Field unavailable — refresh';
    });
    li.append(sh); ul.append(li);
  }
}
async function confirmAttach(slot, d) {
  $('a-text').textContent = `Select “${d.name}” in the field “${slot.label}”?`;
  const choice = await ask3($('attach'));
  if (choice !== 'yes') return;
  if (!(await refresh()) || tabId !== slot.tabId || page.path !== slot.path || !fields.some(f => f.id === slot.id && f.type === 'file' && !f.disabled)) { say('The page or upload field changed. Refresh the document fields and choose the file again.'); showTab('t-chat'); return; }
  let bin = '';
  for (let i = 0; i < d.bytes.length; i += 0x8000) bin += String.fromCharCode(...d.bytes.subarray(i, i + 0x8000));
  const r = await send({ type: 'attach', id: slot.id, name: d.name, mime: d.type || 'application/octet-stream', b64: btoa(bin) }).catch(() => ({ ok: false }));
  say(r.ok ? `I selected “${d.name}” in “${slot.label}”. Check that the portal now shows the file name; if it does not, choose the file yourself. Then click the portal’s own upload/save button.` : `I could not select the file (${r.reason || 'the field may have changed'}). Please choose it in the portal yourself.`);
  showTab('t-chat');
  await renderSlots();
}
$('rescan').addEventListener('click', renderSlots);

// Greeting for a student who arrived from the TribalSaarthi website (scheme id only, valid 30 min, used once).
async function showHandoff() {
  try {
    const { tsHandoff } = await chrome.storage.local.get('tsHandoff');
    if (!isFresh(tsHandoff) || tsHandoff.host !== portal.hosts[0]) return;
    await chrome.storage.local.remove('tsHandoff');
    say(handoffMessage(tsHandoff.id, portal), 'bot', `TribalSaarthi website handoff; ${sourceNoteFor(portal)}`);
  } catch { /* storage unavailable: skip the greeting */ }
}

// Shows the extension version and whether the AI server is reachable, so a stale install or a stopped server is visible.
const VERSION = chrome.runtime.getManifest?.().version || '?';
function setAI(state, text) {
  const e = $('ai-status');
  e.className = `ai-status ${state}`;
  e.textContent = `v${VERSION} · ${text}`;
}
async function checkAI() {
  try {
    const r = await fetch('http://localhost:4501/api/health', { signal: AbortSignal.timeout(4000) });
    const h = await r.json();
    if (!h.keyConfigured) setAI('off', 'AI guide off: no API key on the server — using local answers');
    else if (!h.canAnswer) setAI('off', 'AI guide off: Mesh balance is empty — using local answers');
    else setAI('on', `AI guide connected (${h.model})`);
  } catch {
    setAI('off', 'AI guide offline: start the server (npm run server) — using local answers');
  }
}

renderDocs();
refresh().then(async () => { renderQuick(); await renderSlots(); await showHandoff(); });
checkAI();

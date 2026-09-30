// TribalSaarthi page script (runs on supported official portal hosts).
// It READS the page, highlights things, follows approved links the student asked for, and can
// place a student-chosen file into an upload field. It never submits, never types text into
// fields, and never reads password / OTP / CAPTCHA / Aadhaar / bank values.
(() => {
  try {
  // Re-injection (extension reloaded, or injected by the background worker): remove a stale launcher first.
  document.getElementById('tsaarthi-launcher')?.remove();
  window.__tsaarthiLoaded = true;

  const SENSITIVE = /pass(word)?|otp|captcha|cvv|\bpin\b(?![ _-]*code)|aadhaar|aadhar|\buid\b|bank|account|ifsc|biometric/i;
  const BLOCKED_LINK = /log\s*out|sign\s*out|delete|remove|\bpay(ment)?\b|submit|final|confirm|cancel/i;
  const clean = (t) => String(t || '').replace(/\s+/g, ' ').replace(/[*:]+$/g, '').trim();
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  const style = document.createElement('style');
  style.textContent = '.ts-ring{outline:3px solid #F4B740 !important;outline-offset:3px !important;border-radius:6px;transition:outline-color .2s}';
  document.documentElement.appendChild(style);

  function labelOf(el) {
    let t = '';
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l) t = l.innerText;
    }
    if (!t) { const l = el.closest('label'); if (l) t = l.innerText; }
    if (!t) t = el.getAttribute('aria-label') || '';
    if (!t) {
      const by = el.getAttribute('aria-labelledby');
      if (by) t = by.split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ');
    }
    if (!t) {
      const cell = el.closest('td,th,.form-group,.col-md-4,.col-sm-4,div');
      const prev = cell && cell.previousElementSibling;
      if (prev && prev.innerText && prev.innerText.length < 120) t = prev.innerText;
    }
    if (!t) t = el.placeholder || el.name || el.id || '';
    return clean(t);
  }

  let counter = 0;
  const tag = (el) => {
    if (!el.dataset.tsId) el.dataset.tsId = 'ts' + ++counter;
    return el.dataset.tsId;
  };

  function scan() {
    const els = [...document.querySelectorAll('input, select, textarea')].filter((el) => visible(el) && !['hidden', 'button', 'submit', 'reset', 'image'].includes(el.type));
    const fields = els.map((el) => {
      const label = labelOf(el);
      const name = el.name || '';
      const sensitive = el.type === 'password' || SENSITIVE.test(label + ' ' + name + ' ' + el.id);
      const type = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : el.type || 'text';
      let filled;
      if (sensitive) filled = undefined;
      else if (type === 'radio' && el.name) filled = [...(el.form || document).querySelectorAll('input[type="radio"]')].some(other => other.name === el.name && other.checked);
      else if (type === 'checkbox' || type === 'radio') filled = el.checked;
      else if (type === 'file') filled = !!(el.files && el.files.length);
      else if (type === 'select') filled = !!el.value;
      else filled = !!String(el.value || '').trim();
      const required = el.required || el.getAttribute('aria-required') === 'true' || /\*\s*$/.test(labelRaw(el)) || /\brequired\b/i.test(el.className);
      const out = { id: tag(el), label, name, type, required, filled, sensitive, disabled: el.disabled || el.matches(':disabled'), readOnly: !!el.readOnly };
      if (!sensitive && type !== 'file' && type !== 'select' && type !== 'checkbox' && type !== 'radio') out.value = String(el.value || '').slice(0, 200);
      if (type === 'file' && !sensitive) { out.fileName = el.files && el.files[0] ? el.files[0].name : ''; out.accept = el.accept || ''; }
      return out;
    });
    return fields;
  }
  function labelRaw(el) {
    const l = (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) || el.closest('label');
    return l ? l.innerText : '';
  }

  function pageInfo() {
    const links = [...document.querySelectorAll('a, button, [role="menuitem"]')]
      .filter(visible)
      .map((a) => clean(a.innerText || a.getAttribute('aria-label')))
      .filter((t) => t && t.length < 60);
    return {
      title: document.title,
      path: location.pathname,
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0, 8).map((h) => clean(h.innerText)),
      links: [...new Set(links)].slice(0, 80),
    };
  }

  function highlight(id) {
    const el = document.querySelector('[data-ts-id="' + CSS.escape(id) + '"]');
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ts-ring');
    setTimeout(() => el.classList.remove('ts-ring'), 3500);
    return true;
  }

  function goto(text) {
    const want = clean(text).toLowerCase();
    if (!want || BLOCKED_LINK.test(want)) return { ok: false, reason: 'blocked' };
    const cands = [...document.querySelectorAll('a, button, [role="menuitem"]')].filter(visible);
    const txt = (e) => clean(e.innerText || e.getAttribute('aria-label')).toLowerCase();
    const el = cands.find((e) => txt(e) === want) || cands.find((e) => txt(e).includes(want));
    if (!el || BLOCKED_LINK.test(txt(el))) return { ok: false, reason: 'not-found' };
    if (el.href && new URL(el.href, location.href).origin !== location.origin) return { ok: false, reason: 'external-link' };
    el.scrollIntoView({ block: 'center' });
    el.classList.add('ts-ring');
    setTimeout(() => el.click(), 350);
    return { ok: true, matched: clean(el.innerText) };
  }

  function attach(id, name, mime, b64) {
    const el = document.querySelector('input[type="file"][data-ts-id="' + CSS.escape(id) + '"]');
    if (!el || el.matches(':disabled')) return { ok: false, reason: 'no-input' };
    const allowed = String(el.accept || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.some(rule => rule.startsWith('.') ? name.toLowerCase().endsWith(rule) : rule.endsWith('/*') ? mime.startsWith(rule.slice(0, -1)) : mime === rule)) return { ok: false, reason: 'file type not accepted by this field' };
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: mime }));
      el.files = dt.files;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const set = !!(el.files && el.files.length === 1 && el.files[0].name === name);
      return set ? { ok: true } : { ok: false, reason: 'the portal did not keep the file in its field' };
    } catch (e) {
      return { ok: false, reason: String(e && e.message) };
    }
  }

  // Structure only: labels, types, flags. NEVER values, and no query string or hash.
  function diagnostics() {
    const fields = scan().map((f) => ({ label: f.label, name: f.name, type: f.type, required: f.required, filled: f.filled, sensitive: f.sensitive }));
    return {
      host: location.host,
      path: location.pathname,
      title: document.title,
      iframes: document.querySelectorAll('iframe').length,
      fileInputs: document.querySelectorAll('input[type="file"]').length,
      hiddenFileInputs: [...document.querySelectorAll('input[type="file"]')].filter((e) => !visible(e)).length,
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0, 12).map((h) => clean(h.innerText)),
      links: pageInfo().links,
      fields,
      hashRouting: /^#\//.test(location.hash),
    };
  }

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    try {
      if (msg.type === 'page-info') reply({ ok: true, info: pageInfo(), fields: scan() });
      else if (msg.type === 'scan') reply({ ok: true, fields: scan() });
      else if (msg.type === 'diagnostics') reply({ ok: true, data: diagnostics() });
      else if (msg.type === 'highlight') reply({ ok: highlight(msg.id) });
      else if (msg.type === 'goto') reply(goto(msg.label));
      else if (msg.type === 'attach') reply(attach(msg.id, msg.name, msg.mime, msg.b64));
      else return false;
    } catch (e) {
      reply({ ok: false, reason: String(e && e.message) });
    }
    return true;
  });

  // Handoff from the TribalSaarthi website: fragment "#tsaarthi=<scheme-id>" (id only, no personal data).
  let handedOff = false;
  const hm = /[#&?]tsaarthi=([a-z0-9-]{1,40})(?=&|$)/i.exec(location.hash);
  if (hm) {
    handedOff = true;
    try { chrome.storage.local.set({ tsHandoff: { id: hm[1].toLowerCase(), host: location.hostname, ts: Date.now() } }); } catch (e) { /* storage unavailable */ }
    const rest = location.hash.replace(/[#&?]tsaarthi=[a-z0-9-]{1,40}(?=&|$)/i, '');
    history.replaceState(null, '', location.pathname + location.search + (rest.length > 1 ? rest : ''));
  }

  // Floating launcher (shadow DOM keeps it isolated from the portal's CSS).
  const host = document.createElement('div');
  host.id = 'tsaarthi-launcher';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>@keyframes p{0%{box-shadow:0 0 0 0 rgba(244,183,64,.7)}100%{box-shadow:0 0 0 14px rgba(244,183,64,0)}}.tip{position:absolute;right:0;bottom:56px;background:#fff;color:#111827;font:500 13px system-ui,sans-serif;padding:9px 12px;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(17,24,39,.2);white-space:nowrap}button.pulse{animation:p 1.6s ease-out 4}button{all:unset;cursor:pointer;background:#111827;color:#fff;font:600 14px system-ui,sans-serif;padding:11px 16px;border-radius:999px;box-shadow:0 8px 24px rgba(17,24,39,.35);display:flex;gap:8px;align-items:center}button:hover{background:#0b2f2a}button:focus-visible{outline:3px solid #F4B740;outline-offset:2px}i{color:#F4B740;font-style:normal}</style><button aria-label="Open TribalSaarthi guide"><i>✦</i> TribalSaarthi guide</button>' + (handedOff ? '<div class="tip" role="status">Your guide is ready — click to open</div>' : '');
  if (handedOff) root.querySelector('button').classList.add('pulse');
  root.querySelector('button').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-panel' }));
  document.documentElement.appendChild(host);
  document.documentElement.dataset.tsaarthiGuide = 'on';
  chrome.runtime.sendMessage({ type: 'alive' });
  } catch (e) {
    try { chrome.runtime.sendMessage({ type: 'error', message: String((e && e.message) || e) }); } catch (_) { /* context gone */ }
    console.error('[TribalSaarthi] page script failed:', e);
  }
})();

// TribalSaarthi page script (runs on supported official portal hosts).
// It READS the page, highlights things, follows approved links the student asked for, and can
// place a student-chosen file into an upload field. It never submits, never types text into
// fields, and never reads password / OTP / CAPTCHA / Aadhaar / bank values.
(() => {
  // Notifications are best-effort. Extension reloads can invalidate the old page context.
  const notify = (message) => {
    try { chrome.runtime.sendMessage(message)?.catch?.(() => {}); } catch { /* reload in progress */ }
  };
  try {
  // Re-injection (extension reloaded, or injected by the background worker): remove a stale launcher first.
  document.getElementById('tsaarthi-launcher')?.remove();
  window.__tsaarthiLoaded = true;

  // Same pattern as FIELD_PATTERN in lib/sensitive.js (a unit test keeps the two identical). Whole words only, so
  // "Passport size photograph" and "Passing year" are not treated as private.
  const SENSITIVE = /password|passcode|passwd|\bpwd\b|(?:^|[^a-z])otp|otp(?:$|[^a-z])|captcha|\bcvv\b|\bpin\b(?![ _-]*code)|aadhaar|aadhar|\buid\b|bank|account|ifsc|biometric/i;
  const splitWords = (s) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  const isPrivate = (...parts) => SENSITIVE.test(splitWords(parts.filter(Boolean).join(' ')));
  // Menu text that carries the student's own name or an id ("Welcome ASHA PATIL", a 10-digit number) never leaves the page.
  const PERSONAL_LABEL = /^(welcome|hello|hi|namaste|logged in as|signed in as)\b|\d{6,}|@/i;
  const BLOCKED_LINK = /log\s*out|sign\s*out|delete|remove|\bpay(ment)?\b|submit|final|confirm|cancel/i;
  const clean = (t) => String(t || '').replace(/\s+/g, ' ').replace(/[*:]+$/g, '').trim();
  const documentId = crypto.randomUUID();
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  // Styled upload controls often hide their native input behind a visible label.
  const uploadAnchor = (el) => [...(el.labels || [])].find(visible) ||
    (el.parentElement?.matches('label,.form-group,.upload-field') && visible(el.parentElement) ? el.parentElement : null);

  const style = document.createElement('style');
  style.textContent = '.ts-ring{outline:3px solid #F4B740 !important;outline-offset:3px !important;border-radius:6px;transition:outline-color .2s}';
  document.documentElement.appendChild(style);

  // ---------- "the guide is acting" frame ----------
  // While the guide navigates or works on the page, a green glow frames the page with a short label on top, like
  // AI browsers do, so the student can see that the change came from the guide. It never blocks clicks.
  const NAV_KEY = 'tsaarthi-arrived';
  let glowParts = null;
  let glowTimer = 0;
  function glowRoot() {
    if (glowParts && glowParts.host.isConnected) return glowParts;
    document.getElementById('tsaarthi-glow')?.remove();
    const host = document.createElement('div');
    host.id = 'tsaarthi-glow';
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      .frame{position:fixed;inset:0;opacity:0;transition:opacity .3s ease;box-shadow:inset 0 0 0 4px rgba(16,185,129,1),inset 0 0 46px 12px rgba(16,185,129,.42)}
      .frame::before{content:"";position:absolute;inset:0;padding:3px;background:conic-gradient(from var(--a,0deg),#10b981,#a7f3d0,#34d399,#059669,#10b981);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.9}
      .frame.on{opacity:1;animation:breathe 1.8s ease-in-out infinite}
      @keyframes breathe{50%{box-shadow:inset 0 0 0 4px rgba(52,211,153,.85),inset 0 0 72px 20px rgba(16,185,129,.28)}}
      .pill{position:fixed;top:14px;left:50%;display:flex;align-items:center;gap:9px;max-width:min(560px,90vw);padding:8px 16px 8px 11px;color:#fff;font:600 13px/1.35 system-ui,'Segoe UI',sans-serif;background:#0f2b26;border:1px solid rgba(52,211,153,.55);border-radius:999px;box-shadow:0 10px 30px rgba(6,40,30,.35);opacity:0;transform:translate(-50%,-10px);transition:opacity .3s ease,transform .3s ease}
      .pill.on{opacity:1;transform:translate(-50%,0)}
      .dot{flex:none;width:10px;height:10px;border-radius:50%;background:#34d399;box-shadow:0 0 0 0 rgba(52,211,153,.6);animation:ping 1.2s ease-out infinite}
      .tx{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      @keyframes ping{100%{box-shadow:0 0 0 9px rgba(52,211,153,0)}}
      @media (prefers-reduced-motion:reduce){.frame.on,.dot{animation:none}.pill,.pill.on{transform:translate(-50%,0)}}
    </style><div class="frame"></div><div class="pill" role="status"><span class="dot"></span><span class="tx"></span></div>`;
    document.documentElement.appendChild(host);
    glowParts = { host, frame: shadow.querySelector('.frame'), pill: shadow.querySelector('.pill'), text: shadow.querySelector('.tx') };
    return glowParts;
  }
  function glow(label, ms = 2600) {
    try {
      const g = glowRoot();
      g.text.textContent = label;
      requestAnimationFrame(() => { g.frame.classList.add('on'); g.pill.classList.add('on'); });
      clearTimeout(glowTimer);
      glowTimer = setTimeout(() => { g.frame.classList.remove('on'); g.pill.classList.remove('on'); }, ms);
    } catch (e) { /* purely visual */ }
  }

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

  // Ids must stay unique if this script runs twice on one page (extension reloaded): continue after the highest one in use.
  let counter = [...document.querySelectorAll('[data-ts-id]')].reduce((max, e) => Math.max(max, parseInt(String(e.dataset.tsId).replace(/\D/g, ''), 10) || 0), 0);
  const tag = (el) => {
    if (!el.dataset.tsId) el.dataset.tsId = 'ts' + ++counter;
    return el.dataset.tsId;
  };

  // A "Select" placeholder option (value "", "0", "-1" or text like "--Select--") does not count as an answer.
  function selectHasAnswer(el) {
    if (!el.value) return false;
    const option = el.options[el.selectedIndex];
    const text = clean(option ? option.text : '');
    if (el.selectedIndex > 0) return true;
    return !(/^(0|-1|null|undefined)$/i.test(el.value) || /^[-–—\s]*(select|choose|please select|none)\b/i.test(text));
  }

  // Radios that share a name are one question. Its caption is the fieldset legend or the text just above the options.
  function groupRaw(el) {
    const legend = el.closest('fieldset')?.querySelector('legend');
    if (legend) return legend.innerText;
    const box = el.closest('[role="radiogroup"], [role="group"]');
    if (box) {
      const by = box.getAttribute('aria-labelledby');
      const text = box.getAttribute('aria-label') || (by ? by.split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ') : '');
      if (text) return text;
    }
    const same = el.name ? [...document.querySelectorAll('input[type="radio"]')].filter((r) => r.name === el.name) : [el];
    let wrap = (el.closest('label') || el).parentElement;
    for (let i = 0; i < 5 && wrap && !same.every((r) => wrap.contains(r)); i++) wrap = wrap.parentElement;
    const prev = wrap && wrap.previousElementSibling;
    return prev && prev.innerText && prev.innerText.length < 120 ? prev.innerText : (el.name || '');
  }

  function scan() {
    const els = [...document.querySelectorAll('input, select, textarea')].filter((el) =>
      (visible(el) || (el.type === 'file' && uploadAnchor(el))) && !['hidden', 'button', 'submit', 'reset', 'image'].includes(el.type));
    const fields = els.map((el) => {
      const label = labelOf(el);
      const name = el.name || '';
      const sensitive = el.type !== 'file' && (el.type === 'password' || isPrivate(label, name, el.id));
      const type = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : el.type || 'text';
      let filled;
      if (sensitive) filled = undefined;
      else if (type === 'radio' && el.name) filled = [...(el.form || document).querySelectorAll('input[type="radio"]')].some(other => other.name === el.name && other.checked);
      else if (type === 'checkbox' || type === 'radio') filled = el.checked;
      else if (type === 'file') filled = !!(el.files && el.files.length);
      else if (type === 'select') filled = selectHasAnswer(el);
      else filled = !!String(el.value || '').trim();
      const groupText = type === 'radio' ? groupRaw(el) : '';
      const required = el.required || el.getAttribute('aria-required') === 'true' || /\*\s*$/.test(labelRaw(el)) || /\*\s*$/.test(groupText.trim()) || /\brequired\b/i.test(el.className);
      const out = { id: tag(el), label, name, type, required, filled, sensitive, disabled: el.disabled || el.matches(':disabled'), readOnly: !!el.readOnly };
      if (type === 'radio') out.group = clean(groupText);
      if (!sensitive && type !== 'file' && type !== 'select' && type !== 'checkbox' && type !== 'radio') out.value = String(el.value || '').slice(0, 200);
      if (type === 'file' && !sensitive) {
        out.fileName = el.files && el.files[0] ? el.files[0].name : ''; out.accept = el.accept || '';
        // Only help text associated with this control; never read entered values.
        const help = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id));
        const group = el.closest('.form-group, .mb-3, .field') || el.parentElement;
        if (group && group.querySelectorAll('input[type=file]').length === 1) help.push(...group.querySelectorAll('small, .help-block, .form-text'));
        out.requirements = [...new Set(help.filter(Boolean).map(e => clean(e.textContent)).filter(t => t && !PERSONAL_LABEL.test(t)))].join(' ').slice(0, 500);
      }
      return out;
    });
    return fields;
  }
  function labelRaw(el) {
    const l = (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) || el.closest('label');
    return l ? l.innerText : '';
  }

  // True when following the link would leave this website (or open a mail / phone / file handler).
  function leavesSite(a) {
    const href = a.getAttribute && a.getAttribute('href');
    if (!href || /^\s*(javascript:|#)/i.test(href)) return false;
    if (/^\s*(mailto|tel|sms|data|blob|file|ftp):/i.test(href)) return true;
    try { return new URL(a.href, location.href).origin !== location.origin; } catch (e) { return true; }
  }

  // ---------- links, including ones tucked inside closed menus ----------
  // Portals hide most pages inside drawers, accordions and dropdowns (NSP: ☰ → Public → "Find Institutes on NSP").
  // The guide lists those too, and when asked it opens each menu in turn, like a person would, then clicks the link.
  const GENERIC = /^(view|view more|view all|view details|search|search now|apply|apply now|click here|here|more|read more|know more|details|go|open|start|continue)!?$/i;
  const MENU_AREA = 'nav, header, [role="menu"], [role="tabpanel"], .dropdown-menu, .offcanvas, .accordion, .collapse, .navbar, .menu, .submenu, .sub-menu, .tab-pane';
  const shown = (el) => (el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) : visible(el));
  const ownText = (el) => clean(el.innerText || el.textContent || el.getAttribute('aria-label') || el.value);
  // "View" or "Search now!" alone says nothing: name it after the card or section it sits in.
  function contextOf(el) {
    let box = el.parentElement;
    for (let i = 0; i < 5 && box && box !== document.body; i++, box = box.parentElement) {
      const h = box.querySelector('h1,h2,h3,h4,h5,h6,.card-title,strong,b');
      const t = h && !h.contains(el) ? clean(h.textContent) : '';
      if (t && t.length < 60 && !GENERIC.test(t)) return t;
    }
    return '';
  }
  function linkName(el) {
    const own = ownText(el);
    if (!own || !GENERIC.test(own)) return own;
    const ctx = contextOf(el);
    return ctx ? `${ctx} – ${own}` : own;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // The controls that open each closed container around `el`, outermost first (e.g. the ☰ drawer, then "Public").
  function openers(el) {
    const chain = [];
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (!p.id) continue;
      const id = CSS.escape(p.id);
      chain.unshift({ panel: p, selector: `[data-bs-target="#${id}"],[data-target="#${id}"],[aria-controls="${p.id.replace(/"/g, '')}"],a[href="#${id}"]` });
    }
    return chain;
  }
  async function reveal(el) {
    for (const { panel, selector } of openers(el)) {
      if (shown(panel)) continue;
      const trigger = [...document.querySelectorAll(selector)].find((t) => shown(t) && !panel.contains(t));
      if (!trigger) continue;
      trigger.classList.add('ts-ring');
      setTimeout(() => trigger.classList.remove('ts-ring'), 1600);
      trigger.click();
      await wait(500);
    }
  }
  function activate(el) {
    const href = el.getAttribute('href') || '';
    if (shown(el)) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('ts-ring');
      setTimeout(() => el.classList.remove('ts-ring'), 3000);
    }
    if (/^\s*javascript:/i.test(href)) {
      // A "javascript:" link clicked from here would run under the extension's security policy and be blocked,
      // so the background worker makes the same click inside the page itself.
      const token = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      el.setAttribute('data-ts-click', token);
      setTimeout(() => notify({ type: 'page-click', token }), 650);
    } else {
      setTimeout(() => el.click(), 650);
    }
  }

  function pageInfo() {
    const links = [];
    const tucked = [];
    const externalLinks = [];
    for (const a of document.querySelectorAll('a, button, [role="menuitem"]')) {
      const isShown = shown(a);
      if (!isShown && !a.closest(MENU_AREA)) continue;
      const text = linkName(a);
      if (!text || text.length >= 80 || PERSONAL_LABEL.test(text)) continue;
      (leavesSite(a) ? externalLinks : isShown ? links : tucked).push(text);
    }
    return {
      documentId,
      title: document.title,
      path: location.pathname,
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0, 8).map((h) => clean(h.innerText)),
      // Menu items the guide can take the student to (visible ones first, then ones inside closed menus), and ones
      // that open a different website (the student clicks those).
      links: [...new Set([...links, ...tucked])].slice(0, 80),
      externalLinks: [...new Set(externalLinks)].slice(0, 40),
    };
  }

  function highlight(id) {
    const el = document.querySelector('[data-ts-id="' + CSS.escape(id) + '"]');
    if (!el) return false;
    const target = visible(el) ? el : uploadAnchor(el);
    if (!target) return false;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('ts-ring');
    setTimeout(() => target.classList.remove('ts-ring'), 3500);
    glow(`Showing “${labelOf(el)}”`, 2200);
    return true;
  }

  // Points at the portal's own Upload / Save button near a file field. It only highlights; the student clicks it.
  function findAction(id) {
    const field = document.querySelector('[data-ts-id="' + CSS.escape(id) + '"]');
    if (!field) return { ok: false };
    const WORDS = /upload|save|submit|attach|update|next|proceed/i;
    const textOf = (b) => clean(b.innerText || b.value || b.getAttribute('aria-label'));
    const pick = (root) => [...root.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn')].filter(visible).find((b) => WORDS.test(textOf(b)));
    const scope = field.closest('form') || field.closest('.modal, .panel, table, section') || field.parentElement?.parentElement || document;
    const button = pick(scope) || pick(document);
    if (!button) return { ok: false };
    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
    button.classList.add('ts-ring');
    setTimeout(() => button.classList.remove('ts-ring'), 5000);
    glow(`Showing the portal’s “${textOf(button)}” button`, 2600);
    return { ok: true, label: textOf(button) };
  }

  function goto(text) {
    const want = clean(text).toLowerCase();
    if (!want || BLOCKED_LINK.test(want)) return { ok: false, reason: 'blocked' };
    const all = [...document.querySelectorAll('a, button, [role="menuitem"]')];
    const order = [...all.filter(shown), ...all.filter((e) => !shown(e) && e.closest(MENU_AREA))];
    const named = (e) => linkName(e).toLowerCase();
    const plain = (e) => ownText(e).toLowerCase();
    const el = order.find((e) => named(e) === want) || order.find((e) => plain(e) === want)
      || order.find((e) => named(e).includes(want)) || order.find((e) => plain(e).includes(want));
    if (!el || BLOCKED_LINK.test(plain(el))) return { ok: false, reason: 'not-found' };
    // Portal menus are often "javascript:" links (ASP.NET postbacks); clicking one is what the student would do.
    // Only links that leave this website, or open mail/phone/file handlers, are refused.
    if (leavesSite(el)) return { ok: false, reason: 'external-link' };
    const name = linkName(el);
    glow(`TribalSaarthi is opening “${name}”…`, 4500);
    // The next page shows "Opened …" for a moment, so the student sees where the guide took them.
    try { sessionStorage.setItem(NAV_KEY, JSON.stringify({ label: name, ts: Date.now() })); } catch (e) { /* storage blocked */ }
    setTimeout(() => { try { sessionStorage.removeItem(NAV_KEY); } catch (e) { /* ignore */ } }, 10000);
    if (shown(el)) activate(el);
    else reveal(el).then(() => activate(el)); // open the menus it is in, then click it (a hidden link still works if a menu will not open)
    return { ok: true, matched: name };
  }

  const selectedFiles = new WeakMap();
  const uploadOffers = new Map();
  const uploadResults = new Map();
  function watchUpload(field) {
    // Observe only the individual file control's container. An old success notice
    // elsewhere on the page is never accepted as this upload's receipt.
    const scope = field.closest('.form-group, .mb-3, .field, tr') || field.parentElement;
    const id = crypto.randomUUID();
    const result = { status: 'pending' };
    uploadResults.set(id, result);
    if (uploadResults.size > 30) uploadResults.delete(uploadResults.keys().next().value);
    if (!scope || scope.querySelectorAll('input[type=file]').length !== 1) { result.status = 'unknown'; return id; }
    const messages = () => [...scope.querySelectorAll('[role=status],[role=alert],.text-success,.text-danger,.success,.error,.invalid-feedback,.field-validation-error')]
      .filter(visible).map(n => clean(n.textContent)).filter(Boolean);
    const before = new Set(messages());
    const observer = new MutationObserver(() => {
      const fresh = messages().filter(t => !before.has(t));
      if (fresh.some(t => /upload.*(failed|error|invalid|rejected)|file.*(too large|not allowed|invalid)|अपलोड.*विफल/i.test(t))) result.status = 'failed';
      else if (fresh.some(t => /(?:file|document).*uploaded successfully|upload (?:successful|completed)|successfully uploaded|अपलोड.*सफल/i.test(t))) result.status = 'confirmed';
      if (result.status !== 'pending') observer.disconnect();
    });
    observer.observe(scope, { childList: true, subtree: true, characterData: true, attributes: true });
    setTimeout(() => { observer.disconnect(); if (result.status === 'pending') result.status = 'unknown'; }, 18000);
    return id;
  }
  function uploadControl(field) {
    // A whole application form is never a document-upload scope.
    for (let scope = field.parentElement, depth = 0; scope && depth < 4; scope = scope.parentElement, depth++) {
      if (scope.matches('form,body,html')) break;
      if (scope.querySelectorAll('input[type="file"]').length !== 1) break;
      const buttons = [...scope.querySelectorAll('button, input[type="button"], input[type="submit"]')]
        .filter(b => visible(b) && !b.matches(':disabled') && b.getAttribute('aria-disabled') !== 'true')
        .filter(b => /^(upload|upload (file|document)|अपलोड|दस्तावेज़ अपलोड करें)$/i.test(clean(b.innerText || b.value || b.getAttribute('aria-label'))));
      if (buttons.length === 1) return buttons[0];
      if (buttons.length > 1) return null;
    }
    return null;
  }
  function prepareUpload(id) {
    const field = document.querySelector('input[type="file"][data-ts-id="' + CSS.escape(id) + '"]');
    const selected = field && selectedFiles.get(field);
    const button = field && uploadControl(field);
    if (!selected || field.files?.[0] !== selected || !button) return { ok: false };
    const token = crypto.randomUUID();
    uploadOffers.clear();
    uploadOffers.set(token, { field, selected, button, url: location.href, expires: Date.now() + 60000 });
    return { ok: true, token, host: location.hostname, name: selected.name, label: clean(button.innerText || button.value) };
  }
  function uploadDocument(token) {
    const offer = uploadOffers.get(token);
    uploadOffers.delete(token); // Single use, including when a check fails.
    if (!offer || Date.now() > offer.expires || location.href !== offer.url ||
      !offer.field.isConnected || offer.field.files?.[0] !== offer.selected ||
      uploadControl(offer.field) !== offer.button) return { ok: false, reason: 'changed' };
    selectedFiles.delete(offer.field);
    glow('TribalSaarthi is pressing the portal’s Upload button…', 3000);
    const receiptId = watchUpload(offer.field);
    offer.button.click();
    // A click is not evidence of a successful server upload.
    return { ok: true, status: 'requested', receiptId };
  }

  function attach(id, name, mime, b64) {
    const el = document.querySelector('input[type="file"][data-ts-id="' + CSS.escape(id) + '"]');
    if (!el || el.matches(':disabled')) return { ok: false, reason: 'no-input' };
    // File inputs are explicit student-selected uploads, not secret text inputs.
    if (!visible(el) && !uploadAnchor(el)) return { ok: false, reason: 'upload control is not visible' };
    const allowed = String(el.accept || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.some(rule => rule.startsWith('.') ? name.toLowerCase().endsWith(rule) : rule.endsWith('/*') ? mime.startsWith(rule.slice(0, -1)) : mime === rule)) return { ok: false, reason: 'file type not accepted by this field' };
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: mime }));
      const receiptId = watchUpload(el);
      el.files = dt.files;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const set = !!(el.files && el.files.length === 1 && el.files[0].name === name);
      if (set) { selectedFiles.set(el, el.files[0]); glow(`Placed “${name}” in “${labelOf(el)}”`, 2600); (uploadAnchor(el) || el).scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return set ? { ok: true, receiptId } : { ok: false, reason: 'the portal did not keep the file in its field' };
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

  // Injecting twice into the same page must not leave two listeners answering every message.
  if (window.__tsaarthiListener) {
    try { chrome.runtime.onMessage.removeListener(window.__tsaarthiListener); } catch (e) { /* the old copy's extension context is gone */ }
  }
  const onMessage = (msg, _s, reply) => {
    try {
      if (msg.type === 'page-info') reply({ ok: true, info: pageInfo(), fields: scan() });
      else if (msg.type === 'scan') reply({ ok: true, fields: scan() });
      else if (msg.type === 'diagnostics') reply({ ok: true, data: diagnostics() });
      else if (msg.type === 'highlight') reply({ ok: highlight(msg.id) });
      else if (msg.type === 'highlight-action') reply(findAction(msg.id));
      else if (msg.type === 'goto') reply(goto(msg.label));
      else if (msg.type === 'attach') reply(attach(msg.id, msg.name, msg.mime, msg.b64));
      else if (msg.type === 'prepare-upload') reply(prepareUpload(msg.id));
      else if (msg.type === 'upload-document') reply(uploadDocument(msg.token));
      else if (msg.type === 'upload-result') reply({ ok: true, ...(uploadResults.get(msg.receiptId) || { status: 'unknown' }) });
      else return false;
    } catch (e) {
      reply({ ok: false, reason: String(e && e.message) });
    }
    return true;
  };
  window.__tsaarthiListener = onMessage;
  chrome.runtime.onMessage.addListener(onMessage);

  // Handoff from the TribalSaarthi website: fragment "#tsaarthi=<scheme-id>" (id only, no personal data).
  let handedOff = false;
  const hm = /[#&?]tsaarthi=([a-z0-9-]{1,40})(?=&|$)/i.exec(location.hash);
  if (hm) {
    handedOff = true;
    try { chrome.storage.local.set({ tsHandoff: { id: hm[1].toLowerCase(), host: location.hostname, ts: Date.now() } })?.catch?.(() => {}); } catch (e) { /* storage unavailable */ }
    const rest = location.hash.replace(/[#&?]tsaarthi=[a-z0-9-]{1,40}(?=&|$)/i, '');
    history.replaceState(null, '', location.pathname + location.search + (rest.length > 1 ? rest : ''));
  }

  // Floating launcher (shadow DOM keeps it isolated from the portal's CSS).
  const host = document.createElement('div');
  host.id = 'tsaarthi-launcher';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>@keyframes p{0%{box-shadow:0 0 0 0 rgba(71,133,99,.38)}100%{box-shadow:0 0 0 13px rgba(71,133,99,0)}}.tip{position:absolute;right:0;bottom:58px;background:#fff;color:#263b2e;font:500 13px system-ui,sans-serif;padding:9px 12px;border-radius:12px;border:1px solid #e1e9e3;box-shadow:0 8px 24px rgba(23,53,36,.15);white-space:normal;width:max-content;max-width:250px;line-height:1.4}button.pulse{animation:p 1.8s ease-out 3}button{all:unset;cursor:pointer;background:#173d30;color:#fff;font:600 13px system-ui,sans-serif;padding:10px 15px 10px 10px;border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 5px 18px rgba(20,52,37,.22);display:flex;gap:9px;align-items:center;transition:background .18s ease,transform .18s ease,box-shadow .18s ease}button:hover{background:#22523d;transform:translateY(-1px);box-shadow:0 8px 23px rgba(20,52,37,.27)}button:focus-visible{outline:3px solid #d5af53;outline-offset:3px}.guide-mark{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#10231f;color:#33b39a}.guide-mark svg{width:18px;height:18px;display:block}</style><button aria-label="Open TribalSaarthi guide"><span class="guide-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M22.4 8.7c-1.9-1.8-5.5-2.1-8.4-.6-2.7 1.4-3.6 4.3-1.3 5.9 1.3.9 3.6 1.2 5.5 1.8 2.8.8 2.8 3.1.7 4.5-2.5 1.7-6.3.9-8.1-1.1" stroke="currentColor" stroke-width="3.1" stroke-linecap="round"/><path d="m23.5 6.5.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" fill="#f4b740"/></svg></span><span>TribalSaarthi guide</span></button>' + (handedOff ? '<div class="tip" role="status">Your guide is ready — click to open</div>' : '');
  if (handedOff) root.querySelector('button').classList.add('pulse');
  const tip = (text) => {
    let note = root.querySelector('.tip');
    if (!note) { note = document.createElement('div'); note.className = 'tip'; note.setAttribute('role', 'status'); root.append(note); }
    note.textContent = text;
    clearTimeout(tip.timer);
    tip.timer = setTimeout(() => note.remove(), 7000);
  };
  // Chrome only opens a side panel for a real click. If it refuses, tell the student what to click instead of doing nothing.
  root.querySelector('button').addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ type: 'open-panel' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) tip('Click the TribalSaarthi icon in your browser toolbar to open the guide.');
      });
    } catch (e) {
      tip('Reload this page, then click the TribalSaarthi icon in your browser toolbar.');
    }
  });
  document.documentElement.appendChild(host);
  document.documentElement.dataset.tsaarthiGuide = 'on';
  // Arrived here because the guide opened a link: say so for a moment.
  try {
    const arrived = JSON.parse(sessionStorage.getItem(NAV_KEY) || 'null');
    sessionStorage.removeItem(NAV_KEY);
    if (arrived && Date.now() - arrived.ts < 20000) glow(`Opened “${arrived.label}”`, 2000);
  } catch (e) { /* storage blocked */ }
  notify({ type: 'alive' });
  } catch (e) {
    notify({ type: 'error', message: String((e && e.message) || e) });
    console.error('[TribalSaarthi] page script failed:', e);
  }
})();

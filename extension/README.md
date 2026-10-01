# TribalSaarthi Guide — Chrome extension (prototype)

## Version 0.11.2 English and Hindi only

The website, Saarthi AI and guide now offer English and Hindi only. The microphone defaults to Hindi (`hi-IN`) and its spoken-language selector is stored independently as `tsSpeechLang`; English interface text never resets Hindi dictation. Recognition results preserve Devanagari, update interim text without duplication, and allow four-second pauses for Hindi. Unsupported-language errors remain visible instead of being replaced by a success message. This uses Chrome's speech recognition service, not the chat model. Reload the extension and reopen its panel after updating.

Regression check: `node extension/test/recognition-browser.mjs` verifies Hindi locale selection, simulated Hindi results and persistence in an isolated Chrome extension profile. Live audio accuracy depends on the microphone, browser speech service and connection; it is not measured by that test.

## Version 0.11.0 reliability update

- AI scans require a complete structured response. Unreadable files, unknown/non-document content, failed reviews and incomplete requested AI scans cannot be offered for placement. Local-only checking remains an explicit choice.
- PDF.js renders every PDF page locally, then sends JPEG page images after consent. Up to 6 pages and 4,000,000 base64 characters total are supported; larger files are refused with a split-file instruction. Workers, fonts and decoders ship with the extension. Rebuild with `npm run build:extension` after dependency updates.
- Reviews compare the document with help text explicitly attached to upload controls on the current scheme page. Results are pass/fail/unknown; no requirements means no scheme-compliance claim. Changed requirements invalidate an earlier review. This does not verify issuers, authenticity, cross-document identity or officer approval.
- Navigation returns one action, waits for an observed page change, and replans from the new page. Every subsequent navigation requires Continue; loops and unconfirmed changes stop. Maximum five steps. External websites and login/manual input remain boundaries.
- Upload results distinguish a new, file-local portal success message, failure, and unknown. An old/global success banner is not a receipt. Page reloads and unsupported portal markup can produce unknown, and uploads are never automatically retried.
- Aadhaar/bank file controls accept student-confirmed file selection; corresponding number/password/OTP fields remain unread. PDF and image bytes leave the device only after AI-scan consent or confirmed placement on the portal.
- Speech waits for available voices, chunks long/mixed-script replies, retries the language default once, and explains playback failure. Voice availability still depends on Chrome and the operating system.

Verification: `npm test`; `node extension/test/automation-browser.mjs`. The latter uses fictional local fixtures. Optional `node --env-file=.env extension/test/automation-browser.mjs --live-scan` also checks the configured model with a fictional income certificate. Actual logged-in portal uploads still require portal-specific verification.

A Manifest V3 extension. On `mahadbt.maharashtra.gov.in`, `mahadbt2.maharashtra.gov.in` (MahaDBT 2.0) and `scholarships.gov.in` it adds a **✦ TribalSaarthi guide** button and a Chrome **side panel** with:

- **Guide** — portal-specific answers and "take me to …" navigation to menu links that exist on the page you are on.
- **Check form** — scans the visible fields on the page for empty required fields and obvious format problems (email, 10-digit mobile, 6-digit PIN, names with digits). Password / OTP / CAPTCHA / Aadhaar / bank fields are **skipped and their values never read**.
- **Documents** — you pick a file from your computer. The panel **asks before every check** (on this device, or "send to server AI" which is disabled until a provider is connected). Local checks: real file type by content, extension mismatch, size vs limit, encrypted PDF, small image, duplicate file. It can then put the file into a portal upload field **only after you confirm**; you still click the portal's own Upload/Save/Submit.
- **Voice** — select Hindi or English, tap the microphone, and dictate a question. Chrome may send microphone audio to its speech service; the panel explains this before first use. The transcript remains editable and is sent to TribalSaarthi only when you press Send. Tap the speaker on a guide reply to hear it using an available browser voice. Recognition and voice quality depend on Chrome, the selected language and installed system voices; mixed Hindi-English dictation is not guaranteed to be perfect.

## Website → official portal handoff
Version 0.10.0 added a language selector to the panel header. The panel labels and AI replies follow that language. The Form tab ends in one rejection-risk card that lists missing documents, document problems and form issues together; it is a checklist, never a decision. Built-in fallback answers and official portal wording stay in English.

Version 0.9.10 also supports `https://tribal.nic.in/ScholarshiP.aspx` and other pages on that exact Ministry host. Reload the extension, approve the new site access if Chrome asks, and refresh the Ministry page. Its guide explains scholarship information and links; separate fellowship/overseas application domains are not included. No upload field on an information page means no file can be attached there.
Version 0.9.9 opens the companion automatically when you click a supported NSP or MahaDBT link on TribalSaarthi (production or localhost). The extension opens the window-wide panel during that click, so it remains open in the new portal tab. Reload the extension and refresh the TribalSaarthi tab after updating. Chrome requires a user gesture: typing a government URL directly or an automatic redirect without a click cannot open the panel; use the portal launcher in that case. Shift-click into a separate window uses the normal link behavior.

On the homepage choose **Use the guide on NSP** or **Use the guide on MahaDBT**. The handoff page checks whether this extension is detected, then opens the chosen official portal. An opportunity-specific handoff carries only a demo ID in the URL fragment, never personal data. The extension uses it once and removes the fragment. Chrome requires a user click to open the side panel; click the ✦ button or toolbar icon. For deployment, update the `bridge.js` match patterns to the website's production domain.

## What it never does
Log in, type passwords/OTP/CAPTCHA, fill text fields, submit, pay, delete, log out, or leave the supported official site. It does not decide eligibility and cannot tell whether a document is genuine.

## Load it (Chrome)
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → choose this `extension` folder.
2. Open https://mahadbt.maharashtra.gov.in/, https://mahadbt2.maharashtra.gov.in/ or https://scholarships.gov.in/home and click the toolbar icon (or the on-page ✦ button).
3. After updating the files or granting the new NSP site permission, reload the extension and refresh the portal tab. The Codex in-app preview may not use your Chrome extension; test the guide in Chrome or Edge.

## If the ✦ button does not appear
1. `chrome://extensions` → find *TribalSaarthi Guide* → click the **reload** arrow (this also injects the guide into supported portal tabs that are already open). Check there is no red **Errors** button, and that the version matches `manifest.json`.
2. Look at the toolbar icon on the MahaDBT tab: a green **ON** badge means the page script is running; red **ERR** means it failed (see the tab's DevTools console for “[TribalSaarthi]”).
3. Click the toolbar icon. The panel opens even if the button is missing, and it now injects the page script itself if needed.
4. In the tab's console run `document.documentElement.dataset.tsaarthiGuide` — `"on"` means the script ran.
5. The extension must be on one of the exact hosts `mahadbt.maharashtra.gov.in`, `mahadbt2.maharashtra.gov.in` or `scholarships.gov.in` and Chrome ≥ 114 (side panel).

## AI document scan, voice and the page frame
- **Scan with AI** (chosen per file in the consent dialog) sends that one file to `/api/scan`. The server returns only its type (for example "Income certificate"), whether it is readable, and which upload field on the page it belongs to; names and numbers are never returned and the file is not stored. The panel then offers one click to place the file in that field. "Check on this device only" never sends the file.
- **Voice**: Chrome cannot show its microphone prompt inside a side panel, so the first time the panel opens `mic.html` in a tab to ask once. After that, voice input works in English or Hindi (choose the language next to the microphone).
- **Page frame**: whenever the guide opens a link, highlights a field or places a file, the portal page gets a green glowing frame with a short label, and "Opened …" after a navigation.

## What the panel sends to the AI service
Only your question, the last few turns of this conversation, the page title, the page address **without** its query string, fragment or session id (for example `;jsessionid=…`), the visible menu labels (names and long numbers such as “Welcome ASHA PATIL” or an application number are dropped) and the labels of upload fields. It never sends what you typed in form fields, your files, or anything that looks like a password, OTP, Aadhaar or card number: a message containing one is answered on your device and shown as “Message hidden”.

## Testing
- `npm test` runs the unit tests in `lib/lib.test.js` (rules, checks, privacy patterns, manifest hosts).
- `test/content-check.html` exercises `content.js` against a fake page (served from any local web server; it prints `CONTENT CHECKS PASSED`).
- `test/panel-harness.html` opens the side panel in a normal tab with a stubbed Chrome API.
- Menu links written as `javascript:` (common on MahaDBT) are clicked by the background worker inside the page, because Chrome blocks such a click when it comes from an extension script.

## Honest limits
- Public MahaDBT and NSP pages were inspected. **Logged-in scheme forms were not seen**, so field detection is generic (labels, `required`, `aria`). Expect to tune it on real pages.
- Upload size guidance (1 MB) is an **unverified default**, shown as a warning rather than a blocking portal rule. Each field’s accept attribute filters selectable files. Local processing is capped at 20 MB per file / 40 MB total.
- Server AI scanning is **not built**: needs a hosted provider, student consent UI (present), and a privacy review (DPDP Act).
- Official portals may object to extensions that drive their pages; get the portal owner's permission before any real use.
- Other government domains, including `prematric.mahait.org`, are not covered.

## Files
Prototype v0.9.5 adds a confirmed document-upload action after file selection. It only targets one nearby control labelled Upload/Upload document (or its supported Hindi label); general Save and application Submit buttons are excluded. The confirmation is bound to the page, selected file and button, expires in one minute, and cannot be replayed. The panel reports “Upload requested”, not successful receipt. Check the portal's result. Local checks do not read document contents or verify authenticity. Panel files are memory-only, but files sent to an official portal are governed by that portal's storage rules and are not automatically temporary.

`manifest.json` · `background.js` (opens the panel) · `content.js` (reads page, highlights, follows approved links, selects a chosen file) · `sidepanel.html/css/js` · `lib/portal.js` (MahaDBT facts + source note) · `lib/rules.js` (guide) · `lib/checks.js` (form/document checks) · `lib/sensitive.js` (what counts as a secret; shared by the rules and the checks) · `lib/lib.test.js` (unit tests, run with `npm test`) · `test/` (mock page and panel harness, dev only).

# TribalSaarthi Guide — Chrome extension (prototype)

A Manifest V3 extension. On `mahadbt.maharashtra.gov.in` and `scholarships.gov.in` it adds a **✦ TribalSaarthi guide** button and a Chrome **side panel** with:

- **Guide** — portal-specific answers and "take me to …" navigation to menu links that exist on the page you are on.
- **Check form** — scans the visible fields on the page for empty required fields and obvious format problems (email, 10-digit mobile, 6-digit PIN, names with digits). Password / OTP / CAPTCHA / Aadhaar / bank fields are **skipped and their values never read**.
- **Documents** — you pick a file from your computer. The panel **asks before every check** (on this device, or "send to server AI" which is disabled until a provider is connected). Local checks: real file type by content, extension mismatch, size vs limit, encrypted PDF, small image, duplicate file. It can then put the file into a portal upload field **only after you confirm**; you still click the portal's own Upload/Save/Submit.

## Website → official portal handoff
On the homepage choose **Use the guide on NSP** or **Use the guide on MahaDBT**. The handoff page checks whether this extension is detected, then opens the chosen official portal. An opportunity-specific handoff carries only a demo ID in the URL fragment, never personal data. The extension uses it once and removes the fragment. Chrome requires a user click to open the side panel; click the ✦ button or toolbar icon. For deployment, update the `bridge.js` match patterns to the website's production domain.

## What it never does
Log in, type passwords/OTP/CAPTCHA, fill text fields, submit, pay, delete, log out, or leave the supported official site. It does not decide eligibility and cannot tell whether a document is genuine.

## Load it (Chrome)
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → choose this `extension` folder.
2. Open https://mahadbt.maharashtra.gov.in/ or https://scholarships.gov.in/home and click the toolbar icon (or the on-page ✦ button).
3. After updating the files or granting the new NSP site permission, reload the extension and refresh the portal tab. The Codex in-app preview may not use your Chrome extension; test the guide in Chrome or Edge.

## If the ✦ button does not appear
1. `chrome://extensions` → find *TribalSaarthi Guide* → click the **reload** arrow (this also injects the guide into supported portal tabs that are already open). Check there is no red **Errors** button, and that the version is 0.6.0.
2. Look at the toolbar icon on the MahaDBT tab: a green **ON** badge means the page script is running; red **ERR** means it failed (see the tab's DevTools console for “[TribalSaarthi]”).
3. Click the toolbar icon. The panel opens even if the button is missing, and it now injects the page script itself if needed.
4. In the tab's console run `document.documentElement.dataset.tsaarthiGuide` — `"on"` means the script ran.
5. The extension must be on the exact host `mahadbt.maharashtra.gov.in` or `scholarships.gov.in` and Chrome ≥ 114 (side panel).

## Honest limits
- Public MahaDBT and NSP pages were inspected. **Logged-in scheme forms were not seen**, so field detection is generic (labels, `required`, `aria`). Expect to tune it on real pages.
- Upload size guidance (1 MB) is an **unverified default**, shown as a warning rather than a blocking portal rule. Each field’s accept attribute filters selectable files. Local processing is capped at 20 MB per file / 40 MB total.
- Server AI scanning is **not built**: needs a hosted provider, student consent UI (present), and a privacy review (DPDP Act).
- Official portals may object to extensions that drive their pages; get the portal owner's permission before any real use.
- Other government domains, including `prematric.mahait.org`, are not covered.

## Files
`manifest.json` · `background.js` (opens the panel) · `content.js` (reads page, highlights, follows approved links, selects a chosen file) · `sidepanel.html/css/js` · `lib/portal.js` (MahaDBT facts + source note) · `lib/rules.js` (guide) · `lib/checks.js` (form/document checks) · `lib/lib.test.js` (unit tests, run with `npm test`) · `test/` (mock page and panel harness, dev only).

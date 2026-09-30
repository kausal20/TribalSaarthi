# TribalSaarthi — guided scholarship discovery prototype (SIH26239)

**Prototype — fictional data; not an official Ministry portal; no live provider integration.**

## Premium UI (latest redesign)

Homepage: centred hero with cursor-following light (fine pointers only), Ctrl/⌘+K search combobox with suggestions, two full-width Framer Motion marquees under the search bar (portal tiles moving left, topic pills moving right; constant speed, seamless loop, eased pause on hover/focus, edge fade masks, no scrollbar; static wrapped rows under reduced motion), compact scholarship cards with the sparkle "Open with AI Guide" CTA, a 5-step journey, an *illustrative* AI-guide preview (fictional student, labelled), the "You stay in control" section, final CTA and footer. Framer Motion drives the micro-interactions (page transition, hero entrance, card lift, button spring, scroll reveals, journey line, typing replies); the marquee is a CSS transform. All motion respects `prefers-reduced-motion` (the marquee becomes a static, scrollable row).

Guide replies are typed out; on screens <= 900px the portal stacks above the guide with a "Back to guide" shortcut. My Applications shows progress derived from the local draft (filled fields + confirmed uploads). Marquee tiles/pills and search suggestions apply real filters against the demo catalogue. Tile marks (NSP, PM, …) are neutral monograms, not official logos. "National Scholarship Portal" and "State Scholarship" have no demo-catalogue entry, so they lead to an explicit "not in the demo catalogue" empty state.

## What it is now

A searchable catalogue of demo scholarship/fellowship entries. Picking one opens a **split workspace**: a clearly labelled *simulated provider page* (Overview, Eligibility, Documents, Application form, Status) on the left and a **TribalSaarthi guide** on the right. The guide navigates the simulated page and explains it, answering **only** from the selected scheme's local `assistantKnowledge`/field-help data. It is deterministic keyword matching, **not an LLM**. Unknown questions get: "I don't have verified information for that. Please check the official provider page." It refuses passwords/OTPs and never uploads or submits: the student clicks *Confirm upload* and *submit (simulated)*.

Routes (hash): `#/` catalogue · `#/opportunity/:id` detail · `#/guide/:id/:section` workspace (deep-linkable) · `#/applications` local drafts. The earlier workflow prototype (officer desk, versioned scheme configs, analytics, rule evaluator) is preserved under **Demo menu** (`#/tools`, `#/officer`, `#/schemes`, `#/analytics`).

## Real scholarship schemes in the catalogue

`src/catalogue/officialSchemes.ts` holds 8 real schemes for ST students, each with its official source and the date it was read (30 Sep 2026):

| Scheme | Official source |
|---|---|
| Post Matric Scholarship for ST Students (central) | tribal.nic.in scholarship page; income limit from a State (Goa) guideline |
| Pre Matric Scholarship for ST Students (Class 9–10) | Pre-Matric guidelines (17 Oct 2022) + rate revision (20 Dec 2019) |
| National Scholarship for Higher Education of ST Students (Top Class) | Ministry scheme note |
| National Fellowship for Higher Education of ST Students (NFST) | 2025-26 call for applications + scheme note |
| National Overseas Scholarship for ST Students (NOS) | FAQs for NOS 2026-27 |
| Post Matric Scholarship — Maharashtra | MahaDBT scheme page |
| Tuition Fee & Exam Fee (Freeship) — Maharashtra | MahaDBT scheme page |
| Vocational Training (ITI) Fee Reimbursement — Maharashtra | MahaDBT scheme page |

Rules: add a fact only from an official source; update `CHECKED` when you re-read the sources; keep deadlines as "see official notice" unless a current official notice gives the dates. Left out on purpose: NFST fellowship amounts (the 2023 revision is an unreadable scan) and the NOS allowance amounts (not in the FAQ). The four fictional "practice examples" remain for learning the flow and are labelled as such.

## AI guide quality check

The AI guide (website chat, homepage bubble, Chrome extension) is grounded in app data: `src/catalogue/aiGuide.ts` builds the scheme/catalogue context, `server/guide.mjs` holds the prompts and input sanitising.
Whenever you change the prompts, the data, or the model (`MESH_MODEL`), run the live check (costs roughly a cent):

```bash
npm run server        # in one terminal
npm run eval:guide    # 13 real questions: direct answers, no repeated intros/menus, eligibility from criteria without deciding, fallback for unknowns, correct navigation, Hindi, extension mode
```

It is kept out of `npm test` because it calls the paid API.

## Run

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # 34 unit tests (engine + catalogue/assistant/drafts)
npm run build   # typecheck + production build
```

## Working vs simulated vs future

| Working | Simulated | Future scope (not built) |
|---|---|---|
| Search/filters, detail, deep links, section navigation, grounded guide, field help, upload validation (type/size/content sniff), local drafts, reset, About/Safety drawer, earlier workflow tools | Provider portal page, catalogue entries and dates (marked illustrative), uploads/"submit", role switch | Live provider integration (needs official permission/APIs/security review), real login, secure storage, OCR, Hindi UI, verification |

Official info links open in a new tab and are view-only; this app never scripts or embeds a third-party portal. Browser storage is not secure; use fictional data only.

**Five-step demo:** 1) Search "overseas", clear it, open *Research fellowship* → **Open with assistant**. 2) Ask "Which page has the document list?" — the portal jumps to Documents. 3) Attach fictional samples (try the bad-file buttons), click *Confirm upload*. 4) Say "take me to application form", click a field to hear its help, fill in, *Review and submit (simulated)*. 5) Open *My applications* and *Continue on official website* (new tab).

---

# (Earlier build) SchemePath Demo workflow prototype


**SIH26239 PROTOTYPE — fictional data; not an official Ministry portal.** No live government connection. Browser-only. Not for real applicant data.

A configurable scholarship/fellowship workflow where **one form component and one deterministic rule checker** serve two **illustrative** schemes (NFST-inspired, NOS-inspired). Every decision is made by a person; nothing awards, rejects or verifies automatically.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 21 unit tests (engine)
npm run build      # typecheck + production build
```

No API keys, backend or database. No login: the header **Demo role switch (not authentication)** picks Asha Demo, Ravi Demo, Scrutiny officer, or Scheme admin. There are no demo credentials.

## Status of each part

| Part | Status |
|---|---|
| Scheme-driven form, document attach, PDF/PNG/JPG + 1 MB/3 MB guards, content sniffing | **Working** |
| Rule evaluator (`FIELD_*`, `DOC_*`; missing / attached-unverified / officer-reviewed) | **Working** (completeness only, not AI) |
| Central state machine, reasoned officer actions, append-only timeline, persistence over reload | **Working** |
| Versioned scheme editor; in-flight applications keep an immutable snapshot | **Working** |
| Analytics (counts from stored records only) | **Working** |
| Guided demo assistant (keyword answers from config; **not an LLM**) | **Working, deterministic** |
| Roles, applicants, documents, post-selection follow-up | **Simulated** |
| OCR, AI extraction, real auth, secure/encrypted storage, DigiLocker/Aadhaar/DBT/bank/portal integrations, real notifications | **Future scope — not built** |

## Assumptions

- Scheme A/B requirements are demonstration examples, not the official criteria. **Verify against current official PDFs** (https://tribal.nic.in/ScholarshiP.aspx) before stating any as fact. No numeric cut-offs or merit weights exist.
- Statuses: `DRAFT → SUBMITTED → NEEDS_CORRECTION → RESUBMITTED → UNDER_REVIEW → READY_FOR_SELECTION_REVIEW`. Added transition `SUBMITTED → RESUBMITTED` (applicant self-corrects, needed for the acceptance demo). Applications are editable in Draft, Submitted and Needs-correction only.
- "Ready for selection review" needs: a written reason, no empty fields/missing documents, and every attached required document marked *reviewed* by the officer. This is a design choice stricter than the TRD minimum.
- `POST_SELECTION_FOLLOWUP_DEMO` is an event only (no status change, no award, no payment), allowed after Ready.
- Files (≤1 MB each, ≤3 MB per application) are stored as data URLs in `localStorage`, so they persist across reload. If the quota fails, the change is rejected with a visible error and prior records stay intact.
- Editing a scheme publishes a **new version**; old versions and in-flight application snapshots are never modified. Reset restores both seed schemes to v1.

## Demo test steps

1. **Reset demo.** Role: *Student — Asha Demo* → Schemes & apply → Scheme A → Start.
2. Click *Review & submit* with empty fields → error summary + inline errors (empty mandatory field).
3. Fill fields, submit with no documents → `DOC_study_proof` and `DOC_academic_record` named as missing with "Why we need this".
4. Try *Demo helpers* (wrong type, oversized, corrupt, SVG) → each gives a visible error.
5. *Attach fictional sample* on each slot → status shows "Attached — authenticity not verified". *Upload and resubmit* → same ID `APP-…`, timeline grows. Refresh: unchanged.
6. Role: *Scrutiny officer* → Review queue → open → *Start review*, inspect the original files, try *Mark ready* early (rejected), *Request correction* with a reason.
7. Back to Asha: reason shown verbatim; resubmit with a note.
8. Officer: *Start review*, *I reviewed this original file* ×2, *Mark ready for selection review*, then *Record simulated follow-up*.
9. Role: *Ravi Demo* → Scheme B: `DOC_overseas_admission_proof` (PDF only) is required instead — same form and checker.
10. Role: *Scheme admin* → Scheme configs → compare, *Edit / publish new version* (e.g. add a required document), reload; new applications include the new rule, older ones keep v1.
11. *Reset demo* (with confirmation) clears applications and restores v1.

The *Demo scenario* button in the header lists this script.

## Tests

`npm test` covers: different DOC failures per scheme; attached ≠ verified; version snapshots; stable ID + append-only log + reload; officer reason on timeline; invalid transitions and no award path; bad/corrupt/oversized files, corrupt storage, quota failure; reset; analytics; assistant scope. The UI flow was additionally exercised by hand in a browser (desktop and 375 px width); there is no automated UI test suite.

## Planned real architecture (not implemented)

Separate authenticated applicant and officer clients, backend API, relational database, encrypted object storage, access policies, audit-integrity log, versioned policy engine, notifications, and official scheme/verification integrations — each subject to government approvals and a security design. OCR, if ever added, would only propose text for human correction.

## Layout

`src/engine/` pure logic (evaluator, workflow, storage, files, analytics, assistant, seeds, tests) · `src/pages/`, `src/components/` UI · `src/store.ts` localStorage-backed store.

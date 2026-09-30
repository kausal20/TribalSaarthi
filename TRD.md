# TRD — SIH26239 24-hour prototype

## Engineering principle
Implement an honest vertical slice that runs in a browser. Do not confuse `AI` with deterministic rule checks. Favor tested, explainable functions over a large generated codebase.

## Stack
Recommended: React, TypeScript, Vite, CSS; Vitest for unit tests and Playwright only if already installed. Persist fictional demo application metadata, scheme configurations, and events in browser localStorage behind a repository interface. No production backend/auth claims. If a repo already uses another working stack, retain it. Do not require API keys or a database server for the demo.

## Data model
`Scheme`: `id`, `name`, `version`, `description`, `fields[]` (`key`, `label`, `required`, `type`), `requiredDocuments[]` (`key`, `label`, `acceptedTypes`), `publishedAt`, `demoDisclaimer`.
`Application`: `id`, `schemeId`, `schemeVersion`, `applicantId`, `studentFields`, `documents[]` (`key`, `name`, `mime`, `size`, `attachedAt`, `verification:'UNVERIFIED'|'HUMAN_REVIEWED'`), `status`, `createdAt`, `updatedAt`, `events[]`.
`Event`: `id`, `timestamp`, `actorRole`, `type`, `message`, `ruleId?`; append only in app logic. Never edit prior events.
`CheckResult`: `ruleId`, `severity:'MISSING'|'NEEDS_REVIEW'|'INFO'`, `explanation`, `remedy`.

## State machine
`DRAFT` -> `SUBMITTED` -> `NEEDS_CORRECTION` -> `RESUBMITTED` -> `UNDER_REVIEW` -> `READY_FOR_SELECTION_REVIEW`. From `SUBMITTED` or `RESUBMITTED`, officer may request correction; an explicit officer review can advance to `READY_FOR_SELECTION_REVIEW`. `POST_SELECTION_FOLLOWUP_DEMO` is an **event only**, not proof of selection/award. Invalid transitions return an error, do not silently update. Application cannot be submitted with empty mandatory profile fields; document deficiencies *may* be submitted so the correction loop is demonstrable. Validate transitions centrally, not only by hiding buttons.

## Rule evaluator
`evaluate(schemeSnapshot, application)` is a pure function. Evaluate `requiredFields` and `requiredDocuments` by keys, produce stable rule IDs `FIELD_<key>` and `DOC_<key>`, descriptions and remedies. Never claim attached document is genuine. Do not infer caste or income eligibility from a filename. On application creation store immutable `schemeVersion` and a snapshot of relevant rule data, so later admin edits do not retroactively change an in-flight case. Seed Scheme A/B with a meaningfully different required document key. Editing scheme data produces a new version. The UI calls same evaluator for both schemes, no per-scheme forked pages.

## Persistence and file handling
For screening, localStorage is acceptable only with fictional data. Store small sample uploads (<= 1 MB each, max 3MB total) as data URLs only if implementation can ensure it persists after reload; otherwise store safe metadata and clearly say `demo attachment metadata, contents not persisted` and show file preview only during current session. Never silently imply a real permanent upload. Check extensions/MIME/size, sanitize displayed filenames, disallow executable and SVG uploads. Provide `Reset demo` with confirmation. Use `crypto.randomUUID()` for IDs. If browser quota fails, show visible error. Never claim browser storage is secure or suitable for real applicants.

## Screens
`/`: overview + demo disclaimer + student/officer role switch, not real authentication.
`/apply`: scheme choice, dynamic common form, documents and results with reasons.
`/application/:id`: status timeline, deficiency correction/resubmission.
`/officer`: queue, filtering, original demo evidence, rule results, reasoned review actions.
`/schemes`: compare versions and rule definitions (editable config only if core workflow done).
`/analytics`: counts computed from records.
Routes may be implemented as client-side tabs if faster; deep-linking optional.

## Security, ethics, and evidence boundaries
Use fictional applicants/documents; avoid Aadhaar, bank account and real certificates. No externally hosted LLM calls for uploaded documents. Role switch is a demo affordance, not access control. A production version needs server-side authentication, authorization, encrypted storage, audit integrity, retention policy, accessibility and formal government approvals. Explain this in README. If OCR added, manual verification is always required; hide claimed confidence unless measured.

## Tests (minimum)
1. Scheme A and B yield different DOC rule failures on same data.
2. Adding missing document resolves corresponding missing result but leaves verification `UNVERIFIED`.
3. Changing current scheme version does not silently change existing application snapshot.
4. Submit/resubmit preserves ID and event log; reload retains events.
5. Officer reason propagates to applicant timeline.
6. Invalid transition rejected; award cannot be automatic.
7. Corrupt/missing/oversized type produces visible error.
8. Reset leaves seed schemes and clears demo applications after confirmation.

## Definition of done
`npm install && npm run dev` works; `npm run build` succeeds; run available tests and record outcomes. Reviewer can complete both demo schemes on a laptop/mobile viewport. README includes startup, demo route, which functions are real, which are simulated and next phase. No claims of production readiness or real AI if none exists.
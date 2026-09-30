# PRD — SIH26239 scholarship workflow prototype

## Product intent
A transparent, configurable, human-reviewed scholarship/fellowship workflow for ST applicants and Ministry reviewers. **24-hour national-screening prototype**, not a production Ministry portal. Product working name: `SchemePath Demo` (team may rename). Do not reuse NETRA CARE AI branding. Source brief: https://zaidsayyed.in/tools/sih-problem-statements/sih26239 . Scheme background: https://tribal.nic.in/ScholarshiP.aspx .

## The actual problem
The SIH26239 brief covers applicant registration, application, document scrutiny, scheme-specific eligibility, screening/selection support, deficiency communication, tracking, dashboards and post-selection/fellowship management. Different schemes need different requirements, but duplicated manual checks and correspondence slow processing. Existing official scheme portals already exist; this demo is a proposed unified administrative workflow, **not a claim that no portal exists**. All exact demo rules are illustrative until checked against currently applicable government guidelines.

## Actors
- Applicant: selects scheme, completes application, attaches sample files, sees specific deficiencies, resubmits and tracks status.
- Scrutiny officer: sees queue, original documents and rule evidence, requests corrections with reason, manually advances to ready-for-selection review; can record a simulated later follow-up.
- Scheme administrator (small demo): compares/changes versioned scheme configurations; sees aggregate counts derived from records. May be same demo officer account for time box but label roles clearly.

## Prototype scope (must ship)
1. Two named *demo* scheme configurations inspired by NFST (domestic research fellowship) and NOS (overseas studies), clearly labeled `ILLUSTRATIVE — consult current official guidelines`. Each specifies field definitions, required document types and display text; use only non-controversial example fields such as study type and a required `study_proof` for one versus `overseas_admission_proof` for the other. No unverified numerical cut-offs or merit weights.
2. Same form component and same deterministic rule evaluator used by both schemes. Show rule ID and explanation; distinguish `missing`, `present but unverified`, `needs human review`.
3. Student submits application, corrects deficiencies and tracks it with stable application ID and timestamped activity log. Simulated student and officer views should see the same data after refresh.
4. Officer reviews attached evidence, requests correction with text reason, records `READY_FOR_SELECTION_REVIEW` manually, and records one `POST_SELECTION_FOLLOWUP_DEMO` event **without claiming award**.
5. Demo analytics computed from stored applications: per-scheme counts, deficiency counts, pending review.
6. Fictional sample records and files; reset demo button; persistent `Prototype — fictional data; no live government connection` banner on every screen.
7. Input guardrails: required fields, accepted PDF/PNG/JPG, file-size cap, meaningful errors; no public sharing of actual student data.

## Optional only after must-ship
- Grounded deterministic split-screen guidance panel for scheme questions and missing-document help. Label not AI.
- OCR on a demo document with visible extraction, uncertainty and human edit. Do not claim this unless functioning live.
- Read-only comparison of scheme rule versions and simulated status analytics.

## Explicitly out of scope
Native mobile app, external government portal embedding/automation, real certificate verification, Aadhaar, DigiLocker, payments, DBT, live government APIs, production identity/authentication, automatic final eligibility/selection, official merit ranking, email/SMS, actual awards. Add these to PPT as *future work subject to approvals* only.

## Core demo narrative
Asha Demo chooses Scheme A and submits without study proof. Platform explains missing requirement. She attaches it and resubmits. Officer reviews original file and asks for correction, Asha responds, officer advances for further selection review. In Scheme B, a different configured proof is required; the same engine detects that. A sample post-selection follow-up is shown as a simulated event, not payment.

## Acceptance checks
- Both schemes use common UI and common evaluator; change a scheme configuration without code and show changed behavior.
- No system check ever marks an attached document verified or grants an award automatically.
- Deficiency names precise missing item and shows its rule; remedy works.
- Officer reason appears in student timeline; stable ID and history persist after reload.
- No one can skip required statuses by clicking a UI shortcut.
- README and PPT distinguish implemented prototype, demonstration rules, planned OCR/AI, and future integrations.

## Success measures for screening
A live 2–3 minute demonstration without broken links or manual database intervention; clarity and correctness of rule evidence, a real correction loop, and two genuinely different configured schemes. No invented impact, accuracy, speed or approval-rate figures.
# Architecture — SIH26239 prototype

## System boundary
A self-contained browser prototype of a unified scholarship/fellowship workflow. The demo **does not connect** to Ministry, university, caste certificate, bank, DBT, or external scholarship systems. NFST/NOS names identify distinct real schemes but the executable rule examples are illustrative until verified against current official PDFs.

## Logical diagram
```text
Fictional student  ──┐
                    ├── React UI: shared scheme-driven form + status timeline
Demo officer      ──┤                           │
Scheme admin      ──┘                           ▼
                                    Application service / state machine
                                     │          │           │
                                     ▼          ▼           ▼
                                Rule evaluator  Event log   Demo analytics
                                     │          │           │
                                     └──────────┴───────────┘
                                                │
                                                ▼
                                      Browser demo repository
                                      (localStorage + versioned JSON)
```

## Components
- `SchemeRepository`: seed two rule sets, versions, read/edit immutable scheme snapshots.
- `ApplicationRepository`: read/create/update fictional applications, copy rule snapshot at creation.
- `RuleEvaluator`: pure, deterministic, reusable common form/checker across schemes.
- `WorkflowService`: guards transitions, attaches role/reason/timestamp to each event.
- `StudentWorkspace`: guided submission, uploaded-document status and understandable remedies.
- `OfficerWorkspace`: queue, original evidence, reasons and manual routing.
- `Analytics`: derived counts only. No made-up national metrics.
- `GuidancePanel` (optional): deterministic, scheme-grounded help, labeled demo; not an LLM.

## Sequence: normal demo
```text
Student → choose Scheme A → config loads → dynamic fields render
Student → submit without proof → rules return DOC_study_proof = MISSING
App → persist SUBMITTED + event; show named deficiency
Officer → request correction(reason) → persist NEEDS_CORRECTION + event
Student → attach proof + resubmit → rules reevaluate; status RESUBMITTED
Officer → review evidence → manually route READY_FOR_SELECTION_REVIEW
Student → refresh → same ID and timeline show current status
Admin → compare Scheme B; different required document via config alone
```

## Boundary between automation and authority
Rules only identify data completeness / illustrative checks. OCR, if implemented, extracts *candidate text*, not authenticated fact. Upload != validated document. Only human reviewer can move a case into selection review, and nobody in this prototype awards or pays funding. Post-selection is a simulated tracking event; future production functionality requires official integration.

## Future production architecture (not implemented)
Separate authenticated applicant and officer clients; backend API; relational database; encrypted object storage for files; access policies; versioned policy engine; audited notification and official scheme/verification integrations after authorization. Explain as future scope in PPT and never mark as current implementation.

## Technology decision
Browser-only storage maximizes chance of a robust 24-hour demo. The tradeoff is inability to support real multi-user access/security; the role switch demonstrates the workflow in one browser. Upgrade after shortlisting only with permission and security design. A single repo and explicit interfaces make that migration possible without pretending it is already done.
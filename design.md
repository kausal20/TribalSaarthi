# Design — SIH26239 scholarship workflow demo

## Design intent
Help a student know exactly what to do next, and help an officer understand which rule is involved, without making either trust unexplained AI. Warm, calm and accessible, not an official government visual clone. Place a persistent `SIH26239 PROTOTYPE — fictional data; not an official Ministry portal` banner on every screen. No Ministry seal/logo unless permission obtained.

## Visual system
Colors: navy `#14243A`, emerald `#087F71`, warm white `#F8FAF8`, gold `#E7A63C`, error `#B42318`. Use high-contrast text and visible keyboard focus. Font: system sans serif. Body >= 16px, labels above inputs, buttons >= 44px high. Use color plus icons/text—never color alone. Show mobile width 360px and desktop 1280px. Keep content max-width 1200px and group forms into clear sections.

## Navigation
Student: Home → Schemes → Start application → Review & submit → Application status → Correct deficiency.
Officer: Review queue → Application details → Documents/rule evidence → Request correction or advance with reason.
Admin: Scheme configurations/versions + small actual demo-record analytics. Use a prominent demo role-switcher labeled `Demo role switch (not authentication)`.

## Screen specifications
### Landing / scheme choice
Cards for illustrative NFST and NOS flows; each has purpose, nonauthoritative demo requirements, and `Start demo application`. Link official Ministry scheme information; note scheme rules may change.
### Applicant workspace
Desktop two-column: left form/attached sample docs; right optional help panel (grounded, non-LLM if built). Mobile single column with help collapsed. Show progress bar as UI convenience, not an eligibility score. Required docs listed by friendly names with `missing / attached-unverified / officer-reviewed` badges. Explain specific remedy in plain language. Save draft and show persistent application ID.
### Results and corrections
Do not render a frightening `REJECTED` badge for an incomplete form. Render `Needs your action: please add [document]`, rule ID, `Why we need this` (config text), and `Upload and resubmit`. Officer-requested reasons shown verbatim with time and actor. Do not reveal other applicants.
### Officer dashboard
Queue cards with current status and scheme/version; reviewing officer sees document preview, relevant configured checks and a plain-language difference between `field supplied` and `document verified`. Request correction requires entered reason; advance button reads `Mark ready for selection review`, never `Approve scholarship`.
### Tracking and analytics
Horizontal timeline on desktop / vertical on phone with timestamped events. Show a compact dashboard with counts derived from actual fictional applications; no invented processing time reductions or award rates.

## Copy and trust guidelines
Say `Potentially complete under demo rules; pending officer verification` rather than `Eligible`. Say `Document attached; authenticity not verified`. Use `Ready for selection review`, never `Awarded` unless an expressly fictional post-selection demo event clearly says simulated. If optional assistant is deterministic, label `Guided demo assistant—not connected to external portals`. Never say that the system is officially endorsed, integrated, or independently AI-powered if not demonstrable.

## Feedback and failures
Clear loading and save-success status, persistent after reload. File errors explain allowed types and max size; no silent upload failures. If local storage quota fills, show explicit error and preserve existing records; never overwrite silently. Error summary at top of form plus inline messages. Confirm before reset and show what will be erased.

## Demo script in UI
Use a top-right `Demo scenario` helper: `1. Start Asha's Scheme A application; 2. leave required demo proof empty; 3. submit; 4. attach file; 5. switch to officer; 6. request correction; 7. return to student; 8. resubmit; 9. officer advances; 10. compare Scheme B.` Hide helper in a real production design; here it assists screening judges.

## PPT/screenshots
Capture five true states: scheme selection, specific deficiency, corrected submission, officer decision with reason, student timeline plus alternate Scheme B rule. Label real demo screens as `Working prototype` and optional modules as `Planned`.
## Home discovery carousels
Preserve the existing premium.css palette and typography. InfiniteMarquee owns both Framer Motion tracks, seamless repeated groups, opposite directions, automatic playback without play/pause controls, with keyboard-focus pause for selecting items. Per the user request, these two tracks autoplay even when the browser requests reduced motion; other page animations keep their existing motion preferences. Hover does not stop automatic scrolling. The hero owns a higher stacking layer than the discovery section, so search suggestions always cover the carousel tiles. ExploreMarquees uses local official provider assets with reserved contain-fit dimensions. Scheme tiles use their provider logo, not an invented scheme logo. Filters retain existing catalogue behavior. The user requested official logos for these tiles; their use identifies providers without implying endorsement, overriding the earlier placeholder-logo direction for this section only.


## Discovery UX refinement
- Keep the premium.css teal/navy identity and shared tokens; muted text uses --t3 #667085 for stronger readability.
- Hero has two compact headline lines, short supporting copy and an explicit Search action. Suggestions stay above discovery content. Search supports touch, keyboard and composition input.
- At widths <=900px, the native details-based Main menu exposes student navigation; profile/demo tools remain separate. Language selection stays hidden until multiple languages work.
- Portal discovery contains three distinct official sources, opens external sites in new tabs, and identifies providers with original local logo assets. Topics continue to filter the internal demo catalogue. A stationary disclosure exposes both sets without waiting for animation.
- Catalogue cards lead with View scholarship and use Try guided demo as the secondary action, consistent with detail pages. Browser session storage preserves filters across navigation/reload and validates restored values; storage failure falls back to normal browsing.
- At widths <=640px, filters collapse behind an expanded-state button and removable active-filter chips remain visible. Native select menus remain intentional platform-owned controls.
- Section anchors reserve 110px for the sticky header. Local catalogue data renders immediately, without an artificial loading delay.
- Trust copy states that fictional practice drafts stay in this browser; it makes no security guarantee.


## Opportunity cards and chat workspace
Opportunity cards use a two-column desktop grid and one column below 640px. Restrained semantic accents identify research, overseas and school categories; metadata has a tinted surface and actions remain consistent. Do not introduce unverified award amounts or real eligibility claims.
The guided workspace retains natural-height document/form sections. Compact horizontal section navigation replaces the oversized sidebar. Chat alone owns a bounded scroll area and multiline composer; sources are expandable, send is disabled for empty/pending messages, Enter submits except during IME composition, and Shift+Enter creates a new line. Replies do not pull focus away from chat, and scrolling up suspends automatic following. At <=1000px, an explicit chat/application view switch preserves both panels' state. The rule-based demo disclosure stays visible; this redesign does not add an LLM backend.


## Taste audit refinement
Treat the landing page as a trust-first scholarship service: design variance 3/10, general motion 2/10, density 5/10. Existing native React/CSS components remain the foundation. The two continuously moving carousels are an explicit user-requested exception and remain unchanged in behavior.
The hero states the student task directly, without eyebrow pills, ornamental dots, cursor glow or a highlight underline. Keep teal as the single interface accent. Cards retain the two-column grid, consistent metadata, and clear actions; category distinctions use text rather than decorative icons or pastel palettes. Surface radius is 14px; control radius 8px; pills are reserved for topic choices.
The lower page contains a short task sequence, a working rule-based guide example, and compact safety guidance. The example uses the production respond() engine and shared GuideReply component; it is not a mock browser or screenshot. Remove the redundant final search pitch. Routes, navigation labels, real provider links and prototype disclosures remain intact.


## Chat-first guide direction
The user requested a centered prompt-led guide instead of side-by-side application and chat cards. Workspace overview opens in Chat on every screen size, with selected-scholarship context, a concise welcome, a wide multiline composer and actionable starter questions. The welcome collapses after the first message. Conversation history scrolls inside a bounded region while the composer stays outside it. Application sections are a separate view controlled by the same visible switch on desktop and mobile; direct non-overview links open that application section. Chat-triggered navigation preserves the conversation and exposes a View section action. Keep all form/draft logic and the rule-based disclosure intact.

## Extension form and document tools
Use calm teal/white tool headers, clear local-check disclosures, a keyboard-accessible file picker, and neutral empty states. Zero fields and unreadable pages must never render a success result. Sensitive values are skipped before reading. Unverified upload defaults are guidance only; file selection respects the field accept attribute. Checks stay local and do not claim OCR, authenticity or approval.

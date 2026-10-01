# TribalSaarthi design context

## Extension panel
Audience: students navigating official scholarship portals. The primary task is a conversation about the current page. Form and document checks are secondary tool views, reached through the composer plus menu and exited with Back to conversation.

Visual direction: calm, legible, restrained green and navy; a clear introductory headline, open assistant messages, pale user messages and an anchored multiline composer. Avoid decorative gradients and a permanent three-tab shell.

Runtime source of truth: extension/sidepanel.css. Body typography uses Segoe UI/system sans; headings use the same family with tighter tracking. Surfaces #fcfdfc and #edf2ee, text #283d32, action #24533e, border #d4e0d8. Spacing uses 4–8px increments. Scrollbars remain usable and narrow.

Motion: extension/sidepanel-motion.jsx owns Framer Motion message entrances, tool reveals and the waiting indicator. Respect reduced motion. The standalone production bundle must replace process.env.NODE_ENV and must not depend on Node globals. Core controls remain usable without animation.

Behavior: preserve local-only document checks and existing portal consent flows. Do not claim document authenticity or application approval. Enter sends, Shift+Enter creates a newline, IME Enter does not submit. Prevent duplicate requests and bound network waiting.

Document upload prototype: sidepanel.js owns file checks, target selection and confirmation through its existing dialog and chat primitives. content.js may click a single, nearby document Upload control only after confirmation; tokens expire after one minute, bind the selected file and page, and are consumed once. General Save and final application Submit controls are excluded. Feedback says “Upload requested”; only the portal can confirm receipt. No automatic retry after an uncertain result. Document contents are sent to the AI service only when the student chooses Scan with AI for that one file; the default is an on-device check.

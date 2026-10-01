# TribalSaarthi: what to say, and what not to say

Every line below is true of the build as it stands. Say it plainly; do not stretch it.

## 1. Hindi and Marathi
- The website and the browser panel switch between English, Hindi and Marathi. The AI answers in the chosen language.
- Scheme facts (eligibility, benefits, documents) stay exactly as the official source publishes them. We do not machine-translate official rules.
- Next: tribal languages, using Bhashini or a similar language service. Say "next", not "supported".

## 2. Helper mode
- A teacher, school clerk or NGO volunteer can switch on "Helping a student".
- Chats are saved on that device under the student's first name, so a clerk can return to each student. The name is never sent to the AI.
- Reminders: get the student's permission, never type Aadhaar, OTP or password.

## 3. Rejection-risk summary
- One card before applying: documents still missing, documents to fix, form fields to complete, entries to double-check.
- It is a checklist. It never says an application will be accepted or rejected; only the provider decides.

## 4. School and officer view (`#/dashboard`)
- Every number on it is invented sample data and is labelled DEMO DATA on the page. Never quote them as results.
- A real version would count only anonymous results that a student agrees to share. No names, Aadhaar numbers or files.

## 5. Low bandwidth: WhatsApp and SMS
- Slide: `docs/whatsapp-sms-slide.png` (source `docs/whatsapp-sms-slide.html`).
- Concept only. It would reuse the same matcher, checklist, languages and safety rules.
- Needs first: a WhatsApp Business account with approved templates, an SMS gateway with the registration Indian rules require, and a pilot with a school or NGO.

## Questions a judge may ask
- **Does it replace the government portal?** No. Students still apply on MahaDBT or NSP. We explain, check and prepare.
- **Where do documents go?** Checked on the device by default. A file is sent to the AI service only if the student picks "Scan with AI" for that file.
- **Is the AI always right?** No. Answers say so, name their source, and point to the official portal.
- **How many students use it?** None yet. It is a prototype; do not claim reach.

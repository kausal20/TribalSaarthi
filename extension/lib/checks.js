// Local, on-device checks. Nothing here sends data anywhere.

const startsWith = (b, sig) => sig.every((v, i) => b[i] === v);

export function detectType(bytes) {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  return null;
}

const EXT = { 'application/pdf': ['pdf'], 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'] };
const LABEL = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG' };
const kb = (n) => `${Math.round(n / 1000)} KB`;

/**
 * Basic document validation. file: {name,size,declaredType,bytes:Uint8Array,dims?:{w,h}}
 * limits: {maxBytes, accepted[], verified}
 * Returns [{level:'error'|'warn'|'info', text}]. It cannot tell if a document is genuine or correct.
 */
export function checkDocument(file, limits) {
  const out = [];
  const add = (level, text) => out.push({ level, text });
  const real = detectType(file.bytes);
  const ext = (file.name.toLowerCase().split('.').pop() || '');
  if (!file.size) add('error', 'The file is empty.');
  if (!real) add('error', 'The file content is not a PDF, JPG or PNG (it may be corrupt or renamed).');
  else {
    if (!EXT[real].includes(ext)) add('warn', `The name ends in .${ext} but the content is ${LABEL[real]}. Rename it correctly before uploading.`);
    if (!limits.accepted.includes(real)) add('error', `${LABEL[real]} is not in the accepted types (${limits.accepted.map((t) => LABEL[t]).join(', ')}).`);
  }
  const verifiedNote = limits.verified ? '' : ' (default limit, not verified — use the limit the portal shows)';
  if (file.size > limits.maxBytes) add(limits.verified ? 'error' : 'warn', `File is ${kb(file.size)}; the limit is ${kb(limits.maxBytes)}${verifiedNote}.`);
  else if (file.size > limits.maxBytes * 0.9) add('warn', `File is ${kb(file.size)}, close to the ${kb(limits.maxBytes)} limit${verifiedNote}.`);
  if (real === 'application/pdf') {
    const head = new TextDecoder('latin1').decode(file.bytes.subarray(0, Math.min(file.bytes.length, 200000)));
    const tail = new TextDecoder('latin1').decode(file.bytes.subarray(Math.max(0, file.bytes.length - 200000)));
    if (/\/Encrypt\b/.test(head + tail)) add('error', 'This PDF looks password-protected. Portals usually cannot read protected PDFs.');
    if (!/%%EOF/.test(tail)) add('warn', 'The PDF end marker is missing. Open the file to check whether it is complete.');
    const pages = (head.match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (pages) add('info', `About ${pages} page(s) (approximate count).`);
  }
  if (file.dims) {
    if (file.dims.invalid) { add('error', 'The image could not be opened. Export a new JPG or PNG and try again.'); return out; }
    if (Math.min(file.dims.w, file.dims.h) < 500) add('warn', `Image is small (${file.dims.w}×${file.dims.h}px). Text may be hard for an officer to read.`);
    else add('info', `Image size ${file.dims.w}×${file.dims.h}px.`);
  }
  if (!out.some((o) => o.level === 'error' || o.level === 'warn')) add('info', 'Passed the basic checks. This does not confirm the document is genuine or correct.');
  return out;
}

export function acceptsFile(accept, name, mime) {
  const rules = String(accept || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return !rules.length || rules.some(rule => rule.startsWith('.') ? name.toLowerCase().endsWith(rule) : rule.endsWith('/*') ? mime.startsWith(rule.slice(0, -1)) : mime === rule);
}

const SENS = /pass(word)?|otp|captcha|cvv|\bpin\b(?![ _-]*code)|aadhaar|aadhar|\buid\b|bank|account|ifsc|biometric/i;
export const isSensitive = (f) => SENS.test(`${f.label} ${f.name} ${f.id}`);

/**
 * Field checks on a scan result (values only present for non-sensitive fields).
 * fields: [{id,label,name,type,required,filled,sensitive,value?}]
 */
export function checkFields(fields) {
  const issues = [];
  for (const f of fields) {
    if (f.sensitive || isSensitive(f) || f.type === 'password' || f.disabled || f.readOnly) continue;
    const v = (f.value || '').trim();
    const L = f.label || f.name || 'Field';
    if (f.required && !f.filled) {
      issues.push({ id: f.id, level: 'error', text: `“${L}” is required and empty.` });
      continue;
    }
    if (!v) continue;
    const key = `${f.label} ${f.name}`.toLowerCase();
    if (/e-?mail/.test(key) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) issues.push({ id: f.id, level: 'warn', text: `“${L}” does not look like an email address.` });
    else if (/(mobile|phone|contact)/.test(key) && !/^[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ''))) issues.push({ id: f.id, level: 'warn', text: `“${L}” should be a 10-digit mobile number starting with 6–9.` });
    else if (/(pin ?code|postal|zip)/.test(key) && !/^\d{6}$/.test(v)) issues.push({ id: f.id, level: 'warn', text: `“${L}” should be a 6-digit PIN code.` });
    else if (/name/.test(key) && !/pin|user/.test(key) && /\d/.test(v)) issues.push({ id: f.id, level: 'warn', text: `“${L}” contains digits — check the spelling.` });
    else if (/(percent|marks|cgpa)/.test(key) && f.type !== 'select' && !/^\d+(\.\d+)?$/.test(v)) issues.push({ id: f.id, level: 'warn', text: `“${L}” should be a number.` });
  }
  return issues;
}

export function summarise(fields) {
  const visible = fields.filter((f) => f.type !== 'hidden' && !f.disabled && !f.readOnly);
  const req = visible.filter((f) => f.required);
  return { total: visible.length, required: req.length, requiredEmpty: req.filter((f) => !f.filled && !f.sensitive).length, sensitiveSkipped: visible.filter((f) => f.sensitive).length };
}

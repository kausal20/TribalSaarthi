import { fail, ok, type Result } from '../types';

export const MAX_FILE_BYTES = 1_000_000; // 1 MB per file
export const MAX_TOTAL_BYTES = 3_000_000; // 3 MB per application

const ALLOWED: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
};

export interface FileMeta {
  name: string;
  type: string;
  size: number;
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f<>"'`&|;$]/g, '_').trim();
  return (cleaned || 'file').slice(0, 80);
}

const kb = (n: number) => `${(n / 1000).toFixed(0)} KB`;

/** Sync guard: extension, declared MIME, size caps. `otherBytes` = size already attached to other slots. */
export function validateFile(file: FileMeta, acceptedTypes: string[], otherBytes = 0): Result<FileMeta> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const allowedList = acceptedTypes.map((t) => t.split('/')[1].toUpperCase().replace('JPEG', 'JPG')).join(', ');
  if (['svg', 'exe', 'bat', 'cmd', 'com', 'msi', 'js', 'sh', 'html', 'htm', 'scr', 'jar'].includes(ext) || file.type === 'image/svg+xml') {
    return fail(`"${sanitizeFilename(file.name)}" is not allowed (executable or SVG files are blocked). Allowed here: ${allowedList}.`);
  }
  const mimeExts = ALLOWED[file.type];
  if (!mimeExts || !acceptedTypes.includes(file.type) || !mimeExts.includes(ext)) {
    return fail(`Wrong file type for "${sanitizeFilename(file.name)}". Allowed here: ${allowedList} (max ${kb(MAX_FILE_BYTES)}).`);
  }
  if (file.size === 0) return fail(`"${sanitizeFilename(file.name)}" is empty.`);
  if (file.size > MAX_FILE_BYTES) {
    return fail(`"${sanitizeFilename(file.name)}" is ${kb(file.size)}; the limit is ${kb(MAX_FILE_BYTES)} per file.`);
  }
  if (otherBytes + file.size > MAX_TOTAL_BYTES) {
    return fail(`Total attachments would exceed ${kb(MAX_TOTAL_BYTES)} for this application.`);
  }
  return ok(file);
}

/** Checks that the leading bytes match the declared type (catches renamed/corrupt files). */
export function sniffMatches(bytes: Uint8Array, mime: string): boolean {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (mime === 'application/pdf') return starts([0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mime === 'image/png') return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === 'image/jpeg') return starts([0xff, 0xd8, 0xff]);
  return false;
}

/** Minimal valid one-page PDF with a fictional sample label. */
export function makeSamplePdf(label: string): Uint8Array {
  const safe = label.replace(/[()\\]/g, '');
  const stream = `BT /F1 16 Tf 20 120 Td (SAMPLE - FICTIONAL DOCUMENT) Tj 0 -30 Td (${safe}) Tj 0 -30 Td (No real person. Not verified.) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (out += `${String(o).padStart(10, '0')} 00000 n \n`));
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

export function dataUrlToBlobUrl(dataUrl: string): string {
  const [head, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

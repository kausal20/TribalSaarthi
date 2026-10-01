import { checkDocument, detectType } from '../../extension/lib/checks.js';
import type { DocType } from './bridge';

/** What the page knows about a file the student chose. The bytes stay in the browser; only this summary is shared. */
export interface FileMeta {
  name: string;
  kb: number;
  /** Which upload box the file name points at, or null when it does not say. */
  guess: DocType | null;
  check: 'passed' | 'warning' | 'failed';
  notes: string[];
}

export const MAX_CHECK_BYTES = 10 * 1024 * 1024;
export const ACCEPT = '.pdf,.png,.jpg,.jpeg';
export const isSupportedName = (name: string) => /\.(pdf|png|jpe?g)$/i.test(name);

/** Practice limits: not the real portal's, so a big file is a warning rather than a block. */
const LIMITS = { maxBytes: 2_000_000, accepted: ['application/pdf', 'image/jpeg', 'image/png'], verified: false };

export function guessDocType(name: string): DocType | null {
  const n = name.toLowerCase();
  if (/aadhaar|aadhar|adhar|\buid\b/.test(n)) return 'Aadhaar';
  if (/income|salary|tehsil|tahsil|itr/.test(n)) return 'Income';
  return null;
}

async function imageSize(bytes: Uint8Array): Promise<{ w: number; h: number; invalid?: boolean } | undefined> {
  const type = detectType(bytes);
  if (!type?.startsWith('image/')) return undefined;
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }));
    const size = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { w: 0, h: 0, invalid: true };
  }
}

/** Basic checks that run on the student's own device: real file type, size, encrypted PDF, unreadable or tiny image. */
export async function checkFile(file: File, guess: DocType | null = guessDocType(file.name)): Promise<FileMeta> {
  const base = { name: file.name, kb: Math.max(1, Math.round(file.size / 1000)), guess };
  if (file.size > MAX_CHECK_BYTES) return { ...base, check: 'failed', notes: ['The file is over 10 MB, which is too large to check here.'] };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const results = checkDocument({ name: file.name, size: file.size, bytes, dims: await imageSize(bytes) }, LIMITS);
    const problems = results.filter((r) => r.level === 'error' || r.level === 'warn');
    const check = results.some((r) => r.level === 'error') ? 'failed' : problems.length ? 'warning' : 'passed';
    return { ...base, check, notes: problems.map((r) => r.text).slice(0, 3) };
  } catch {
    return { ...base, check: 'failed', notes: ['The file could not be read. Choose it again.'] };
  }
}

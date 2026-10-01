// Plain-JavaScript modules that the website shares with the extension and the server (single source of truth).
declare module '*/extension/lib/sensitive.js' {
  export const HIDDEN_TEXT: string;
  export function sharesSecret(message: string): boolean;
  export function asksToHandleSecret(message: string): boolean;
}

declare module '*/extension/lib/checks.js' {
  export interface DocCheck { level: 'error' | 'warn' | 'info'; text: string }
  export function checkDocument(
    file: { name: string; size: number; bytes: Uint8Array; dims?: { w: number; h: number; invalid?: boolean } },
    limits: { maxBytes: number; accepted: string[]; verified: boolean },
  ): DocCheck[];
  export function detectType(bytes: Uint8Array): string | null;
}

declare module '*/extension/lib/readiness.js' {
  export type ReadinessKind = 'missing-doc' | 'doc-problem' | 'form-error' | 'form-warning';
  export interface ReadinessGroup { kind: ReadinessKind; title: string; items: string[] }
  export interface Readiness { level: 'low' | 'medium' | 'high'; total: number; blocking: number; groups: ReadinessGroup[]; headline: string; note: string }
  export const KINDS: Record<ReadinessKind, string>;
  export function buildReadiness(items?: { kind: ReadinessKind; text: string }[]): Readiness;
}

declare module '*/server/companion.mjs' {
  export type CompanionTarget = 'instructions' | 'form_section' | 'personal_details' | 'income_details' | 'documents';
  export const TARGETS: readonly CompanionTarget[];
  export const DOC_TYPES: readonly ['Aadhaar', 'Income'];
  export const FILL_FIELDS: readonly ['name', 'income'];
  export function normalizeTarget(raw: unknown): CompanionTarget | null;
  export function normalizeField(raw: unknown): 'name' | 'income' | 'aadhaar' | null;
  export function normalizeDocType(raw: unknown): 'Aadhaar' | 'Income' | null;
  export function cleanFileName(raw: unknown): string;
  export function parseRupees(raw: unknown): string | null;
  export function cleanFillValue(field: string, raw: unknown): string | null;
}

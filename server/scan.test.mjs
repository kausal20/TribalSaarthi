import { describe, expect, it } from 'vitest';
import { MAX_SCAN_B64, parseScan, sanitizeScanInput, scanPrompt } from './scan.mjs';

const fields = ['Passport size photograph', 'Income certificate'];

describe('AI document scan', () => {
  it('accepts only one PDF/JPG/PNG of a sane size', () => {
    expect(sanitizeScanInput({ name: 'a.pdf', mime: 'application/pdf', b64: 'JVBERi0=', fields })).toMatchObject({ mime: 'application/pdf', fields });
    expect(sanitizeScanInput({ name: 'a.exe', mime: 'application/x-msdownload', b64: 'AAAA' })).toBeNull();
    expect(sanitizeScanInput({ name: 'a.png', mime: 'image/png', b64: 'not base64!' })).toBeNull();
    expect(sanitizeScanInput({ name: 'a.png', mime: 'image/png', b64: 'A'.repeat(MAX_SCAN_B64 + 4) })).toBeNull();
    expect(sanitizeScanInput(null)).toBeNull();
  });
  it('keeps only known kinds and field labels that are really on the page', () => {
    const r = parseScan('```json\n{"kind":"income_certificate","field":"Income certificate","readable":true,"issues":[],"summary":"An income certificate."}\n```', fields);
    expect(r).toMatchObject({ kind: 'income_certificate', label: 'Income certificate', field: 'Income certificate', readable: true });
    expect(parseScan('{"kind":"spaceship","field":"Made up field","readable":false,"issues":[],"summary":"Unknown"}', fields)).toMatchObject({ kind: 'other_document', field: '', readable: false });
    expect(parseScan('no json here', fields)).toBeNull();
  });
  it('removes anything that looks like a number from the document', () => {
    const r = parseScan('{"kind":"aadhaar_card","field":"","readable":true,"issues":["Number 1234 5678 9012 is visible"],"summary":"Aadhaar 123456789012 of the student"}', fields);
    expect(JSON.stringify(r)).not.toMatch(/\d{4,}/);
  });
  it('tells the model never to read out names or numbers and lists the page fields', () => {
    const p = scanPrompt(fields);
    expect(p).toContain('Never write names, numbers');
    expect(p).toContain('"Income certificate"');
  });
  it('rejects missing and incorrectly typed scan results', () => {
    for (const text of ['{}', '[]', '{"kind":"income_certificate","readable":"false"}', '{"kind":"income_certificate","readable":true}']) expect(parseScan(text, fields)).toBeNull();
  });
  it('defaults missing scheme findings to unknown and refuses invented requirement IDs', () => {
    const result = parseScan(JSON.stringify({ kind:'income_certificate',field:'',readable:true,issues:[],summary:'Readable',review:[{id:'invented',status:'pass'}] }),fields,[{id:'r0',label:'Income',text:'Current financial year'}]);
    expect(result.review).toEqual([expect.objectContaining({id:'r0',status:'unknown'})]);
  });
});

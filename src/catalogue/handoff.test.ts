import { describe, expect, it } from 'vitest';
import { MAHADBT_HOME, NSP_HOME, extensionSupportsPortal, guidedPortalUrl, mahadbtHandoffUrl } from './handoff';

describe('MahaDBT handoff url', () => {
  it('carries only a safe scheme id in the fragment', () => {
    expect(mahadbtHandoffUrl('postmatric-demo')).toBe(`${MAHADBT_HOME}#tsaarthi=postmatric-demo`);
  });
  it('drops unsafe or missing ids', () => {
    expect(mahadbtHandoffUrl('<script>')).toBe(MAHADBT_HOME);
    expect(mahadbtHandoffUrl('a b')).toBe(MAHADBT_HOME);
    expect(mahadbtHandoffUrl(undefined)).toBe(MAHADBT_HOME);
    expect(mahadbtHandoffUrl('x'.repeat(41))).toBe(MAHADBT_HOME);
  });
});

describe('National Scholarship Portal handoff url', () => {
  it('opens the official NSP home and carries only a safe demo id', () => {
    expect(guidedPortalUrl('nsp')).toBe(NSP_HOME);
    expect(guidedPortalUrl('nsp', 'postmatric-demo')).toBe(`${NSP_HOME}#tsaarthi=postmatric-demo`);
    expect(guidedPortalUrl('nsp', '<script>')).toBe(NSP_HOME);
  });
});

describe('extension portal support', () => {
  it('does not call an old MahaDBT-only build NSP-ready', () => {
    expect(extensionSupportsPortal('0.4.0', 'mahadbt')).toBe(true);
    expect(extensionSupportsPortal('0.4.0', 'nsp')).toBe(false);
    expect(extensionSupportsPortal('0.5.0', 'nsp')).toBe(true);
    expect(extensionSupportsPortal('unknown', 'nsp')).toBe(false);
  });
});

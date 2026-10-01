import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { portalForHost, TRIBAL_PORTAL, sourceNoteFor } from './portal.js';
import { respond } from './rules.js';
import { handoffMessage } from './handoff.js';
import { portalPrompt } from '../../server/guide.mjs';

describe('Ministry scholarship portal', () => {
  it('recognises only the exact supported host', () => {
    expect(portalForHost('tribal.nic.in')).toBe(TRIBAL_PORTAL);
    expect(portalForHost('tribal.nic.in.evil.test')).toBeNull();
  });
  it('registers permissions, injection and redirect opening', () => {
    const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    expect(manifest.host_permissions).toContain('https://tribal.nic.in/*');
    expect(manifest.content_scripts[0].matches).toContain('https://tribal.nic.in/*');
    expect(readFileSync(new URL('../background.js', import.meta.url), 'utf8')).toContain('https://tribal.nic.in/*');
  });
  it('does not invent a ministry registration or application dashboard', () => {
    for (const query of ['Where do I register?', 'check my application status', 'my profile', 'login']) {
      const reply = respond(query, {}, TRIBAL_PORTAL);
      expect(reply.text).not.toContain('MahaDBT');
      expect(reply.actions || []).toHaveLength(0);
    }
    expect(sourceNoteFor(TRIBAL_PORTAL)).toContain('Ministry');
    expect(handoffMessage('nfst-demo', TRIBAL_PORTAL)).toContain('Ministry');
    expect(portalPrompt({ url: 'https://tribal.nic.in/ScholarshiP.aspx', links: [], uploadLabels: [] })).toContain('official Ministry of Tribal Affairs website');
  });
});

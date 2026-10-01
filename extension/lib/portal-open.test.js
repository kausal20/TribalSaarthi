import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const bridge = readFileSync(new URL('../bridge.js', import.meta.url), 'utf8');
const background = readFileSync(new URL('../background.js', import.meta.url), 'utf8');

describe('portal link opens the companion', () => {
  function click(href, overrides = {}) {
    let listener;
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    runInNewContext(bridge, {
      URL,
      document: { documentElement: { dataset: {} }, addEventListener: (_, fn) => { listener = fn; } },
      chrome: { runtime: { getManifest: () => ({ version: 'test' }), sendMessage } },
    });
    listener({ isTrusted: true, button: 0, target: { closest: () => ({ href }) }, ...overrides });
    return sendMessage;
  }
  it.each(['scholarships.gov.in', 'mahadbt.maharashtra.gov.in', 'mahadbt2.maharashtra.gov.in', 'tribal.nic.in'])('opens for a real click on %s', (host) => {
    expect(click(`https://${host}/`).mock.calls[0][0]).toEqual({ type: 'open-panel-for-portal', url: `https://${host}/` });
  });
  it('ignores unrelated, insecure and synthetic links', () => {
    expect(click('https://example.com/')).not.toHaveBeenCalled();
    expect(click('http://scholarships.gov.in/')).not.toHaveBeenCalled();
    expect(click('https://scholarships.gov.in/', { isTrusted: false })).not.toHaveBeenCalled();
  });
  function worker() {
    let listener;
    const open = vi.fn().mockResolvedValue(undefined);
    runInNewContext(background, { URL, chrome: {
      runtime: { onInstalled: { addListener() {} }, onMessage: { addListener: fn => { listener = fn; } } },
      sidePanel: { open, setPanelBehavior: () => Promise.resolve() },
    } });
    return { listener, open };
  }
  it('opens synchronously for the whole window and responds after completion', async () => {
    const { listener, open } = worker();
    const reply = vi.fn();
    expect(listener({ type: 'open-panel-for-portal', url: 'https://scholarships.gov.in/' },
      { url: 'https://tribalsaarthi.vercel.app/', tab: { windowId: 9 } }, reply)).toBe(true);
    expect(open).toHaveBeenCalledWith({ windowId: 9 });
    await Promise.resolve();
    expect(reply).toHaveBeenCalledWith({ ok: true });
  });
  it('rejects messages from untrusted pages', () => {
    const { listener, open } = worker();
    listener({ type: 'open-panel-for-portal', url: 'https://scholarships.gov.in/' },
      { url: 'https://example.com/', tab: { windowId: 9 } }, vi.fn());
    expect(open).not.toHaveBeenCalled();
  });
  it('handles Chrome refusing the panel without an unhandled rejection', async () => {
    const { listener, open } = worker();
    open.mockRejectedValue(new Error('No user gesture'));
    const reply = vi.fn();
    listener({ type: 'open-panel-for-portal', url: 'https://scholarships.gov.in/' },
      { url: 'http://localhost:4500/', tab: { windowId: 9 } }, reply);
    await Promise.resolve();
    expect(reply).toHaveBeenCalledWith({ ok: false });
  });
});

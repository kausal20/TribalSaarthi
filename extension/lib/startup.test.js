import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const bridge = readFileSync(new URL('../bridge.js', import.meta.url), 'utf8');
describe('extension bridge startup', () => {
  it('waits for the document root at document_start', () => {
    let observe, disconnected = false;
    const document = { documentElement: null, addEventListener() {} };
    runInNewContext(bridge, {
      document,
      chrome: { runtime: { getManifest: () => ({ version: '0.9.6' }) } },
      MutationObserver: class {
        constructor(callback) { observe = callback; }
        observe() {}
        disconnect() { disconnected = true; }
      },
    });
    document.documentElement = { dataset: {} };
    observe();
    expect(document.documentElement.dataset.tsaarthiExt).toBe('0.9.6');
    expect(disconnected).toBe(true);
  });
  it('does not throw when an old extension context is invalidated', () => {
    expect(() => runInNewContext(bridge, {
      document: { documentElement: { dataset: {} }, addEventListener() {} },
      chrome: { runtime: { getManifest() { throw new Error('Extension context invalidated'); } } },
    })).not.toThrow();
  });
});

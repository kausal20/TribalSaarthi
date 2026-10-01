// Runs on TribalSaarthi only. Detect the extension and open the companion during
// the student's portal-link click, while Chrome's user gesture is still active.
(() => {
  const supportedHosts = new Set(['scholarships.gov.in', 'mahadbt.maharashtra.gov.in', 'mahadbt2.maharashtra.gov.in', 'tribal.nic.in']);
  document.addEventListener('click', (event) => {
    if (!event.isTrusted || event.button !== 0 || event.shiftKey) return;
    const link = event.target?.closest?.('a[href]');
    if (!link) return;
    try {
      const url = new URL(link.href);
      if (url.protocol !== 'https:' || !supportedHosts.has(url.hostname)) return;
      // Do not prevent navigation: the official link still works if the extension
      // was reloaded or Chrome cannot open the panel. Never await before sending.
      chrome.runtime.sendMessage({ type: 'open-panel-for-portal', url: url.href }).catch(() => {});
    } catch { /* Invalid URL or an extension context invalidated by reload. */ }
  }, true);
  const mark = () => {
    try {
      if (!document.documentElement) return false;
      document.documentElement.dataset.tsaarthiExt = chrome.runtime.getManifest().version;
      return true;
    } catch { return true; } // An old content-script context may be invalid after reload.
  };
  if (!mark()) {
    const observer = new MutationObserver(() => { if (mark()) observer.disconnect(); });
    observer.observe(document, { childList: true, subtree: true });
  }
})();

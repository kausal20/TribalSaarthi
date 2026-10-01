const PATTERNS = ['https://mahadbt.maharashtra.gov.in/*', 'https://mahadbt2.maharashtra.gov.in/*', 'https://scholarships.gov.in/*', 'https://tribal.nic.in/*'];

// Chrome injects manifest content scripts only into pages loaded AFTER the extension is installed or
// reloaded. Tabs that were already open never get them, so inject into those ourselves.
async function inject(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return true;
  } catch (e) {
    return false;
  }
}

async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: PATTERNS });
  await Promise.all(tabs.filter((t) => t.id != null).map((t) => inject(t.id)));
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true })?.catch(() => {});
  injectIntoOpenTabs().catch(() => {}); // Tabs may close or the extension may reload during startup.
});
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true })?.catch(() => {});

function badge(tabId, text, color) {
  if (tabId == null) return;
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'open-panel-for-portal') {
    let allowed = false;
    try {
      const source = new URL(sender.url);
      const destination = new URL(msg.url);
      allowed = ['https://tribalsaarthi.vercel.app', 'http://localhost:4500', 'http://localhost:5173'].includes(source.origin)
        && destination.protocol === 'https:'
        && ['scholarships.gov.in', 'mahadbt.maharashtra.gov.in', 'mahadbt2.maharashtra.gov.in', 'tribal.nic.in'].includes(destination.hostname);
    } catch { /* Only the trusted portal bridge may request this. */ }
    if (!allowed || sender.tab?.windowId == null || !chrome.sidePanel?.open) {
      sendResponse({ ok: false });
      return false;
    }
    // Open globally in this window so a target=_blank portal tab keeps the panel.
    // Calling directly (before any await) preserves the originating link gesture.
    chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(
      () => sendResponse({ ok: true }), () => sendResponse({ ok: false }),
    );
    return true;
  } else if (msg?.type === 'open-panel' && sender.tab?.id != null) {
    // Must run in response to the student's click on the launcher; Chrome enforces this.
    // The page is told whether it worked, so it can point at the toolbar icon when Chrome refuses.
    if (!chrome.sidePanel?.open) { sendResponse({ ok: false }); return false; } // browsers without the side panel API
    chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true; // async response
  } else if (msg?.type === 'alive') {
    badge(sender.tab?.id, 'ON', '#0F8B78'); // toolbar badge = the page script is running on this tab
  } else if (msg?.type === 'error') {
    badge(sender.tab?.id, 'ERR', '#B42318');
  } else if (msg?.type === 'page-click' && sender.tab?.id != null && /^c[a-z0-9]{3,30}$/.test(String(msg.token))) {
    // Clicks a menu link that the content script marked, inside the page's own JavaScript world. Needed for
    // "javascript:" links, which Chrome blocks when they are clicked from an extension script.
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      args: [msg.token],
      func: (token) => {
        const link = document.querySelector('[data-ts-click="' + token + '"]');
        if (!link) return;
        link.removeAttribute('data-ts-click');
        link.click();
      },
    }).catch(() => {});
  } else if (msg?.type === 'inject' && msg.tabId != null) {
    inject(msg.tabId).then((ok) => sendResponse({ ok }));
    return true; // async response
  }
  return false;
});

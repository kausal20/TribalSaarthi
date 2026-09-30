const PATTERNS = ['https://mahadbt.maharashtra.gov.in/*', 'https://scholarships.gov.in/*'];

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
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  injectIntoOpenTabs();
});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

function badge(tabId, text, color) {
  if (tabId == null) return;
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'open-panel' && sender.tab?.id != null) {
    // Must run in response to the student's click on the launcher; Chrome enforces this.
    chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
  } else if (msg?.type === 'alive') {
    badge(sender.tab?.id, 'ON', '#0F8B78'); // toolbar badge = the page script is running on this tab
  } else if (msg?.type === 'error') {
    badge(sender.tab?.id, 'ERR', '#B42318');
  } else if (msg?.type === 'inject' && msg.tabId != null) {
    inject(msg.tabId).then((ok) => sendResponse({ ok }));
    return true; // async response
  }
  return false;
});

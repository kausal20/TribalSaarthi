// Asks for microphone access in a normal tab (the side panel cannot show Chrome's permission prompt).
// Once allowed here, the guide panel can use voice input. No audio is recorded or kept by this page.
const status = document.getElementById('status');
const again = document.getElementById('again');

async function closeSoon() {
  setTimeout(async () => {
    try { const tab = await chrome.tabs.getCurrent(); if (tab?.id != null) await chrome.tabs.remove(tab.id); } catch { window.close(); }
  }, 1600);
}

async function ask() {
  again.hidden = true;
  status.className = '';
  status.textContent = 'Waiting for your choice…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    status.textContent = 'Microphone allowed. You can close this tab and speak to the guide.';
    chrome.runtime.sendMessage({ type: 'mic-permission', granted: true }).catch(() => {});
    closeSoon();
  } catch (error) {
    const blocked = error?.name === 'NotAllowedError';
    status.className = 'bad';
    status.textContent = blocked
      ? 'The microphone is blocked. Click the icon at the left of the address bar, set Microphone to Allow, then press “Ask again”.'
      : 'No microphone was found. Connect one, then press “Ask again”.';
    again.hidden = false;
    chrome.runtime.sendMessage({ type: 'mic-permission', granted: false }).catch(() => {});
  }
}
again.addEventListener('click', ask);
ask();

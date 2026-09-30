// Runs on the TribalSaarthi website only. It sets ONE attribute so the site can show
// "extension detected". It reads nothing from the page and sends nothing anywhere.
document.documentElement.dataset.tsaarthiExt = chrome.runtime.getManifest().version;

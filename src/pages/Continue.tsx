import { useEffect, useState } from 'react';
import { findOpportunity } from '../catalogue/data';
import { extensionSupportsPortal, extensionVersion, guidedPortalUrl, GUIDED_PORTALS, type GuidedPortal } from '../catalogue/handoff';
import { BackIcon, ExternalIcon } from '../components/icons';

/** Explains the browser-extension handoff before opening an official portal. */
export function Continue({ portal, id }: { portal: GuidedPortal; id?: string }) {
  const opp = id ? findOpportunity(id) : undefined;
  const destination = GUIDED_PORTALS[portal];
  const [ext, setExt] = useState<string | null | 'checking'>('checking');
  const supported = ext !== 'checking' && ext !== null && extensionSupportsPortal(ext, portal);

  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      const v = extensionVersion();
      if (v || ++tries > 8) { setExt(v); clearInterval(t); }
    }, 250);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="cont">
      <a href={opp ? `#/opportunity/${opp.id}` : '#/'} className="back"><BackIcon width={16} height={16} /> Back</a>
      <header className="cont-head">
        <p className="eyebrow">Continue on the official portal</p>
        <h1>Open {destination.name} with your guide</h1>
        {opp && <p className="d-sub">You are continuing from <strong>{opp.title}</strong>.</p>}
      </header>

      <ol className="cont-steps">
        <li>
          <h2>1. Get the TribalSaarthi Chrome extension</h2>
          {ext === 'checking' && <p className="cont-status" role="status">Checking for the extension…</p>}
          {supported && <p className="cont-status ok" role="status">✓ Extension detected (v{ext}).</p>}
          {ext !== 'checking' && ext && !supported && <div className="cont-status warn" role="status"><p>Extension v{ext} needs an update to guide you on {destination.name}. In Chrome, open <code>chrome://extensions</code> and reload TribalSaarthi Guide, then refresh this page.</p></div>}
          {ext === null && (
            <div className="cont-status warn" role="status">
              <p>Extension not detected in this browser. You can still open {destination.name}, but the side-panel guide will not appear here.</p>
              <p className="fine">Open this website in Chrome or Edge with the TribalSaarthi extension installed; the in-app preview may not run your Chrome extensions. In Chrome, open <code>chrome://extensions</code>, turn on Developer mode, choose <strong>Load unpacked</strong>, select this project’s <code>extension</code> folder, then refresh this page.</p>
            </div>
          )}
        </li>
        <li>
          <h2>2. Continue to {destination.name}</h2>
          <p>{destination.name} opens in a new tab. {opp ? 'The link carries only this demo’s identifier — nothing about you.' : 'No personal information is sent in this link.'}</p>
          <a className="btn-solid" href={guidedPortalUrl(portal, opp?.id)} target="_blank" rel="noopener noreferrer">Continue to {destination.name} <ExternalIcon width={15} height={15} /><span className="sr-only"> (opens in a new tab)</span></a>
        </li>
        <li>
          <h2>3. Open the guide there</h2>
          <p>On {destination.name} click the <strong>✦ TribalSaarthi guide</strong> button (or the extension icon). Chrome only opens a side panel after you click, so it cannot open by itself.</p>
        </li>
      </ol>

      <section className="panel cont-safe" aria-labelledby="safe-h">
        <h2 id="safe-h">You stay in control</h2>
        <ul>
          <li>The guide never asks for, reads or types your password, OTP or CAPTCHA.</li>
          <li>You fill in details, upload and submit on {destination.name} yourself.</li>
          <li>Documents are checked on your device. You are asked before every check.</li>
          <li>TribalSaarthi is an independent prototype, not part of {destination.name} or the Government.</li>
        </ul>
      </section>
    </div>
  );
}

export function TrustSection() {
  return (
    <section className="sec safety-note" aria-labelledby="trust-h">
      <h2 id="trust-h">Before you apply</h2>
      <div><p>Practise with fictional data. Drafts are saved in this browser, so you can return to them on this device. Apply for real only on the official provider website.</p>
      <p>Never share passwords or OTPs with the guide. You review and submit every application yourself.</p></div>
      <div className="trust-strip" aria-label="What this demo helps with"><div><strong>4</strong><span>demo opportunities</span></div><div><strong>3</strong><span>guided preparation steps</span></div><div><strong>0</strong><span>official decisions made here</span></div></div>
    </section>
  );
}

export function Footer({ onAbout }: { onAbout: () => void }) {
  return (
    <footer className="footer">
      <div className="wrap2 footer-row">
        <div>
          <strong>TribalSaarthi</strong>
          <p>A guidance layer for scholarship applications. The government portal remains the official place to apply.</p>
        </div>
        <ul>
          <li><a href="#/">Opportunities</a></li>
          <li><a href="#/applications">My Applications</a></li>
          <li><button type="button" onClick={onAbout}>About &amp; safety</button></li>
          <li><a href="https://tribal.nic.in/ScholarshiP.aspx" target="_blank" rel="noopener noreferrer">Official scheme information ↗</a></li>
        </ul>
      </div>
      <div className="wrap2 footer-fine">
        Prototype for SIH 2026 · fictional demo data · not an official government portal · no live provider integration · browser storage is not secure.
      </div>
    </footer>
  );
}

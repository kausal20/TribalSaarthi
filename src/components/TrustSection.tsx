import { useT } from '../i18n/i18n';

const POINTS = [
  'Never asks for your OTP or password',
  'You confirm every upload and submit yourself',
  'Documents are checked on your device',
  'The official portal is where you apply',
];

/** One calm safety band. Replaces the earlier stats strip. */
export function TrustSection({ onAbout }: { onAbout?: () => void }) {
  const t = useT();
  return (
    <section className="sec" aria-labelledby="trust-h">
      <div className="safety-band">
        <div>
          <h2 id="trust-h">{t('You stay in control')}</h2>
          <p>{t('TribalSaarthi explains and checks. It is independent of the government portals.')}</p>
          {onAbout && <button type="button" className="linkbtn" onClick={onAbout}>{t('About & safety')}</button>}
        </div>
        <ul>{POINTS.map((p) => <li key={p}>{t(p)}</li>)}</ul>
      </div>
    </section>
  );
}

export function Footer({ onAbout }: { onAbout: () => void }) {
  const t = useT();
  return (
    <footer className="footer">
      <div className="wrap2 footer-row">
        <div>
          <strong>TribalSaarthi</strong>
          <p>{t('A guidance layer for scholarship applications. The government portal remains the official place to apply.')}</p>
        </div>
        <ul>
          <li><a href="#/">{t('Opportunities')}</a></li>
          <li><a href="#/applications">{t('My Saved')}</a></li>
          <li><a href="#/dashboard">{t('For schools & officers (demo data)')}</a></li>
          <li><button type="button" onClick={onAbout}>{t('About & safety')}</button></li>
          <li><a href="https://tribal.nic.in/ScholarshiP.aspx" target="_blank" rel="noopener noreferrer">{t('Official scheme information ↗')}</a></li>
        </ul>
      </div>
      <div className="wrap2 footer-fine">
        {t('Prototype for SIH 2026 · not an official government portal · practice examples use fictional data · browser storage is not secure.')}
      </div>
    </footer>
  );
}

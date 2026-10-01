import { useState, type ReactNode } from 'react';
import { ExtensionPreview } from './ExtensionPreview';
import { SparkleIcon } from './icons';
import { go } from '../router';
import { useT } from '../i18n/i18n';

/** Ask the floating AI guide (it opens with a starter question). */
const askGuide = () => go('/guide/nfst-demo/overview');

export function Hero({ children }: { children: ReactNode }) {
  const t = useT();
  const [preview, setPreview] = useState(false);
  return (
    <section className="hx" aria-labelledby="hero-h">
      <div className="hx-inner">
        {/* When the extension is final, the "Download extension" button goes in this note. */}
        <p className="hx-proto" role="note">
          <span className="hx-proto-tag">{t('Coming soon')}</span>
          <span>{t('TribalSaarthi includes an upcoming Chrome extension for live guidance on MahaDBT and NSP. Watch the preview via the Video link. Download coming soon!')}</span>
          <button type="button" className="hx-watch" onClick={() => setPreview(true)}><span className="hx-play" aria-hidden="true">▶</span> {t('Watch preview')}</button>
        </p>
        <ExtensionPreview open={preview} onClose={() => setPreview(false)} />
        <h1 id="hero-h">{t('Find the right scholarship.')}</h1>
        <p className="hx-sub">{t('Real schemes for ST students, with the official source for every fact. Get answers from the guide, then apply on the official portal.')}</p>
        <div className="hx-search">{children}</div>
        <p className="hx-help">
          {t('Not sure which one fits?')}{' '}
          <button type="button" className="hx-ask" onClick={askGuide}><SparkleIcon width={14} height={14} /> {t('Ask the guide')}</button>
        </p>
      </div>
    </section>
  );
}

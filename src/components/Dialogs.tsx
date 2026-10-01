import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '../i18n/i18n';

/** Native <dialog>: focus trap, Esc to close, and focus return are handled by the browser. */
export function Dialog({ open, onClose, title, children, side, left }: { open: boolean; onClose: () => void; title: string; children: ReactNode; side?: boolean; left?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dlg ${side ? 'dlg-side' : ''} ${left ? 'dlg-left' : ''}`}
      aria-labelledby="dlg-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dlg-body">
        <div className="row between">
          <h2 id="dlg-title">{title}</h2>
          <button type="button" className="btn-quiet" onClick={onClose} aria-label={t('Close')}>
            ✕ {t('Close')}
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function AboutSafety({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t('About & safety')} side>
      <h3>{t('You stay in control')}</h3>
      <ul>
        <li>{t('The guide explains pages and fields. You review and click every upload and submit yourself.')}</li>
        <li>{t('Never share passwords, OTPs, PINs or ID/bank numbers with the guide. It never needs them. Messages that look like these are not sent to the AI.')}</li>
        <li>{t('Documents are checked on your device by default. A file is read by AI only if you choose “Scan with AI” for that file in the browser extension.')}</li>
      </ul>
      <h3>{t('How the AI is used')}</h3>
      <ul>
        <li>{t('Saarthi AI answers from the official scheme facts in this catalogue. It can make mistakes, so confirm on the official portal.')}</li>
        <li>{t('Your question, recent chat and language are sent to the AI service.')}</li>
        <li>{t('Scholarship decisions are made only by the provider, never by TribalSaarthi.')}</li>
      </ul>
      <h3>{t('What this prototype is')}</h3>
      <ul>
        <li>{t('An independent prototype for SIH 2026. It is not an official government portal.')}</li>
        <li>{t('Practice examples use fictional data. The school and officer page uses demo numbers only.')}</li>
        <li>{t('Browser storage is not secure. Do not keep real personal data in practice examples.')}</li>
      </ul>
      <h3>{t('What comes next')}</h3>
      <p>{t('More languages, including tribal languages, using a language service such as Bhashini. A WhatsApp or SMS version for low-bandwidth areas. Official integration would need permission from the portals.')}</p>
    </Dialog>
  );
}

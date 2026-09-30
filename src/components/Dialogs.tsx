import { useEffect, useRef, type ReactNode } from 'react';

/** Native <dialog>: focus trap, Esc to close, and focus return are handled by the browser. */
export function Dialog({ open, onClose, title, children, side }: { open: boolean; onClose: () => void; title: string; children: ReactNode; side?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dlg ${side ? 'dlg-side' : ''}`}
      aria-labelledby="dlg-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dlg-body">
        <div className="row between">
          <h2 id="dlg-title">{title}</h2>
          <button type="button" className="btn-quiet" onClick={onClose} aria-label="Close">
            ✕ Close
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function AboutSafety({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="About & safety" side>
      <h3>You stay in control</h3>
      <ul>
        <li>The guide explains pages and fields. You review and click every upload and submit yourself.</li>
        <li>Never share passwords, OTPs, PINs or ID/bank numbers with the guide. It never needs them.</li>
        <li>Uploaded files stay in this browser. They are not sent to any server or external AI.</li>
      </ul>
      <h3>What this prototype is</h3>
      <ul>
        <li>A guided browser prototype. The “provider page” is a local, clearly labelled simulation — not a real government portal and not a live integration.</li>
        <li>The guide is a deterministic helper that answers only from each scheme’s local demo data. It is not an LLM.</li>
        <li>Catalogue entries, requirements and dates are demonstration content marked illustrative. Verify on the official provider page.</li>
        <li>Browser storage is not secure. Use fictional data only.</li>
      </ul>
      <h3>Future scope (not built)</h3>
      <p>Real integration would need official permission, provider APIs, security review, accessibility validation, authenticated accounts and secure storage. Real portals may block embedding or automation, so this prototype does none of it: the official site opens in a new tab and is view-only.</p>
    </Dialog>
  );
}

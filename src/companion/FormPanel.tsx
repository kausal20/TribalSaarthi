import { useState, type DragEvent, type RefObject } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { DOC_LABEL, PROGRESS_TOTAL, aadhaarDigits, formatAadhaar, progress, type DocType, type FileSlot, type FormState, type Tab, type TargetId } from './bridge';
import { ACCEPT } from './files';
import { DrawnCheck, ShieldIcon, UploadIcon } from './icons';
import { SparkleIcon } from '../components/icons';

export interface FormPanelProps {
  form: FormState;
  /** The section the assistant just pointed at. */
  lit: TargetId | null;
  /** Fields / upload boxes the assistant just changed (drives the highlight). */
  flash: Record<string, boolean>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onTab: (tab: Tab) => void;
  onType: (field: 'name' | 'aadhaar' | 'income', value: string) => void;
  onManualFile: (doc: DocType, file: File) => void;
  onClearFile: (doc: DocType) => void;
}

function AiBadge() {
  return <span className="cmp-ai-badge"><SparkleIcon width={11} height={11} /> Filled by assistant</span>;
}

function UploadCard({ doc, slot, flash, onFile, onClear }: { doc: DocType; slot: FileSlot; flash: boolean; onFile: (f: File) => void; onClear: () => void }) {
  const reduce = useReducedMotion();
  const [over, setOver] = useState(false);
  const inputId = `cmp-file-${doc}`;
  const drop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };
  return (
    <div id={`cmp-upload-${doc}`} className={`cmp-upload is-${slot.status} ${flash ? 'is-flash' : ''}`}>
      <span className="cmp-label" id={`${inputId}-label`}>{DOC_LABEL[doc]} Upload <em>(File)</em> <b aria-hidden="true">*</b></span>
      {slot.status === 'verified' ? (
        <motion.div
          className="cmp-verified"
          role="status"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        >
          <span className="cmp-verified-ic"><DrawnCheck animate={!reduce} /></span>
          <span className="cmp-verified-tx">
            <strong>Verified &amp; Attached: {slot.fileName}</strong>
            <small>Checked on your device · attached in this simulation · nothing is uploaded</small>
          </span>
          <button type="button" className="cmp-link" onClick={onClear}>Remove</button>
        </motion.div>
      ) : slot.status === 'checking' ? (
        <div className="cmp-checking" role="status"><span className="cmp-spin" aria-hidden="true" /> Checking <strong>{slot.fileName}</strong> on your device…</div>
      ) : (
        <label
          className={`cmp-drop ${over ? 'is-over' : ''}`}
          htmlFor={inputId}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <UploadIcon width={22} height={22} />
          <span className="cmp-drop-tx">
            <span className="cmp-filebtn">Choose file</span> or drag it here
            <small>PDF, JPG or PNG · up to 10 MB</small>
            {slot.status === 'attached' && <em>Attached: {slot.fileName}. Waiting for your OK in the chat.</em>}
          </span>
          <input id={inputId} className="sr-only" type="file" accept={ACCEPT} aria-labelledby={`${inputId}-label`} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
        </label>
      )}
    </div>
  );
}

function Instructions({ onStart }: { onStart: () => void }) {
  return (
    <div id="cmp-instructions" className="cmp-instr">
      <h2>How this practice application works</h2>
      <ol className="cmp-steps">
        <li><b>1</b><span><strong>Tell the assistant about yourself.</strong> Say your name and your family’s yearly income in the chat. It types them into the form for you.</span></li>
        <li><b>2</b><span><strong>Type your Aadhaar number yourself.</strong> The assistant never reads it and cannot fill it in.</span></li>
        <li><b>3</b><span><strong>Drop your two documents in the chat.</strong> Your Aadhaar card and income certificate. You are asked before each one is checked.</span></li>
      </ol>
      <div className="cmp-safe">
        <ShieldIcon width={20} height={20} />
        <p><strong>You stay in control.</strong> Files are checked on your own device. The assistant sees only a file’s name and the result of that check, never what is inside it. This is a simulation: nothing is sent to any government website.</p>
      </div>
      <button type="button" className="cmp-btn primary" onClick={onStart}>Start the form</button>
    </div>
  );
}

export function FormPanel({ form, lit, flash, scrollRef, onTab, onType, onManualFile, onClearFile }: FormPanelProps) {
  const done = progress(form);
  const v = form.values;
  const rupees = v.income ? `₹${Number(v.income).toLocaleString('en-IN')} a year` : '';
  const aadhaarHint = aadhaarDigits(v.aadhaar).length === 0 || aadhaarDigits(v.aadhaar).length === 12 ? '' : `${12 - aadhaarDigits(v.aadhaar).length} more digits`;

  return (
    <section className="cmp-form" aria-label="Practice scholarship application">
      <header className="cmp-form-head">
        <div className="cmp-head-tx">
          <p className="cmp-kicker">Practice portal · simulation</p>
          <h1>Post-Matric Scholarship for ST Students</h1>
          <p className="cmp-sub">Application form. Nothing here is sent to any government site.</p>
        </div>
        <div className="cmp-progress" role="group" aria-label="Form progress">
          <span className="cmp-progress-tx"><b>{done}</b> of {PROGRESS_TOTAL} done</span>
          <div className="cmp-bar" aria-hidden="true"><i style={{ width: `${(done / PROGRESS_TOTAL) * 100}%` }} /></div>
        </div>
      </header>

      <div className="cmp-tabs" role="tablist" aria-label="Form sections">
        <button type="button" role="tab" id="cmp-tab-instructions" aria-selected={form.tab === 'instructions'} aria-controls="cmp-panel" onClick={() => onTab('instructions')}>Instructions</button>
        <button type="button" role="tab" id="cmp-tab-form" aria-selected={form.tab === 'form'} aria-controls="cmp-panel" onClick={() => onTab('form')}>Application form</button>
      </div>

      <div className="cmp-scroll" id="cmp-panel" role="tabpanel" aria-labelledby={form.tab === 'form' ? 'cmp-tab-form' : 'cmp-tab-instructions'} ref={scrollRef}>
        {form.tab === 'instructions' ? (
          <Instructions onStart={() => onTab('form')} />
        ) : (
          <form id="cmp-form_section" className={`cmp-body ${lit === 'form_section' ? 'is-lit' : ''}`} onSubmit={(e) => e.preventDefault()} noValidate>
            <fieldset id="cmp-personal_details" className={`cmp-card ${lit === 'personal_details' ? 'is-lit' : ''}`}>
              <legend><b>1</b> Personal details</legend>
              <div className={`cmp-field ${flash.name ? 'is-flash' : ''}`}>
                <label htmlFor="cmp-name" className="cmp-label">Full Name <b aria-hidden="true">*</b>{form.aiFilled.includes('name') && <AiBadge />}</label>
                <input id="cmp-name" className="cmp-input" type="text" autoComplete="off" placeholder="As written on your Aadhaar card" value={v.name} onChange={(e) => onType('name', e.target.value)} />
              </div>
              <div className="cmp-field">
                <label htmlFor="cmp-aadhaar" className="cmp-label">Aadhaar Number <b aria-hidden="true">*</b></label>
                <input id="cmp-aadhaar" className="cmp-input cmp-mono" type="text" inputMode="numeric" autoComplete="off" placeholder="XXXX XXXX XXXX" aria-describedby="cmp-aadhaar-help" value={formatAadhaar(v.aadhaar)} onChange={(e) => onType('aadhaar', aadhaarDigits(e.target.value))} />
                <p id="cmp-aadhaar-help" className="cmp-help"><ShieldIcon width={14} height={14} /> Type this yourself. The assistant never reads it and cannot fill it in. {aadhaarHint && <span className="cmp-count">{aadhaarHint}</span>}</p>
              </div>
            </fieldset>

            <fieldset id="cmp-income_details" className={`cmp-card ${lit === 'income_details' ? 'is-lit' : ''}`}>
              <legend><b>2</b> Income details</legend>
              <div className={`cmp-field ${flash.income ? 'is-flash' : ''}`}>
                <label htmlFor="cmp-income" className="cmp-label">Income Amount <b aria-hidden="true">*</b>{form.aiFilled.includes('income') && <AiBadge />}</label>
                <div className="cmp-money">
                  <span aria-hidden="true">₹</span>
                  <input id="cmp-income" className="cmp-input" type="text" inputMode="numeric" autoComplete="off" placeholder="Family income for the year" aria-describedby="cmp-income-help" value={v.income} onChange={(e) => onType('income', e.target.value.replace(/\D/g, '').slice(0, 9))} />
                </div>
                <p id="cmp-income-help" className="cmp-help">{rupees || 'Total yearly income of your family, in rupees.'}</p>
              </div>
            </fieldset>

            <fieldset id="cmp-documents" className={`cmp-card ${lit === 'documents' ? 'is-lit' : ''}`}>
              <legend><b>3</b> Documents</legend>
              <UploadCard doc="Aadhaar" slot={form.files.Aadhaar} flash={!!flash.Aadhaar} onFile={(f) => onManualFile('Aadhaar', f)} onClear={() => onClearFile('Aadhaar')} />
              <UploadCard doc="Income" slot={form.files.Income} flash={!!flash.Income} onFile={(f) => onManualFile('Income', f)} onClear={() => onClearFile('Income')} />
            </fieldset>

            <p className="cmp-foot">This is a practice form: there is nothing to submit. On the real portal you click its own Submit button yourself.</p>
          </form>
        )}
      </div>
    </section>
  );
}

import { useState } from 'react';
import { ChatPanel } from '../companion/ChatPanel';
import { FormPanel } from '../companion/FormPanel';
import { SUGGESTIONS } from '../companion/localBrain';
import { useCompanion } from '../companion/useCompanion';
import '../companion/companion.css';

export function Companion() {
  const [view, setView] = useState<'form' | 'chat'>('chat');
  const [updated, setUpdated] = useState(false);
  const c = useCompanion({
    onChange: () => setView((v) => { if (v === 'chat') setUpdated(true); return v; }),
    onFile: () => setView('chat'),
  });

  return (
    <div className="cmp-root" data-view={view}>
      <div className="cmp-switch" role="tablist" aria-label="Show the form or the assistant">
        <button type="button" role="tab" aria-selected={view === 'chat'} onClick={() => setView('chat')}>Assistant</button>
        <button type="button" role="tab" aria-selected={view === 'form'} onClick={() => { setView('form'); setUpdated(false); }}>Form{updated && <i className="cmp-updated" aria-label="updated" />}</button>
      </div>
      <div className="cmp-grid">
        <FormPanel form={c.form} lit={c.lit} flash={c.flash} scrollRef={c.scrollRef} onTab={c.onTab} onType={c.onType} onManualFile={c.onManualFile} onClearFile={c.onClearFile} />
        <ChatPanel msgs={c.msgs} activity={c.activity} thinking={c.thinking} busy={c.busy} ai={c.ai} suggestions={SUGGESTIONS} onSend={(t) => void c.send(t)} onFiles={c.onFiles} onDecide={(id, yes) => void c.onDecide(id, yes)} onPick={c.onPick} />
      </div>
    </div>
  );
}

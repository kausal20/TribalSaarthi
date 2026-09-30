/** Shared response presentation for the workspace and its working homepage example. */
export function GuideReply({ text, source, who = 'guide' }: { text: string; source?: string; who?: 'guide' | 'you' }) {
  return (
    <div className={`bubble b-${who}`}>
      <span className="bubble-author">{who === 'guide' ? 'TribalSaarthi' : 'You'}</span>
      <div className="bubble-text">{text}</div>
      {source && <details className="bubble-src"><summary>View source</summary>{source}</details>}
    </div>
  );
}

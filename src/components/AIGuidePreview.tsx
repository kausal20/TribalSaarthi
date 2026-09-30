import { useState } from 'react';
import { respond } from '../catalogue/assistant';
import { OPPORTUNITIES } from '../catalogue/data';
import { GuideReply } from './GuideReply';

const QUESTIONS = ['What documents do I need?', 'Where do I apply?', 'Who is eligible?'];
const opportunity = OPPORTUNITIES.find(o => o.id === 'nfst-demo')!;

/** Working example backed by the same response engine and component as the guide. */
export function AIGuidePreview() {
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const reply = respond(opportunity, question, { attachedKeys: [], filledFieldKeys: [] });
  return (
    <section className="sec guide-example" aria-labelledby="comp-h">
      <div className="guide-example-copy">
        <h2 id="comp-h">Ask about a scholarship.</h2>
        <p>Try a question about the research fellowship demo. The guide uses its configured requirements to answer.</p>
        <p className="fine">A working rule-based example. No live AI service or official eligibility decision.</p>
        <a className="btn-outline" href={`#/guide/${opportunity.id}/overview`}>Open the full guide</a>
      </div>
      <div className="guide-example-panel">
        <h3>Research fellowship</h3>
        <div className="example-questions" role="group" aria-label="Example questions">
          {QUESTIONS.map(q => <button key={q} type="button" aria-pressed={question === q} onClick={() => setQuestion(q)}>{q}</button>)}
        </div>
        <div className="example-answer" aria-live="polite" aria-atomic="true"><GuideReply text={reply.text} source={reply.source} /></div>
        {reply.navigate && <a className="example-section" href={`#/guide/${opportunity.id}/${reply.navigate.section}`}>View {opportunity.sections.find(s => s.id === reply.navigate!.section)?.title.toLowerCase()} in the demo</a>}
      </div>
    </section>
  );
}

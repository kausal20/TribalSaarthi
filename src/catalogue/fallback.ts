import { OPPORTUNITIES } from './data';
import { LEVEL_LABEL } from './filters';

/** Offline answer for the site-wide guide (no scheme selected). Lists real schemes; never decides eligibility. */
export function catalogueFallback(message: string): { text: string; scrollTo?: string } {
  const q = message.toLowerCase();
  const real = OPPORTUNITIES.filter((o) => o.official);
  if (/\b(best|suit|suits|suitable|recommend|which|for me|can i get|eligible)\b/.test(q)) {
    const lines = real.map((o) => `• ${o.title} — ${LEVEL_LABEL[o.level]}, ${o.location === 'Overseas' ? 'abroad' : 'India'}`);
    return {
      text: `The AI guide is not reachable right now, so here are the real schemes:\n${lines.join('\n')}\n\nTell me your class or course, your state and whether you want to study in India or abroad, and try again in a moment. Only the provider decides eligibility; confirm the current notice on the official portal.`,
      scrollTo: '#opportunities',
    };
  }
  if (/\b(show|browse|list|scholarships?|schemes?)\b/.test(q)) {
    return { text: 'Here are the real schemes. Use the level buttons to narrow them down.', scrollTo: '#opportunities' };
  }
  return { text: 'The AI guide is not reachable right now. You can still browse the schemes below, or open a scheme and use its own guide.', scrollTo: '#opportunities' };
}

import { motion } from 'framer-motion';
import type { Filters } from '../catalogue/filters';
import { PORTALS, TOPICS, type Portal, type Topic } from '../catalogue/discovery';
import { InfiniteMarquee } from './InfiniteMarquee';

type Pick = (p: Partial<Filters>) => void;

/** <ScholarshipMarquee/>: compact tiles with locally hosted official provider logos. */
export function ScholarshipMarquee() {
  return (
    <InfiniteMarquee<Portal>
      label="Popular scholarship portals"
      items={PORTALS}
      direction="left"
      speed={48}
      render={(p, hidden) => (
        <motion.a href={p.guideHref ?? p.url} target={p.guideHref ? undefined : '_blank'} rel={p.guideHref ? undefined : 'noopener noreferrer'} className="tile" tabIndex={hidden ? -1 : 0} >
          <span className="portal-logo"><img src={p.logo} alt={`${p.provider} logo`} width="88" height="36" draggable={false} /></span>
          <span className="tile-copy"><span className="tile-name">{p.name}</span><span className="tile-provider">{p.provider}</span></span><span aria-hidden="true">{p.guideHref ? '→' : '↗'}</span>{!p.guideHref && <span className="sr-only"> (opens in a new tab)</span>}
        </motion.a>
      )}
    />
  );
}

/** <TopicMarquee/>: simple pills, opposite direction and slightly slower. */
export function TopicMarquee({ onPick }: { onPick: Pick }) {
  return (
    <InfiniteMarquee<Topic>
      label="Explore by need"
      items={TOPICS}
      direction="right"
      speed={60}
      render={(t, hidden) => (
        <motion.button type="button" className="pillm" tabIndex={hidden ? -1 : 0} onClick={() => onPick(t.preset)}>
          {t.label}
        </motion.button>
      )}
    />
  );
}

export function ExploreSection({ onPick }: { onPick: Pick }) {
  return (
    <section className="explore" aria-label="Scholarship discovery">
      <h2 className="mq-h">Popular scholarship portals</h2>
      <ScholarshipMarquee />
      <p className="mq-note">Guided portals show extension instructions first; other official websites open in a new tab. TribalSaarthi is an independent demo.</p>
      <div className="portal-guide-links" aria-label="Guided official portal demos">
        <a href="#/continue/nsp">Use the guide on NSP <span aria-hidden="true">→</span></a>
        <a href="#/continue/mahadbt">Use the guide on MahaDBT <span aria-hidden="true">→</span></a>
      </div>
      <h2 className="mq-h mq-h2">Explore by need</h2>
      <TopicMarquee onPick={onPick} />
      <details className="browse-all"><summary>Browse all topics and portals</summary>
        <div className="browse-topics">{TOPICS.map(t => <button className="pillm" key={t.label} onClick={() => onPick(t.preset)}>{t.label}</button>)}</div>
        <div className="browse-portals">{PORTALS.map(p => <a key={p.name} href={p.guideHref ?? p.url} target={p.guideHref ? undefined : '_blank'} rel={p.guideHref ? undefined : 'noopener noreferrer'}>{p.name} {p.guideHref ? '→' : '↗'}{!p.guideHref && <span className="sr-only"> (opens in a new tab)</span>}</a>)}</div>
      </details>
    </section>
  );
}

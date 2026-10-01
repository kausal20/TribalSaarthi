import { motion } from 'framer-motion';
import type { Opportunity } from '../catalogue/types';
import { LEVEL_LABEL } from '../catalogue/filters';
import { ArrowIcon, SparkleIcon } from './icons';
import { useT } from '../i18n/i18n';

/** Primary AI CTA: sparkle spins, arrow nudges on hover/focus. */
export function AIGuideButton({ href, label = 'Open Saarthi AI', full }: { href: string; label?: string; full?: boolean }) {
  return (
    <motion.a href={href} className={`btn-ai ${full ? 'btn-ai-full' : ''}`} initial="rest" whileHover="hover" whileFocus="hover" whileTap={{ scale: 0.98 }}>
      <motion.span variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: 90, scale: 1.2 } }} transition={{ type: 'spring', stiffness: 300, damping: 14 }} className="btn-ai-ic">
        <SparkleIcon width={16} height={16} />
      </motion.span>
      {label}
      <motion.span variants={{ rest: { x: 0 }, hover: { x: 4 } }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="btn-ai-ar">
        <ArrowIcon width={16} height={16} />
      </motion.span>
    </motion.a>
  );
}

/** The official site a scheme is applied on, from its own apply link (logos are the sites' own, used only to show the source). */
export function providerOf(o: Opportunity): { id: string; name: string; logo: string } | null {
  const url = o.official?.applyUrl ?? (o.official ? o.verifiedSourceUrl : '');
  let host = '';
  try { host = new URL(url).host; } catch { /* practice example: no official site */ }
  if (host.endsWith('scholarships.gov.in')) return { id: 'nsp', name: 'National Scholarship Portal', logo: '/logos/nsp.svg' };
  if (host.endsWith('mahadbt.maharashtra.gov.in')) return { id: 'mahadbt', name: 'MahaDBT', logo: '/logos/mahadbt.png' };
  if (host.endsWith('tribal.gov.in') || host.endsWith('tribal.nic.in')) return { id: 'mota', name: 'Ministry of Tribal Affairs', logo: '/logos/tribal-affairs.jpg' };
  return null;
}

/** Compact card: what it is, who it is for, and one clear next step. Details live on the scheme page. */
export function ScholarshipCard({ o, index = 0 }: { o: Opportunity; index?: number }) {
  const t = useT();
  const open = o.status === 'Open in demo';
  const provider = providerOf(o);
  return (
    <motion.article
      className={`s-card ${provider ? `prov-${provider.id}` : ''}`}
      whileHover={{ y: -4 }}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.2) }}
    >
      {!o.official && <div className="s-top"><span className="tag tag-demo" title={t('Practice example with fictional details')}>{t('Practice')}</span></div>}
      {provider && (
        <div className="s-prov">
          <span className="s-logo"><img src={provider.logo} alt="" loading="lazy" width={28} height={28} /></span>
          <span><small>{t('Apply on')}</small><strong>{provider.name}</strong></span>
        </div>
      )}
      <h3><a href={`#/opportunity/${o.id}`}>{o.title}</a></h3>
      <p className="s-line">{o.tagline}</p>
      <ul className="s-chips" aria-label={t('Level and location')}>
        <li>{t(LEVEL_LABEL[o.level])}</li>
        <li>{o.location === 'Overseas' ? t('Study abroad') : t('India')}</li>
      </ul>
      <div className="s-actions">
        <a className="btn-solid" href={`#/opportunity/${o.id}`}>{t('View details')} <ArrowIcon width={15} height={15} /></a>
        {open && <a className="btn-quiet" href={`#/guide/${o.id}/overview`}>{o.official ? t('Ask the guide') : t('Try demo')}</a>}
      </div>
    </motion.article>
  );
}

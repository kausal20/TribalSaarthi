import { PORTALS } from '../catalogue/discovery';
import { useT } from '../i18n/i18n';

/** Static trust strip: where students actually apply. Guided portals get a "use the guide" link. */
export function PortalStrip() {
  const t = useT();
  return (
    <section className="portal-strip" aria-labelledby="portals-h">
      <h2 id="portals-h" className="ps-label">{t('Apply on the official portals')}</h2>
      <ul className="ps-list">
        {PORTALS.map((p) => (
          <li key={p.name}>
            <a className="ps-item" href={p.url} target="_blank" rel="noopener noreferrer">
              <img src={p.logo} alt="" width="72" height="30" draggable={false} />
              <span><strong>{t(p.name)}</strong><small>{t(p.provider)}</small></span>
              <span aria-hidden="true" className="ps-out">↗</span>
              <span className="sr-only">{t('(opens in a new tab)')}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

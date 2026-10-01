import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '../i18n/i18n';
import { KPIS, PROBLEMS, SCHEMES, WEEKS } from './dashboardData';

export function Dashboard() {
  const t = useT();
  const reduce = useReducedMotion();
  const max = Math.max(...PROBLEMS.map((p) => p.n));
  const top = Math.max(...WEEKS);
  return (
    <div className="dash">
      <div className="dash-demo" role="note"><strong>{t('DEMO DATA')}</strong> {t('Every number on this page is made up to show the layout. No real student, school or application is counted.')}</div>
      <header className="dash-head">
        <h1>{t('School and officer view')}</h1>
        <p>{t('What a school coordinator or district officer would see: how many applications were checked and which document problems come up most, so help can go where it is needed.')}</p>
      </header>

      <ul className="dash-kpis">
        {KPIS.map((k, i) => (
          <motion.li key={k.label} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <span>{t(k.label)}</span>
            <strong>{k.value}</strong>
            <small>{t(k.hint)}</small>
          </motion.li>
        ))}
      </ul>

      <div className="dash-grid">
        <section className="dash-card" aria-labelledby="dash-p">
          <h2 id="dash-p">{t('Common document problems')}</h2>
          <ul className="dash-bars">
            {PROBLEMS.map((p) => (
              <li key={p.label}>
                <span>{t(p.label)}</span>
                <div className="dash-bar" role="img" aria-label={`${p.n}`}><i style={{ width: `${(p.n / max) * 100}%` }} /></div>
                <b>{p.n}</b>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card" aria-labelledby="dash-w">
          <h2 id="dash-w">{t('Applications checked per week')}</h2>
          <div className="dash-spark" role="img" aria-label={t('Rising from {a} to {b} per week', { a: WEEKS[0], b: WEEKS[WEEKS.length - 1] })}>
            {WEEKS.map((w, i) => <i key={i} style={{ height: `${(w / top) * 100}%` }}><span>{w}</span></i>)}
          </div>
          <p className="dash-axis">{t('Last 8 weeks (sample)')}</p>
        </section>
      </div>

      <section className="dash-card" aria-labelledby="dash-s">
        <h2 id="dash-s">{t('By scheme')}</h2>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>{t('Scheme')}</th><th>{t('Checked')}</th><th>{t('Sent back')}</th><th>{t('Share sent back')}</th></tr></thead>
            <tbody>
              {SCHEMES.map((s) => (
                <tr key={s.name}><td>{t(s.name)}</td><td>{s.checked}</td><td>{s.back}</td><td>{Math.round((s.back / s.checked) * 100)}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="dash-foot">{t('A real version would count only anonymous results that a student agrees to share, with no names, Aadhaar numbers or document files.')}</p>
    </div>
  );
}

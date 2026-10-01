import { motion, useReducedMotion } from 'framer-motion';
import { findOpportunity } from '../catalogue/data';
import { clearChats, deleteChat, relativeTime, requestOpenChat, requestSheet, useChats, type Chat } from '../catalogue/chatStore';
import { go } from '../router';
import { ArrowIcon } from '../components/icons';
const Mark = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" /><path d="m9 10 2 2 4-4" /></svg>
);
import { ease } from '../components/motionKit';
import { MatchResults } from './Workspace';
import { useT } from '../i18n/i18n';

const GUIDE = '/guide/nfst-demo/overview';

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></svg>
);

export function MySaved() {
  const reduce = useReducedMotion();
  const t = useT();
  const chats = useChats();

  // Newest shortlist and the answers that produced it both come from the saved chats, so nothing extra is stored.
  const found = chats
    .flatMap((c) => c.messages.map((m, i) => ({ c, m, answers: c.messages.slice(0, i).reverse().find((x) => x.who === 'you')?.text })).filter((x) => x.m.matches && x.m.matches.length > 0))
    .sort((a, b) => b.c.updatedAt.localeCompare(a.c.updatedAt))[0];
  const count = found?.m.matches?.length ?? 0;

  const openChat = (c: Chat) => {
    requestOpenChat(c.id);
    go(`/guide/${findOpportunity(c.oppId) ? c.oppId : 'nfst-demo'}/overview`);
  };
  const redoSheet = () => { requestSheet(); go(GUIDE); };

  return (
    <motion.div className="sv" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
      <header className="sv-top">
        <div>
          <h1>{t('My Saved')}</h1>
          <p>{t('Your shortlist and past chats, kept only in this browser.')}</p>
        </div>
        <a className="btn-solid" href={`#${GUIDE}`}><Mark size={18} /> {t('Ask the guide')}</a>
      </header>

      <div className="sv-layout">
        <section className="sv-main" aria-labelledby="sv-short">
          <div className="sv-sechead">
            <h2 id="sv-short">{t('My shortlist')} {count > 0 && <span className="sv-badge">{count}</span>}</h2>
            {found && <button type="button" className="sv-link" onClick={redoSheet}>{t('Update my answers')} <ArrowIcon width={14} height={14} /></button>}
          </div>

          {found ? (
            <>
              {found.answers && <p className="sv-answers"><span>{t('Based on')}</span> {found.answers}</p>}
              <MatchResults m={found.m} grid />
            </>
          ) : (
            <div className="sv-empty">
              <span className="sv-empty-ic" aria-hidden="true"><Mark size={44} /></span>
              <h3>{t('Find schemes that may fit you')}</h3>
              <p>{t('Answer six quick questions and the guide will shortlist central and state schemes, with links to apply on the official website.')}</p>
              <ol className="sv-steps">
                <li><b>1</b>{t('Answer 6 questions')}</li>
                <li><b>2</b>{t('Get your shortlist')}</li>
                <li><b>3</b>{t('Apply on the official site')}</li>
              </ol>
              <button type="button" className="btn-solid" onClick={redoSheet}>{t('Start the 1-minute sheet')} <ArrowIcon width={15} height={15} /></button>
            </div>
          )}
        </section>

        <aside className="sv-side" aria-labelledby="sv-chats">
          <div className="sv-sechead">
            <h2 id="sv-chats">{t('Recent chats')} {chats.length > 0 && <span className="sv-badge">{chats.length}</span>}</h2>
            {chats.length > 0 && <button type="button" className="sv-link" onClick={() => { if (window.confirm(t('Delete all saved chats from this browser?'))) clearChats(); }}>{t('Clear all')}</button>}
          </div>
          {chats.length === 0 ? (
            <p className="sv-none">{t('No chats yet. Your conversations with the guide will appear here.')}</p>
          ) : (
            <ul className="sv-chats">
              {chats.map((c) => (
                <li key={c.id}>
                  <span className="sv-chat-ic" aria-hidden="true"><Mark size={26} /></span>
                  <button type="button" className="sv-chat" onClick={() => openChat(c)}>
                    <strong>{c.student && <em className="gp-who">{c.student}</em>}{c.title}</strong>
                    <span>{findOpportunity(c.oppId)?.title ?? t('Scholarship')}</span>
                    <small>{relativeTime(c.updatedAt)} · {t('{n} messages', { n: c.messages.length })}</small>
                  </button>
                  <button type="button" className="sv-del" onClick={() => deleteChat(c.id)} aria-label={`${t('Delete chat')}: ${c.title}`} title={t('Delete chat')}><TrashIcon /></button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </motion.div>
  );
}

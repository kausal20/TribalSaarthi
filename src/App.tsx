import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRoute } from './router';
import { clearToast, dismissLoadWarning, doReset, getLoadWarning, toast, useDemoState, useUI } from './store';
import { clearDrafts, useDrafts } from './catalogue/draftStore';
import { Analytics, Apply, ApplicationPage, Home as ToolsHome, Officer, Schemes } from './pages/Pages';
import { Catalogue } from './pages/Catalogue';
import { Detail } from './pages/Detail';
import { Workspace } from './pages/Workspace';
import { MySaved } from './pages/MySaved';
import { Continue } from './pages/Continue';
import { Companion } from './pages/Companion';
import { Dashboard } from './pages/Dashboard';
import { AboutSafety, Dialog } from './components/Dialogs';
import { Navbar } from './components/Navbar';
import { Footer } from './components/TrustSection';

function ResetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const st = useDemoState();
  const drafts = Object.keys(useDrafts()).length;
  return (
    <Dialog open={open} onClose={onClose} title="Reset demo?">
      <p>
        This erases <strong>{drafts}</strong> guided-application draft(s) (with attached sample files) and <strong>{st.applications.length}</strong> workflow-tool application(s), and restores the seed scheme configurations. Nothing outside this browser is affected.
      </p>
      <div className="row gap wrap">
        <button
          className="btn-solid danger"
          onClick={() => {
            clearDrafts();
            doReset();
            toast('ok', 'Demo reset. Drafts and demo records cleared.');
            window.location.hash = '#/';
            onClose();
          }}
        >
          Erase and reset
        </button>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </Dialog>
  );
}

export function App() {
  const route = useRoute();
  const ui = useUI();
  const reduce = useReducedMotion();
  useDemoState();
  const [about, setAbout] = useState(false);
  const [reset, setReset] = useState(false);
  const warning = getLoadWarning();

  useEffect(() => {
    if (!ui.toast) return;
    const t = setTimeout(clearToast, ui.toast.kind === 'error' ? 9000 : 4500);
    return () => clearTimeout(t);
  }, [ui.toast]);

  // Page key: sections of the same guided workspace do not re-run the page transition.
  const pageKey = route.name === 'guide' ? `guide-${route.id}` : route.name === 'opportunity' || route.name === 'application' ? `${route.name}-${route.id}` : route.name;
  const wide = route.name === 'guide' || route.name === 'companion';
  const legacy = ['tools', 'apply', 'application', 'officer', 'schemes', 'analytics'].includes(route.name);

  useEffect(() => {
    if (route.name !== 'guide') window.scrollTo({ top: 0 });
  }, [pageKey, route.name]);

  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      {route.name !== 'guide' && <Navbar onAbout={() => setAbout(true)} onReset={() => setReset(true)} />}
      {warning && (
        <div className="wrap2"><div className="callout action-callout" role="alert">{warning} <button className="btn-quiet" onClick={dismissLoadWarning}>Dismiss</button></div></div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pageKey}
          id="main"
          className={`${wide ? 'wrap2 wide' : route.name === 'catalogue' ? '' : 'wrap2'} ${legacy ? 'legacy' : ''} main`}
          tabIndex={-1}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
        >
          {route.name === 'catalogue' && <Catalogue />}
          {route.name === 'opportunity' && <Detail id={route.id} />}
          {route.name === 'guide' && <Workspace id={route.id} section={route.section} />}
          {route.name === 'applications' && <MySaved />}
          {route.name === 'companion' && <Companion />}
          {route.name === 'dashboard' && <Dashboard />}
          {route.name === 'continue' && <Continue portal={route.portal} id={route.id} />}
          {route.name === 'tools' && <ToolsHome />}
          {route.name === 'apply' && <Apply />}
          {route.name === 'application' && <ApplicationPage id={route.id} />}
          {route.name === 'officer' && <Officer />}
          {route.name === 'schemes' && <Schemes />}
          {route.name === 'analytics' && <Analytics />}
        </motion.main>
      </AnimatePresence>
      <Footer onAbout={() => setAbout(true)} />
      <div className="toast-area" aria-live="polite">
        {ui.toast && (
          <div key={ui.toast.n} className={`toast ${ui.toast.kind}`} role={ui.toast.kind === 'error' ? 'alert' : 'status'}>
            {ui.toast.kind === 'error' ? '⚠ ' : '✔ '}{ui.toast.text}
            <button className="btn-quiet" onClick={clearToast} aria-label="Dismiss message">×</button>
          </div>
        )}
      </div>
      <AboutSafety open={about} onClose={() => setAbout(false)} />
      <ResetDialog open={reset} onClose={() => setReset(false)} />
    </>
  );
}

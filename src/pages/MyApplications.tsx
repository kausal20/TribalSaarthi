import { OPPORTUNITIES } from '../catalogue/data';
import { useDrafts } from '../catalogue/draftStore';
import { ApplicationCard } from '../components/ApplicationCard';

export function MyApplications() {
  const drafts = useDrafts();
  const items = Object.values(drafts)
    .map((d) => ({ d, o: OPPORTUNITIES.find((x) => x.id === d.oppId) }))
    .filter((x): x is { d: typeof x.d; o: NonNullable<typeof x.o> } => !!x.o)
    .sort((a, b) => b.d.updatedAt.localeCompare(a.d.updatedAt));
  return (
    <div className="apps">
      <header className="page-head">
        <h1>My Applications</h1>
        <p>Practice drafts saved in this browser with fictional data. No real application exists here.</p>
      </header>
      {items.length === 0 ? (
        <div className="empty2">
          <h2>Nothing here yet</h2>
          <p>Open a scheme with the AI Guide; your draft appears here with its progress.</p>
          <a className="btn-solid" href="#/">Find an opportunity</a>
        </div>
      ) : (
        <ul className="a-list">{items.map(({ d, o }) => <ApplicationCard key={d.oppId} d={d} o={o} />)}</ul>
      )}
    </div>
  );
}

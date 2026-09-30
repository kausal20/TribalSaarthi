export const MAHADBT_HOME = 'https://mahadbt.maharashtra.gov.in/Home/LandingPage';
export const NSP_HOME = 'https://scholarships.gov.in/home';
export type GuidedPortal = 'mahadbt' | 'nsp';
export const GUIDED_PORTALS: Record<GuidedPortal, { name: string; home: string }> = {
  mahadbt: { name: 'MahaDBT', home: MAHADBT_HOME },
  nsp: { name: 'National Scholarship Portal', home: NSP_HOME },
};
const ID_RE = /^[a-z0-9-]{1,40}$/;

/** MahaDBT URL carrying ONLY a scheme id in the fragment (never personal data). */
export function mahadbtHandoffUrl(oppId?: string): string {
  return oppId && ID_RE.test(oppId) ? `${MAHADBT_HOME}#tsaarthi=${oppId}` : MAHADBT_HOME;
}

export function guidedPortalUrl(portal: GuidedPortal, oppId?: string): string {
  const home = GUIDED_PORTALS[portal].home;
  return oppId && ID_RE.test(oppId) ? `${home}#tsaarthi=${oppId}` : home;
}

/** True when the TribalSaarthi Chrome extension's bridge script has marked this page. */
export function extensionVersion(doc: Document = document): string | null {
  return doc.documentElement.dataset.tsaarthiExt ?? null;
}

export function extensionSupportsPortal(version: string, portal: GuidedPortal): boolean {
  const parts = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(version);
  if (!parts) return false;
  const [major, minor] = [Number(parts[1]), Number(parts[2])];
  return portal === 'mahadbt' ? major > 0 || minor >= 4 : major > 0 || minor >= 5;
}

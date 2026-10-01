export const pageFingerprint = p => JSON.stringify([p.documentId, p.path, p.title, p.links, p.headings]);

/** A bounded observe → act → confirm loop. Each plan sees the freshly read page. */
export async function navigateSteps({ initial, read, act, plan, confirm, report, maxSteps = 5 }) {
  let response = initial;
  const visited = new Set();
  for (let step = 0; step < maxSteps; step++) {
    const action = response.actions?.[0];
    if (action?.type !== 'goto') return response;
    const before = await read();
    if (!before) { report('The page is unavailable. Navigation stopped.'); return null; }
    const key = `${pageFingerprint(before)}:${action.label}`;
    if (visited.has(key)) { report('This step would repeat. Navigation stopped; choose the next page yourself.'); return null; }
    visited.add(key);
    if (step > 0 && !(await confirm(action.label))) { report('Navigation paused.'); return null; }
    if (!(await act(action, before))) { report('The destination could not be confirmed. Navigation stopped.'); return null; }
    const after = await read();
    if (!after) { report('The new page could not be read. Navigation stopped.'); return null; }
    report(`Page updated after opening “${action.label}”.`);
    response = await plan(after, action.label);
  }
  report('Five navigation steps completed. Ask again to continue from this page.');
  return null;
}

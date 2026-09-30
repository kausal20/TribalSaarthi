import { SECTION_IDS, cataloguePrompt, cleanReply, portalPrompt, sanitizeCatalogue, sanitizeScheme, schemePrompt } from './guide.mjs';

const meshModel = process.env.MESH_MODEL || 'google/gemini-3.1-flash-lite';
const baseUrl = (process.env.MESH_BASE_URL || 'https://api.meshapi.ai/v1').replace(/\/$/, '');
const blockedLink = /log\s*out|sign\s*out|delete|remove|\bpay(ment)?\b|submit|final|confirm|cancel/i;
const allowedPaths = /^\/(|applications|opportunity\/[a-z0-9-]+|guide\/[a-z0-9-]+\/(overview|eligibility|documents|form|status))$/;
const allowedSelectors = new Set(['#opportunities', '#how', '#comp-h', '#trust-h', '#match-h']);
const tools = [
  { type: 'function', function: { name: 'navigateTo', description: 'Navigate to an exact visible link on the current official MahaDBT page, or to an approved internal TribalSaarthi route. Do not invent destinations.', parameters: { type: 'object', properties: { destination: { type: 'string', description: 'Exact visible link label or approved internal path.' } }, required: ['destination'], additionalProperties: false } } },
  { type: 'function', function: { name: 'scrollToElement', description: 'Scroll to and highlight an approved section in the TribalSaarthi demo.', parameters: { type: 'object', properties: { selector: { type: 'string', enum: [...allowedSelectors] } }, required: ['selector'], additionalProperties: false } } },
  { type: 'function', function: { name: 'checkForm', description: 'Ask the browser extension to scan visible form fields locally. Sensitive values are never sent to the model.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'showDocuments', description: 'Open the extension document checklist. Do not upload documents to the model or server.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
];

const send = (res, code, data) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' }); res.end(JSON.stringify(data)); };
const readBody = req => req.body !== undefined ? Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : new Promise((resolve, reject) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 256_000) reject(new Error('Request too large')); }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON')); } }); });
const parseArgs = call => { try { return JSON.parse(call.function?.arguments || '{}'); } catch { return {}; } };

function validateAction(call, context) {
  const name = call.function?.name;
  const args = parseArgs(call);
  if (name === 'navigateTo') {
    const destination = String(args.destination || '').trim();
    if (allowedPaths.test(destination)) return { type: 'navigateTo', urlPath: destination };
    const exactLink = (context.links || []).find(link => link === destination && !blockedLink.test(link));
    if (exactLink) return { type: 'goto', label: exactLink };
  }
  if (name === 'scrollToElement' && allowedSelectors.has(args.selector)) return { type: name, selector: args.selector };
  if (name === 'checkForm') return { type: 'scan-form' };
  if (name === 'showDocuments') return { type: 'scan-uploads' };
  return null;
}

/** Non-secret balance info for diagnostics; null when unavailable. */
async function meshBalance() {
  try {
    const r = await fetch(`${baseUrl.replace(/\/v1$/, '')}/v1/balance`, { signal: AbortSignal.timeout(8000), headers: { authorization: `Bearer ${process.env.MESH_API_KEY}` } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Specific wording for validated actions, used only if the model wrote no text at all. */
function describeActions(actions) {
  return actions.map((a) => {
    if (a.type === 'goto') return `Opening “${a.label}”.`;
    if (a.type === 'navigateTo') {
      const m = /^\/guide\/[a-z0-9-]+\/([a-z]+)$/.exec(a.urlPath || '');
      return m ? `Opening the ${m[1]} section.` : /^\/opportunity\//.test(a.urlPath || '') ? 'Opening the scholarship details.' : 'Opening that page.';
    }
    if (a.type === 'scan-form') return 'Checking the form on this page.';
    if (a.type === 'scan-uploads') return 'Showing the upload fields on this page.';
    return 'Done.';
  }).join(' ');
}

async function answer(input) {
  const apiKey = process.env.MESH_API_KEY;
  if (!apiKey) return { text: 'The guide is not connected yet. Add the Mesh API key to the server environment and restart the assistant server.', actions: [] };
  const messages = Array.isArray(input.messages) ? input.messages.filter(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string').slice(-16) : [];
  const scheme = sanitizeScheme(input.scheme);
  const context = input.page && typeof input.page === 'object' ? input.page : {};
  const pageInfo = {
    title: String(context.title || '').slice(0, 200),
    url: String(context.url || '').slice(0, 500),
    links: Array.isArray(context.links) ? context.links.filter(x => typeof x === 'string' && !blockedLink.test(x)).slice(0, 80).map(x => x.slice(0, 120)) : [],
  };
  const catalogue = sanitizeCatalogue(input.catalogue);
  const system = scheme ? schemePrompt(scheme, catalogue) : catalogue ? cataloguePrompt(catalogue) : portalPrompt(pageInfo);
  const activeTools = scheme
    ? [{ type: 'function', function: { name: 'navigateTo', description: 'Open one section of the guided demo for this scheme.', parameters: { type: 'object', properties: { destination: { type: 'string', enum: [...SECTION_IDS.map(sec => `/guide/${scheme.id}/${sec}`), ...(catalogue || []).filter(o => o.id !== scheme.id).map(o => `/opportunity/${o.id}`)] } }, required: ['destination'], additionalProperties: false } } }]
    : catalogue
      ? [{ type: 'function', function: { name: 'navigateTo', description: 'Open a demo scholarship page on the TribalSaarthi website.', parameters: { type: 'object', properties: { destination: { type: 'string', enum: catalogue.flatMap(o => [`/opportunity/${o.id}`, ...(o.guidedDemo ? [`/guide/${o.id}/overview`] : [])]) } }, required: ['destination'], additionalProperties: false } } }]
      : tools;
  const requestMessages = [{ role: 'system', content: system }, ...messages];
  const actions = [];

  // Mesh's OpenAI-compatible tool calls are collected here and validated before they reach the client.
  // Text the model wrote alongside a tool call is kept, so a navigation step never replaces the actual answer.
  const spoken = [];
  for (let round = 0; round < 3; round++) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: meshModel, messages: requestMessages, tools: activeTools, tool_choice: 'auto', max_tokens: 500, temperature: 0.2 }),
    });
    if (!response.ok) {
      let upstream = {};
      try { upstream = await response.json(); } catch { /* Keep provider details private on parse failure. */ }
      const code = upstream.error?.code;
      const fail = (message, upstreamCode) => { const error = new Error(message); error.publicMessage = message; error.upstreamCode = upstreamCode; return error; };
      if (response.status === 402 || code === 'spend_limit_exceeded') {
        const b = await meshBalance();
        throw fail(`Mesh says the balance for this API key's account is too low${b ? ` (available: $${b.available_usd})` : ''}. Top up the same account that owns this key, or raise this key's spend limit.`, code || 'payment_required');
      }
      if (response.status === 401 || response.status === 403) throw fail('Mesh rejected the API key. Check MESH_API_KEY in .env and restart the assistant server.', code || 'unauthorized');
      if (response.status === 404 || code === 'model_not_found') throw fail(`Mesh does not recognise the model "${meshModel}". Check MESH_MODEL in .env (list: ${baseUrl}/models).`, code || 'model_not_found');
      if (response.status === 429) throw fail('Mesh is rate limiting this key. Wait a moment and try again.', code || 'rate_limited');
      console.error('Mesh request rejected:', response.status, code || 'provider_error');
      throw fail('The AI provider rejected the request. Check the Mesh model and key settings.');
    }
    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;
    if (!message) throw new Error('Mesh returned no assistant response');
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) {
      const text = cleanReply([...spoken, message.content || ''].filter(Boolean).join('\n\n'));
      return { text: text || (actions.length ? describeActions(actions) : 'Could you say a little more about what you need?'), actions };
    }
    if (message.content) spoken.push(String(message.content));
    requestMessages.push({ role: 'assistant', content: message.content || null, tool_calls: calls });
    for (const call of calls) {
      const action = validateAction(call, pageInfo);
      if (action) actions.push(action);
      requestMessages.push({ role: 'tool', tool_call_id: call.id, content: action ? 'Action validated and sent to the browser for execution.' : 'Action refused: destination was not in the allowed page context.' });
    }
  }
  const text = cleanReply(spoken.join('\n\n'));
  return { text: text || (actions.length ? describeActions(actions) : 'I could not match that to a safe page. Which page or section do you mean?'), actions };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/api/health') {
    // Diagnostics only: never includes the key.
    const balance = process.env.MESH_API_KEY ? await meshBalance() : null;
    return send(res, 200, { ok: true, model: meshModel, baseUrl, keyConfigured: !!process.env.MESH_API_KEY, canAnswer: !!process.env.MESH_API_KEY && Number(balance?.available_usd ?? 0) > 0 });
  }
  if (req.method !== 'POST' || req.url !== '/api/assistant') return send(res, 404, { error: 'Not found. Use POST /api/assistant (or GET /api/health).' });
  try { send(res, 200, await answer(await readBody(req))); }
  catch (error) {
    if (error?.upstreamCode) console.error('Mesh billing restriction:', error.upstreamCode);
    else console.error('Assistant request failed:', error instanceof Error ? error.message : 'unknown error');
    send(res, 502, { error: error?.publicMessage || 'The guide could not reach its AI service. Please try again in a moment.' });
  }
}

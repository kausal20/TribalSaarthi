import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const ext = resolve('extension');
const context = await chromium.launchPersistentContext('', {channel:'chromium',headless:true,
  args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  // URL.origin is null for chrome-extension URLs in Node; use the worker host.
  const base = `chrome-extension://${new URL(worker.url()).host}`;
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/sidepanel.html`);
  await page.locator('#composer').waitFor();
  const bytes=[...await readFile('output/pdf/prototype-documents/income-certificate-DEMO.pdf')];
  const result = await page.evaluate(async bytes=>{
    const {renderDocumentPages}=await import('./pdf.bundle.js');
    const images=await renderDocumentPages(new Uint8Array(bytes));
    return {pages:images.length,firstLength:images[0].b64.length};
  },bytes);
  assert.equal(result.pages,1); assert.ok(result.firstLength>1000);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({packagedExtension:'passed',localPdfWorker:'passed',result,errors}));
} finally {await context.close();}

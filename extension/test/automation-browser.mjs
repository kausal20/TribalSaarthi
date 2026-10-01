// Local-only integration checks. No government site or real student documents.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4500/extension/test/content-check.html');
  await page.waitForFunction(() => document.querySelector('#result').textContent !== 'Running');
  assert.equal(await page.locator('#result').textContent(), 'CONTENT CHECKS PASSED');
  const uploads = await page.evaluate(async () => {
    const message = data => new Promise(resolve => window.receive(data, {}, resolve));
    const group = document.createElement('div'); group.className = 'field';
    group.innerHTML = '<label for="proof">Income certificate</label><input id="proof" type="file" accept=".pdf"><small>Issued in the current financial year</small><button type="button">Upload document</button><p role="status">Document uploaded successfully</p>';
    document.body.append(group);
    const field = (await message({type:'scan'})).fields.find(f=>f.label==='Income certificate');
    const attachment = await message({type:'attach',id:field.id,name:'fictional.pdf',mime:'application/pdf',b64:btoa('%PDF-1.4\n%%EOF')});
    const stale = await message({type:'upload-result',receiptId:attachment.receiptId});
    group.querySelector('button').onclick=()=>{ group.querySelector('p').textContent='Upload completed'; };
    const offer=await message({type:'prepare-upload',id:field.id});
    const sent=await message({type:'upload-document',token:offer.token});
    await new Promise(r=>setTimeout(r,30));
    const fresh=await message({type:'upload-result',receiptId:sent.receiptId});
    const identity = document.createElement('div'); identity.innerHTML='<label for="id-file">Aadhaar card</label><input id="id-file" type="file"><label for="id-number">Aadhaar number</label><input id="id-number" value="123412341234">'; document.body.append(identity);
    const fields=(await message({type:'scan'})).fields;
    return { stale:stale.status,fresh:fresh.status,requirements:field.requirements,
      identityFile:fields.find(f=>f.label==='Aadhaar card').sensitive,
      identityNumber:fields.find(f=>f.label==='Aadhaar number') };
  });
  assert.equal(uploads.stale,'pending'); assert.equal(uploads.fresh,'confirmed');
  assert.match(uploads.requirements,/current financial year/);
  assert.equal(uploads.identityFile,false); assert.equal(uploads.identityNumber.sensitive,true); assert.equal(uploads.identityNumber.value,undefined);
  const bytes = [...await readFile(new URL('../../output/pdf/prototype-documents/income-certificate-DEMO.pdf', import.meta.url))];
  const pdf = await page.evaluate(async bytes => {
    const {renderDocumentPages}=await import('/extension/pdf.bundle.js');
    const pages=await renderDocumentPages(new Uint8Array(bytes));
    window.renderedDemo=pages;
    return pages.map(p=>({mime:p.mime,length:p.b64.length}));
  },bytes);
  assert.ok(pdf.length>0); assert.ok(pdf.every(p=>p.mime==='image/jpeg' && p.length>1000));
  const invalid=await page.evaluate(async()=>{
    const {renderDocumentPages}=await import('/extension/pdf.bundle.js');
    try {await renderDocumentPages(new TextEncoder().encode('%PDF-broken'));return false;}catch{return true;}
  });
  assert.equal(invalid,true);
  const image=await page.evaluate(()=>window.renderedDemo[0].b64);
  if (process.argv.includes('--live-scan')) {
    const { default: handler } = await import('../../server/handler.mjs');
    let status, response;
    await handler({method:'POST',url:'/api/scan',body:{pages:[{mime:'image/jpeg',b64:image}],fields:['Income certificate'],requirements:[{label:'Income certificate',text:'Certificate must be for financial year 2026-27.'}]}},
      {writeHead(code){status=code;},end(body){response=JSON.parse(body);}});
    assert.equal(status,200,JSON.stringify(response));
    assert.equal(response.kind,'income_certificate'); assert.equal(response.readable,true);
    assert.equal(response.review[0].status,'fail');
    console.log(JSON.stringify({liveScan:'passed',kind:response.kind,ruleMismatch:response.review[0].status}));
  }
  await page.setContent(`<img alt="Rendered fictional income certificate" src="data:image/jpeg;base64,${image}" style="max-width:720px">`);
  await page.screenshot({path:'tmp/pdf-render-check.png',fullPage:true});
  await page.goto('http://localhost:4500/extension/test/panel-harness.html');
  await page.getByRole('textbox', {name:/Ask|What would/i}).waitFor({timeout:10000}).catch(()=>{});
  await page.waitForTimeout(1000);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.route('**/api/scan',route=>route.fulfill({json:{kind:'income_certificate',label:'Income certificate',readable:false,issues:['Too blurred'],field:'Income certificate',summary:'Unreadable',review:[]}}));
  await page.goto('http://localhost:4500/extension/test/panel-harness.html?ai=1');
  await page.locator('#chat-pick').setInputFiles('output/pdf/prototype-documents/income-certificate-DEMO.pdf');
  await page.locator('#c-scan').click();
  await page.getByText('The AI could not identify a readable document.',{exact:false}).first().waitFor();
  assert.equal(await page.locator('.attach-offer').count(),0);
  await page.route('**/api/assistant',async route=>{
    const body=route.request().postDataJSON();
    const link=body.page.links[0];
    const label=link==='Home' && body.page.links.length>1 ? 'New Registration' : link==='Documents' ? 'Documents' : null;
    await route.fulfill({json:{text:label?`Opening ${label}`:'You reached Documents.',actions:label?[{type:'goto',label}]:[]}});
  });
  await page.goto('http://localhost:4500/extension/test/panel-harness.html?ai=1&scenario=navigation');
  await page.locator('#ask').fill('Take me through registration to the Documents page');
  await page.locator('#send').click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByText('You reached Documents.',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__calls.filter(m=>m.type==='goto').map(m=>m.label)),['New Registration','Documents']);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({content:'passed',uploadReceipt:'passed',sensitiveFields:'passed',pdf,invalidPdf:'rejected',panelErrors:errors}));
} finally { await browser.close(); }

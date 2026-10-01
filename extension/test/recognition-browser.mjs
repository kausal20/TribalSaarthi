import { chromium } from 'playwright';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const ext=resolve('extension');
const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
try {
  await context.addInitScript(()=>{
    const query=navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query=p=>p.name==='microphone'?Promise.resolve({state:'granted'}):query(p);
    window.SpeechRecognition=class {
      constructor(){window.testRecognizer=this;}
      start(){this.onstart?.();}
      stop(){this.onend?.();}
    };
  });
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/health',r=>r.fulfill({json:{keyConfigured:false}}));
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/sidepanel.html`);
  await page.locator('#composer').waitFor();
  await page.evaluate(()=>chrome.storage.local.set({tsLang:'en'})); await page.reload();
  await page.waitForFunction(()=>document.querySelector('#ui-language').value==='en'&&document.querySelector('#voice-language').value==='hi-IN');
  await page.locator('#voice-input').click();
  await page.locator('#voice-consent button[value=start]').click();
  await page.waitForFunction(()=>window.testRecognizer?.lang==='hi-IN');
  await page.evaluate(()=>{
    const result=[{transcript:'मुझे छात्रवृत्ति चाहिए'}];result.isFinal=false;
    window.testRecognizer.onresult({resultIndex:0,results:[result]});
    result.isFinal=true; window.testRecognizer.onresult({resultIndex:0,results:[result]});
    window.testRecognizer.stop();
  });
  assert.equal(await page.locator('#ask').inputValue(),'मुझे छात्रवृत्ति चाहिए');
  await page.locator('#voice-language').selectOption('en-IN');
  await page.waitForFunction(async()=> (await chrome.storage.local.get('tsSpeechLang')).tsSpeechLang==='en-IN');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#voice-language').value==='en-IN');
  await page.locator('#ui-language').selectOption('hi');
  assert.equal(await page.locator('#voice-language').inputValue(),'en-IN');
  await page.locator('#voice-language').selectOption('hi-IN');
  await page.waitForFunction(async()=> (await chrome.storage.local.get('tsSpeechLang')).tsSpeechLang==='hi-IN');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#voice-language').value==='hi-IN');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({hindiLocale:'hi-IN',devanagariTranscript:'passed',noDuplicateResults:'passed',savedLanguage:'passed',independentOfInterface:'passed',errors}));
} finally {await context.close();}

import { describe, it, expect, vi } from 'vitest';
import { placementProblem } from './document-policy.js';
import { navigateSteps } from './navigation.js';
import { speechChunks, speakChunks } from './speech.js';
describe('document placement gate', () => {
  it('blocks every failed or incomplete AI review', () => {
    for (const doc of [{scanRequested:true}, {scan:{kind:'income_certificate',readable:false}}, {scan:{kind:'not_a_document',readable:true}}, {scan:{kind:'income_certificate',readable:true,issues:['Cut off']}}, {scan:{kind:'income_certificate',readable:true,review:[{status:'fail'}]}}]) expect(placementProblem(doc)).not.toBe('');
  });
  it('allows an explicitly local-only valid file and successful review', () => {
    expect(placementProblem({checks:[]})).toBe('');
    expect(placementProblem({scanRequested:true,scan:{kind:'income_certificate',readable:true,issues:[],review:[{status:'unknown'}]}})).toBe('');
  });
});
describe('observed navigation', () => {
  it('reads after each action and asks before the next page', async () => {
    let path = '/'; const events = [];
    const result = await navigateSteps({initial:{actions:[{type:'goto',label:'Students'}]},
      read:async()=>({path,links:[]}), act:async(a)=>{ events.push(a.label); path += 'next'; return true; },
      confirm:async(label)=>{events.push(`confirm:${label}`);return true;}, report:()=>{},
      plan:async(p)=>p.path === '/next' ? {actions:[{type:'goto',label:'Documents'}]} : {text:'Arrived',actions:[]},
    });
    expect(events).toEqual(['Students','confirm:Documents','Documents']); expect(result.text).toBe('Arrived');
  });
  it('does not replan after uncertain execution', async () => {
    const plan=vi.fn();
    await navigateSteps({initial:{actions:[{type:'goto',label:'Students'}]},read:async()=>({path:'/'}),act:async()=>false,plan,report:()=>{},confirm:async()=>true});
    expect(plan).not.toHaveBeenCalled();
  });
});
it('splits Hindi and English into bounded speech segments', () => {
  const chunks = speechChunks('आपका Income certificate तैयार है।');
  expect(chunks.some(c=>c.lang==='hi-IN')).toBe(true);
  expect(chunks.some(c=>c.lang==='en-IN' && c.text.includes('Income'))).toBe(true);
  expect(speechChunks('word '.repeat(300)).every(c=>c.text.length<=180)).toBe(true);
});
it('retries a failed installed voice using the language default', async () => {
  let calls=0;
  vi.stubGlobal('SpeechSynthesisUtterance', class {constructor(text){this.text=text;}});
  vi.stubGlobal('window',{speechSynthesis:{cancel(){},resume(){},getVoices:()=>[{lang:'en-IN'}],speak(u){calls++;queueMicrotask(()=>calls===1 ? u.onerror({error:'voice-unavailable'}) : u.onend());}}});
  try {await speakChunks('Hello','hi-IN',()=>{}); expect(calls).toBe(2);} finally {vi.unstubAllGlobals();}
});

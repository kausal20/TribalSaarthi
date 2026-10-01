export function speechChunks(text, preferred = 'hi-IN') {
  const cleaned = String(text).replace(/https?:\/\/\S+/g, '').replace(/[*#`]/g, '');
  // Preserve script runs: English terms inside Hindi use an English voice.
  return (cleaned.match(/[\u0900-\u097f][\u0900-\u097f\s\d,।!?]*|[^\u0900-\u097f]+/g) || [])
    .flatMap(run => (run.match(/.{1,180}(?:\s|$)|.{1,180}/gu) || []).map(value => ({
      text: value.trim(), lang: /[\u0900-\u097f]/.test(value) ? preferred : 'en-IN',
    }))).filter(c => /[\p{L}\p{N}]/u.test(c.text));
}

export async function availableVoices(synth) {
  if (synth.getVoices().length) return synth.getVoices();
  await new Promise(resolve => {
    const done = () => { clearTimeout(timer); synth.removeEventListener('voiceschanged', done); resolve(); };
    const timer = setTimeout(done, 1500);
    synth.addEventListener('voiceschanged', done);
  });
  return synth.getVoices();
}

let generation = 0;
export function stopSpeech() { generation++; window.speechSynthesis?.cancel(); }
export async function speakChunks(text, preferred, onStatus) {
  stopSpeech(); const run = generation;
  const synth = window.speechSynthesis;
  const voices = await availableVoices(synth);
  for (const chunk of speechChunks(text, preferred)) {
    if (run !== generation) return;
    const voice = voices.find(v => v.lang.toLowerCase() === chunk.lang.toLowerCase()) || voices.find(v => v.lang.toLowerCase().startsWith(chunk.lang.slice(0, 2)));
    // Try the language default once when an enumerated voice is absent/fails.
    onStatus(voice ? 'Reading the answer aloud…' : `Trying the browser’s ${chunk.lang} voice. If silent, install a voice for this language in your device settings.`);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (run !== generation) return;
      try {
        await new Promise((resolve, reject) => {
          const u = new SpeechSynthesisUtterance(chunk.text); u.lang = chunk.lang;
          if (attempt === 0 && voice) u.voice = voice;
          const timer = setTimeout(() => { synth.cancel(); reject(new Error('Speech playback timed out.')); }, 25000);
          u.onend = () => { clearTimeout(timer); resolve(); };
          u.onerror = e => { clearTimeout(timer); reject(new Error(e.error || 'Speech playback failed.')); };
          synth.speak(u); synth.resume();
        });
        break;
      } catch (error) {
        if (run !== generation) return;
        if (attempt === 1) throw new Error(`Speech could not play (${chunk.lang}). Install an English or Hindi voice in your device settings. The answer remains available as text.`);
      }
    }
  }
}

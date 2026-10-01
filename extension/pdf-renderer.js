import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';

const asset = name => new URL(name, import.meta.url).href;
pdfjs.GlobalWorkerOptions.workerSrc = asset('./pdf.worker.mjs');
const MAX_PAGES = 6;
const MAX_BASE64 = 4_000_000;

/** Render every page or refuse. Never silently scan just the first page. */
export async function renderDocumentPages(bytes) {
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false,
    useSystemFonts: true, cMapUrl: asset('./pdf-cmaps/'),
    cMapPacked: true, standardFontDataUrl: asset('./pdf-fonts/'),
    wasmUrl: asset('./pdf-wasm/') });
  const timeout = setTimeout(() => void task.destroy(), 30000);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new Error(`This PDF has ${pdf.numPages} pages. Split it into files of up to ${MAX_PAGES} pages for a complete AI review.`);
    const pages = [];
    let total = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1800 / Math.max(base.width, base.height)) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      try {
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: '#ffffff' }).promise;
        const b64 = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
        total += b64.length;
        if (total > MAX_BASE64) throw new Error('The rendered PDF exceeds the AI scan limit. Split the PDF into smaller files without reducing text clarity.');
        pages.push({ mime: 'image/jpeg', b64 });
      } finally { canvas.width = canvas.height = 0; page.cleanup(); }
    }
    return pages;
  } catch (error) {
    if (error?.name === 'PasswordException') throw new Error('This PDF is password protected. Choose an unlocked copy.');
    throw error;
  } finally { clearTimeout(timeout); await task.destroy(); }
}

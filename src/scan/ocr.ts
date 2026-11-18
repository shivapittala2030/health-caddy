/**
 * Reads an ingredient label from a photo, on the device, with Tesseract.js (F5).
 * The OCR engine and English language data download once from a public CDN, then the browser caches them.
 */
export async function readLabel(image: File | Blob, onProgress?: (pct: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: m => { if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100)); },
  });
  try {
    const { data } = await worker.recognize(await downscale(image));
    return cleanLabel(data.text);
  } finally {
    await worker.terminate();
  }
}

/** Keep the ingredient part of the label and tidy common OCR slips. */
export function cleanLabel(raw: string): string {
  let t = raw.replace(/\r/g, '').replace(/-\n(?=[a-z])/g, '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const i = t.search(/ingredients?\s*[:;.]/i);
  if (i >= 0) t = t.slice(i).replace(/^ingredients?\s*[:;.]\s*/i, '');
  const end = t.search(/\b(nutrition facts|distributed by|manufactured for|best (before|by)|keep refrigerated)\b/i);
  if (end > 20) t = t.slice(0, end);
  return t.replace(/\|/g, 'l').trim();
}

/** Large phone photos are slow to read; 1600 px on the long side is plenty for label text. */
async function downscale(file: Blob): Promise<Blob | HTMLCanvasElement> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (scale === 1) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  } catch {
    return file;
  }
}

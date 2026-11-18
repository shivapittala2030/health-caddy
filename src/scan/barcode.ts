/**
 * Live barcode reading from the phone camera.
 * Uses the browser's built-in BarcodeDetector where it exists (Chrome on Android), and the
 * ZXing library everywhere else (Safari on iPhone, Firefox, desktop).
 */
import type { IScannerControls } from '@zxing/browser';

export interface Scanner { stop: () => void; torch?: (on: boolean) => Promise<void> }

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface NativeDetector { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }
type DetectorCtor = { new (o: { formats: string[] }): NativeDetector; getSupportedFormats(): Promise<string[]> };

/** UPC-E is a compressed UPC-A; expand it so the database lookup matches. */
export function upcEtoA(e: string): string {
  if (!/^[01]\d{7}$/.test(e)) return e;
  const [ns, d1, d2, d3, d4, d5, d6, check] = e.split('');
  let mfr: string, prod: string;
  if ('012'.includes(d6)) { mfr = d1 + d2 + d6 + '00'; prod = '00' + d3 + d4 + d5; }
  else if (d6 === '3') { mfr = d1 + d2 + d3 + '00'; prod = '000' + d4 + d5; }
  else if (d6 === '4') { mfr = d1 + d2 + d3 + d4 + '0'; prod = '0000' + d5; }
  else { mfr = d1 + d2 + d3 + d4 + d5; prod = '0000' + d6; }
  return ns + mfr + prod + check;
}

export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
}

export async function startScanner(video: HTMLVideoElement, onCode: (code: string) => void): Promise<Scanner> {
  let done = false;
  const emit = (raw: string) => {
    if (done) return;
    const code = raw.length === 8 && raw.startsWith('0') ? upcEtoA(raw) : raw;
    if (!/^\d{8,14}$/.test(code)) return;
    done = true;
    onCode(code);
  };

  const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  let native: NativeDetector | null = null;
  if (Native) {
    try {
      const ok = (await Native.getSupportedFormats()).filter(f => FORMATS.includes(f));
      if (ok.length) native = new Native({ formats: ok });
    } catch { native = null; }
  }

  const constraints: MediaStreamConstraints = {
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  };

  if (native) {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();
    let timer = 0;
    const tick = async () => {
      if (done) return;
      try {
        if (video.readyState >= 2) {
          const found = await native!.detect(video);
          if (found[0]) emit(found[0].rawValue);
        }
      } catch { /* a frame can fail while the camera warms up */ }
      if (!done) timer = window.setTimeout(tick, 120);
    };
    tick();
    const track = stream.getVideoTracks()[0];
    return {
      stop: () => { done = true; clearTimeout(timer); stream.getTracks().forEach(t => t.stop()); video.srcObject = null; },
      torch: track && 'applyConstraints' in track
        ? (on: boolean) => track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
        : undefined,
    };
  }

  const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
  const controls: IScannerControls = await reader.decodeFromConstraints(constraints, video, result => {
    if (result) emit(result.getText());
  });
  return {
    stop: () => { done = true; controls.stop(); },
    torch: controls.switchTorch ? (on: boolean) => controls.switchTorch!(on) : undefined,
  };
}

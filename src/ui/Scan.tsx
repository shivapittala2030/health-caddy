import { useEffect, useRef, useState } from 'react';
import type { FoodItem, Profile } from '../engine/types';
import { lookupBarcode, LookupError, validBarcode } from '../data/openFoodFacts';
import { cameraSupported, startScanner, type Scanner } from '../scan/barcode';
import { readLabel } from '../scan/ocr';
import { ICONS } from './icons';
import { VerdictPill } from './Result';

export type ScanMode = 'barcode' | 'label';

interface Props {
  p: Profile;
  mode: ScanMode;
  setMode: (m: ScanMode) => void;
  onResult: (item: FoodItem) => void;
  recent: FoodItem[];
}

export function ScanScreen({ p, mode, setMode, onResult, recent }: Props) {
  return (
    <>
      <div><h1 className="h">Scan a food</h1><p className="sub">Point your camera at a barcode, or photograph the ingredient list.</p></div>
      <div className="seg" role="group" aria-label="Scan type">
        <button aria-pressed={mode === 'barcode'} onClick={() => setMode('barcode')}>Barcode</button>
        <button aria-pressed={mode === 'label'} onClick={() => setMode('label')}>Label photo</button>
      </div>
      {mode === 'barcode' ? <BarcodePane onResult={onResult} /> : <LabelPane onResult={onResult} />}
      {recent.length > 0 && (
        <section className="stack">
          <h2 className="sec-title">Recent scans <small>Checked with your current profile</small></h2>
          <div className="recent">
            {recent.map(it => (
              <button key={it.id} className="res" onClick={() => onResult(it)}>
                <span><b>{it.name}</b><small>{it.brand || (it.source === 'label' ? 'Label photo' : '')}</small></span>
                <VerdictPill item={it} p={p} />
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function BarcodePane({ onResult }: { onResult: (item: FoodItem) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<Scanner | null>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'looking' | 'denied'>('idle');
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [torch, setTorch] = useState(false);

  const stop = () => { scanner.current?.stop(); scanner.current = null; };
  useEffect(() => stop, []);

  const lookup = async (raw: string) => {
    stop();
    setErr('');
    setState('looking');
    try {
      const item = await lookupBarcode(raw);
      setState('idle');
      onResult(item);
    } catch (e) {
      setState('idle');
      setErr(e instanceof LookupError ? e.message : 'Something went wrong looking up that barcode. Please try again.');
    }
  };

  const start = async () => {
    setErr('');
    setState('starting');
    try {
      scanner.current = await startScanner(video.current!, c => { navigator.vibrate?.(60); lookup(c); });
      setState('live');
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'idle');
      setErr(name === 'NotAllowedError'
        ? 'Camera permission was turned down. Allow camera access for this site in your browser settings, or type the barcode number below.'
        : name === 'NotFoundError' ? 'No camera was found on this device. Type the barcode number below instead.'
          : 'The camera could not start. Type the barcode number below instead.');
    }
  };

  const submit = () => {
    const c = code.replace(/\D/g, '');
    if (!validBarcode(c)) { setErr('That doesn’t look like a full barcode. It should be the 8, 12 or 13 digits under the bars.'); return; }
    lookup(c);
  };

  const canCam = cameraSupported();
  return (
    <>
      <div className="viewfinder">
        <video ref={video} muted playsInline aria-label="Camera view" style={{ display: state === 'live' ? 'block' : 'none' }} />
        {state === 'live' && <><div className="frame" /><div className="scanline" /></>}
        {state === 'live' && scanner.current?.torch && (
          <button className="tool" aria-label={torch ? 'Turn light off' : 'Turn light on'} onClick={() => { const t = !torch; setTorch(t); scanner.current?.torch?.(t).catch(() => {}); }}>{ICONS.torch}</button>
        )}
        {state !== 'live' && (
          <div className="msg">
            {state === 'looking' ? <><div className="spinner" /><span>Looking up the product…</span></>
              : state === 'starting' ? <><div className="spinner" /><span>Starting the camera…</span></>
                : canCam ? <><span>Hold the barcode inside the frame. It scans by itself.</span><button className="btn" onClick={start}>{ICONS.camera}Start camera</button></>
                  : <span>This browser can’t use the camera here. Type the barcode number below.</span>}
          </div>
        )}
      </div>
      {state === 'live' && <button className="btn ghost small" onClick={() => { stop(); setState('idle'); }}>Stop camera</button>}
      {err && <div className="err" role="alert">{err}</div>}
      <form className="row" onSubmit={e => { e.preventDefault(); submit(); }}>
        <input className="inp grow" inputMode="numeric" autoComplete="off" placeholder="Or type the barcode number" value={code} onChange={e => setCode(e.target.value)} aria-label="Barcode number" />
        <button className="btn" type="submit" disabled={state === 'looking' || code.replace(/\D/g, '').length < 8}>Check</button>
      </form>
    </>
  );
}

function LabelPane({ onResult }: { onResult: (item: FoodItem) => void }) {
  const [img, setImg] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => () => { if (img) URL.revokeObjectURL(img); }, [img]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(''); setText('');
    setImg(URL.createObjectURL(f));
    setPct(0);
    try {
      const t = await readLabel(f, setPct);
      setText(t);
      if (!t.trim()) setErr('No text could be read. Try again with the label flat, well lit and filling the photo.');
    } catch {
      setErr('The label reader could not load. Check your internet connection, or type the ingredients below.');
    } finally {
      setPct(null);
    }
  };

  const check = () => onResult({
    id: 'label-' + Date.now().toString(36), name: name.trim() || 'Label photo', ingredients: text.trim(), source: 'label',
  });

  return (
    <>
      <label className="upload">
        {ICONS.camera}{img ? 'Take another photo' : 'Photograph the ingredient list'}
        <input type="file" accept="image/*" capture="environment" onChange={e => onFile(e.target.files?.[0])} />
      </label>
      {img && <img className="preview" src={img} alt="Your label photo" />}
      {pct !== null && <div className="busy"><div className="spinner" /><span>Reading the label… {pct}%</span><small className="fine">The first time takes a little longer while the reader downloads.</small></div>}
      {err && <div className="err" role="alert">{err}</div>}
      {pct === null && (
        <section className="stack">
          <label className="field">Ingredients {img ? '(check and fix what was read)' : '(or type or paste them)'}
            <textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Cultured milk, sugar, strawberries, gelatin…" />
          </label>
          <label className="field">Food name (optional)<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Strawberry yogurt" /></label>
          <button className="btn" disabled={!text.trim()} onClick={check}>Check these ingredients</button>
          <p className="fine">The photo is read on your phone and is not uploaded anywhere.</p>
        </section>
      )}
    </>
  );
}

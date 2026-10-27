import { Check, ImageUp, Keyboard } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getDetector, normalizeBarcode } from '../lib/barcode';
import { Notice } from './ui';

type Status = 'starting' | 'scanning' | 'nocamera' | 'denied';

/**
 * Lecteur de code-barres : caméra arrière en direct, ou photo de l'étiquette, ou saisie des chiffres.
 * L'analyse se fait sur l'appareil ; rien n'est envoyé tant qu'un code n'a pas été lu.
 */
export default function BarcodeScanner({ onResult }: { onResult: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const done = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const finish = (code: string) => {
    if (done.current) return;
    done.current = true;
    navigator.vibrate?.(60);
    onResultRef.current(code);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    let last = '';
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('nocamera'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) {
        setStatus(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'nocamera');
        return;
      }
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = video.current!;
      v.srcObject = stream;
      await v.play().catch(() => undefined);
      setStatus('scanning');
      const detector = await getDetector();
      const tick = async () => {
        if (stopped || done.current) return;
        if (v.readyState >= 2 && v.videoWidth > 0) {
          try {
            const found = await detector.detect(v);
            const code = found.map((b) => normalizeBarcode(b.rawValue, b.format)).find((c): c is string => !!c);
            // Deux lectures identiques d'affilée avant de valider : évite les erreurs de lecture.
            if (code && code === last) { finish(code); return; }
            last = code ?? '';
          } catch { /* image illisible : on continue */ }
        }
        timer = window.setTimeout(tick, 180);
      };
      tick();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fromPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoMsg('Analyse de la photo…');
    try {
      const detector = await getDetector();
      const bitmap = await createImageBitmap(file);
      const found = await detector.detect(bitmap);
      bitmap.close?.();
      const code = found.map((b) => normalizeBarcode(b.rawValue, b.format)).find((c): c is string => !!c);
      if (code) { setPhotoMsg(null); finish(code); } else setPhotoMsg('Aucun code-barres lisible sur cette photo. Rapproche-toi, évite les reflets, et cadre le code bien à plat.');
    } catch {
      setPhotoMsg('Impossible de lire cette photo.');
    }
  }

  const manualCode = normalizeBarcode(manual);

  return (
    <div className="space-y-3">
      {(status === 'starting' || status === 'scanning') && (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
          <video ref={video} className="w-full h-full object-cover" playsInline muted autoPlay aria-label="Image de la caméra" />
          <div className="absolute inset-x-[12%] top-1/2 -translate-y-1/2 h-[38%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" aria-hidden />
          <div className="absolute bottom-2 inset-x-0 text-center text-white text-[13px] font-medium drop-shadow">
            {status === 'starting' ? 'Ouverture de la caméra…' : 'Place le code-barres dans le cadre'}
          </div>
        </div>
      )}
      {status === 'denied' && <Notice tone="warn">L’accès à la caméra a été refusé. Sur iPhone : Réglages › Safari › Caméra › Autoriser (ou « Demander »), puis rouvre l’appli. En attendant, tu peux prendre une photo ou taper les chiffres.</Notice>}
      {status === 'nocamera' && <Notice tone="warn">Caméra indisponible sur cet appareil ou dans ce navigateur. Prends une photo du code-barres ou tape ses chiffres.</Notice>}

      <label className="btn-secondary w-full cursor-pointer">
        <ImageUp size={18} />Lire depuis une photo
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { fromPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {photoMsg && <p className="text-sm text-muted" role="status">{photoMsg}</p>}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manualCode) finish(manualCode); }}>
        <div className="relative flex-1">
          <Keyboard size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-10 tabular" inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Ou tape les chiffres sous le code" aria-label="Chiffres du code-barres" />
        </div>
        <button className="btn-primary" disabled={!manualCode} aria-label="Valider le code"><Check size={18} /></button>
      </form>
      {manual.replace(/\D/g, '').length >= 8 && !manualCode && <p className="text-[12px] text-muted">Code incomplet ou mal recopié (le dernier chiffre ne correspond pas).</p>}
      <p className="text-[12px] text-muted">L’image est analysée sur ton téléphone. Seuls les chiffres du code sont envoyés à Open Food Facts pour trouver le produit.</p>
    </div>
  );
}

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fmtDuration } from '../lib/format';

/**
 * Minuteur d'intervalles. Il se base sur l'heure réelle (et non un compteur) :
 * si l'écran se verrouille, il se recale au retour. Sur iPhone, Safari met les pages en pause
 * écran verrouillé : pour être guidé au poignet, utilise plutôt un exercice personnalisé sur l'Apple Watch.
 */
export function IntervalTimer({ steps }: { steps: { kind: 'run' | 'walk'; label: string; sec: number }[] }) {
  const total = steps.reduce((s, x) => s + x.sec, 0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);
  const lastStep = useRef(-1);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const e = Math.min(total, baseRef.current + (Date.now() - startRef.current!) / 1000);
      setElapsed(e);
      if (e >= total) setRunning(false);
    }, 250);
    return () => clearInterval(id);
  }, [running, total]);

  let acc = 0;
  let idx = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if (elapsed < acc + steps[i].sec) { idx = i; break; }
    acc += steps[i].sec;
  }
  if (elapsed >= total) acc = total - steps[steps.length - 1].sec;
  const step = steps[idx];
  const left = Math.max(0, acc + step.sec - elapsed);

  useEffect(() => {
    if (running && idx !== lastStep.current) {
      if (lastStep.current !== -1) beep(audio, step.kind === 'run' ? 880 : 520);
      lastStep.current = idx;
    }
  }, [idx, running, step.kind]);

  const toggle = () => {
    if (running) {
      baseRef.current = elapsed;
      setRunning(false);
    } else {
      if (!audio.current) try { audio.current = new AudioContext(); } catch { audio.current = null; }
      startRef.current = Date.now();
      setRunning(true);
    }
  };

  return (
    <div className="text-center space-y-4">
      <div className={`rounded-3xl py-8 ${step.kind === 'run' ? 'bg-accent text-white' : 'bg-surface2'}`}>
        <div className="text-[15px] font-semibold opacity-90">{elapsed >= total ? 'Terminé, bravo !' : step.label}</div>
        <div className="text-[64px] font-black tabular leading-none mt-2">{Math.floor(left / 60)}:{String(Math.floor(left % 60)).padStart(2, '0')}</div>
        <div className="text-[13px] opacity-80 mt-2">Étape {idx + 1}/{steps.length}</div>
      </div>
      <div className="h-2 rounded-full bg-surface2 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(elapsed / total) * 100}%` }} /></div>
      <div className="text-[13px] text-muted tabular">{fmtDuration(Math.floor(elapsed))} / {fmtDuration(total)}</div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1 h-14 text-lg" onClick={toggle} disabled={elapsed >= total}>{running ? <><Pause />Pause</> : <><Play />{elapsed > 0 ? 'Reprendre' : 'Démarrer'}</>}</button>
        <button className="btn-secondary h-14" onClick={() => { setRunning(false); baseRef.current = 0; setElapsed(0); lastStep.current = -1; }} aria-label="Recommencer"><RotateCcw /></button>
      </div>
      <p className="text-[12px] text-muted">Un bip signale chaque changement. Sur iPhone, garde l’écran allumé : Safari suspend la page écran verrouillé. Pour un guidage au poignet, crée un exercice personnalisé sur ta montre.</p>
    </div>
  );
}

function beep(ref: React.MutableRefObject<AudioContext | null>, freq: number) {
  const ctx = ref.current;
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch { /* son indisponible */ }
}

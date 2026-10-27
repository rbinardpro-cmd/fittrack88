import { useEffect, useState } from 'react';

type Toast = { id: number; text: string; tone: 'ok' | 'error'; undo?: () => void };
let push: ((t: Omit<Toast, 'id'>) => void) | null = null;

/** Message éphémère, avec bouton « Annuler » optionnel. */
export function toast(text: string, opts: { tone?: 'ok' | 'error'; undo?: () => void } = {}) {
  push?.({ text, tone: opts.tone ?? 'ok', undo: opts.undo });
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    push = (t) => {
      const id = ++n;
      setItems((l) => [...l.slice(-2), { ...t, id }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), t.undo ? 5000 : 2800);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <div className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`fade-in pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${t.tone === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-bg'}`}>
          <span>{t.text}</span>
          {t.undo && (
            <button
              className="font-bold underline"
              onClick={() => {
                t.undo!();
                setItems((l) => l.filter((x) => x.id !== t.id));
              }}
            >
              Annuler
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

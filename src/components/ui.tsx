import { X, ChevronLeft } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DataSource } from '../lib/types';

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: ReactNode; back?: boolean; action?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="flex items-end justify-between gap-3 pt-4 pb-3">
      <div className="flex items-center gap-1 min-w-0">
        {back && (
          <button className="-ml-2 p-2 rounded-full hover:bg-surface2" onClick={() => nav(-1)} aria-label="Retour">
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight truncate">{title}</h1>
          {subtitle && <div className="text-sm text-muted mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {action}
    </header>
  );
}

export function Card({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3 gap-2">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, sub, tone }: { label: ReactNode; value: ReactNode; unit?: string; sub?: ReactNode; tone?: 'good' | 'warn' | 'accent' }) {
  const toneCls = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : tone === 'accent' ? 'text-accent' : '';
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-muted font-medium truncate">{label}</div>
      <div className={`tabular text-[22px] font-bold leading-tight ${toneCls}`}>
        {value}
        {unit && <span className="text-[13px] font-semibold text-muted ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[12px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, tone = 'accent', label }: { value: number; max: number; tone?: 'accent' | 'good' | 'info' | 'warn'; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = { accent: 'bg-accent', good: 'bg-good', info: 'bg-info', warn: 'bg-warn' }[tone];
  return (
    <div className="h-2 rounded-full bg-surface2 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ pct, size = 120, stroke = 10, children, tone = 'accent' }: { pct: number; size?: number; stroke?: number; children?: ReactNode; tone?: 'accent' | 'good' | 'info' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const color = { accent: 'rgb(var(--accent))', good: 'rgb(var(--good))', info: 'rgb(var(--info))' }[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--surface2))" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export const SOURCE_LABELS: Record<DataSource, string> = {
  manual: 'Saisie manuelle',
  apple_health_export: 'Apple Santé (export)',
  shortcut_import: 'Import JSON / Raccourci',
  file_import: 'Import de fichier',
  estimate: 'Calcul estimatif',
  local_db: 'Base locale (à vérifier)',
  open_food_facts: 'Open Food Facts',
  recipe: 'Recette calculée',
};

export function SourceBadge({ source, className = '' }: { source: DataSource; className?: string }) {
  const tone =
    source === 'apple_health_export' || source === 'shortcut_import'
      ? 'bg-info/10 text-info'
      : source === 'estimate'
        ? 'bg-warn/10 text-warn'
        : 'bg-surface2 text-muted';
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tone} ${className}`}>{SOURCE_LABELS[source]}</span>;
}

export function Segmented<T extends string>({ value, onChange, options, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex p-1 rounded-xl bg-surface2 gap-1 max-w-full overflow-x-auto">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 h-8 rounded-lg text-[13px] font-semibold whitespace-nowrap transition ${value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Feuille modale qui monte du bas (atteignable au pouce sur iPhone). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="fade-in relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-surface rounded-t-3xl sm:rounded-3xl p-4 pb-safe outline-none"
      >
        <div className="flex items-center justify-between mb-3 sticky -top-4 bg-surface pt-1 pb-2 z-10">
          <h2 id={id} className="text-lg font-bold">{title}</h2>
          <button className="p-2 rounded-full bg-surface2" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-8 px-4">
      {icon && <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-surface2 flex items-center justify-center text-muted">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {text && <div className="text-sm text-muted mt-1">{text}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'good' }) {
  const cls = { info: 'bg-info/10 text-ink border-info/20', warn: 'bg-warn/10 text-ink border-warn/30', good: 'bg-good/10 text-ink border-good/20' }[tone];
  return <div className={`rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed ${cls}`}>{children}</div>;
}

export function Loading() {
  return <div className="py-16 text-center text-muted text-sm">Chargement…</div>;
}

/** Saisie numérique tolérante à la virgule française. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

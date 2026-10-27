const nf = (digits: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmt0 = (n: number) => nf(0).format(Math.round(n));
export const fmt1 = (n: number) => nf(1).format(n);
export const fmtKg = (n: number) => `${nf(1).format(n)} kg`;
export const fmtSigned1 = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${nf(1).format(Math.abs(n))}`;

export function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
  if (r === 0) return `${m} min`;
  return `${m} min ${String(r).padStart(2, '0')} s`;
}

export function fmtMinutes(min: number): string {
  return fmtDuration(min * 60);
}

/** Allure en min/km, ex. 7'45". */
export function fmtPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !isFinite(secPerKm)) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}'00"` : `${m}'${String(s).padStart(2, '0')}"`;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const round1 = (n: number) => Math.round(n * 10) / 10;

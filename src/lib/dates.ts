import type { DayKey } from './types';

// Les journées sont repérées par une clé AAAA-MM-JJ calculée dans le fuseau local.
// Toutes les opérations passent par midi local pour ne jamais être piégées par
// les changements d'heure (une journée de 23 h ou 25 h reste une journée).

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

export function isDayKey(s: unknown): s is DayKey {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromDayKey(s);
  return toDayKey(d) === s;
}

/** Date locale à midi pour la clé donnée. */
export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

/** Nombre de jours calendaires entre a et b (b - a), indépendant des changements d'heure. */
export function diffDays(a: DayKey, b: DayKey): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayMon0(key: DayKey): number {
  return (fromDayKey(key).getDay() + 6) % 7;
}

export function startOfWeek(key: DayKey): DayKey {
  return addDays(key, -weekdayMon0(key));
}

export function rangeDays(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function dayName(key: DayKey): string {
  return DAYS[weekdayMon0(key)];
}

export function formatDay(key: DayKey, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = key.split('-').map(Number);
  let s = `${d} ${MONTHS[m - 1]}`;
  if (opts.year) s += ` ${y}`;
  if (opts.weekday) s = `${dayName(key)} ${s}`;
  return s;
}

export function formatMonthYear(key: DayKey): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function shortDay(key: DayKey): string {
  const [, m, d] = key.split('-').map(Number);
  return `${d}/${pad(m)}`;
}

export function nowTime(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function relativeDay(key: DayKey, ref: DayKey = today()): string {
  const n = diffDays(key, ref);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  if (n === -1) return 'demain';
  return formatDay(key, { weekday: true });
}

import { addDays, diffDays } from './dates';
import type { DayKey, WeightEntry } from './types';

export interface Progress {
  lostKg: number;
  remainingKg: number;
  /** Avancement vers l'objectif, 0 à 100 (peut être < 0 si le poids a augmenté). */
  progressPct: number;
  /** Pourcentage du poids de départ perdu (différent de l'avancement !). */
  bodyWeightLostPct: number;
  reached: boolean;
}

/**
 * Exemple : départ 120, actuel 110, objectif 88 → 10 kg perdus, 22 restants,
 * avancement 10 / 32 = 31,25 %, alors que le poids perdu représente 8,33 % du poids de départ.
 */
export function computeProgress(startKg: number, currentKg: number, goalKg: number): Progress {
  const total = startKg - goalKg;
  const lost = startKg - currentKg;
  const remaining = Math.max(0, currentKg - goalKg);
  const pct = total > 0 ? Math.min(100, (lost / total) * 100) : 0;
  return {
    lostKg: round2(lost),
    remainingKg: round2(remaining),
    progressPct: round2(pct),
    bodyWeightLostPct: round2((lost / startKg) * 100),
    reached: currentKg <= goalKg,
  };
}

/** Une valeur par jour : moyenne des pesées du jour, triée par date. */
export function dailyWeights(entries: WeightEntry[]): { date: DayKey; kg: number }[] {
  const map = new Map<DayKey, number[]>();
  for (const e of entries) {
    if (!isFinite(e.kg) || e.kg <= 0) continue;
    const l = map.get(e.date) ?? [];
    l.push(e.kg);
    map.set(e.date, l);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, l]) => ({ date, kg: l.reduce((s, x) => s + x, 0) / l.length }));
}

/** Dernière pesée connue (ou null). */
export function latestWeight(entries: WeightEntry[]): { date: DayKey; kg: number } | null {
  const d = dailyWeights(entries);
  return d.length ? d[d.length - 1] : null;
}

/**
 * Moyenne glissante sur 7 jours calendaires (fenêtre se terminant au jour donné),
 * calculée sur les jours qui ont une pesée. Lisse les variations d'eau et de digestion.
 */
export function rollingAverage(daily: { date: DayKey; kg: number }[], windowDays = 7): { date: DayKey; kg: number; avg: number }[] {
  return daily.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      if (diffDays(daily[j].date, p.date) >= windowDays) break;
      sum += daily[j].kg;
      n++;
    }
    return { ...p, avg: sum / n };
  });
}

/**
 * Variation de la moyenne glissante entre (ref - jours) et ref.
 * Renvoie null s'il n'y a pas de pesée assez ancienne.
 */
export function changeOver(daily: { date: DayKey; kg: number }[], days: number | 'all', ref?: DayKey): number | null {
  if (daily.length < 2) return null;
  const smooth = rollingAverage(daily);
  const end = smooth[smooth.length - 1];
  const refDay = ref ?? end.date;
  if (days === 'all') return round2(end.avg - smooth[0].kg);
  const from = addDays(refDay, -days);
  // point le plus proche à ±3 jours de la date de départ
  let best: (typeof smooth)[number] | null = null;
  for (const p of smooth) {
    const d = Math.abs(diffDays(p.date, from));
    if (d <= 3 && (best == null || d < Math.abs(diffDays(best.date, from)))) best = p;
  }
  if (!best || best.date >= end.date) return null;
  return round2(end.avg - best.avg);
}

/** Moyennes par semaine (lundi → dimanche). */
export function weeklyAverages(daily: { date: DayKey; kg: number }[], weekStartOf: (d: DayKey) => DayKey): { week: DayKey; avg: number; n: number }[] {
  const m = new Map<DayKey, number[]>();
  for (const p of daily) {
    const w = weekStartOf(p.date);
    const l = m.get(w) ?? [];
    l.push(p.kg);
    m.set(w, l);
  }
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([week, l]) => ({ week, avg: round2(l.reduce((s, x) => s + x, 0) / l.length), n: l.length }));
}

// ---------- Tendance et prévision ----------

export interface Regression {
  slope: number; // kg / jour
  intercept: number;
  se: number; // erreur type de la pente
  n: number;
  spanDays: number;
  origin: DayKey;
}

export function linearRegression(points: { date: DayKey; kg: number }[]): Regression | null {
  if (points.length < 3) return null;
  const origin = points[0].date;
  const xs = points.map((p) => diffDays(origin, p.date));
  const ys = points.map((p) => p.kg);
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (intercept + slope * xs[i])) ** 2;
  const se = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : Infinity;
  return { slope, intercept, se, n, spanDays: xs[n - 1] - xs[0], origin };
}

export interface Forecast {
  status: 'not_enough_data' | 'not_losing' | 'reached' | 'ok';
  message: string;
  trendKgPerWeek?: number;
  /** Poids de tendance aujourd'hui (droite de régression). */
  trendWeightKg?: number;
  dateCentral?: DayKey;
  dateEarly?: DayKey;
  dateLate?: DayKey | null;
  weeksCentral?: number;
  windowDays?: number;
}

export const FORECAST_MIN_SPAN_DAYS = 14;
export const FORECAST_MIN_POINTS = 5;
const FORECAST_WINDOW_DAYS = 42;

/**
 * Prévision prudente de la date d'objectif.
 * - Nécessite au moins 14 jours d'historique et 5 pesées : jamais d'estimation sur une seule semaine.
 * - Régression linéaire sur les 6 dernières semaines (rythme récent).
 * - Fourchette : pente ± 1,28 erreur type (≈ intervalle à 80 %), plus une marge
 *   pessimiste qui suppose un ralentissement de 25 % (la perte ralentit avec le poids).
 */
export function forecastGoal(entries: WeightEntry[], goalKg: number, todayKey: DayKey): Forecast {
  const daily = dailyWeights(entries);
  if (!daily.length) return { status: 'not_enough_data', message: 'Ajoute une première pesée pour démarrer le suivi.' };
  const last = daily[daily.length - 1];
  if (last.kg <= goalKg) return { status: 'reached', message: 'Objectif atteint, bravo !' };
  const from = addDays(last.date, -FORECAST_WINDOW_DAYS);
  const recent = daily.filter((p) => p.date >= from);
  const span = recent.length ? diffDays(recent[0].date, last.date) : 0;
  if (span < FORECAST_MIN_SPAN_DAYS || recent.length < FORECAST_MIN_POINTS) {
    const missingDays = Math.max(0, FORECAST_MIN_SPAN_DAYS - span);
    const missingPts = Math.max(0, FORECAST_MIN_POINTS - recent.length);
    const parts = [] as string[];
    if (missingDays) parts.push(`${missingDays} jour${missingDays > 1 ? 's' : ''} d'historique`);
    if (missingPts) parts.push(`${missingPts} pesée${missingPts > 1 ? 's' : ''}`);
    return { status: 'not_enough_data', message: `Estimation disponible après encore ${parts.join(' et ')}. Une seule semaine ne suffit pas : l'eau et la digestion font varier le poids.` };
  }
  const reg = linearRegression(recent)!;
  const tToday = diffDays(reg.origin, todayKey);
  const trendWeight = reg.intercept + reg.slope * tToday;
  const perWeek = reg.slope * 7;
  if (reg.slope >= -0.005) {
    return {
      status: 'not_losing',
      message: 'La tendance récente est stable ou en hausse : pas de date estimée pour le moment. Les variations ponctuelles sont normales.',
      trendKgPerWeek: round2(perWeek),
      trendWeightKg: round2(trendWeight),
      windowDays: span,
    };
  }
  const remaining = Math.max(0, trendWeight - goalKg);
  const z = 1.28;
  const fast = reg.slope - z * reg.se; // plus négatif
  const slow = (reg.slope + z * reg.se) * 0.75; // moins négatif + ralentissement
  const days = remaining / -reg.slope;
  const daysEarly = remaining / -fast;
  const daysLate = slow < -0.005 ? remaining / -slow : null;
  return {
    status: 'ok',
    message: 'Estimation indicative basée sur ton rythme récent. Elle évoluera avec tes prochaines pesées.',
    trendKgPerWeek: round2(perWeek),
    trendWeightKg: round2(trendWeight),
    dateCentral: addDays(todayKey, Math.round(days)),
    dateEarly: addDays(todayKey, Math.round(daysEarly)),
    dateLate: daysLate == null ? null : addDays(todayKey, Math.round(daysLate)),
    weeksCentral: round2(days / 7),
    windowDays: span,
  };
}

/** Courbe de projection (centrale, basse, haute) pour le graphique. */
export function projectionSeries(fc: Forecast, todayKey: DayKey, goalKg: number, steps = 12) {
  if (fc.status !== 'ok' || fc.trendWeightKg == null || !fc.dateCentral || !fc.dateEarly) return [];
  const startKg = fc.trendWeightKg;
  const endDay = fc.dateLate ?? addDays(fc.dateCentral, diffDays(todayKey, fc.dateCentral));
  const total = diffDays(todayKey, endDay);
  const rate = (d: DayKey | null | undefined) => (d ? (startKg - goalKg) / Math.max(1, diffDays(todayKey, d)) : 0);
  const rc = rate(fc.dateCentral);
  const re = rate(fc.dateEarly);
  const rl = rate(fc.dateLate ?? endDay);
  const out = [] as { date: DayKey; central: number; low: number; high: number }[];
  for (let i = 0; i <= steps; i++) {
    const d = Math.round((total * i) / steps);
    out.push({
      date: addDays(todayKey, d),
      central: round2(Math.max(goalKg, startKg - rc * d)),
      low: round2(Math.max(goalKg, startKg - re * d)),
      high: round2(Math.max(goalKg, startKg - rl * d)),
    });
  }
  return out;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

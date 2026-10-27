import { addDays, rangeDays } from './dates';
import { sumNutrients } from './energy';
import type { DailyActivity, DayKey, LogEntry, Nutrients, PlanState, WaterEntry, WeightEntry, Workout } from './types';
import { dailyWeights } from './weight';

export interface DaySummary {
  date: DayKey;
  intake: Nutrients;
  logged: boolean;
  mealsLogged: number;
  waterMl: number;
  steps?: number;
  workouts: Workout[];
  runSec: number;
  runKm: number;
  weightKg?: number;
  planConsumed: number;
  planTotal: number;
  activity?: DailyActivity;
}

export interface SummaryInput {
  logs: LogEntry[];
  water: WaterEntry[];
  workouts: Workout[];
  activity: DailyActivity[];
  weights: WeightEntry[];
  planStates: PlanState[];
}

const isRun = (w: Workout) => w.type === 'course' || w.type === 'course_marche';

export function daySummary(date: DayKey, d: SummaryInput, plannedMealsCount = 3): DaySummary {
  const logs = d.logs.filter((l) => l.date === date);
  const workouts = d.workouts.filter((w) => w.date === date && w.completed);
  const act = d.activity.find((a) => a.id === date);
  const weight = dailyWeights(d.weights.filter((w) => w.date === date))[0]?.kg;
  const plan = d.planStates.filter((p) => p.date === date && p.meal !== 'snack');
  return {
    date,
    intake: sumNutrients(logs.map((l) => l.nutrients)),
    logged: logs.length > 0,
    mealsLogged: new Set(logs.map((l) => l.meal)).size,
    waterMl: d.water.filter((w) => w.date === date).reduce((s, w) => s + w.ml, 0),
    steps: act?.steps,
    workouts,
    runSec: workouts.filter(isRun).reduce((s, w) => s + w.durationSec, 0),
    runKm: workouts.filter(isRun).reduce((s, w) => s + (w.distanceKm ?? 0), 0),
    weightKg: weight,
    planConsumed: plan.filter((p) => p.status === 'consumed' || p.status === 'replaced').length,
    planTotal: plannedMealsCount,
    activity: act,
  };
}

/**
 * Score d'habitudes du jour (0 à 100), centré sur la régularité, jamais sur la « performance » :
 * journal rempli, protéines ≥ 80 % de l'objectif, eau ≥ 80 %, pas ≥ objectif ou séance faite, pesée/réalisé.
 * Dépasser l'objectif calorique ne fait pas perdre de points : l'important est de noter.
 */
export function habitScore(s: DaySummary, t: { protein: number; waterMl: number; steps: number }): { score: number; items: { label: string; done: boolean }[] } {
  const items = [
    { label: 'Journal alimentaire rempli', done: s.mealsLogged >= 2 },
    { label: 'Protéines ≥ 80 % de l’objectif', done: s.intake.protein >= t.protein * 0.8 },
    { label: 'Hydratation ≥ 80 % de l’objectif', done: s.waterMl >= t.waterMl * 0.8 },
    { label: 'Bouger : pas atteints ou séance faite', done: (s.steps ?? 0) >= t.steps || s.workouts.length > 0 },
  ];
  return { score: Math.round((items.filter((i) => i.done).length / items.length) * 100), items };
}

export interface WeekSummary {
  from: DayKey;
  to: DayKey;
  days: DaySummary[];
  avgWeight: number | null;
  prevAvgWeight: number | null;
  weightDelta: number | null;
  sessions: number;
  runKm: number;
  runSec: number;
  avgKcal: number | null;
  avgProtein: number | null;
  loggedDays: number;
  mealRegularity: number; // % jours avec ≥ 2 repas notés
  positives: string[];
  improvements: string[];
}

export function weekSummary(from: DayKey, d: SummaryInput, targets: { kcal: number; protein: number; waterMl: number }): WeekSummary {
  const to = addDays(from, 6);
  const days = rangeDays(from, to).map((k) => daySummary(k, d));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const wAll = dailyWeights(d.weights);
  const avgWeight = avg(wAll.filter((p) => p.date >= from && p.date <= to).map((p) => p.kg));
  const prevAvgWeight = avg(wAll.filter((p) => p.date >= addDays(from, -7) && p.date < from).map((p) => p.kg));
  const logged = days.filter((x) => x.logged);
  const sessions = days.reduce((s, x) => s + x.workouts.length, 0);
  const runKm = days.reduce((s, x) => s + x.runKm, 0);
  const runSec = days.reduce((s, x) => s + x.runSec, 0);
  const avgKcal = avg(logged.map((x) => x.intake.kcal));
  const avgProtein = avg(logged.map((x) => x.intake.protein));
  const mealRegularity = Math.round((days.filter((x) => x.mealsLogged >= 2).length / 7) * 100);
  const waterDays = days.filter((x) => x.waterMl >= targets.waterMl * 0.8).length;

  const positives: string[] = [];
  const improvements: string[] = [];
  if (logged.length >= 5) positives.push(`Journal tenu ${logged.length} jours sur 7 : c’est la base d’un suivi fiable.`);
  else if (logged.length > 0) improvements.push(`Journal tenu ${logged.length} jour${logged.length > 1 ? 's' : ''} sur 7. Même une saisie rapide aide à y voir clair.`);
  if (sessions >= 3) positives.push(`${sessions} séances réalisées : belle régularité.`);
  else if (sessions > 0) positives.push(`${sessions} séance${sessions > 1 ? 's' : ''} réalisée${sessions > 1 ? 's' : ''}, chaque sortie compte.`);
  else improvements.push('Aucune séance enregistrée : une marche active de 20 minutes est un bon point de départ.');
  if (avgProtein != null) {
    if (avgProtein >= targets.protein * 0.9) positives.push('Apport en protéines au rendez-vous.');
    else improvements.push(`Protéines en moyenne à ${Math.round(avgProtein)} g pour ${targets.protein} g visés : un skyr ou des œufs en plus aident.`);
  }
  if (waterDays >= 5) positives.push('Hydratation régulière.');
  if (avgWeight != null && prevAvgWeight != null) {
    const delta = avgWeight - prevAvgWeight;
    if (delta < -0.1) positives.push(`Poids moyen en baisse de ${Math.abs(delta).toFixed(1).replace('.', ',')} kg sur la semaine.`);
    else if (delta > 0.3) improvements.push('Poids moyen en légère hausse : sur une semaine, l’eau, le sel et la digestion suffisent à l’expliquer. On regarde la tendance sur plusieurs semaines.');
  }
  if (!positives.length) positives.push('Tu as ouvert ton bilan : regarder ses données est déjà un pas.');
  return {
    from, to, days, avgWeight, prevAvgWeight,
    weightDelta: avgWeight != null && prevAvgWeight != null ? avgWeight - prevAvgWeight : null,
    sessions, runKm, runSec, avgKcal, avgProtein, loggedDays: logged.length, mealRegularity, positives, improvements,
  };
}

/** Message bienveillant sur le bilan calorique du jour (jamais culpabilisant). */
export function kcalMessage(consumed: number, target: number): string {
  if (consumed === 0) return 'Rien de noté pour le moment.';
  const diff = target - consumed;
  if (diff >= 0) return `Il reste ${Math.round(diff)} kcal sur ton objectif.`;
  return `Objectif dépassé de ${Math.round(-diff)} kcal. Une journée ne change pas la tendance : c’est la moyenne de la semaine qui compte.`;
}

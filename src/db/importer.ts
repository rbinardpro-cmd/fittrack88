import { getAll, put, putMany } from './db';
import type { DailyActivity, RunSession, SyncState, WeightEntry, Workout } from '../lib/types';
import { addDays } from '../lib/dates';

export interface ImportSummary { days: number; workouts: number; newWorkouts: number; weights: number; skippedWeights: number; linked: number }

/**
 * Enregistre des données importées :
 * - activité : une ligne par jour ; les valeurs importées remplacent les précédentes,
 *   les champs saisis à la main et absents de l'import sont conservés ;
 * - séances : dédoublonnées par identifiant externe ; commentaires, RPE et douleurs saisis sont conservés ;
 *   une course importée est rattachée à la séance prévue du même jour si elle n'a pas déjà été enregistrée ;
 * - pesées : ignorées si une pesée manuelle existe déjà ce jour-là.
 */
export async function applyImport(data: { days: DailyActivity[]; workouts: Workout[]; weights: WeightEntry[] }, ctx: { runPlan: RunSession[]; runPlanStart: string }): Promise<ImportSummary> {
  const existingAct = new Map((await getAll('activity')).map((a) => [a.id, a]));
  const days = data.days.map((d) => {
    const prev = existingAct.get(d.id);
    if (!prev) return d;
    const merged: DailyActivity = { ...prev, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) } as DailyActivity;
    return merged;
  });
  await putMany('activity', days);

  const existingW = await getAll('workouts');
  const byExt = new Map(existingW.filter((w) => w.externalId).map((w) => [w.externalId!, w]));
  const linkedIds = new Set(existingW.map((w) => w.plannedSessionId).filter(Boolean));
  let newWorkouts = 0;
  let linked = 0;
  const toSave: Workout[] = data.workouts.map((w) => {
    const prev = byExt.get(w.externalId!);
    if (prev) return { ...w, id: prev.id, rpe: prev.rpe, comment: prev.comment ?? w.comment, pain: prev.pain, plannedSessionId: prev.plannedSessionId, completed: prev.completed };
    newWorkouts++;
    if (w.type === 'course' || w.type === 'course_marche') {
      const s = ctx.runPlan.find((p) => addDays(ctx.runPlanStart, (p.week - 1) * 7 + p.dayOffset) === w.date && !linkedIds.has(p.id));
      if (s) {
        linkedIds.add(s.id);
        linked++;
        return { ...w, plannedSessionId: s.id };
      }
    }
    return w;
  });
  await putMany('workouts', toSave);

  const existingWeights = await getAll('weights');
  const manualDays = new Set(existingWeights.filter((w) => w.source === 'manual').map((w) => w.date));
  const weights = data.weights.filter((w) => !manualDays.has(w.date));
  await putMany('weights', weights);
  return { days: days.length, workouts: toSave.length, newWorkouts, weights: weights.length, skippedWeights: data.weights.length - weights.length, linked };
}

export async function recordSync(state: SyncState) {
  await put('sync', state);
}

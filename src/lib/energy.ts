import type { ActivityLevel, DailyActivity, Nutrients, Profile, Sex } from './types';

// ---------- Métabolisme de base et dépense ----------

/** Mifflin-St Jeor (1990) : estimation du métabolisme de base en kcal/j. */
export function bmrMifflin(p: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}

export const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Sédentaire', hint: 'Travail assis, peu de marche' },
  light: { factor: 1.375, label: 'Légèrement actif', hint: '1 à 3 séances légères par semaine' },
  moderate: { factor: 1.55, label: 'Modérément actif', hint: '3 à 5 séances par semaine' },
  active: { factor: 1.725, label: 'Très actif', hint: '6 à 7 séances soutenues par semaine' },
};

/** Dépense énergétique journalière estimée (DEJ), activité physique incluse. */
export function tdee(bmr: number, level: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[level].factor;
}

// ---------- Objectifs ----------

export const DEFICIT_MIN = 0;
export const DEFICIT_MAX = 750;
/** Le déficit ne dépasse jamais 25 % de la dépense estimée. */
export const DEFICIT_MAX_RATIO = 0.25;

export interface Targets {
  bmr: number;
  tdee: number;
  deficit: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** Indique quelles valeurs ont été fixées à la main. */
  manual: { kcal: boolean; protein: boolean; carbs: boolean; fat: boolean; fiber: boolean };
  notes: string[];
}

/**
 * Calcule les objectifs à partir du profil et du poids actuel.
 * - Déficit borné (0 à 750 kcal, au plus 25 % de la DEJ), jamais d'objectif sous le métabolisme de base.
 * - Protéines : 1,8 g par kg de poids objectif (référence plus pertinente que le poids actuel en cas de surpoids).
 * - Lipides : 30 % des calories. Glucides : le reste. Fibres : 14 g / 1000 kcal (min 25 g).
 */
export function computeTargets(profile: Profile, currentWeightKg: number): Targets {
  const notes: string[] = [];
  const bmr = bmrMifflin({ sex: profile.sex, weightKg: currentWeightKg, heightCm: profile.heightCm, age: profile.age });
  const dej = tdee(bmr, profile.activityLevel);
  let deficit = Math.min(Math.max(profile.deficitKcal, DEFICIT_MIN), DEFICIT_MAX, dej * DEFICIT_MAX_RATIO);
  if (deficit < profile.deficitKcal) notes.push(`Déficit limité à ${Math.round(deficit)} kcal pour rester progressif.`);
  let kcal = dej - deficit;
  if (kcal < bmr) {
    kcal = bmr;
    deficit = dej - bmr;
    notes.push("Objectif relevé au niveau du métabolisme de base : l'application ne descend pas en dessous.");
  }
  kcal = Math.round(kcal / 10) * 10;
  const o = profile.overrides ?? {};
  const finalKcal = o.kcal ?? kcal;
  const protein = o.protein ?? Math.round(1.8 * profile.goalWeightKg);
  const fat = o.fat ?? Math.round((finalKcal * 0.3) / 9);
  const carbs = o.carbs ?? Math.max(0, Math.round((finalKcal - protein * 4 - fat * 9) / 4));
  const fiber = o.fiber ?? Math.max(25, Math.round((finalKcal / 1000) * 14));
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(dej),
    deficit: Math.round(deficit),
    kcal: finalKcal,
    protein,
    carbs,
    fat,
    fiber,
    manual: { kcal: o.kcal != null, protein: o.protein != null, carbs: o.carbs != null, fat: o.fat != null, fiber: o.fiber != null },
    notes,
  };
}

// ---------- Dépense du jour ----------

export interface DayEnergy {
  /** Dépense totale du jour, en kcal. */
  total: number;
  /** D'où vient ce total. */
  method: 'measured' | 'estimated';
  active: number | null;
  basal: number | null;
  explanation: string;
}

/**
 * Dépense énergétique du jour, sans double comptage :
 * - si l'Apple Watch fournit la dépense au repos ET la dépense active, total = repos + active ;
 * - sinon on prend la DEJ estimée (facteur d'activité), qui inclut DÉJÀ l'activité habituelle :
 *   les calories actives sont alors affichées pour information mais pas ajoutées.
 */
export function dayEnergy(estimatedTdee: number, act?: Pick<DailyActivity, 'activeKcal' | 'basalKcal'> | null): DayEnergy {
  const active = act?.activeKcal ?? null;
  const basal = act?.basalKcal ?? null;
  if (active != null && basal != null && basal > 0) {
    return {
      total: Math.round(active + basal),
      method: 'measured',
      active,
      basal,
      explanation: 'Dépense au repos + dépense active mesurées par Apple Santé.',
    };
  }
  return {
    total: Math.round(estimatedTdee),
    method: 'estimated',
    active,
    basal,
    explanation:
      "Estimation Mifflin-St Jeor × niveau d'activité. Elle inclut déjà l'activité habituelle : les calories actives ne sont pas ajoutées une seconde fois.",
  };
}

// ---------- Ajustement prudent ----------

/** Équivalent énergétique approximatif d'un kg de masse corporelle perdue. */
export const KCAL_PER_KG = 7700;

export interface AdjustmentSuggestion {
  ready: boolean;
  reason: string;
  /** Dépense réelle estimée à partir des apports et de la tendance du poids. */
  observedTdee?: number;
  suggestedKcal?: number;
  delta?: number;
}

/**
 * Propose (sans jamais appliquer automatiquement) un ajustement de l'objectif calorique.
 * Conditions : au moins 21 jours de tendance, au moins 80 % des jours avec un journal complet.
 * L'ajustement est limité à ±150 kcal par proposition.
 */
export function suggestAdjustment(input: {
  currentTargetKcal: number;
  avgIntakeKcal: number | null;
  loggedDays: number;
  periodDays: number;
  /** Pente de la tendance du poids, en kg par jour (négative = perte). */
  slopeKgPerDay: number | null;
  currentWeightKg: number;
  bmr: number;
}): AdjustmentSuggestion {
  const { currentTargetKcal, avgIntakeKcal, loggedDays, periodDays, slopeKgPerDay, currentWeightKg, bmr } = input;
  if (periodDays < 21 || slopeKgPerDay == null) {
    return { ready: false, reason: 'Il faut au moins 3 semaines de pesées pour évaluer la tendance.' };
  }
  if (avgIntakeKcal == null || loggedDays < periodDays * 0.8) {
    return { ready: false, reason: 'Le journal alimentaire doit être rempli au moins 80 % des jours pour que la comparaison soit fiable.' };
  }
  const observedTdee = avgIntakeKcal - slopeKgPerDay * KCAL_PER_KG;
  const weeklyPct = ((-slopeKgPerDay * 7) / currentWeightKg) * 100;
  let delta = 0;
  let reason: string;
  if (weeklyPct > 1) {
    delta = 150;
    reason = `Perte rapide (${weeklyPct.toFixed(1)} % du poids par semaine) : une petite hausse aide à préserver la masse musculaire et l'énergie.`;
  } else if (weeklyPct < 0.25) {
    delta = -100;
    reason = 'La tendance est quasi stable depuis 3 semaines : une légère baisse peut relancer la perte, si tu te sens bien.';
  } else {
    reason = `Rythme de ${weeklyPct.toFixed(1)} % du poids par semaine : progressif et durable, pas de changement nécessaire.`;
  }
  let suggested = currentTargetKcal + delta;
  if (suggested < bmr) suggested = Math.round(bmr);
  return { ready: true, reason, observedTdee: Math.round(observedTdee), suggestedKcal: Math.round(suggested / 10) * 10, delta: Math.round(suggested / 10) * 10 - currentTargetKcal };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  let fiberKnown = false;
  const t = list.reduce(
    (acc, n) => {
      acc.kcal += n.kcal;
      acc.protein += n.protein;
      acc.carbs += n.carbs;
      acc.fat += n.fat;
      if (n.fiber != null) {
        acc.fiber = (acc.fiber ?? 0) + n.fiber;
        fiberKnown = true;
      }
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 as number | null },
  );
  if (!fiberKnown) t.fiber = list.length === 0 ? 0 : null;
  return t;
}

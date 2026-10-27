import { addDays, startOfWeek } from '../lib/dates';
import type { DayKey, Profile } from '../lib/types';

export type ProfileBasics = Pick<Profile, 'firstName' | 'sex' | 'age' | 'heightCm' | 'startWeightKg' | 'goalWeightKg' | 'activityLevel'>;

/**
 * Profil créé à l'écran d'accueil à partir des informations saisies par la personne.
 * Les programmes repas et course démarrent le lundi suivant ; tout reste modifiable dans Profil.
 */
export function defaultProfile(todayKey: DayKey, basics: ProfileBasics): Profile {
  const monday = startOfWeek(todayKey);
  const nextMonday = todayKey === monday ? monday : addDays(monday, 7);
  return {
    id: 'profile',
    ...basics,
    birthYear: null,
    startDate: todayKey,
    deficitKcal: 500,
    overrides: {},
    waterGoalMl: basics.sex === 'female' ? 2000 : 2500,
    stepsGoal: 8000,
    mealPlanStart: nextMonday,
    runPlanStart: nextMonday,
    people: 1,
    theme: 'system',
    updatedAt: Date.now(),
  };
}

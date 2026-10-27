import { addDays, startOfWeek } from '../lib/dates';
import type { DayKey, Profile } from '../lib/types';

/** Profil de départ de Romain : tout est modifiable dans Profil. */
export function defaultProfile(todayKey: DayKey): Profile {
  const monday = startOfWeek(todayKey);
  const nextMonday = todayKey === monday ? monday : addDays(monday, 7);
  return {
    id: 'profile',
    firstName: 'Romain',
    sex: 'male',
    birthYear: null,
    age: 31,
    heightCm: 187,
    startWeightKg: 120,
    goalWeightKg: 88,
    startDate: todayKey,
    activityLevel: 'light',
    deficitKcal: 500,
    overrides: {},
    waterGoalMl: 2500,
    stepsGoal: 8000,
    mealPlanStart: nextMonday,
    runPlanStart: nextMonday,
    people: 1,
    theme: 'system',
    updatedAt: Date.now(),
  };
}

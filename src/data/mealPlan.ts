import type { Meal } from '../lib/types';

export interface PlannedMeal {
  meal: Meal;
  recipeId: string;
  /** Portions prévues (1 = une portion de la recette). */
  servings: number;
  note?: string;
  optional?: boolean;
}

/**
 * Programme de 14 jours (jour 0 = lundi de la semaine 1).
 * Principe : le dîner est cuisiné en 2 portions, la seconde devient le déjeuner du lendemain
 * (préparé la veille et transportable). Les poissons et l'omelette se mangent le soir même ;
 * le lendemain midi, on emporte une salade froide ou la soupe.
 */
const S = (meal: Meal, recipeId: string, note?: string, servings = 1): PlannedMeal => ({ meal, recipeId, servings, note });
const snack = (recipeId: string): PlannedMeal => ({ meal: 'snack', recipeId, servings: 1, optional: true });

export const MEAL_PLAN: PlannedMeal[][] = [
  // Semaine 1
  [S('breakfast', 'porridge-banane'), S('lunch', 'salade-pates-thon', 'Préparée dimanche soir'), S('dinner', 'boeuf-pates-tomate', 'Cuisiner 2 portions : la 2e pour demain midi'), snack('collation-skyr-pomme')],
  [S('breakfast', 'oeufs-pain'), S('lunch', 'boeuf-pates-tomate', 'Reste de la veille'), S('dinner', 'poisson-riz-brocolis', 'Ce soir aussi : préparer la salade de demain'), snack('collation-amandes-banane')],
  [S('breakfast', 'skyr-avoine'), S('lunch', 'salade-pdt-thon-oeufs', 'Préparée la veille'), S('dinner', 'dinde-curry-riz', '2 portions : la 2e pour demain midi'), snack('collation-skyr-pomme')],
  [S('breakfast', 'porridge-banane'), S('lunch', 'dinde-curry-riz', 'Reste de la veille'), S('dinner', 'omelette-pdt', 'Ce soir aussi : soupe de lentilles (3 portions)'), snack('collation-amandes-banane')],
  [S('breakfast', 'oeufs-pain'), S('lunch', 'soupe-lentilles-carottes', 'En thermos'), S('dinner', 'poulet-pdt-carottes', '2 portions : la 2e pour samedi midi'), snack('collation-skyr-pomme')],
  [S('breakfast', 'skyr-avoine'), S('lunch', 'poulet-pdt-carottes', 'Reste de la veille'), S('dinner', 'boulettes-boeuf-tomate', 'Congeler la 2e portion si besoin'), snack('collation-amandes-banane')],
  [S('breakfast', 'oeufs-pain'), S('lunch', 'poulet-roti-legumes', 'Batch : 4 portions, 1 pour demain midi'), S('dinner', 'soupe-lentilles-carottes', 'Reste de jeudi'), snack('collation-skyr-pomme')],
  // Semaine 2
  [S('breakfast', 'porridge-banane'), S('lunch', 'poulet-roti-legumes', 'Reste du dimanche'), S('dinner', 'dinde-courgettes-pates', '2 portions : la 2e pour demain midi'), snack('collation-amandes-banane')],
  [S('breakfast', 'skyr-avoine'), S('lunch', 'dinde-courgettes-pates', 'Reste de la veille'), S('dinner', 'poisson-riz-brocolis', 'Ce soir aussi : salade de pâtes pour demain'), snack('collation-skyr-pomme')],
  [S('breakfast', 'oeufs-pain'), S('lunch', 'salade-pates-thon', 'Préparée la veille'), S('dinner', 'poulet-paprika-riz-brocolis', '2 portions : la 2e pour demain midi'), snack('collation-amandes-banane')],
  [S('breakfast', 'porridge-banane'), S('lunch', 'poulet-paprika-riz-brocolis', 'Reste de la veille'), S('dinner', 'boulettes-boeuf-tomate', '2 portions : la 2e pour demain midi'), snack('collation-skyr-pomme')],
  [S('breakfast', 'skyr-avoine'), S('lunch', 'boulettes-boeuf-tomate', 'Reste de la veille'), S('dinner', 'omelette-pdt'), snack('collation-amandes-banane')],
  [S('breakfast', 'oeufs-pain'), S('lunch', 'poulet-riz-haricots'), S('dinner', 'boeuf-pates-tomate'), snack('collation-skyr-pomme')],
  [S('breakfast', 'porridge-banane'), S('lunch', 'poulet-roti-legumes', 'Nouveau batch de 4 portions (congeler le surplus)'), S('dinner', 'soupe-lentilles-carottes', 'Portion congelée'), snack('collation-amandes-banane')],
];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
};
export const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

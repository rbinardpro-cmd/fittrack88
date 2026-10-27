import type { Recipe } from '../data/recipes';
import { sumNutrients } from './energy';
import { nutrientsFor, roundNutrients, scaleNutrients } from './nutrition';
import type { Food, Nutrients } from './types';

export type FoodLookup = (id: string) => Food | undefined;

export interface RecipeNutrition {
  total: Nutrients;
  perServing: Nutrients;
  missing: string[];
  /** Vrai si toutes les valeurs viennent d'aliments marqués « à vérifier ». */
  unverified: boolean;
}

/** Valeurs nutritionnelles calculées à partir des ingrédients réellement utilisés. */
export function recipeNutrition(recipe: Recipe, lookup: FoodLookup): RecipeNutrition {
  const missing: string[] = [];
  const parts: Nutrients[] = [];
  let unverified = false;
  for (const ing of recipe.ingredients) {
    const food = lookup(ing.foodId);
    if (!food) {
      missing.push(ing.foodId);
      continue;
    }
    if (food.source === 'local_db') unverified = true;
    parts.push(nutrientsFor(food, ing.grams, ing.state ?? 'raw'));
  }
  const total = sumNutrients(parts);
  return { total: roundNutrients(total), perServing: roundNutrients(scaleNutrients(total, 1 / recipe.servings)), missing, unverified };
}

/** Valeurs pour un nombre de portions (0,5 ; 1 ; 1,5…). */
export function nutritionForServings(recipe: Recipe, servings: number, lookup: FoodLookup): Nutrients {
  if (!(servings > 0)) throw new Error('Nombre de portions invalide');
  const { total, missing } = recipeNutrition(recipe, lookup);
  if (missing.length) throw new Error(`Ingrédients inconnus : ${missing.join(', ')}`);
  return roundNutrients(scaleNutrients(total, servings / recipe.servings));
}

export function recipeAllergens(recipe: Recipe, lookup: FoodLookup): string[] {
  const set = new Set<string>();
  for (const ing of recipe.ingredients) for (const a of lookup(ing.foodId)?.allergens ?? []) set.add(a);
  return [...set].sort();
}

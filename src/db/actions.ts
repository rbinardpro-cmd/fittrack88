import type { Recipe } from '../data/recipes';
import { uid } from '../lib/format';
import { nutrientsFor, roundNutrients } from '../lib/nutrition';
import { nutritionForServings, type FoodLookup } from '../lib/recipes';
import type { CookState, DayKey, Food, LogEntry, Meal, PlanState, PlanStatus, WaterEntry } from '../lib/types';
import { getOne, put, remove } from './db';

/** Ajoute un aliment au journal. Les valeurs sont figées dans l'entrée. */
export async function logFood(p: { date: DayKey; meal: Meal; food: Food; grams: number; state: CookState }): Promise<LogEntry> {
  if (!(p.grams > 0) || p.grams > 5000) throw new Error('Quantité invalide (entre 1 et 5000 g).');
  const entry: LogEntry = {
    id: uid(),
    date: p.date,
    meal: p.meal,
    name: p.food.name,
    kind: 'food',
    foodId: p.food.id,
    grams: p.grams,
    state: p.food.cookedYield ? p.state : undefined,
    nutrients: roundNutrients(nutrientsFor(p.food, p.grams, p.state)),
    source: p.food.source,
    createdAt: Date.now(),
  };
  await put('logs', entry);
  await touchFood(p.food.id);
  return entry;
}

export async function logRecipe(p: { date: DayKey; meal: Meal; recipe: Recipe; servings: number; lookup: FoodLookup; planKey?: string }): Promise<LogEntry> {
  const entry: LogEntry = {
    id: uid(),
    date: p.date,
    meal: p.meal,
    name: p.recipe.name,
    kind: 'recipe',
    recipeId: p.recipe.id,
    servings: p.servings,
    nutrients: nutritionForServings(p.recipe, p.servings, p.lookup),
    source: 'recipe',
    createdAt: Date.now(),
    planKey: p.planKey,
  };
  await put('logs', entry);
  return entry;
}

/** Modifie la quantité d'une entrée en recalculant les valeurs. */
export async function updateLogQuantity(entry: LogEntry, qty: { grams?: number; state?: CookState; servings?: number }, deps: { food?: Food; recipe?: Recipe; lookup: FoodLookup }) {
  let next: LogEntry = entry;
  if (entry.kind === 'food' && deps.food && qty.grams) {
    const state = qty.state ?? entry.state ?? 'raw';
    next = { ...entry, grams: qty.grams, state: deps.food.cookedYield ? state : undefined, nutrients: roundNutrients(nutrientsFor(deps.food, qty.grams, state)) };
  } else if (entry.kind === 'recipe' && deps.recipe && qty.servings) {
    next = { ...entry, servings: qty.servings, nutrients: nutritionForServings(deps.recipe, qty.servings, deps.lookup) };
  } else if (entry.kind === 'food' && !deps.food && qty.grams && entry.grams) {
    // aliment supprimé de la base : mise à l'échelle des valeurs figées
    const f = qty.grams / entry.grams;
    next = { ...entry, grams: qty.grams, nutrients: roundNutrients({ ...entry.nutrients, kcal: entry.nutrients.kcal * f, protein: entry.nutrients.protein * f, carbs: entry.nutrients.carbs * f, fat: entry.nutrients.fat * f, fiber: entry.nutrients.fiber == null ? null : entry.nutrients.fiber * f }) };
  }
  await put('logs', next);
}

export async function deleteLog(entry: LogEntry): Promise<() => Promise<void>> {
  await remove('logs', entry.id);
  if (entry.planKey) {
    const ps = await getOne('planStates', entry.planKey);
    if (ps && ps.logEntryId === entry.id) await put('planStates', { ...ps, status: 'planned', logEntryId: undefined, updatedAt: Date.now() });
  }
  return async () => put('logs', entry);
}

/** Copie toutes les entrées d'un repas vers une autre date / un autre repas. */
export async function duplicateMeal(entries: LogEntry[], to: { date: DayKey; meal: Meal }) {
  for (const e of entries) await put('logs', { ...e, id: uid(), date: to.date, meal: to.meal, createdAt: Date.now(), planKey: undefined });
}

export async function addWater(date: DayKey, ml: number): Promise<WaterEntry> {
  if (!(ml > 0) || ml > 5000) throw new Error('Quantité invalide');
  const e = { id: uid(), date, ml: Math.round(ml), createdAt: Date.now() };
  await put('water', e);
  return e;
}

async function touchFood(id: string) {
  const p = (await getOne('foodPrefs', id)) ?? { id };
  await put('foodPrefs', { ...p, lastUsed: Date.now(), uses: (p.uses ?? 0) + 1 });
}

export async function toggleFavorite(food: Food) {
  if (food.custom) {
    await put('foods', { ...food, favorite: !food.favorite });
    return;
  }
  const p = (await getOne('foodPrefs', food.id)) ?? { id: food.id };
  await put('foodPrefs', { ...p, favorite: !food.favorite });
}

/**
 * Statut d'un repas du programme. « Consommé » ajoute la recette au journal
 * (et seulement à ce moment-là : un repas prévu n'est jamais compté).
 */
export async function setPlanStatus(p: {
  date: DayKey;
  meal: Meal;
  status: PlanStatus;
  recipe?: Recipe;
  servings?: number;
  lookup: FoodLookup;
}) {
  const id = `${p.date}|${p.meal}`;
  const prev = await getOne('planStates', id);
  // retirer l'entrée de journal liée si on quitte l'état « consommé »
  if (prev?.logEntryId && (p.status !== 'consumed' || prev.servings !== p.servings)) {
    await remove('logs', prev.logEntryId);
  }
  let logEntryId: string | undefined;
  if (p.status === 'consumed' && p.recipe) {
    if (prev?.status === 'consumed' && prev.logEntryId && prev.servings === p.servings) logEntryId = prev.logEntryId;
    else logEntryId = (await logRecipe({ date: p.date, meal: p.meal, recipe: p.recipe, servings: p.servings ?? 1, lookup: p.lookup, planKey: id })).id;
  }
  const state: PlanState = { id, date: p.date, meal: p.meal, status: p.status, servings: p.servings, logEntryId, updatedAt: Date.now() };
  await put('planStates', state);
}

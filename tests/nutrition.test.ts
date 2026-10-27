import { describe, expect, it } from 'vitest';
import { FOOD_BY_ID, FOODS } from '../src/data/foods';
import { RECIPE_BY_ID, RECIPES } from '../src/data/recipes';
import { convertWeight, kcalFromMacros, nutrientsFor, per100ForState, searchFoods, validateFood } from '../src/lib/nutrition';
import { nutritionForServings, recipeAllergens, recipeNutrition } from '../src/lib/recipes';

const lookup = (id: string) => FOOD_BY_ID[id];

describe('cru / cuit', () => {
  const pates = FOOD_BY_ID['pates'];
  it('100 g de pâtes crues = 230 g cuites, même énergie', () => {
    expect(convertWeight(pates, 100, 'raw', 'cooked')).toBeCloseTo(230, 6);
    const raw = nutrientsFor(pates, 100, 'raw');
    const cooked = nutrientsFor(pates, 230, 'cooked');
    expect(cooked.kcal).toBeCloseTo(raw.kcal, 6);
    expect(cooked.protein).toBeCloseTo(raw.protein, 6);
  });
  it('100 g de pâtes cuites ≈ 43 g crues : beaucoup moins de calories que 100 g crues', () => {
    const cooked100 = nutrientsFor(pates, 100, 'cooked').kcal;
    const raw100 = nutrientsFor(pates, 100, 'raw').kcal;
    expect(cooked100).toBeCloseTo(raw100 / 2.3, 6);
  });
  it('viande : 150 g de poulet cuit correspondent à 200 g cru', () => {
    const poulet = FOOD_BY_ID['poulet-filet'];
    expect(convertWeight(poulet, 150, 'cooked', 'raw')).toBeCloseTo(200, 6);
    expect(nutrientsFor(poulet, 150, 'cooked').protein).toBeCloseTo(nutrientsFor(poulet, 200, 'raw').protein, 6);
  });
  it("sans rendement de cuisson, l'état ne change rien", () => {
    const pomme = FOOD_BY_ID['pomme'];
    expect(per100ForState(pomme, 'cooked')).toEqual(pomme.per100);
  });
  it('refuse une quantité invalide', () => {
    expect(() => nutrientsFor(FOOD_BY_ID['riz'], NaN)).toThrow();
    expect(() => nutrientsFor(FOOD_BY_ID['riz'], -5)).toThrow();
  });
});

describe('base locale', () => {
  it('toutes les valeurs sont cohérentes avec les coefficients UE', () => {
    for (const f of FOODS) {
      if (f.id === 'biere') continue; // alcool ajouté à part
      const { protein, carbs, fat, fiber } = f.per100;
      expect(f.per100.kcal, f.name).toBe(kcalFromMacros(protein, carbs, fat, fiber ?? 0));
      expect(validateFood(f), f.name).toEqual([]);
    }
  });
  it('les identifiants sont uniques', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
  });
  it('recherche sans accents', () => {
    expect(searchFoods(FOODS, 'oeuf')[0].id).toBe('oeuf');
    expect(searchFoods(FOODS, 'hache boeuf')[0].id).toBe('boeuf-hache-5');
  });
  it('validation d’un aliment personnalisé incohérent', () => {
    expect(validateFood({ name: '', per100: { kcal: 100, protein: 0, carbs: 0, fat: 0, fiber: null } }).length).toBeGreaterThan(0);
    expect(validateFood({ name: 'X', per100: { kcal: 50, protein: 60, carbs: 50, fat: 0, fiber: null } }).length).toBeGreaterThan(0);
  });
});

describe('recettes', () => {
  it('chaque recette référence des aliments existants', () => {
    for (const r of RECIPES) expect(recipeNutrition(r, lookup).missing, r.name).toEqual([]);
  });
  it('les 16 recettes demandées sont présentes et numérotées', () => {
    const nums = RECIPES.map((r) => r.number).filter(Boolean).sort((a, b) => a! - b!);
    expect(nums).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
  it('les valeurs par portion = total ÷ portions', () => {
    const r = RECIPE_BY_ID['poulet-riz-haricots'];
    const n = recipeNutrition(r, lookup);
    // calcul manuel : 360 g poulet + 240 g riz cru + 400 g haricots + 10 g huile + 2 g herbes
    const manual =
      nutrientsFor(lookup('poulet-filet'), 360).kcal + nutrientsFor(lookup('riz'), 240).kcal +
      nutrientsFor(lookup('haricots-verts'), 400).kcal + nutrientsFor(lookup('huile-olive'), 10).kcal +
      nutrientsFor(lookup('herbes'), 2).kcal;
    expect(n.total.kcal).toBe(Math.round(manual));
    expect(n.perServing.kcal).toBe(Math.round(manual / 2));
  });
  it('demi-portion et portion et demie', () => {
    const r = RECIPE_BY_ID['boeuf-pates-tomate'];
    const one = nutritionForServings(r, 1, lookup);
    const half = nutritionForServings(r, 0.5, lookup);
    const oneHalf = nutritionForServings(r, 1.5, lookup);
    expect(half.kcal).toBeCloseTo(one.kcal / 2, -0.5);
    expect(oneHalf.kcal).toBeCloseTo(one.kcal * 1.5, -0.5);
    expect(() => nutritionForServings(r, 0, lookup)).toThrow();
  });
  it('allergènes déduits des ingrédients', () => {
    expect(recipeAllergens(RECIPE_BY_ID['salade-pates-thon'], lookup)).toEqual(expect.arrayContaining(['gluten', 'poisson', 'moutarde']));
  });
  it('aucune recette ne contient de porc', () => {
    for (const r of RECIPES) for (const i of r.ingredients) expect(lookup(i.foodId).name.toLowerCase()).not.toMatch(/porc|jambon|lard|bacon|chorizo/);
  });
  it('les repas principaux apportent des protéines (≥ 25 g par portion)', () => {
    for (const r of RECIPES.filter((x) => x.meals.includes('lunch') || x.meals.includes('dinner'))) {
      expect(recipeNutrition(r, lookup).perServing.protein, r.name).toBeGreaterThanOrEqual(25);
    }
  });
});

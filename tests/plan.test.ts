import { describe, expect, it } from 'vitest';
import { FOOD_BY_ID } from '../src/data/foods';
import { MEAL_PLAN } from '../src/data/mealPlan';
import { RECIPE_BY_ID } from '../src/data/recipes';
import { assessTolerance, DEFAULT_RUN_PLAN, flattenSession, paceSecPerKm, parseDuration, parsePace, sessionTotals, speedKmh } from '../src/lib/running';
import { computeNeeds, estimateBudget, formatQty, mergeShopping } from '../src/lib/shopping';

const lookup = (id: string) => FOOD_BY_ID[id];

describe('programme repas 14 jours', () => {
  it('14 jours, 3 repas principaux par jour, recettes existantes', () => {
    expect(MEAL_PLAN).toHaveLength(14);
    for (const day of MEAL_PLAN) {
      for (const m of ['breakfast', 'lunch', 'dinner'] as const) expect(day.some((p) => p.meal === m)).toBe(true);
      for (const p of day) expect(RECIPE_BY_ID[p.recipeId], p.recipeId).toBeDefined();
    }
  });
  it('utilise les 16 recettes de base', () => {
    const used = new Set(MEAL_PLAN.flat().map((p) => RECIPE_BY_ID[p.recipeId].number).filter(Boolean));
    expect(used.size).toBe(16);
  });
  it('déjeuners de semaine transportables', () => {
    for (let d = 0; d < 14; d++) {
      if (d % 7 >= 5) continue;
      const lunch = MEAL_PLAN[d].find((p) => p.meal === 'lunch')!;
      expect(RECIPE_BY_ID[lunch.recipeId].transportable, `jour ${d}`).toBe(true);
    }
  });
  it('chaque journée couvre 80 à 100 % de l’objectif de départ (pas de régime extrême)', async () => {
    const { computeTargets } = await import('../src/lib/energy');
    const { defaultProfile } = await import('../src/db/defaults');
    const { recipeNutrition } = await import('../src/lib/recipes');
    const target = computeTargets(defaultProfile('2026-10-27'), 120).kcal;
    for (const [i, day] of MEAL_PLAN.entries()) {
      const kcal = day.reduce((s, p) => s + recipeNutrition(RECIPE_BY_ID[p.recipeId], lookup).perServing.kcal * p.servings, 0);
      expect(kcal, `jour ${i + 1}`).toBeGreaterThanOrEqual(target * 0.8);
      expect(kcal, `jour ${i + 1}`).toBeLessThanOrEqual(target);
    }
  });
  it("pas plus de 2 jours d'affilée avec le même dîner", () => {
    for (let d = 2; d < 14; d++) {
      const r = (i: number) => MEAL_PLAN[i].find((p) => p.meal === 'dinner')!.recipeId;
      expect(r(d) === r(d - 1) && r(d) === r(d - 2)).toBe(false);
    }
  });
});

describe('liste de courses', () => {
  it('additionne les ingrédients au prorata des portions et des personnes', () => {
    const days = [[{ meal: 'dinner' as const, recipeId: 'poulet-riz-haricots', servings: 1 }]];
    const one = computeNeeds(days, RECIPE_BY_ID, lookup, { people: 1, includeOptional: false });
    const two = computeNeeds(days, RECIPE_BY_ID, lookup, { people: 2, includeOptional: false });
    const poulet1 = one.find((n) => n.foodId === 'poulet-filet')!;
    expect(poulet1.grams).toBe(180); // 360 g pour 2 portions → 180 g pour 1
    expect(two.find((n) => n.foodId === 'poulet-filet')!.grams).toBe(360);
  });
  it('compte les œufs en pièces et arrondit au-dessus', () => {
    const days = [[{ meal: 'breakfast' as const, recipeId: 'oeufs-pain', servings: 1 }], [{ meal: 'breakfast' as const, recipeId: 'oeufs-pain', servings: 1 }]];
    const eggs = computeNeeds(days, RECIPE_BY_ID, lookup, { people: 1, includeOptional: false }).find((n) => n.foodId === 'oeuf')!;
    expect(eggs.unit).toBe('pièce');
    expect(eggs.qty).toBe(6);
  });
  it('14 jours : quantités plausibles par rapport à la base indicative', () => {
    const needs = computeNeeds(MEAL_PLAN, RECIPE_BY_ID, lookup, { people: 1, includeOptional: true });
    const g = (id: string) => needs.find((n) => n.foodId === id)?.grams ?? 0;
    const pouletTotal = g('poulet-filet') + g('poulet-cuisse');
    expect(pouletTotal).toBeGreaterThan(1000);
    expect(pouletTotal).toBeLessThan(3000);
    expect(g('pates')).toBeGreaterThan(300);
    expect(g('pates')).toBeLessThan(1500);
  });
  it('les collations facultatives ne sont comptées que si demandées', () => {
    const without = computeNeeds(MEAL_PLAN, RECIPE_BY_ID, lookup, { people: 1, includeOptional: false });
    expect(without.find((n) => n.foodId === 'amandes')).toBeUndefined();
  });
  it('conserve cases cochées, placard et quantités modifiées', () => {
    const computed = [{ foodId: 'riz', name: 'Riz', category: 'Féculents' as const, qty: 500, unit: 'g' as const, grams: 500 }];
    const saved = [
      { id: 'a', name: 'Riz', category: 'Féculents' as const, qty: 1000, unit: 'g', computedQty: 400, checked: true, inPantry: false, manual: false, foodId: 'riz', price: 2 },
      { id: 'b', name: 'Café', category: 'Épicerie' as const, qty: 1, unit: 'paquet', checked: false, inPantry: false, manual: true },
    ];
    const merged = mergeShopping(computed, saved, () => 'new');
    expect(merged[0]).toMatchObject({ id: 'a', qty: 1000, computedQty: 500, checked: true, price: 2 });
    expect(merged.find((m) => m.id === 'b')).toBeDefined();
  });
  it('budget uniquement à partir des prix saisis', () => {
    const b = estimateBudget([
      { id: '1', name: 'Riz', category: 'Féculents', qty: 1500, unit: 'g', price: 2, checked: false, inPantry: false, manual: false },
      { id: '2', name: 'Œufs', category: 'Œufs', qty: 18, unit: 'pièce', price: 0.3, checked: false, inPantry: false, manual: false },
      { id: '3', name: 'Huile', category: 'Épicerie', qty: 100, unit: 'ml', checked: false, inPantry: false, manual: false },
      { id: '4', name: 'Pâtes', category: 'Féculents', qty: 500, unit: 'g', price: 1.5, checked: false, inPantry: true, manual: false },
    ]);
    expect(b.total).toBe(8.4);
    expect(b.priced).toBe(2);
    expect(b.unpriced).toBe(1);
  });
  it('affichage des quantités', () => {
    expect(formatQty(1250, 'g')).toBe('1,25 kg');
    expect(formatQty(750, 'ml')).toBe('750 ml');
  });
});

describe('course à pied', () => {
  const total = (id: string) => sessionTotals(DEFAULT_RUN_PLAN.find((s) => s.id === id)!.blocks);
  it('durées exactes des séances du programme', () => {
    expect(total('w1s1')).toEqual({ totalSec: 25 * 60, runSec: 6 * 60, walkSec: 19 * 60 });
    expect(total('w1s2').totalSec).toBe(25 * 60);
    expect(total('w1s3')).toEqual({ totalSec: 29 * 60, runSec: 9 * 60, walkSec: 20 * 60 });
    expect(total('w2s1')).toEqual({ totalSec: 27 * 60, runSec: 10 * 60, walkSec: 17 * 60 });
    expect(total('w2s3')).toEqual({ totalSec: 30 * 60, runSec: 12 * 60, walkSec: 18 * 60 });
  });
  it('le déroulé à plat a la même durée', () => {
    const s = DEFAULT_RUN_PLAN[0];
    expect(flattenSession(s.blocks).reduce((a, b) => a + b.sec, 0)).toBe(sessionTotals(s.blocks).totalSec);
    expect(flattenSession(s.blocks)).toHaveLength(14);
  });
  it('jours de repos entre les séances', () => {
    for (const w of [1, 2]) {
      const days = DEFAULT_RUN_PLAN.filter((s) => s.week === w).map((s) => s.dayOffset).sort();
      for (let i = 1; i < days.length; i++) expect(days[i] - days[i - 1]).toBeGreaterThanOrEqual(2);
    }
  });
  it('allure et vitesse', () => {
    expect(paceSecPerKm(1800, 4)).toBe(450); // 7'30"/km
    expect(speedKmh(1800, 4)).toBe(8);
    expect(paceSecPerKm(1800, 0)).toBeNull();
    expect(parsePace("7'30")).toBe(450);
    expect(parseDuration('25:30')).toBe(1530);
    expect(parseDuration('1:02:00')).toBe(3720);
    expect(parseDuration('25')).toBe(1500);
    expect(parseDuration('abc')).toBeNull();
  });
  it('pas de progression si douleur ou effort trop élevé', () => {
    const base = { id: 'x', date: '2026-10-27', type: 'course_marche' as const, durationSec: 1500, completed: true, source: 'manual' as const };
    expect(assessTolerance([base, { ...base, id: 'y' }]).canProgress).toBe(true);
    expect(assessTolerance([base, { ...base, id: 'y', pain: 'genou droit' }]).canProgress).toBe(false);
    expect(assessTolerance([base, { ...base, id: 'y', rpe: 9 }]).canProgress).toBe(false);
    expect(assessTolerance([base]).canProgress).toBe(false);
  });
});

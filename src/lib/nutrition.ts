import type { CookState, Food, Nutrients } from './types';

/**
 * Énergie selon les coefficients du règlement UE 1169/2011 :
 * protéines 4, glucides 4, lipides 9, fibres 2 kcal/g.
 */
export function kcalFromMacros(protein: number, carbs: number, fat: number, fiber = 0): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9 + fiber * 2);
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  return {
    kcal: n.kcal * factor,
    protein: n.protein * factor,
    carbs: n.carbs * factor,
    fat: n.fat * factor,
    fiber: n.fiber == null ? null : n.fiber * factor,
  };
}

export function roundNutrients(n: Nutrients): Nutrients {
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return { kcal: Math.round(n.kcal), protein: r1(n.protein), carbs: r1(n.carbs), fat: r1(n.fat), fiber: n.fiber == null ? null : r1(n.fiber) };
}

export function hasCookStates(food: Food): boolean {
  return typeof food.cookedYield === 'number' && food.cookedYield > 0;
}

/**
 * Valeurs pour 100 g dans l'état demandé.
 * La cuisson ne crée ni ne détruit (ou presque) l'énergie : l'eau absorbée (pâtes, riz)
 * ou perdue (viandes) change le poids. Donc valeurs cuites = valeurs crues / rendement.
 */
export function per100ForState(food: Food, state: CookState): Nutrients {
  if (state === 'cooked' && hasCookStates(food)) return scaleNutrients(food.per100, 1 / food.cookedYield!);
  return food.per100;
}

/** Nutriments pour une quantité en grammes dans l'état indiqué. */
export function nutrientsFor(food: Food, grams: number, state: CookState = 'raw'): Nutrients {
  if (!(grams >= 0)) throw new Error('Quantité invalide');
  return scaleNutrients(per100ForState(food, state), grams / 100);
}

/** Convertit un poids d'un état à l'autre (ex. 100 g de pâtes crues ≈ 230 g cuites). */
export function convertWeight(food: Food, grams: number, from: CookState, to: CookState): number {
  if (from === to || !hasCookStates(food)) return grams;
  return from === 'raw' ? grams * food.cookedYield! : grams / food.cookedYield!;
}

/** Validation d'un aliment personnalisé. Renvoie la liste des erreurs (vide si OK). */
export function validateFood(f: { name: string; per100: Nutrients }): string[] {
  const errs: string[] = [];
  if (!f.name.trim()) errs.push('Le nom est obligatoire.');
  const { kcal, protein, carbs, fat, fiber } = f.per100;
  for (const [k, v] of Object.entries({ kcal, protein, carbs, fat })) {
    if (!isFinite(v) || v < 0) errs.push(`Valeur invalide : ${k}.`);
  }
  if (fiber != null && (!isFinite(fiber) || fiber < 0)) errs.push('Valeur invalide : fibres.');
  if (protein + carbs + fat + (fiber ?? 0) > 100.5) errs.push('La somme des macronutriments dépasse 100 g pour 100 g.');
  if (kcal > 900) errs.push('Plus de 900 kcal pour 100 g est impossible.');
  const theoretical = kcalFromMacros(protein, carbs, fat, fiber ?? 0);
  if (kcal > 0 && Math.abs(theoretical - kcal) > Math.max(40, kcal * 0.2)) {
    errs.push(`Les calories (${kcal}) ne correspondent pas aux macronutriments (≈ ${theoretical} kcal). Vérifie l'étiquette.`);
  }
  return errs;
}

/** Recherche tolérante (sans accents, sans casse, tous les mots doivent apparaître). */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe');
}

export function searchFoods(foods: Food[], query: string): Food[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return foods;
  return foods
    .map((f) => {
      const n = normalize(f.name);
      if (!words.every((w) => n.includes(w))) return null;
      const score = (n.startsWith(words[0]) ? 0 : 1) + (f.favorite ? -2 : 0) + n.length / 100;
      return { f, score };
    })
    .filter((x): x is { f: Food; score: number } => x != null)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.f);
}

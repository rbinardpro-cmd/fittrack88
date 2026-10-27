import type { PlannedMeal } from '../data/mealPlan';
import type { Recipe } from '../data/recipes';
import type { FoodLookup } from './recipes';
import type { ShoppingCategory, ShoppingItem } from './types';

export const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  'Viandes et poissons', 'Œufs', 'Produits laitiers', 'Légumes frais', 'Légumes surgelés',
  'Fruits', 'Féculents', 'Épicerie', 'Assaisonnements', 'Autres',
];

export interface ComputedNeed {
  foodId: string;
  name: string;
  category: ShoppingCategory;
  /** Quantité brute nécessaire, en g / ml / pièces. */
  qty: number;
  unit: 'g' | 'ml' | 'pièce';
  grams: number;
}

/**
 * Additionne les ingrédients des repas sélectionnés.
 * quantité = ingrédient de la recette × (portions prévues / portions de la recette) × nombre de personnes.
 * Les ingrédients notés « cuits » sont reconvertis en poids cru à acheter.
 */
export function computeNeeds(
  days: PlannedMeal[][],
  recipes: Record<string, Recipe>,
  lookup: FoodLookup,
  opts: { people: number; includeOptional: boolean; skipped?: Set<string> },
): ComputedNeed[] {
  const grams = new Map<string, number>();
  days.forEach((day, di) => {
    for (const pm of day) {
      if (pm.optional && !opts.includeOptional) continue;
      if (opts.skipped?.has(`${di}|${pm.meal}`)) continue;
      const r = recipes[pm.recipeId];
      if (!r) continue;
      const factor = (pm.servings / r.servings) * opts.people;
      for (const ing of r.ingredients) {
        const food = lookup(ing.foodId);
        let g = ing.grams * factor;
        if (food && ing.state === 'cooked' && food.cookedYield) g = g / food.cookedYield;
        grams.set(ing.foodId, (grams.get(ing.foodId) ?? 0) + g);
      }
    }
  });
  const out: ComputedNeed[] = [];
  for (const [foodId, g] of grams) {
    const food = lookup(foodId);
    const shop = food?.shopping;
    const unit = shop?.unit ?? 'g';
    const qty = unit === 'pièce' ? Math.ceil(g / (shop?.pieceGrams ?? 1) - 0.05) : Math.ceil(g / 10) * 10;
    out.push({ foodId, name: shop?.label ?? food?.name ?? foodId, category: shop?.category ?? 'Autres', qty, unit, grams: Math.round(g) });
  }
  return out.sort((a, b) => SHOPPING_CATEGORIES.indexOf(a.category) - SHOPPING_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name, 'fr'));
}

/**
 * Fusionne la liste calculée avec la liste enregistrée : conserve les cases cochées,
 * les produits « déjà au placard », les prix et les quantités modifiées à la main.
 */
export function mergeShopping(computed: ComputedNeed[], saved: ShoppingItem[], newId: () => string): ShoppingItem[] {
  const byFood = new Map(saved.filter((s) => s.foodId).map((s) => [s.foodId!, s]));
  const result: ShoppingItem[] = computed.map((c) => {
    const prev = byFood.get(c.foodId);
    const edited = prev && prev.computedQty != null && prev.qty !== prev.computedQty;
    return {
      id: prev?.id ?? newId(),
      name: c.name,
      category: c.category,
      qty: edited ? prev!.qty : c.qty,
      unit: c.unit,
      computedQty: c.qty,
      checked: prev?.checked ?? false,
      inPantry: prev?.inPantry ?? false,
      manual: false,
      price: prev?.price,
      priceUnit: prev?.priceUnit,
      foodId: c.foodId,
      habitual: prev?.habitual,
    };
  });
  // articles manuels et produits habituels conservés
  for (const s of saved) if (s.manual || (s.habitual && !computed.some((c) => c.foodId === s.foodId))) result.push(s);
  return result;
}

/** Quantité affichée de façon lisible : 1 250 g → « 1,25 kg ». */
export function formatQty(qty: number, unit: string): string {
  const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  if (unit === 'g' && qty >= 1000) return `${nf.format(qty / 1000)} kg`;
  if (unit === 'ml' && qty >= 1000) return `${nf.format(qty / 1000)} L`;
  if (unit === 'pièce') return `${nf.format(qty)}`;
  return `${nf.format(qty)} ${unit}`;
}

/**
 * Budget estimé : uniquement à partir des prix saisis par l'utilisateur.
 * Prix exprimé par kg (g), par litre (ml) ou par pièce.
 */
export function estimateBudget(items: ShoppingItem[]): { total: number; priced: number; unpriced: number } {
  let total = 0;
  let priced = 0;
  let unpriced = 0;
  for (const it of items) {
    if (it.inPantry) continue;
    if (it.price == null || !(it.price >= 0)) {
      unpriced++;
      continue;
    }
    priced++;
    const q = it.unit === 'g' || it.unit === 'ml' ? it.qty / 1000 : it.qty;
    total += q * it.price;
  }
  return { total: Math.round(total * 100) / 100, priced, unpriced };
}

export function shoppingToText(items: ShoppingItem[], title: string): string {
  const lines = [title, ''];
  for (const cat of SHOPPING_CATEGORIES) {
    const list = items.filter((i) => i.category === cat && !i.inPantry);
    if (!list.length) continue;
    lines.push(cat.toUpperCase());
    for (const i of list) lines.push(`${i.checked ? '☑' : '☐'} ${i.name} : ${formatQty(i.qty, i.unit)}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

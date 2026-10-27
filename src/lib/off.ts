import { kcalFromMacros } from './nutrition';
import type { Food } from './types';

/*
 * Open Food Facts : base collaborative et gratuite, sans clé API (licence ODbL).
 * Limites documentées par OFF : ~10 recherches/minute, ~100 lectures de produit/minute par IP.
 * Les valeurs sont saisies par des contributeurs : elles sont marquées comme telles.
 * Seuls le texte recherché ou le code-barres sont envoyés à OFF (aucune donnée personnelle).
 */

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_fr,brands,nutriments,serving_quantity,allergens_tags';

interface OffProduct {
  code: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  serving_quantity?: number | string;
  allergens_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
}

export function offToFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const g = (k: string) => {
    const v = n[k];
    const x = typeof v === 'string' ? Number(v) : v;
    return typeof x === 'number' && isFinite(x) && x >= 0 ? x : null;
  };
  const protein = g('proteins_100g');
  const carbs = g('carbohydrates_100g');
  const fat = g('fat_100g');
  let kcal = g('energy-kcal_100g');
  if (kcal == null && g('energy_100g') != null) kcal = g('energy_100g')! / 4.184; // kJ
  if (protein == null || carbs == null || fat == null) return null; // valeurs incomplètes : on n'invente rien
  const fiber = g('fiber_100g');
  const name = (p.product_name_fr || p.product_name || '').trim();
  if (!name) return null;
  const serving = Number(p.serving_quantity);
  return {
    id: `off-${p.code}`,
    name: p.brands ? `${name} (${p.brands.split(',')[0].trim()})` : name,
    category: 'autre',
    per100: { kcal: Math.round(kcal ?? kcalFromMacros(protein, carbs, fat, fiber ?? 0)), protein, carbs, fat, fiber },
    portion: serving > 0 ? { label: `1 portion (${serving} g)`, grams: serving } : undefined,
    allergens: (p.allergens_tags ?? []).map((a) => a.replace(/^\w\w:/, '')),
    source: 'open_food_facts',
    sourceNote: `Open Food Facts, produit ${p.code} (données collaboratives)`,
    barcode: p.code,
    custom: true,
  };
}

async function getJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (res.status === 429) throw new Error('Trop de recherches en peu de temps (limite d’Open Food Facts). Réessaie dans une minute.');
  if (!res.ok) throw new Error(`Open Food Facts indisponible (erreur ${res.status}).`);
  return res.json();
}

export async function searchOff(query: string, signal?: AbortSignal): Promise<{ foods: Food[]; skipped: number }> {
  if (!navigator.onLine) throw new Error('Pas de connexion Internet : la recherche Open Food Facts est indisponible. La base locale reste utilisable.');
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24&lc=fr&cc=fr&fields=${FIELDS}`;
  const data = (await getJson(url, signal)) as { products?: OffProduct[] };
  const all = data.products ?? [];
  const foods = all.map(offToFood).filter((f): f is Food => f != null);
  return { foods, skipped: all.length - foods.length };
}

export async function fetchOffBarcode(code: string, signal?: AbortSignal): Promise<Food | null> {
  if (!/^\d{8,14}$/.test(code)) throw new Error('Code-barres invalide (8 à 14 chiffres).');
  const data = (await getJson(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`, signal)) as { status: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;
  return offToFood({ ...data.product, code });
}

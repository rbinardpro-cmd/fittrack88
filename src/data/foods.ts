import { kcalFromMacros } from '../lib/nutrition';
import type { Food, FoodCategory, Nutrients, ShoppingCategory } from '../lib/types';

/*
 * Base d'aliments locale de FITTRACK 88 (fonctionne hors ligne).
 *
 * PROVENANCE ET LIMITES — à lire :
 * - Les protéines, glucides, lipides et fibres sont des valeurs moyennes pour 100 g,
 *   reprises de mémoire de la table de composition française CIQUAL (ANSES) et de
 *   tables équivalentes. Elles n'ont PAS été importées automatiquement depuis le fichier
 *   officiel : elles sont donc marquées « à vérifier » dans l'application.
 * - L'énergie est recalculée à partir des macronutriments avec les coefficients UE
 *   (4/4/9/2), ce qui garantit la cohérence calories ↔ macros.
 * - Les états cuits sont dérivés de l'état cru par un rendement de cuisson moyen
 *   (`cookedYield` = poids cuit / poids cru), variable selon la cuisson réelle.
 * Pour une valeur exacte d'un produit précis, utilise la recherche Open Food Facts
 * (étiquette du produit) ou crée ton propre aliment depuis l'étiquette.
 */

const NOTE = 'Valeur moyenne d’après CIQUAL (ANSES), saisie manuellement — à vérifier';

function n(protein: number, carbs: number, fat: number, fiber: number | null): Nutrients {
  return { kcal: kcalFromMacros(protein, carbs, fat, fiber ?? 0), protein, carbs, fat, fiber };
}

type Extra = Partial<Pick<Food, 'cookedYield' | 'portion' | 'liquid' | 'allergens'>> & {
  shop?: { cat: ShoppingCategory; unit?: 'g' | 'ml' | 'pièce'; pieceGrams?: number; label?: string };
};

function f(id: string, name: string, category: FoodCategory, per100: Nutrients, extra: Extra = {}): Food {
  const { shop, ...rest } = extra;
  return {
    id,
    name,
    category,
    per100,
    source: 'local_db',
    sourceNote: NOTE,
    ...rest,
    shopping: shop ? { category: shop.cat, unit: shop.unit ?? 'g', pieceGrams: shop.pieceGrams, label: shop.label } : undefined,
  };
}

export const FOODS: Food[] = [
  // Viandes, poissons, œufs (crus, rendement de cuisson ≈ perte d'eau)
  f('poulet-filet', 'Poulet, filet sans peau', 'viande', n(23.5, 0, 1.8, 0), { cookedYield: 0.75, shop: { cat: 'Viandes et poissons', label: 'Poulet (filets)' } }),
  f('poulet-cuisse', 'Poulet, haut de cuisse sans peau', 'viande', n(19, 0, 6, 0), { cookedYield: 0.72, shop: { cat: 'Viandes et poissons', label: 'Poulet (hauts de cuisse sans peau)' } }),
  f('dinde-escalope', 'Dinde, escalope', 'viande', n(24, 0, 1, 0), { cookedYield: 0.75, shop: { cat: 'Viandes et poissons', label: 'Dinde (escalopes)' } }),
  f('boeuf-hache-5', 'Bœuf haché 5 % MG', 'viande', n(21, 0, 5, 0), { cookedYield: 0.75, shop: { cat: 'Viandes et poissons', label: 'Bœuf haché 5 % MG' } }),
  f('poisson-blanc', 'Poisson blanc (cabillaud, colin), filet', 'poisson', n(17.5, 0, 0.7, 0), { cookedYield: 0.8, allergens: ['poisson'], shop: { cat: 'Viandes et poissons', label: 'Poisson blanc (filets, surgelés possibles)' } }),
  f('thon-naturel', 'Thon au naturel, égoutté', 'poisson', n(25.5, 0, 1, 0), { portion: { label: '1 boîte (≈ 100 g égoutté)', grams: 100 }, allergens: ['poisson'], shop: { cat: 'Épicerie', unit: 'pièce', pieceGrams: 100, label: 'Thon au naturel (boîtes)' } }),
  f('oeuf', 'Œuf entier', 'oeuf', n(12.7, 0.3, 9.8, 0), { portion: { label: '1 œuf moyen (55 g sans coquille)', grams: 55 }, allergens: ['œuf'], shop: { cat: 'Œufs', unit: 'pièce', pieceGrams: 55, label: 'Œufs' } }),

  // Produits laitiers
  f('skyr', 'Skyr nature', 'laitier', n(10.5, 3.8, 0.2, 0), { portion: { label: '1 pot (150 g)', grams: 150 }, allergens: ['lait'], shop: { cat: 'Produits laitiers', label: 'Skyr nature' } }),
  f('fromage-blanc-0', 'Fromage blanc 0 %', 'laitier', n(7.5, 4, 0.2, 0), { portion: { label: '1 portion (150 g)', grams: 150 }, allergens: ['lait'], shop: { cat: 'Produits laitiers', label: 'Fromage blanc 0 %' } }),
  f('yaourt-nature', 'Yaourt nature', 'laitier', n(4.3, 5.5, 1.2, 0), { portion: { label: '1 pot (125 g)', grams: 125 }, allergens: ['lait'], shop: { cat: 'Produits laitiers', label: 'Yaourts nature' } }),
  f('lait-demi', 'Lait demi-écrémé', 'laitier', n(3.3, 4.8, 1.6, 0), { liquid: true, portion: { label: '1 verre (200 ml)', grams: 200 }, allergens: ['lait'], shop: { cat: 'Produits laitiers', unit: 'ml', label: 'Lait demi-écrémé' } }),
  f('creme-legere', 'Crème fraîche légère 15 %', 'laitier', n(2.8, 3.9, 15, 0), { allergens: ['lait'], shop: { cat: 'Produits laitiers', label: 'Crème légère 15 %' } }),
  f('emmental', 'Emmental râpé', 'laitier', n(28, 0.5, 29, 0), { portion: { label: '1 c. à soupe (10 g)', grams: 10 }, allergens: ['lait'], shop: { cat: 'Produits laitiers', label: 'Emmental râpé' } }),

  // Féculents (crus, rendement = absorption d'eau à la cuisson)
  f('pates', 'Pâtes sèches', 'feculent', n(12.5, 70.9, 1.6, 3), { cookedYield: 2.3, allergens: ['gluten'], shop: { cat: 'Féculents', label: 'Pâtes' } }),
  f('pates-completes', 'Pâtes complètes sèches', 'feculent', n(13, 63, 2.3, 8), { cookedYield: 2.3, allergens: ['gluten'], shop: { cat: 'Féculents', label: 'Pâtes complètes' } }),
  f('riz', 'Riz blanc', 'feculent', n(7, 78, 0.6, 1.3), { cookedYield: 2.6, shop: { cat: 'Féculents', label: 'Riz' } }),
  f('riz-complet', 'Riz complet', 'feculent', n(7.5, 72, 2.7, 3.5), { cookedYield: 2.5, shop: { cat: 'Féculents', label: 'Riz complet' } }),
  f('lentilles', 'Lentilles vertes sèches', 'legumineuse', n(24.6, 52.7, 1.1, 10.7), { cookedYield: 2.5, shop: { cat: 'Féculents', label: 'Lentilles vertes' } }),
  f('pomme-de-terre', 'Pomme de terre', 'feculent', n(2, 16.5, 0.1, 1.8), { cookedYield: 1, shop: { cat: 'Légumes frais', label: 'Pommes de terre' } }),
  f('flocons-avoine', "Flocons d'avoine", 'feculent', n(13.5, 58.7, 7, 10), { portion: { label: '1 portion (40 g)', grams: 40 }, allergens: ['gluten (avoine)'], shop: { cat: 'Féculents', label: "Flocons d'avoine" } }),
  f('pain-complet', 'Pain complet', 'feculent', n(9.5, 43, 2.5, 6.5), { portion: { label: '1 tranche (40 g)', grams: 40 }, allergens: ['gluten'], shop: { cat: 'Féculents', label: 'Pain complet' } }),
  f('baguette', 'Baguette blanche', 'feculent', n(8.5, 55, 1.2, 2.7), { portion: { label: '1/4 de baguette (60 g)', grams: 60 }, allergens: ['gluten'] }),

  // Légumes
  f('carotte', 'Carotte', 'legume', n(0.6, 6.6, 0.3, 2.7), { shop: { cat: 'Légumes frais', label: 'Carottes' } }),
  f('haricots-verts', 'Haricots verts (surgelés nature)', 'legume', n(1.8, 3.6, 0.2, 3.4), { shop: { cat: 'Légumes surgelés', label: 'Haricots verts surgelés' } }),
  f('petits-pois', 'Petits pois (surgelés nature)', 'legume', n(5.4, 9.1, 0.4, 5.1), { shop: { cat: 'Légumes surgelés', label: 'Petits pois surgelés' } }),
  f('brocoli', 'Brocoli (surgelé nature)', 'legume', n(2.8, 4, 0.4, 2.6), { shop: { cat: 'Légumes surgelés', label: 'Brocolis surgelés' } }),
  f('courgette', 'Courgette', 'legume', n(1.2, 2.2, 0.3, 1), { shop: { cat: 'Légumes frais', label: 'Courgettes' } }),
  f('oignon', 'Oignon', 'legume', n(1.1, 7.6, 0.1, 1.7), { portion: { label: '1 oignon moyen (100 g)', grams: 100 }, shop: { cat: 'Légumes frais', unit: 'pièce', pieceGrams: 100, label: 'Oignons' } }),
  f('ail', 'Ail', 'legume', n(6.4, 24, 0.5, 2.1), { portion: { label: '1 gousse (5 g)', grams: 5 }, shop: { cat: 'Assaisonnements', unit: 'pièce', pieceGrams: 5, label: 'Ail (gousses)' } }),
  f('tomate', 'Tomate', 'legume', n(0.9, 2.9, 0.2, 1.2), { shop: { cat: 'Légumes frais', label: 'Tomates' } }),
  f('salade-verte', 'Salade verte', 'legume', n(1.3, 1.4, 0.2, 1.3), { shop: { cat: 'Légumes frais', label: 'Salade verte' } }),
  f('poivron', 'Poivron', 'legume', n(0.9, 4.6, 0.3, 1.8), { shop: { cat: 'Légumes frais', label: 'Poivrons' } }),
  f('legumes-soupe', 'Mélange de légumes (surgelé nature)', 'legume', n(1.8, 5, 0.3, 2.8), { shop: { cat: 'Légumes surgelés', label: 'Mélange de légumes surgelés' } }),
  f('coulis-tomate', 'Coulis de tomate nature', 'legume', n(1.4, 5.5, 0.2, 1.5), { shop: { cat: 'Épicerie', label: 'Coulis de tomate' } }),

  // Fruits
  f('banane', 'Banane', 'fruit', n(1.1, 20.5, 0.3, 2.6), { portion: { label: '1 banane (120 g épluchée)', grams: 120 }, shop: { cat: 'Fruits', unit: 'pièce', pieceGrams: 120, label: 'Bananes' } }),
  f('pomme', 'Pomme', 'fruit', n(0.3, 11.6, 0.2, 2), { portion: { label: '1 pomme (150 g)', grams: 150 }, shop: { cat: 'Fruits', unit: 'pièce', pieceGrams: 150, label: 'Pommes' } }),
  f('orange', 'Orange', 'fruit', n(0.9, 8.5, 0.2, 2), { portion: { label: '1 orange (150 g épluchée)', grams: 150 } }),
  f('kiwi', 'Kiwi', 'fruit', n(1, 10, 0.6, 3), { portion: { label: '1 kiwi (75 g)', grams: 75 } }),
  f('clementine', 'Clémentine', 'fruit', n(0.8, 9.2, 0.2, 1.7), { portion: { label: '1 clémentine (60 g)', grams: 60 } }),
  f('fruits-rouges', 'Fruits rouges (surgelés)', 'fruit', n(1, 7, 0.3, 4), { shop: { cat: 'Fruits', label: 'Fruits rouges surgelés' } }),
  f('citron', 'Citron (jus)', 'fruit', n(0.4, 2.5, 0.2, 0.3), { portion: { label: '1/2 citron (20 g de jus)', grams: 20 }, shop: { cat: 'Fruits', unit: 'pièce', pieceGrams: 40, label: 'Citrons' } }),

  // Matières grasses, oléagineux
  f('huile-olive', "Huile d'olive", 'matiere_grasse', n(0, 0, 100, 0), { liquid: true, portion: { label: '1 c. à soupe (10 g)', grams: 10 }, shop: { cat: 'Épicerie', unit: 'ml', label: "Huile d'olive" } }),
  f('beurre', 'Beurre doux', 'matiere_grasse', n(0.7, 0.6, 82, 0), { portion: { label: '1 noisette (10 g)', grams: 10 }, allergens: ['lait'] }),
  f('amandes', 'Amandes', 'oleagineux', n(21.2, 8.8, 49.9, 12.5), { portion: { label: '1 poignée (20 g)', grams: 20 }, allergens: ['fruits à coque'], shop: { cat: 'Épicerie', label: 'Amandes ou noix' } }),
  f('noix', 'Noix (cerneaux)', 'oleagineux', n(15, 7, 65, 6.7), { portion: { label: '1 poignée (20 g)', grams: 20 }, allergens: ['fruits à coque'] }),

  // Épicerie, assaisonnements
  f('miel', 'Miel', 'epicerie', n(0.4, 81, 0, 0.2), { portion: { label: '1 c. à café (8 g)', grams: 8 }, shop: { cat: 'Épicerie', label: 'Miel' } }),
  f('moutarde', 'Moutarde', 'epicerie', n(7, 4, 11, 3), { portion: { label: '1 c. à café (5 g)', grams: 5 }, allergens: ['moutarde'], shop: { cat: 'Assaisonnements', label: 'Moutarde' } }),
  f('curry', 'Curry en poudre', 'epicerie', n(14, 25, 14, 33), { shop: { cat: 'Assaisonnements', label: 'Curry en poudre' } }),
  f('paprika', 'Paprika', 'epicerie', n(14, 19, 13, 35), { shop: { cat: 'Assaisonnements', label: 'Paprika' } }),
  f('bouillon', 'Bouillon de légumes (préparé)', 'epicerie', n(0.2, 0.5, 0.1, 0), { liquid: true, shop: { cat: 'Assaisonnements', unit: 'ml', label: 'Bouillon de légumes (cubes)' } }),
  f('herbes', 'Herbes de Provence', 'epicerie', n(9, 30, 7, 37), { shop: { cat: 'Assaisonnements', label: 'Herbes de Provence' } }),
  f('cumin', 'Cumin', 'epicerie', n(18, 34, 22, 10), { shop: { cat: 'Assaisonnements', label: 'Cumin' } }),
  f('vinaigre', 'Vinaigre de cidre', 'epicerie', n(0, 0.9, 0, 0), { liquid: true, shop: { cat: 'Assaisonnements', unit: 'ml', label: 'Vinaigre' } }),
  f('chocolat-noir', 'Chocolat noir 70 %', 'epicerie', n(9, 33, 42, 11), { portion: { label: '2 carrés (20 g)', grams: 20 } }),
  f('confiture', 'Confiture', 'epicerie', n(0.4, 60, 0.1, 1), { portion: { label: '1 c. à café (10 g)', grams: 10 } }),

  // Boissons
  f('cafe', 'Café noir', 'boisson', n(0.1, 0, 0, 0), { liquid: true, portion: { label: '1 tasse (100 ml)', grams: 100 } }),
  f('the', 'Thé sans sucre', 'boisson', n(0, 0.2, 0, 0), { liquid: true, portion: { label: '1 tasse (200 ml)', grams: 200 } }),
  f('jus-orange', "Jus d'orange 100 %", 'boisson', n(0.7, 9, 0.1, 0.2), { liquid: true, portion: { label: '1 verre (200 ml)', grams: 200 } }),
  f('soda', 'Soda sucré', 'boisson', n(0, 10.6, 0, 0), { liquid: true, portion: { label: '1 canette (330 ml)', grams: 330 } }),
  f('biere', 'Bière blonde (5 %)', 'boisson', n(0.4, 3.5, 0, 0), { liquid: true, portion: { label: '1 demi (250 ml)', grams: 250 }, allergens: ['gluten'] }),
];

/*
 * L'alcool apporte 7 kcal/g, non couvert par le calcul macros : la bière est corrigée ici
 * (≈ 3,9 g d'alcool / 100 ml → +27 kcal) pour ne pas sous-estimer.
 */
const biere = FOODS.find((x) => x.id === 'biere')!;
biere.per100 = { ...biere.per100, kcal: biere.per100.kcal + 27 };

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((x) => [x.id, x]));

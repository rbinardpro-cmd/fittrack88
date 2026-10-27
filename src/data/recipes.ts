import type { CookState, Meal } from '../lib/types';

export interface RecipeIngredient {
  foodId: string;
  /** Quantité totale pour la recette, en grammes (ou ml pour les liquides), dans l'état `state`. */
  grams: number;
  state?: CookState; // défaut : cru
  /** Texte d'affichage optionnel, ex. « 3 œufs ». */
  display?: string;
}

export interface Recipe {
  id: string;
  number?: number;
  name: string;
  emoji: string;
  prepMin: number;
  cookMin: number;
  servings: number;
  meals: Meal[];
  transportable?: boolean;
  ingredients: RecipeIngredient[];
  steps: string[];
  storage: string;
  freezable: boolean;
  freezeNote?: string;
  tips?: string;
  custom?: boolean;
}

export const RECIPES: Recipe[] = [
  {
    id: 'porridge-banane', number: 1, name: 'Porridge à la banane', emoji: '🥣', prepMin: 3, cookMin: 4, servings: 1, meals: ['breakfast'],
    ingredients: [
      { foodId: 'flocons-avoine', grams: 70 },
      { foodId: 'lait-demi', grams: 250, display: '250 ml de lait demi-écrémé' },
      { foodId: 'banane', grams: 120, display: '1 banane' },
      { foodId: 'skyr', grams: 150 },
    ],
    steps: [
      "Verser les flocons et le lait dans une casserole (ou un bol pour le micro-ondes).",
      'Cuire 3 à 4 min à feu doux en remuant (ou 2 min au micro-ondes en 2 fois).',
      'Écraser la moitié de la banane dans le porridge, couper le reste en rondelles.',
      'Ajouter le skyr par-dessus pour les protéines. Cannelle possible (0 kcal significative).',
    ],
    storage: 'À consommer tout de suite. Version « overnight » : mélanger à froid la veille, garder au frigo.',
    freezable: false,
  },
  {
    id: 'oeufs-pain', number: 2, name: 'Œufs et pain complet', emoji: '🍳', prepMin: 2, cookMin: 6, servings: 1, meals: ['breakfast'],
    ingredients: [
      { foodId: 'oeuf', grams: 165, display: '3 œufs' },
      { foodId: 'pain-complet', grams: 120, display: '3 tranches de pain complet' },
      { foodId: 'tomate', grams: 100, display: '1 tomate' },
      { foodId: 'orange', grams: 150, display: '1 orange' },
    ],
    steps: [
      "Cuire les œufs : à la coque 6 min, durs 9 min, ou brouillés dans une poêle antiadhésive sans matière grasse.",
      'Griller le pain.',
      'Servir avec la tomate en tranches, sel et poivre, et l’orange.',
    ],
    storage: "Œufs durs : 4 jours au frigo dans leur coquille, pratique pour les matins pressés.",
    freezable: false,
  },
  {
    id: 'skyr-avoine', number: 3, name: "Skyr ou fromage blanc aux flocons d'avoine", emoji: '🥛', prepMin: 3, cookMin: 0, servings: 1, meals: ['breakfast'],
    ingredients: [
      { foodId: 'skyr', grams: 250 },
      { foodId: 'flocons-avoine', grams: 60 },
      { foodId: 'fruits-rouges', grams: 100 },
      { foodId: 'banane', grams: 120, display: '1 banane' },
      { foodId: 'miel', grams: 8, display: '1 c. à café de miel' },
    ],
    steps: [
      'Mettre le skyr (ou le fromage blanc 0 %) dans un bol.',
      'Ajouter les flocons, la banane en rondelles et les fruits rouges (décongelés la veille au frigo ou directement surgelés).',
      'Ajouter le miel et mélanger.',
    ],
    storage: 'Se prépare la veille dans un bocal fermé, 24 h au frigo.',
    freezable: false,
  },
  {
    id: 'poulet-riz-haricots', number: 4, name: 'Poulet, riz et haricots verts', emoji: '🍗', prepMin: 10, cookMin: 20, servings: 2, meals: ['lunch', 'dinner'], transportable: true,
    ingredients: [
      { foodId: 'poulet-filet', grams: 360 },
      { foodId: 'riz', grams: 240 },
      { foodId: 'haricots-verts', grams: 400 },
      { foodId: 'huile-olive', grams: 10, display: "1 c. à soupe d'huile d'olive" },
      { foodId: 'herbes', grams: 2, display: 'Herbes de Provence' },
    ],
    steps: [
      'Cuire le riz dans un grand volume d’eau salée (10 à 12 min), égoutter.',
      'Cuire les haricots verts surgelés 8 à 10 min à l’eau bouillante ou à la vapeur.',
      'Couper le poulet en lanières, saisir 6 à 8 min à la poêle avec l’huile et les herbes, jusqu’à ce qu’il ne soit plus rosé à cœur.',
      'Répartir en 2 boîtes : riz, haricots, poulet.',
    ],
    storage: '3 jours au réfrigérateur en boîte hermétique. Refroidir le riz rapidement (moins d’1 h à température ambiante).',
    freezable: true, freezeNote: '2 mois (sans les haricots, qui ramollissent).',
  },
  {
    id: 'salade-pates-thon', number: 5, name: 'Salade de pâtes au thon', emoji: '🥗', prepMin: 15, cookMin: 10, servings: 2, meals: ['lunch'], transportable: true,
    ingredients: [
      { foodId: 'pates', grams: 240 },
      { foodId: 'thon-naturel', grams: 200, display: '2 boîtes de thon au naturel' },
      { foodId: 'tomate', grams: 200, display: '2 tomates' },
      { foodId: 'poivron', grams: 150, display: '1 poivron' },
      { foodId: 'petits-pois', grams: 150 },
      { foodId: 'huile-olive', grams: 20 },
      { foodId: 'vinaigre', grams: 10 },
      { foodId: 'moutarde', grams: 5 },
    ],
    steps: [
      'Cuire les pâtes et les petits pois ensemble (les pois les 4 dernières minutes), égoutter et rincer à l’eau froide.',
      'Couper les tomates et le poivron en dés, égoutter le thon.',
      'Préparer la vinaigrette : huile, vinaigre, moutarde, sel, poivre.',
      'Mélanger le tout, répartir en 2 boîtes. Garder la vinaigrette à part si possible.',
    ],
    storage: '2 jours au réfrigérateur. Transport en sac isotherme.',
    freezable: false,
  },
  {
    id: 'boeuf-pates-tomate', number: 6, name: 'Bœuf haché, pâtes et sauce tomate', emoji: '🍝', prepMin: 10, cookMin: 20, servings: 2, meals: ['lunch', 'dinner'], transportable: true,
    ingredients: [
      { foodId: 'boeuf-hache-5', grams: 300 },
      { foodId: 'pates', grams: 230 },
      { foodId: 'coulis-tomate', grams: 300 },
      { foodId: 'oignon', grams: 100, display: '1 oignon' },
      { foodId: 'carotte', grams: 150, display: '1 grosse carotte râpée' },
      { foodId: 'huile-olive', grams: 5 },
      { foodId: 'herbes', grams: 2 },
    ],
    steps: [
      'Faire revenir l’oignon émincé dans l’huile 3 min.',
      'Ajouter le bœuf haché, l’émietter et le cuire jusqu’à ce qu’il soit bien doré (cuisson à cœur pour la viande hachée).',
      'Ajouter la carotte râpée, le coulis et les herbes, laisser mijoter 10 min.',
      'Cuire les pâtes, égoutter, mélanger avec la sauce.',
    ],
    storage: '3 jours au réfrigérateur.',
    freezable: true, freezeNote: 'La sauce seule se congèle 3 mois.',
  },
  {
    id: 'poulet-pdt-carottes', number: 7, name: 'Poulet, pommes de terre et carottes', emoji: '🥕', prepMin: 15, cookMin: 35, servings: 2, meals: ['lunch', 'dinner'], transportable: true,
    ingredients: [
      { foodId: 'poulet-filet', grams: 360 },
      { foodId: 'pomme-de-terre', grams: 900 },
      { foodId: 'carotte', grams: 300 },
      { foodId: 'oignon', grams: 100 },
      { foodId: 'huile-olive', grams: 15 },
      { foodId: 'herbes', grams: 2 },
    ],
    steps: [
      'Préchauffer le four à 200 °C.',
      'Couper les pommes de terre et les carottes en morceaux, l’oignon en quartiers.',
      'Mélanger avec l’huile, les herbes, sel et poivre sur une plaque, enfourner 20 min.',
      'Ajouter le poulet en morceaux, poursuivre 15 min.',
    ],
    storage: '3 jours au réfrigérateur.',
    freezable: true, freezeNote: 'Possible, mais les pommes de terre deviennent farineuses.',
  },
  {
    id: 'dinde-curry-riz', number: 8, name: 'Dinde au curry et riz', emoji: '🍛', prepMin: 10, cookMin: 20, servings: 2, meals: ['lunch', 'dinner'], transportable: true,
    ingredients: [
      { foodId: 'dinde-escalope', grams: 300 },
      { foodId: 'riz', grams: 220 },
      { foodId: 'petits-pois', grams: 200 },
      { foodId: 'oignon', grams: 100 },
      { foodId: 'creme-legere', grams: 60 },
      { foodId: 'curry', grams: 6, display: '2 c. à café de curry' },
      { foodId: 'huile-olive', grams: 5 },
    ],
    steps: [
      'Cuire le riz.',
      'Faire revenir l’oignon dans l’huile, ajouter la dinde en dés et la dorer 5 min.',
      'Ajouter le curry, les petits pois et 10 cl d’eau, cuire 8 min.',
      'Hors du feu, ajouter la crème légère. Servir avec le riz.',
    ],
    storage: '3 jours au réfrigérateur.',
    freezable: true, freezeNote: '2 mois.',
  },
  {
    id: 'omelette-pdt', number: 9, name: 'Omelette aux pommes de terre', emoji: '🥔', prepMin: 10, cookMin: 25, servings: 2, meals: ['dinner', 'lunch'], transportable: true,
    ingredients: [
      { foodId: 'oeuf', grams: 330, display: '6 œufs' },
      { foodId: 'pomme-de-terre', grams: 650 },
      { foodId: 'oignon', grams: 100 },
      { foodId: 'huile-olive', grams: 10 },
      { foodId: 'emmental', grams: 30 },
      { foodId: 'salade-verte', grams: 100 },
      { foodId: 'pain-complet', grams: 120, display: '3 tranches de pain complet' },
    ],
    steps: [
      'Couper les pommes de terre en fines rondelles, les cuire 10 min à l’eau ou 6 min au micro-ondes.',
      'Les faire dorer à la poêle avec l’huile et l’oignon émincé.',
      'Battre les œufs avec l’emmental, sel, poivre, verser sur les pommes de terre.',
      'Cuire à couvert à feu doux 10 min. Servir avec la salade et le pain.',
    ],
    storage: '2 jours au réfrigérateur ; se mange aussi froide (type tortilla).',
    freezable: false,
  },
  {
    id: 'poisson-riz-brocolis', number: 10, name: 'Poisson, riz et brocolis', emoji: '🐟', prepMin: 5, cookMin: 20, servings: 2, meals: ['dinner'],
    ingredients: [
      { foodId: 'poisson-blanc', grams: 400 },
      { foodId: 'riz', grams: 230 },
      { foodId: 'brocoli', grams: 400 },
      { foodId: 'huile-olive', grams: 15 },
      { foodId: 'citron', grams: 20, display: '1/2 citron' },
    ],
    steps: [
      'Cuire le riz.',
      'Cuire les brocolis surgelés 8 min à la vapeur.',
      'Cuire le poisson (décongelé) à la poêle 3 à 4 min par face avec l’huile, ou 15 min au four à 180 °C en papillote.',
      'Arroser de jus de citron.',
    ],
    storage: '1 jour au réfrigérateur pour le poisson cuit : à privilégier au dîner.',
    freezable: false,
  },
  {
    id: 'boulettes-boeuf-tomate', number: 11, name: 'Boulettes de bœuf à la tomate', emoji: '🧆', prepMin: 20, cookMin: 25, servings: 2, meals: ['dinner', 'lunch'], transportable: true,
    ingredients: [
      { foodId: 'boeuf-hache-5', grams: 300 },
      { foodId: 'flocons-avoine', grams: 30 },
      { foodId: 'oeuf', grams: 55, display: '1 œuf' },
      { foodId: 'oignon', grams: 50, display: '1/2 oignon' },
      { foodId: 'ail', grams: 5, display: '1 gousse d’ail' },
      { foodId: 'coulis-tomate', grams: 400 },
      { foodId: 'pates', grams: 200 },
      { foodId: 'haricots-verts', grams: 200 },
      { foodId: 'herbes', grams: 2 },
    ],
    steps: [
      'Mélanger le bœuf, les flocons, l’œuf, l’oignon haché fin, l’ail, sel et poivre. Former une douzaine de boulettes.',
      'Les dorer dans une poêle antiadhésive 5 min.',
      'Ajouter le coulis et les herbes, mijoter 15 min à couvert.',
      'Servir avec les pâtes et les haricots verts.',
    ],
    storage: '3 jours au réfrigérateur.',
    freezable: true, freezeNote: '3 mois, boulettes et sauce ensemble.',
  },
  {
    id: 'poulet-roti-legumes', number: 12, name: 'Poulet rôti et légumes', emoji: '🍗', prepMin: 15, cookMin: 45, servings: 4, meals: ['lunch', 'dinner'], transportable: true,
    ingredients: [
      { foodId: 'poulet-cuisse', grams: 900, display: '900 g de hauts de cuisse sans peau' },
      { foodId: 'pomme-de-terre', grams: 1200 },
      { foodId: 'carotte', grams: 400 },
      { foodId: 'courgette', grams: 400 },
      { foodId: 'oignon', grams: 200 },
      { foodId: 'huile-olive', grams: 30 },
      { foodId: 'herbes', grams: 4 },
      { foodId: 'ail', grams: 10 },
    ],
    steps: [
      'Préchauffer le four à 200 °C.',
      'Couper les légumes en gros morceaux, les mélanger avec l’huile, l’ail, les herbes, sel et poivre.',
      'Poser les hauts de cuisse sur les légumes.',
      'Rôtir 40 à 45 min en retournant à mi-cuisson. Le jus doit être clair.',
    ],
    storage: '3 jours au réfrigérateur. Recette « batch » du week-end : 4 portions.',
    freezable: true, freezeNote: 'Le poulet se congèle 3 mois ; les légumes perdent en texture.',
  },
  {
    id: 'soupe-lentilles-carottes', number: 13, name: 'Soupe de lentilles et carottes', emoji: '🍲', prepMin: 10, cookMin: 30, servings: 3, meals: ['lunch', 'dinner'], transportable: true,
    ingredients: [
      { foodId: 'lentilles', grams: 300 },
      { foodId: 'carotte', grams: 450 },
      { foodId: 'oignon', grams: 150 },
      { foodId: 'pomme-de-terre', grams: 200 },
      { foodId: 'bouillon', grams: 1200, display: '1,2 L de bouillon de légumes' },
      { foodId: 'cumin', grams: 3 },
      { foodId: 'huile-olive', grams: 10 },
      { foodId: 'yaourt-nature', grams: 125, display: '1 yaourt nature (pour servir)' },
      { foodId: 'pain-complet', grams: 120, display: '3 tranches de pain complet (1 par bol)' },
    ],
    steps: [
      'Faire revenir l’oignon dans l’huile 3 min avec le cumin.',
      'Ajouter les carottes et la pomme de terre en morceaux, les lentilles rincées et le bouillon.',
      'Cuire 25 à 30 min jusqu’à ce que les lentilles soient tendres.',
      'Mixer (ou non). Servir avec une cuillère de yaourt et une tranche de pain complet. Thermos pour le déjeuner.',
    ],
    storage: '4 jours au réfrigérateur.',
    freezable: true, freezeNote: '3 mois en portions individuelles.',
  },
  {
    id: 'salade-pdt-thon-oeufs', number: 14, name: 'Salade de pommes de terre, thon et œufs', emoji: '🥚', prepMin: 15, cookMin: 20, servings: 2, meals: ['lunch'], transportable: true,
    ingredients: [
      { foodId: 'pomme-de-terre', grams: 700 },
      { foodId: 'thon-naturel', grams: 200, display: '2 boîtes de thon au naturel' },
      { foodId: 'oeuf', grams: 220, display: '4 œufs' },
      { foodId: 'haricots-verts', grams: 200 },
      { foodId: 'yaourt-nature', grams: 125 },
      { foodId: 'moutarde', grams: 10 },
      { foodId: 'huile-olive', grams: 15 },
    ],
    steps: [
      'Cuire les pommes de terre à l’eau 20 min, les œufs 9 min, les haricots verts 8 min.',
      'Refroidir, couper les pommes de terre en dés et les œufs en quartiers.',
      'Sauce : yaourt, moutarde, huile, sel, poivre.',
      'Mélanger avec le thon égoutté, répartir en 2 boîtes.',
    ],
    storage: '2 jours au réfrigérateur.',
    freezable: false,
  },
  {
    id: 'dinde-courgettes-pates', number: 15, name: 'Dinde aux courgettes et pâtes', emoji: '🍝', prepMin: 10, cookMin: 20, servings: 2, meals: ['lunch', 'dinner'], transportable: true,
    ingredients: [
      { foodId: 'dinde-escalope', grams: 360 },
      { foodId: 'courgette', grams: 400 },
      { foodId: 'pates', grams: 230 },
      { foodId: 'ail', grams: 5 },
      { foodId: 'huile-olive', grams: 10 },
      { foodId: 'emmental', grams: 20 },
    ],
    steps: [
      'Cuire les pâtes.',
      'Faire dorer la dinde en lanières dans l’huile 5 min, réserver.',
      'Faire sauter les courgettes en dés avec l’ail 8 min.',
      'Remettre la dinde, ajouter les pâtes et l’emmental, mélanger.',
    ],
    storage: '3 jours au réfrigérateur.',
    freezable: false,
  },
  {
    id: 'poulet-paprika-riz-brocolis', number: 16, name: 'Poulet au paprika, riz et brocolis', emoji: '🌶️', prepMin: 10, cookMin: 20, servings: 2, meals: ['lunch', 'dinner'], transportable: true,
    ingredients: [
      { foodId: 'poulet-filet', grams: 300 },
      { foodId: 'riz', grams: 210 },
      { foodId: 'brocoli', grams: 400 },
      { foodId: 'oignon', grams: 100 },
      { foodId: 'paprika', grams: 6, display: '2 c. à café de paprika' },
      { foodId: 'creme-legere', grams: 40 },
      { foodId: 'huile-olive', grams: 10 },
    ],
    steps: [
      'Cuire le riz et les brocolis.',
      'Faire revenir l’oignon dans l’huile, ajouter le poulet en dés, dorer 6 min.',
      'Ajouter le paprika et 5 cl d’eau, cuire 3 min, puis la crème hors du feu.',
      'Servir avec le riz et les brocolis.',
    ],
    storage: '3 jours au réfrigérateur.',
    freezable: true, freezeNote: '2 mois (sans les brocolis).',
  },
  // Collations facultatives (ajoutées pour compléter le programme)
  {
    id: 'collation-skyr-pomme', name: 'Collation : skyr, pomme et amandes', emoji: '🍎', prepMin: 1, cookMin: 0, servings: 1, meals: ['snack'], transportable: true,
    ingredients: [{ foodId: 'skyr', grams: 150 }, { foodId: 'pomme', grams: 150, display: '1 pomme' }, { foodId: 'amandes', grams: 15, display: '1 petite poignée d’amandes (15 g)' }],
    steps: ['Un pot de skyr et une pomme, faciles à emporter au travail.'],
    storage: 'Skyr au frais.', freezable: false,
  },
  {
    id: 'collation-amandes-banane', name: 'Collation : amandes et banane', emoji: '🍌', prepMin: 1, cookMin: 0, servings: 1, meals: ['snack'], transportable: true,
    ingredients: [{ foodId: 'amandes', grams: 25, display: '1 poignée d’amandes (25 g)' }, { foodId: 'banane', grams: 120, display: '1 banane' }],
    steps: ['Pratique avant une séance de course en fin de journée.'],
    storage: 'Température ambiante.', freezable: false,
  },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

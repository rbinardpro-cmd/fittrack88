// Modèle de données de FITTRACK 88. Toutes les dates « jour » sont des chaînes
// AAAA-MM-JJ dans le fuseau local de l'appareil (voir lib/dates.ts).

export type DayKey = string;

/** Provenance d'une donnée, affichée à côté de chaque valeur. */
export type DataSource =
  | 'manual' // saisie manuelle
  | 'apple_health_export' // import de l'export Apple Santé (export.zip / export.xml)
  | 'shortcut_import' // import JSON (Raccourci iOS ou fichier)
  | 'file_import' // import CSV/JSON générique
  | 'estimate' // calcul estimatif de l'application
  | 'local_db' // base d'aliments locale
  | 'open_food_facts' // API externe Open Food Facts
  | 'recipe'; // calculé depuis une recette

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** null = donnée non disponible (différent de 0). */
  fiber: number | null;
}

export interface Profile {
  id: 'profile';
  firstName: string;
  sex: Sex;
  birthYear: number | null;
  age: number;
  heightCm: number;
  startWeightKg: number;
  goalWeightKg: number;
  startDate: DayKey;
  activityLevel: ActivityLevel;
  /** Déficit visé en kcal/j (borné par l'application). */
  deficitKcal: number;
  /** Objectifs saisis à la main (remplacent les calculs s'ils sont définis). */
  overrides: Partial<{ kcal: number; protein: number; carbs: number; fat: number; fiber: number }>;
  waterGoalMl: number;
  stepsGoal: number;
  /** Lundi du premier jour du programme repas de 14 jours. */
  mealPlanStart: DayKey;
  /** Lundi de la semaine 1 du programme de course. */
  runPlanStart: DayKey;
  /** Nombre de personnes pour la liste de courses. */
  people: number;
  theme: 'system' | 'light' | 'dark';
  updatedAt: number;
}

export interface WeightEntry {
  id: string;
  date: DayKey;
  time?: string; // HH:MM
  kg: number;
  source: DataSource;
  note?: string;
}

/** États de cuisson possibles pour les aliments qui en ont plusieurs. */
export type CookState = 'raw' | 'cooked';

export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  /** Valeurs pour 100 g (état cru si l'aliment a un état cuit). */
  per100: Nutrients;
  /**
   * Rendement de cuisson : poids cuit / poids cru. Ex. pâtes ≈ 2,3, poulet ≈ 0,75.
   * Présent uniquement pour les aliments où la distinction cru/cuit compte.
   */
  cookedYield?: number;
  /** Portion type proposée (ex. « 1 œuf » = 55 g). */
  portion?: { label: string; grams: number };
  /** Liquide : quantité saisie en ml, densité ≈ 1. */
  liquid?: boolean;
  allergens?: string[];
  source: DataSource;
  sourceNote?: string;
  barcode?: string;
  custom?: boolean;
  favorite?: boolean;
  shopping?: { category: ShoppingCategory; unit: 'g' | 'ml' | 'pièce'; pieceGrams?: number; label?: string };
}

export type FoodCategory =
  | 'viande' | 'poisson' | 'oeuf' | 'laitier' | 'legume' | 'fruit' | 'feculent'
  | 'legumineuse' | 'matiere_grasse' | 'oleagineux' | 'epicerie' | 'boisson' | 'autre';

export type ShoppingCategory =
  | 'Viandes et poissons' | 'Œufs' | 'Produits laitiers' | 'Légumes frais' | 'Légumes surgelés'
  | 'Fruits' | 'Féculents' | 'Épicerie' | 'Assaisonnements' | 'Autres';

export interface LogEntry {
  id: string;
  date: DayKey;
  meal: Meal;
  name: string;
  /** Aliment : grammes saisis dans l'état indiqué. Recette : portions. */
  kind: 'food' | 'recipe' | 'quick';
  foodId?: string;
  recipeId?: string;
  grams?: number;
  state?: CookState;
  servings?: number;
  /** Valeurs figées au moment de l'ajout (l'historique ne change pas si la base change). */
  nutrients: Nutrients;
  source: DataSource;
  createdAt: number;
  planKey?: string;
}

export interface WaterEntry { id: string; date: DayKey; ml: number; createdAt: number }

export type PlanStatus = 'planned' | 'consumed' | 'replaced' | 'skipped';
export interface PlanState {
  /** `${date}|${meal}` */
  id: string;
  date: DayKey;
  meal: Meal;
  status: PlanStatus;
  servings?: number;
  logEntryId?: string;
  updatedAt: number;
}

export type WorkoutType = 'course' | 'marche' | 'course_marche' | 'velo' | 'renforcement' | 'autre';

export interface Workout {
  id: string;
  date: DayKey;
  startTime?: string;
  type: WorkoutType;
  durationSec: number;
  distanceKm?: number;
  avgHr?: number;
  maxHr?: number;
  activeKcal?: number;
  elevationM?: number;
  /** Perception de l'effort, échelle 1 à 10. */
  rpe?: number;
  comment?: string;
  pain?: string;
  completed: boolean;
  plannedSessionId?: string;
  source: DataSource;
  externalId?: string;
}

export type IntervalBlock =
  | { kind: 'walk'; label: string; sec: number }
  | { kind: 'run'; label: string; sec: number }
  | { kind: 'repeat'; times: number; runSec: number; walkSec: number };

export interface RunSession {
  id: string;
  week: number;
  /** Jour de la semaine (0 = lundi). */
  dayOffset: number;
  title: string;
  blocks: IntervalBlock[];
  notes?: string;
}

export interface DailyActivity {
  /** date */
  id: DayKey;
  steps?: number;
  distanceKm?: number;
  activeKcal?: number;
  basalKcal?: number;
  exerciseMin?: number;
  sleepMin?: number;
  restingHr?: number;
  source: DataSource;
  importedAt: number;
  /** Sources Apple retenues (nom de l'appareil), pour la traçabilité. */
  deviceNote?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: ShoppingCategory;
  qty: number;
  unit: string;
  checked: boolean;
  inPantry: boolean;
  manual: boolean;
  /** Prix unitaire saisi par l'utilisateur (€ par unité de `priceUnit`). */
  price?: number;
  priceUnit?: string;
  /** Clé de l'aliment pour fusion avec la liste calculée. */
  foodId?: string;
  /** Quantité calculée d'après les recettes (avant modification). */
  computedQty?: number;
  habitual?: boolean;
}

export interface SyncState {
  id: string; // 'apple_health' | 'shortcut'
  lastAt: number;
  status: 'ok' | 'error' | 'partial';
  message: string;
  stats?: Record<string, number>;
}

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RunSession } from '../lib/types';
import type {
  DailyActivity, Food, LogEntry, PlanState, Profile, ShoppingItem, SyncState, WaterEntry, WeightEntry, Workout,
} from '../lib/types';
import type { Recipe } from '../data/recipes';

/*
 * Stockage local IndexedDB (dans le navigateur, sur l'appareil). Aucune donnée n'est envoyée à un serveur.
 * Chaque magasin correspond à une entité du modèle de données (voir docs/ARCHITECTURE.md).
 */

export interface FitDB extends DBSchema {
  profile: { key: string; value: Profile };
  weights: { key: string; value: WeightEntry; indexes: { date: string } };
  foods: { key: string; value: Food };
  /** Préférences sur les aliments de la base locale (favoris), sans dupliquer l'aliment. */
  foodPrefs: { key: string; value: { id: string; favorite?: boolean; lastUsed?: number; uses?: number } };
  logs: { key: string; value: LogEntry; indexes: { date: string } };
  water: { key: string; value: WaterEntry; indexes: { date: string } };
  planStates: { key: string; value: PlanState; indexes: { date: string } };
  workouts: { key: string; value: Workout; indexes: { date: string } };
  runPlan: { key: string; value: RunSession };
  activity: { key: string; value: DailyActivity };
  shopping: { key: string; value: ShoppingItem };
  recipes: { key: string; value: Recipe };
  sync: { key: string; value: SyncState };
}

export type StoreName = 'profile' | 'weights' | 'foods' | 'foodPrefs' | 'logs' | 'water' | 'planStates' | 'workouts' | 'runPlan' | 'activity' | 'shopping' | 'recipes' | 'sync';
export const STORES: StoreName[] = ['profile', 'weights', 'foods', 'foodPrefs', 'logs', 'water', 'planStates', 'workouts', 'runPlan', 'activity', 'shopping', 'recipes', 'sync'];

const DB_NAME = 'fittrack88';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FitDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FitDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FitDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('profile', { keyPath: 'id' });
        db.createObjectStore('weights', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('foods', { keyPath: 'id' });
        db.createObjectStore('foodPrefs', { keyPath: 'id' });
        db.createObjectStore('logs', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('water', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('planStates', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('workouts', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('runPlan', { keyPath: 'id' });
        db.createObjectStore('activity', { keyPath: 'id' });
        db.createObjectStore('shopping', { keyPath: 'id' });
        db.createObjectStore('recipes', { keyPath: 'id' });
        db.createObjectStore('sync', { keyPath: 'id' });
      },
      blocked() {
        console.warn('Base FITTRACK bloquée par un autre onglet ouvert.');
      },
    });
  }
  return dbPromise;
}

// --- notification des changements pour rafraîchir l'interface ---
type Listener = (store: StoreName) => void;
const listeners = new Set<Listener>();
export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
let channel: BroadcastChannel | null = null;
try {
  channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fittrack88') : null;
  channel?.addEventListener('message', (e) => listeners.forEach((l) => l(e.data as StoreName)));
} catch {
  channel = null;
}
export function notify(store: StoreName) {
  listeners.forEach((l) => l(store));
  channel?.postMessage(store);
}

// --- accès générique ---
export async function getAll<S extends StoreName>(store: S): Promise<FitDB[S]['value'][]> {
  return (await getDB()).getAll(store);
}
export async function getOne<S extends StoreName>(store: S, key: string): Promise<FitDB[S]['value'] | undefined> {
  return (await getDB()).get(store, key);
}
export async function put<S extends StoreName>(store: S, value: FitDB[S]['value']): Promise<void> {
  await (await getDB()).put(store, value);
  notify(store);
}
export async function putMany<S extends StoreName>(store: S, values: FitDB[S]['value'][]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  await Promise.all([...values.map((v) => tx.store.put(v)), tx.done]);
  notify(store);
}
export async function remove(store: StoreName, key: string): Promise<void> {
  await (await getDB()).delete(store, key);
  notify(store);
}
export async function removeMany(store: StoreName, keys: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done]);
  notify(store);
}
export async function clearStore(store: StoreName): Promise<void> {
  await (await getDB()).clear(store);
  notify(store);
}

/** Demande au navigateur de ne pas effacer les données en cas de manque d'espace (Safari 17+, Chrome…). */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

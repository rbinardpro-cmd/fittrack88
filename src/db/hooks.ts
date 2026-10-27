import { useCallback, useEffect, useMemo, useState } from 'react';
import { FOODS } from '../data/foods';
import { RECIPES, type Recipe } from '../data/recipes';
import { computeTargets, type Targets } from '../lib/energy';
import { today } from '../lib/dates';
import { DEFAULT_RUN_PLAN } from '../lib/running';
import type { Food, Profile, RunSession } from '../lib/types';
import { latestWeight } from '../lib/weight';
import { getAll, getOne, put, subscribe, type FitDB, type StoreName } from './db';
import { defaultProfile } from './defaults';

/** Lit tout un magasin et se met à jour à chaque modification. `undefined` pendant le chargement. */
export function useStore<S extends StoreName>(store: S): FitDB[S]['value'][] | undefined {
  const [rows, setRows] = useState<FitDB[S]['value'][]>();
  useEffect(() => {
    let alive = true;
    const load = () => getAll(store).then((r) => alive && setRows(r)).catch((e) => console.error(e));
    load();
    const unsub = subscribe((s) => s === store && load());
    return () => {
      alive = false;
      unsub();
    };
  }, [store]);
  return rows;
}

/** Profil (créé avec les valeurs de départ au premier lancement). */
export function useProfile(): [Profile | undefined, (p: Partial<Profile>) => Promise<void>] {
  const rows = useStore('profile');
  const profile = rows?.[0];
  useEffect(() => {
    if (rows && rows.length === 0) {
      getOne('profile', 'profile').then((p) => {
        if (!p) put('profile', defaultProfile(today()));
      });
    }
  }, [rows]);
  const update = useCallback(
    async (patch: Partial<Profile>) => {
      const cur = (await getOne('profile', 'profile')) ?? defaultProfile(today());
      await put('profile', { ...cur, ...patch, id: 'profile', updatedAt: Date.now() });
    },
    [],
  );
  return [profile, update];
}

/** Aliments disponibles : base locale + aliments personnels, avec favoris. */
export function useFoods(): { foods: Food[]; byId: Record<string, Food>; loading: boolean } {
  const custom = useStore('foods');
  const prefs = useStore('foodPrefs');
  return useMemo(() => {
    const prefMap = new Map((prefs ?? []).map((p) => [p.id, p]));
    const all = [...FOODS, ...(custom ?? [])].map((f) => {
      const p = prefMap.get(f.id);
      return p ? { ...f, favorite: p.favorite ?? f.favorite } : f;
    });
    return { foods: all, byId: Object.fromEntries(all.map((f) => [f.id, f])), loading: !custom || !prefs };
  }, [custom, prefs]);
}

export function useRecipes(): { recipes: Recipe[]; byId: Record<string, Recipe> } {
  const custom = useStore('recipes');
  return useMemo(() => {
    const all = [...RECIPES, ...(custom ?? [])];
    return { recipes: all, byId: Object.fromEntries(all.map((r) => [r.id, r])) };
  }, [custom]);
}

/** Programme de course (modifiable) : celui enregistré, sinon le programme de reprise par défaut. */
export function useRunPlan(): RunSession[] | undefined {
  const rows = useStore('runPlan');
  return useMemo(() => {
    if (!rows) return undefined;
    const list = rows.length ? rows : DEFAULT_RUN_PLAN;
    return [...list].sort((a, b) => a.week - b.week || a.dayOffset - b.dayOffset);
  }, [rows]);
}

/** Objectifs calculés sur le dernier poids connu (ou le poids de départ). */
export function useTargets(): { targets: Targets | undefined; profile: Profile | undefined; currentWeight: number | undefined } {
  const [profile] = useProfile();
  const weights = useStore('weights');
  return useMemo(() => {
    if (!profile || !weights) return { targets: undefined, profile, currentWeight: undefined };
    const cur = latestWeight(weights)?.kg ?? profile.startWeightKg;
    return { targets: computeTargets(profile, cur), profile, currentWeight: cur };
  }, [profile, weights]);
}

/** Recalcule « aujourd'hui » à minuit (changement de jour pendant que l'app est ouverte). */
export function useToday(): string {
  const [d, setD] = useState(today());
  useEffect(() => {
    const id = setInterval(() => {
      const t = today();
      setD((prev) => (prev === t ? prev : t));
    }, 30_000);
    const onVis = () => setD(today());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return d;
}

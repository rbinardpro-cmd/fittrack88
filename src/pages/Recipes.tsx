import { Clock, Snowflake, Users, Plus, Trash2, Pencil, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Recipe, RecipeIngredient } from '../data/recipes';
import { MEAL_LABELS, MEAL_ORDER } from '../data/mealPlan';
import { put, remove } from '../db/db';
import { useFoods, useRecipes, useToday } from '../db/hooks';
import { fmt0, fmt1, uid } from '../lib/format';
import { hasCookStates, searchFoods } from '../lib/nutrition';
import { nutritionForServings, recipeAllergens, recipeNutrition } from '../lib/recipes';
import type { Meal } from '../lib/types';
import { RecipeServingsPicker } from '../components/AddFood';
import { Card, Empty, Field, Notice, PageHeader, parseNum, Segmented, Sheet } from '../components/ui';
import { toast } from '../components/toast';

export default function RecipesPage() {
  const { recipes } = useRecipes();
  const { byId } = useFoods();
  const [filter, setFilter] = useState<'all' | Meal | 'transport'>('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const list = recipes.filter((r) => (filter === 'all' ? true : filter === 'transport' ? r.transportable : r.meals.includes(filter)) && r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Recettes" back subtitle={`${recipes.length} recettes · valeurs calculées depuis les ingrédients`} action={<button className="btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={16} />Créer</button>} />
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-10" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une recette" aria-label="Rechercher une recette" />
      </div>
      <Segmented ariaLabel="Filtrer" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Toutes' }, { value: 'breakfast', label: 'Petit-déj.' }, { value: 'transport', label: 'À emporter' }, { value: 'dinner', label: 'Dîner' }, { value: 'snack', label: 'Collations' }]} />
      <div className="grid sm:grid-cols-2 gap-3">
        {list.map((r) => {
          const n = recipeNutrition(r, (id) => byId[id]).perServing;
          return (
            <Link key={r.id} to={`/recettes/${r.id}`} className="card flex gap-3 items-center hover:border-accent/50">
              <span className="text-4xl w-12 text-center" aria-hidden>{r.emoji}</span>
              <div className="min-w-0">
                <div className="font-semibold leading-snug">{r.number ? `${r.number}. ` : ''}{r.name}</div>
                <div className="text-[12px] text-muted tabular mt-0.5">{fmt0(n.kcal)} kcal · {fmt0(n.protein)} g prot. / portion</div>
                <div className="text-[12px] text-muted flex items-center gap-2 mt-0.5"><Clock size={12} />{r.prepMin + r.cookMin} min<Users size={12} />{r.servings}{r.freezable && <Snowflake size={12} aria-label="Se congèle" />}{r.custom && <span className="chip h-5 text-[10px]">perso</span>}</div>
              </div>
            </Link>
          );
        })}
      </div>
      {list.length === 0 && <Empty title="Aucune recette" />}
      <Sheet open={creating} onClose={() => setCreating(false)} title="Nouvelle recette">
        {creating && <RecipeEditor onDone={() => setCreating(false)} />}
      </Sheet>
    </div>
  );
}

export function RecipeDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const todayKey = useToday();
  const { byId: recipes } = useRecipes();
  const { byId: foods } = useFoods();
  const [scale, setScale] = useState<number | null>(null);
  const [logMeal, setLogMeal] = useState<Meal | null>(null);
  const [editing, setEditing] = useState(false);
  const r = id ? recipes[id] : undefined;
  if (!r) return <div><PageHeader title="Recette" back /><Empty title="Recette introuvable" /></div>;
  const lookup = (fid: string) => foods[fid];
  const servings = scale ?? r.servings;
  const factor = servings / r.servings;
  const nut = recipeNutrition(r, lookup);
  const allergens = recipeAllergens(r, lookup);
  const one = nutritionForServings(r, 1, lookup);
  return (
    <div className="space-y-4 fade-in">
      <PageHeader title={r.name} back action={r.custom ? <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}><Pencil size={15} />Modifier</button> : undefined} />
      <div className="card flex items-center gap-4">
        <span className="text-6xl" aria-hidden>{r.emoji}</span>
        <div className="grid grid-cols-3 gap-3 flex-1 text-center">
          <div><div className="text-[11px] text-muted">Préparation</div><div className="font-bold">{r.prepMin} min</div></div>
          <div><div className="text-[11px] text-muted">Cuisson</div><div className="font-bold">{r.cookMin} min</div></div>
          <div><div className="text-[11px] text-muted">Portions</div><div className="font-bold">{r.servings}</div></div>
        </div>
      </div>

      <Card title="Par portion">
        <div className="grid grid-cols-5 gap-1 text-center tabular">
          {[['kcal', fmt0(one.kcal)], ['Prot.', `${fmt1(one.protein)} g`], ['Gluc.', `${fmt1(one.carbs)} g`], ['Lip.', `${fmt1(one.fat)} g`], ['Fibres', one.fiber == null ? '—' : `${fmt1(one.fiber)} g`]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-surface2 py-2"><div className="font-bold text-[14px]">{v}</div><div className="text-[10px] text-muted">{l}</div></div>
          ))}
        </div>
        <p className="text-[12px] text-muted mt-2">Calculé à partir des ingrédients et quantités ci-dessous{nut.unverified ? ' (valeurs moyennes de la base locale, à vérifier)' : ''}. Recette entière : {fmt0(nut.total.kcal)} kcal.</p>
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="text-[13px] text-muted self-center">Ajouter à mon journal :</span>
          {MEAL_ORDER.filter((m) => r.meals.includes(m) || m === 'snack').map((m) => <button key={m} className="chip" onClick={() => setLogMeal(m)}>{MEAL_LABELS[m]}</button>)}
        </div>
      </Card>

      <Card title="Ingrédients" action={
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-lg bg-surface2 font-bold" onClick={() => setScale(Math.max(1, servings - 1))} aria-label="Moins de portions">−</button>
          <span className="tabular text-[14px] w-20 text-center">{servings} portion{servings > 1 ? 's' : ''}</span>
          <button className="w-8 h-8 rounded-lg bg-surface2 font-bold" onClick={() => setScale(Math.min(20, servings + 1))} aria-label="Plus de portions">+</button>
        </div>
      }>
        <ul className="divide-y divide-line/50">
          {r.ingredients.map((i, k) => {
            const f = foods[i.foodId];
            const g = i.grams * factor;
            const label = factor === 1 && i.display ? i.display : f?.name ?? i.foodId;
            return (
              <li key={k} className="flex justify-between py-1.5 text-[14px] gap-2">
                <span>{label}{f && hasCookStates(f) ? <span className="text-muted"> ({(i.state ?? 'raw') === 'raw' ? 'poids cru' : 'poids cuit'})</span> : ''}</span>
                <span className="tabular font-semibold whitespace-nowrap">{fmt0(g)} {f?.liquid ? 'ml' : 'g'}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Préparation">
        <ol className="space-y-2 list-decimal pl-5 text-[14px] leading-relaxed">{r.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
        {r.tips && <p className="text-[13px] text-muted mt-2">{r.tips}</p>}
      </Card>

      <Card title="Conservation">
        <p className="text-[14px]">{r.storage}</p>
        <p className="text-[14px] mt-1"><Snowflake size={14} className="inline mr-1" />{r.freezable ? `Se congèle${r.freezeNote ? ` : ${r.freezeNote}` : '.'}` : 'Congélation déconseillée.'}</p>
      </Card>
      <Card title="Allergènes">
        <p className="text-[14px]">{allergens.length ? allergens.join(', ') : 'Aucun des allergènes majeurs recensés dans la base pour ces ingrédients.'}</p>
        <p className="text-[12px] text-muted mt-1">Déduits des ingrédients génériques : vérifie toujours l’étiquette des produits achetés (traces, recettes industrielles).</p>
      </Card>
      {r.custom && (
        <button className="btn-danger w-full" onClick={async () => { await remove('recipes', r.id); toast('Recette supprimée', { undo: () => put('recipes', r) }); nav('/recettes'); }}><Trash2 size={16} />Supprimer la recette</button>
      )}

      <Sheet open={logMeal != null} onClose={() => setLogMeal(null)} title={`Ajouter au ${logMeal ? MEAL_LABELS[logMeal].toLowerCase() : ''}`}>
        {logMeal && <RecipeServingsPicker recipe={r} date={todayKey} meal={logMeal} onDone={() => setLogMeal(null)} />}
      </Sheet>
      <Sheet open={editing} onClose={() => setEditing(false)} title="Modifier la recette">
        {editing && <RecipeEditor initial={r} onDone={() => setEditing(false)} />}
      </Sheet>
    </div>
  );
}

function RecipeEditor({ initial, onDone }: { initial?: Recipe; onDone: () => void }) {
  const { foods, byId } = useFoods();
  const nav = useNavigate();
  const [name, setName] = useState(initial?.name ?? '');
  const [servings, setServings] = useState(String(initial?.servings ?? 2));
  const [prep, setPrep] = useState(String(initial?.prepMin ?? 10));
  const [cook, setCook] = useState(String(initial?.cookMin ?? 20));
  const [ings, setIngs] = useState<RecipeIngredient[]>(initial?.ingredients ?? []);
  const [steps, setSteps] = useState((initial?.steps ?? []).join('\n'));
  const [meals, setMeals] = useState<Meal[]>(initial?.meals ?? ['lunch', 'dinner']);
  const [q, setQ] = useState('');
  const results = q.trim() ? searchFoods(foods, q).slice(0, 6) : [];
  const sv = parseNum(servings) ?? 0;
  const draft: Recipe = useMemo(() => ({
    id: initial?.id ?? `perso-${uid()}`, name: name.trim(), emoji: initial?.emoji ?? '🍽️', prepMin: parseNum(prep) ?? 0, cookMin: parseNum(cook) ?? 0,
    servings: sv > 0 ? Math.round(sv) : 1, meals, transportable: true, ingredients: ings, steps: steps.split('\n').map((s) => s.trim()).filter(Boolean),
    storage: initial?.storage ?? '3 jours au réfrigérateur (à adapter).', freezable: initial?.freezable ?? false, custom: true,
  }), [initial, name, prep, cook, sv, meals, ings, steps]);
  const per = ings.length ? recipeNutrition(draft, (id) => byId[id]).perServing : null;
  const valid = draft.name && ings.length > 0 && sv >= 1 && ings.every((i) => i.grams > 0);
  return (
    <div className="space-y-3">
      <Field label="Nom"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Portions"><input className="input tabular" inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} /></Field>
        <Field label="Prépa (min)"><input className="input tabular" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} /></Field>
        <Field label="Cuisson (min)"><input className="input tabular" inputMode="numeric" value={cook} onChange={(e) => setCook(e.target.value)} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">{MEAL_ORDER.map((m) => <button key={m} type="button" className={`chip ${meals.includes(m) ? 'chip-active' : ''}`} onClick={() => setMeals((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m]))}>{MEAL_LABELS[m]}</button>)}</div>
      <div>
        <span className="label">Ingrédients (quantité pour toute la recette)</span>
        <ul className="space-y-2">
          {ings.map((i, k) => {
            const f = byId[i.foodId];
            return (
              <li key={k} className="flex items-center gap-2">
                <span className="flex-1 text-[14px] truncate">{f?.name ?? i.foodId}</span>
                <input className="input w-20 h-9 tabular" inputMode="decimal" value={String(i.grams).replace('.', ',')} onChange={(e) => setIngs((l) => l.map((x, j) => (j === k ? { ...x, grams: parseNum(e.target.value) ?? 0 } : x)))} aria-label={`Quantité de ${f?.name}`} />
                {f && hasCookStates(f) ? (
                  <select className="input w-20 h-9 px-1 text-[13px]" value={i.state ?? 'raw'} onChange={(e) => setIngs((l) => l.map((x, j) => (j === k ? { ...x, state: e.target.value as 'raw' | 'cooked' } : x)))} aria-label="État"><option value="raw">cru</option><option value="cooked">cuit</option></select>
                ) : <span className="w-20 text-[13px] text-muted">{f?.liquid ? 'ml' : 'g'}</span>}
                <button className="p-1.5 text-muted" onClick={() => setIngs((l) => l.filter((_, j) => j !== k))} aria-label="Retirer"><Trash2 size={15} /></button>
              </li>
            );
          })}
        </ul>
        <input className="input mt-2" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="+ Ajouter un ingrédient (rechercher)" aria-label="Ajouter un ingrédient" />
        {results.length > 0 && (
          <ul className="mt-1 rounded-xl border border-line/70 divide-y divide-line/50">
            {results.map((f) => <li key={f.id}><button className="w-full text-left px-3 py-2 text-[14px]" onClick={() => { setIngs((l) => [...l, { foodId: f.id, grams: 100 }]); setQ(''); }}>{f.name}</button></li>)}
          </ul>
        )}
      </div>
      <Field label="Étapes (une par ligne)"><textarea className="input h-28 py-2" value={steps} onChange={(e) => setSteps(e.target.value)} /></Field>
      {per && <Notice>Par portion : <b className="tabular">{fmt0(per.kcal)} kcal</b> · {fmt0(per.protein)} g prot. · {fmt0(per.carbs)} g gluc. · {fmt0(per.fat)} g lip.</Notice>}
      <button className="btn-primary w-full" disabled={!valid} onClick={async () => { await put('recipes', draft); toast('Recette enregistrée'); onDone(); if (!initial) nav(`/recettes/${draft.id}`); }}>Enregistrer la recette</button>
    </div>
  );
}

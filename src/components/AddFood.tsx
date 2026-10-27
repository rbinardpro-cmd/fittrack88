import { Star, Search, Globe, Plus, ChevronLeft, Zap, ScanBarcode } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import type { Recipe } from '../data/recipes';
import { MEAL_LABELS } from '../data/mealPlan';
import { logFood, logRecipe, toggleFavorite } from '../db/actions';
import { getAll, put } from '../db/db';
import { FOODS } from '../data/foods';
import { useFoods, useRecipes, useStore } from '../db/hooks';
import { fmt0, fmt1, uid } from '../lib/format';
import { convertWeight, hasCookStates, nutrientsFor, searchFoods } from '../lib/nutrition';
import { barcodeVariants } from '../lib/barcode-utils';
import { fetchOffBarcode, lookupOffBarcode, searchOff } from '../lib/off';
import { nutritionForServings, recipeNutrition } from '../lib/recipes';
import type { CookState, DayKey, Food, Meal } from '../lib/types';
import { FoodForm } from './FoodForm';
import { Field, Loading, Notice, parseNum, Segmented, SourceBadge } from './ui';
import { toast } from './toast';

type Tab = 'search' | 'recipes' | 'online' | 'create' | 'quick';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

export function AddFood({ date, meal, onDone }: { date: DayKey; meal: Meal; onDone: () => void }) {
  const [tab, setTab] = useState<Tab>('search');
  const [picked, setPicked] = useState<Food | null>(null);
  const [pickedRecipe, setPickedRecipe] = useState<Recipe | null>(null);
  const [scanning, setScanning] = useState(false);

  if (scanning && !picked) return <ScanFlow onPick={(f) => { setScanning(false); setPicked(f); }} onBack={() => setScanning(false)} />;
  if (picked) return <QuantityPicker food={picked} date={date} meal={meal} onBack={() => setPicked(null)} onDone={onDone} />;
  if (pickedRecipe) return <RecipeServingsPicker recipe={pickedRecipe} date={date} meal={meal} onBack={() => setPickedRecipe(null)} onDone={onDone} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] text-muted">Ajout au {MEAL_LABELS[meal].toLowerCase()}</div>
        <button className="btn-secondary btn-sm" onClick={() => setScanning(true)}><ScanBarcode size={16} />Scanner</button>
      </div>
      <Segmented ariaLabel="Mode d’ajout" value={tab} onChange={setTab} options={[
        { value: 'search', label: 'Aliments' }, { value: 'recipes', label: 'Recettes' }, { value: 'online', label: 'En ligne' }, { value: 'create', label: 'Créer' }, { value: 'quick', label: 'Rapide' },
      ]} />
      {tab === 'search' && <LocalSearch onPick={setPicked} />}
      {tab === 'recipes' && <RecipeList onPick={setPickedRecipe} />}
      {tab === 'online' && <OnlineSearch onPick={setPicked} />}
      {tab === 'create' && <FoodForm onSaved={setPicked} />}
      {tab === 'quick' && <QuickAdd date={date} meal={meal} onDone={onDone} />}
    </div>
  );
}

function FoodRow({ food, onPick }: { food: Food; onPick: (f: Food) => void }) {
  return (
    <li className="flex items-center gap-1">
      <button className="flex-1 min-w-0 text-left py-2.5 px-1 rounded-lg hover:bg-surface2" onClick={() => onPick(food)}>
        <div className="font-medium text-[15px] truncate">{food.name}</div>
        <div className="text-[12px] text-muted tabular">
          {fmt0(food.per100.kcal)} kcal · P {fmt1(food.per100.protein)} · G {fmt1(food.per100.carbs)} · L {fmt1(food.per100.fat)} pour 100 {food.liquid ? 'ml' : 'g'}{hasCookStates(food) ? ' (cru)' : ''}
        </div>
      </button>
      <button className="p-2.5 rounded-lg" onClick={() => toggleFavorite(food)} aria-label={food.favorite ? `Retirer ${food.name} des favoris` : `Ajouter ${food.name} aux favoris`} aria-pressed={!!food.favorite}>
        <Star size={18} className={food.favorite ? 'fill-accent text-accent' : 'text-muted'} />
      </button>
    </li>
  );
}

function LocalSearch({ onPick }: { onPick: (f: Food) => void }) {
  const { foods } = useFoods();
  const prefs = useStore('foodPrefs');
  const [q, setQ] = useState('');
  const recent = useMemo(() => {
    const byId = new Map(foods.map((f) => [f.id, f]));
    return (prefs ?? []).filter((p) => p.lastUsed).sort((a, b) => b.lastUsed! - a.lastUsed!).slice(0, 8).map((p) => byId.get(p.id)).filter((f): f is Food => !!f);
  }, [foods, prefs]);
  const favorites = foods.filter((f) => f.favorite);
  const results = q.trim() ? searchFoods(foods, q).slice(0, 40) : [];
  return (
    <div>
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-10" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : riz, poulet, skyr…" autoFocus aria-label="Rechercher un aliment" />
      </div>
      {q.trim() ? (
        results.length ? <ul className="mt-2 divide-y divide-line/50">{results.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul> : <p className="text-sm text-muted mt-4 text-center">Aucun aliment trouvé dans la base locale. Essaie l’onglet « En ligne » ou crée-le.</p>
      ) : (
        <>
          {favorites.length > 0 && <><h3 className="section-title mt-4">Favoris</h3><ul className="divide-y divide-line/50">{favorites.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul></>}
          {recent.length > 0 && <><h3 className="section-title mt-4">Récents</h3><ul className="divide-y divide-line/50">{recent.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul></>}
          <h3 className="section-title mt-4">Toute la base ({foods.length})</h3>
          <ul className="divide-y divide-line/50">{[...foods].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul>
        </>
      )}
    </div>
  );
}

function RecipeList({ onPick }: { onPick: (r: Recipe) => void }) {
  const { recipes } = useRecipes();
  const { byId } = useFoods();
  return (
    <ul className="divide-y divide-line/50">
      {recipes.map((r) => {
        const n = recipeNutrition(r, (id) => byId[id]).perServing;
        return (
          <li key={r.id}>
            <button className="w-full text-left py-2.5 px-1 rounded-lg hover:bg-surface2 flex items-center gap-3" onClick={() => onPick(r)}>
              <span className="text-2xl" aria-hidden>{r.emoji}</span>
              <span className="min-w-0">
                <span className="block font-medium truncate">{r.name}</span>
                <span className="block text-[12px] text-muted tabular">{fmt0(n.kcal)} kcal · {fmt0(n.protein)} g protéines par portion</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function OnlineSearch({ onPick }: { onPick: (f: Food) => void }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState<{ loading: boolean; error?: string; foods?: Food[]; skipped?: number }>({ loading: false });
  async function run(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    setState({ loading: true });
    try {
      if (/^\d{8,14}$/.test(t)) {
        const f = await fetchOffBarcode(t);
        setState({ loading: false, foods: f ? [f] : [], skipped: 0 });
      } else {
        const r = await searchOff(t);
        setState({ loading: false, ...r });
      }
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : 'Erreur réseau : Open Food Facts est injoignable.' });
    }
  }
  async function pick(f: Food) {
    await put('foods', f); // conservé localement pour un usage hors ligne
    onPick(f);
  }
  return (
    <div className="space-y-3">
      <form onSubmit={run} className="flex gap-2">
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom du produit ou code-barres" aria-label="Recherche Open Food Facts" />
        <button className="btn-primary" disabled={state.loading}><Globe size={18} /></button>
      </form>
      <p className="text-[12px] text-muted">Recherche dans Open Food Facts, base gratuite et collaborative : les valeurs sont celles des étiquettes saisies par des contributeurs. Seul ton texte de recherche est envoyé.</p>
      {state.loading && <p className="text-sm text-muted">Recherche…</p>}
      {state.error && <Notice tone="warn">{state.error}</Notice>}
      {state.foods && (state.foods.length ? (
        <ul className="divide-y divide-line/50">{state.foods.map((f) => <FoodRow key={f.id} food={f} onPick={pick} />)}</ul>
      ) : <p className="text-sm text-muted">Aucun produit avec des valeurs nutritionnelles complètes.</p>)}
      {!!state.skipped && <p className="text-[12px] text-muted">{state.skipped} produit(s) écarté(s) car leurs valeurs nutritionnelles sont incomplètes.</p>}
    </div>
  );
}

type ScanState =
  | { step: 'scan' }
  | { step: 'loading'; code: string }
  | { step: 'missing'; code: string; message: string; name?: string }
  | { step: 'create'; code: string; name?: string };

/** Scan → aliment déjà connu sur l'appareil, sinon Open Food Facts, sinon création depuis l'étiquette. */
function ScanFlow({ onPick, onBack }: { onPick: (f: Food) => void; onBack: () => void }) {
  const [s, setS] = useState<ScanState>({ step: 'scan' });

  async function handle(code: string) {
    const variants = barcodeVariants(code);
    const local = [...FOODS, ...(await getAll('foods'))].find((f) => f.barcode && variants.includes(f.barcode));
    if (local) { onPick(local); return; }
    setS({ step: 'loading', code });
    try {
      const r = await lookupOffBarcode(code);
      if (r.status === 'found') {
        await put('foods', r.food); // conservé pour les prochains scans, même hors ligne
        onPick(r.food);
      } else if (r.status === 'incomplete') {
        setS({ step: 'missing', code, name: r.name, message: `« ${r.name || 'Produit'} » est dans Open Food Facts mais ses valeurs nutritionnelles sont incomplètes. Saisis-les depuis l’étiquette.` });
      } else {
        setS({ step: 'missing', code, message: 'Ce produit n’est pas (encore) dans Open Food Facts. Tu peux le créer depuis l’étiquette : il sera reconnu au prochain scan.' });
      }
    } catch (err) {
      setS({ step: 'missing', code, message: err instanceof Error ? err.message : 'Open Food Facts est injoignable.' });
    }
  }

  return (
    <div className="space-y-3">
      <button className="flex items-center gap-1 text-sm text-accent font-semibold" onClick={s.step === 'scan' ? onBack : () => setS({ step: 'scan' })}><ChevronLeft size={16} />Retour</button>
      {s.step === 'scan' && <Suspense fallback={<Loading />}><BarcodeScanner onResult={handle} /></Suspense>}
      {s.step === 'loading' && <p className="text-sm text-muted" role="status">Code {s.code} : recherche dans Open Food Facts…</p>}
      {s.step === 'missing' && (
        <>
          <div className="text-[13px] text-muted tabular">Code-barres {s.code}</div>
          <Notice tone="warn">{s.message}</Notice>
          <button className="btn-primary w-full" onClick={() => setS({ step: 'create', code: s.code, name: s.name })}><Plus size={18} />Créer l’aliment depuis l’étiquette</button>
          <button className="btn-secondary w-full" onClick={() => setS({ step: 'scan' })}><ScanBarcode size={18} />Scanner un autre produit</button>
        </>
      )}
      {s.step === 'create' && (
        <>
          <div className="text-[13px] text-muted tabular">Code-barres {s.code} (sera associé à l’aliment)</div>
          <FoodForm barcode={s.code} defaultName={s.name} onSaved={onPick} />
        </>
      )}
    </div>
  );
}

function QuantityPicker({ food, date, meal, onBack, onDone }: { food: Food; date: DayKey; meal: Meal; onBack: () => void; onDone: () => void }) {
  const cookable = hasCookStates(food);
  const [state, setState] = useState<CookState>(cookable && food.category !== 'feculent' && food.category !== 'legumineuse' ? 'cooked' : 'raw');
  const [qty, setQty] = useState(food.portion ? String(food.portion.grams) : '100');
  const grams = parseNum(qty) ?? 0;
  const valid = grams > 0 && grams <= 5000;
  const n = valid ? nutrientsFor(food, grams, state) : null;
  const unit = food.liquid ? 'ml' : 'g';
  return (
    <div className="space-y-3">
      <button className="flex items-center gap-1 text-sm text-accent font-semibold" onClick={onBack}><ChevronLeft size={16} />Retour</button>
      <div>
        <div className="font-bold text-lg">{food.name}</div>
        <div className="flex gap-2 items-center mt-1"><SourceBadge source={food.source} />{food.sourceNote && food.source !== 'manual' && <span className="text-[11px] text-muted">{food.sourceNote}</span>}</div>
      </div>
      {cookable && (
        <div>
          <span className="label">J’ai pesé l’aliment…</span>
          <Segmented ariaLabel="État de l’aliment pesé" value={state} onChange={setState} options={[{ value: 'raw', label: 'Cru / sec' }, { value: 'cooked', label: 'Cuit' }]} />
          {valid && <p className="text-[12px] text-muted mt-1.5">{fmt0(grams)} g {state === 'raw' ? 'cru' : 'cuit'} ≈ {fmt0(convertWeight(food, grams, state, state === 'raw' ? 'cooked' : 'raw'))} g {state === 'raw' ? 'cuit' : 'cru'} (rendement moyen ×{fmt1(food.cookedYield!)}, variable selon la cuisson).</p>}
        </div>
      )}
      <Field label={`Quantité (${unit})`}>
        <input className="input text-xl font-bold tabular" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus aria-invalid={!valid} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {food.portion && <button className="chip" onClick={() => setQty(String(food.portion!.grams))}>{food.portion.label}</button>}
        {food.portion && <button className="chip" onClick={() => setQty(String(food.portion!.grams * 2))}>× 2</button>}
        {[50, 100, 150, 200].map((g) => <button key={g} className="chip" onClick={() => setQty(String(g))}>{g} {unit}</button>)}
      </div>
      {n && (
        <div className="grid grid-cols-5 gap-1 text-center rounded-xl bg-surface2 p-2 tabular">
          <NV label="kcal" v={fmt0(n.kcal)} /><NV label="Prot." v={fmt1(n.protein)} /><NV label="Gluc." v={fmt1(n.carbs)} /><NV label="Lip." v={fmt1(n.fat)} /><NV label="Fibres" v={n.fiber == null ? '—' : fmt1(n.fiber)} />
        </div>
      )}
      <button
        className="btn-primary w-full"
        disabled={!valid}
        onClick={async () => {
          await logFood({ date, meal, food, grams, state });
          toast(`${food.name} ajouté`);
          onDone();
        }}
      >
        <Plus size={18} />Ajouter au journal
      </button>
    </div>
  );
}

function NV({ label, v }: { label: string; v: string }) {
  return <div><div className="font-bold text-[15px]">{v}</div><div className="text-[10px] text-muted">{label}</div></div>;
}

export function RecipeServingsPicker({ recipe, date, meal, onBack, onDone, planKey }: { recipe: Recipe; date: DayKey; meal: Meal; onBack?: () => void; onDone: () => void; planKey?: string }) {
  const { byId } = useFoods();
  const [servings, setServings] = useState('1');
  const s = parseNum(servings) ?? 0;
  const valid = s > 0 && s <= 10;
  const n = valid ? nutritionForServings(recipe, s, (id) => byId[id]) : null;
  return (
    <div className="space-y-3">
      {onBack && <button className="flex items-center gap-1 text-sm text-accent font-semibold" onClick={onBack}><ChevronLeft size={16} />Retour</button>}
      <div className="font-bold text-lg">{recipe.emoji} {recipe.name}</div>
      <div className="flex flex-wrap gap-2">
        {['0.5', '1', '1.5', '2'].map((v) => (
          <button key={v} className={`chip ${servings === v ? 'chip-active' : ''}`} onClick={() => setServings(v)}>{v.replace('.', ',')} portion{Number(v) > 1 ? 's' : ''}</button>
        ))}
      </div>
      <Field label="Portions (autre valeur)"><input className="input tabular" inputMode="decimal" value={servings.replace('.', ',')} onChange={(e) => setServings(e.target.value.replace(',', '.'))} /></Field>
      {n && (
        <div className="grid grid-cols-5 gap-1 text-center rounded-xl bg-surface2 p-2 tabular">
          <NV label="kcal" v={fmt0(n.kcal)} /><NV label="Prot." v={fmt1(n.protein)} /><NV label="Gluc." v={fmt1(n.carbs)} /><NV label="Lip." v={fmt1(n.fat)} /><NV label="Fibres" v={n.fiber == null ? '—' : fmt1(n.fiber)} />
        </div>
      )}
      <button className="btn-primary w-full" disabled={!valid} onClick={async () => {
        await logRecipe({ date, meal, recipe, servings: s, lookup: (id) => byId[id], planKey });
        toast('Recette ajoutée au journal');
        onDone();
      }}>
        <Plus size={18} />Ajouter à mon journal
      </button>
    </div>
  );
}

function QuickAdd({ date, meal, onDone }: { date: DayKey; meal: Meal; onDone: () => void }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const k = parseNum(kcal);
  const valid = k != null && k >= 0 && k <= 5000;
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!valid) return;
      await put('logs', { id: uid(), date, meal, name: name.trim() || 'Ajout rapide', kind: 'quick', nutrients: { kcal: k!, protein: parseNum(p) ?? 0, carbs: parseNum(c) ?? 0, fat: parseNum(f) ?? 0, fiber: null }, source: 'manual', createdAt: Date.now() });
      toast('Ajouté');
      onDone();
    }}>
      <p className="text-[13px] text-muted flex items-center gap-1"><Zap size={14} />Pour un repas au restaurant ou un plat dont tu connais seulement les calories (estimation à ta charge).</p>
      <Field label="Nom"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Sandwich poulet (boulangerie)" /></Field>
      <Field label="Calories (kcal)"><input className="input tabular" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Prot. (g)"><input className="input tabular" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></Field>
        <Field label="Gluc. (g)"><input className="input tabular" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} /></Field>
        <Field label="Lip. (g)"><input className="input tabular" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} /></Field>
      </div>
      <button className="btn-primary w-full" disabled={!valid}>Ajouter</button>
    </form>
  );
}

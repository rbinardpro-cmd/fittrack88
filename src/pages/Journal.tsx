import { ChevronLeft, ChevronRight, Plus, Copy, Trash2, Droplets, History, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MEAL_LABELS, MEAL_ORDER } from '../data/mealPlan';
import { addWater, deleteLog, duplicateMeal, updateLogQuantity } from '../db/actions';
import { put, remove } from '../db/db';
import { useFoods, useProfile, useRecipes, useStore, useTargets, useToday } from '../db/hooks';
import { addDays, isDayKey, relativeDay } from '../lib/dates';
import { sumNutrients } from '../lib/energy';
import { fmt0, fmt1 } from '../lib/format';
import { kcalMessage } from '../lib/summary';
import type { CookState, LogEntry, Meal } from '../lib/types';
import { AddFood } from '../components/AddFood';
import { Card, Field, Loading, parseNum, ProgressBar, Segmented, Sheet, SourceBadge } from '../components/ui';
import { toast } from '../components/toast';
import { hasCookStates } from '../lib/nutrition';

export default function Journal() {
  const todayKey = useToday();
  const [params, setParams] = useSearchParams();
  const date = isDayKey(params.get('d')) ? params.get('d')! : todayKey;
  const setDate = (d: string) => setParams(d === todayKey ? {} : { d }, { replace: true });
  const logs = useStore('logs');
  const water = useStore('water');
  const [profile] = useProfile();
  const { targets } = useTargets();
  const [addMeal, setAddMeal] = useState<Meal | null>(null);
  const [edit, setEdit] = useState<LogEntry | null>(null);
  const [copyMeal, setCopyMeal] = useState<Meal | null>(null);
  const [waterOpen, setWaterOpen] = useState(false);

  const day = useMemo(() => (logs ?? []).filter((l) => l.date === date).sort((a, b) => a.createdAt - b.createdAt), [logs, date]);
  const total = sumNutrients(day.map((l) => l.nutrients));
  const waterDay = (water ?? []).filter((w) => w.date === date).sort((a, b) => b.createdAt - a.createdAt);
  const waterMl = waterDay.reduce((s, w) => s + w.ml, 0);

  if (!logs || !targets || !profile || !water) return <Loading />;

  return (
    <div className="space-y-4 fade-in">
      <header className="flex items-center justify-between pt-4">
        <button className="p-2 rounded-full bg-surface2" onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent"><ChevronLeft size={20} /></button>
        <div className="text-center">
          <h1 className="text-xl font-bold capitalize">{relativeDay(date, todayKey)}</h1>
          <input type="date" className="text-[13px] text-muted bg-transparent text-center" value={date} max={todayKey} onChange={(e) => isDayKey(e.target.value) && setDate(e.target.value)} aria-label="Choisir la date" />
        </div>
        <button className="p-2 rounded-full bg-surface2 disabled:opacity-30" onClick={() => setDate(addDays(date, 1))} disabled={date >= todayKey} aria-label="Jour suivant"><ChevronRight size={20} /></button>
      </header>

      <Card>
        <div className="flex items-end justify-between">
          <div className="tabular"><span className="text-[28px] font-bold">{fmt0(total.kcal)}</span><span className="text-muted font-semibold"> / {fmt0(targets.kcal)} kcal</span></div>
          <div className="text-[12px] text-muted text-right max-w-[50%]">{kcalMessage(total.kcal, targets.kcal)}</div>
        </div>
        <div className="mt-2"><ProgressBar value={total.kcal} max={targets.kcal} tone={total.kcal <= targets.kcal ? 'accent' : 'warn'} label="Calories" /></div>
        <div className="grid grid-cols-4 gap-2 mt-3 text-center tabular">
          {[['Protéines', total.protein, targets.protein], ['Glucides', total.carbs, targets.carbs], ['Lipides', total.fat, targets.fat], ['Fibres', total.fiber ?? 0, targets.fiber]].map(([l, v, t]) => (
            <div key={l as string}><div className="text-[11px] text-muted">{l}</div><div className="font-bold text-[15px]">{fmt0(v as number)}<span className="text-muted text-[11px] font-medium">/{fmt0(t as number)} g</span></div></div>
          ))}
        </div>
      </Card>

      {MEAL_ORDER.map((meal) => {
        const items = day.filter((l) => l.meal === meal);
        const sub = sumNutrients(items.map((i) => i.nutrients));
        return (
          <Card key={meal} title={<span>{MEAL_LABELS[meal]} <span className="text-muted font-medium tabular text-[13px]">· {fmt0(sub.kcal)} kcal</span></span>}
            action={
              <div className="flex gap-1">
                {items.length > 0 && <button className="p-2 rounded-lg bg-surface2" onClick={() => setCopyMeal(meal)} aria-label={`Dupliquer le ${MEAL_LABELS[meal].toLowerCase()}`}><Copy size={16} /></button>}
                <button className="p-2 rounded-lg bg-accent text-white" onClick={() => setAddMeal(meal)} aria-label={`Ajouter au ${MEAL_LABELS[meal].toLowerCase()}`}><Plus size={16} /></button>
              </div>
            }>
            {items.length === 0 ? (
              <ReusePrevious meal={meal} date={date} />
            ) : (
              <ul className="divide-y divide-line/50 -my-1">
                {items.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 py-2">
                    <button className="flex-1 min-w-0 text-left" onClick={() => setEdit(l)}>
                      <div className="text-[14px] font-medium truncate">{l.name}</div>
                      <div className="text-[12px] text-muted tabular">
                        {l.kind === 'recipe' ? `${fmt1(l.servings ?? 1)} portion(s)` : l.grams ? `${fmt0(l.grams)} g${l.state ? (l.state === 'raw' ? ' cru' : ' cuit') : ''}` : 'ajout rapide'} · P {fmt0(l.nutrients.protein)} · G {fmt0(l.nutrients.carbs)} · L {fmt0(l.nutrients.fat)}
                      </div>
                    </button>
                    <div className="tabular font-semibold text-[14px]">{fmt0(l.nutrients.kcal)}</div>
                    <button className="p-2 text-muted" aria-label={`Supprimer ${l.name}`} onClick={async () => {
                      const undo = await deleteLog(l);
                      toast('Supprimé', { undo });
                    }}><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      <Card title="Hydratation" action={<button className="text-sm text-accent font-semibold" onClick={() => setWaterOpen(true)}>Historique</button>}>
        <div className="flex items-center gap-3">
          <Droplets className="text-info" size={22} />
          <div className="flex-1">
            <div className="flex justify-between text-[14px]"><b className="tabular">{fmt1(waterMl / 1000)} L</b><span className="text-muted tabular">objectif {fmt1(profile.waterGoalMl / 1000)} L</span></div>
            <div className="mt-1"><ProgressBar value={waterMl} max={profile.waterGoalMl} tone="info" label="Eau" /></div>
          </div>
        </div>
        <WaterButtons date={date} />
        <p className="text-[12px] text-muted mt-2">Objectif indicatif et modifiable dans le profil : les besoins varient avec la chaleur, l’activité et l’alimentation. Ce n’est pas une prescription médicale. Le compteur repart de zéro chaque jour.</p>
      </Card>

      <Sheet open={addMeal != null} onClose={() => setAddMeal(null)} title="Ajouter un aliment">
        {addMeal && <AddFood date={date} meal={addMeal} onDone={() => setAddMeal(null)} />}
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Modifier">
        {edit && <EditEntry entry={edit} onDone={() => setEdit(null)} />}
      </Sheet>
      <Sheet open={copyMeal != null} onClose={() => setCopyMeal(null)} title="Dupliquer le repas">
        {copyMeal && <CopyMeal entries={day.filter((l) => l.meal === copyMeal)} from={copyMeal} date={date} onDone={() => setCopyMeal(null)} />}
      </Sheet>
      <Sheet open={waterOpen} onClose={() => setWaterOpen(false)} title="Eau du jour">
        {waterDay.length === 0 ? <p className="text-muted text-sm">Rien de noté.</p> : (
          <ul className="divide-y divide-line/50">
            {waterDay.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2 tabular">
                <span>{new Date(w.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="font-semibold">{fmt0(w.ml)} ml</span>
                <button className="p-2 text-muted" aria-label="Supprimer" onClick={async () => { await remove('water', w.id); toast('Supprimé', { undo: () => put('water', w) }); }}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

function WaterButtons({ date }: { date: string }) {
  const [custom, setCustom] = useState('');
  const ml = parseNum(custom);
  return (
    <div className="flex gap-2 mt-3">
      <button className="btn-secondary flex-1" onClick={async () => { await addWater(date, 250); toast('+250 ml'); }}>+250 ml</button>
      <button className="btn-secondary flex-1" onClick={async () => { await addWater(date, 500); toast('+500 ml'); }}>+500 ml</button>
      <form className="flex gap-1 flex-1" onSubmit={async (e) => { e.preventDefault(); if (ml && ml > 0 && ml <= 3000) { await addWater(date, ml); setCustom(''); toast(`+${fmt0(ml)} ml`); } }}>
        <input className="input w-full min-w-0 tabular" inputMode="numeric" placeholder="ml" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Quantité d’eau personnalisée en ml" />
        <button className="btn-secondary px-3" disabled={!ml || ml <= 0 || ml > 3000} aria-label="Ajouter la quantité personnalisée"><Plus size={16} /></button>
      </form>
    </div>
  );
}

/** Repas vide : propose de reprendre le même repas d'un jour précédent. */
function ReusePrevious({ meal, date }: { meal: Meal; date: string }) {
  const logs = useStore('logs');
  const prev = useMemo(() => {
    const before = (logs ?? []).filter((l) => l.meal === meal && l.date < date);
    if (!before.length) return null;
    const last = before.reduce((a, b) => (a.date > b.date ? a : b)).date;
    return { date: last, items: before.filter((l) => l.date === last) };
  }, [logs, meal, date]);
  if (!prev) return <p className="text-[13px] text-muted">Rien de noté.</p>;
  return (
    <button className="flex items-center gap-2 text-[13px] text-accent font-semibold" onClick={async () => {
      await duplicateMeal(prev.items, { date, meal });
      toast('Repas repris');
    }}>
      <History size={16} />Reprendre le repas du {relativeDay(prev.date)} ({fmt0(sumNutrients(prev.items.map((i) => i.nutrients)).kcal)} kcal)
    </button>
  );
}

function CopyMeal({ entries, from, date, onDone }: { entries: LogEntry[]; from: Meal; date: string; onDone: () => void }) {
  const todayKey = useToday();
  const [to, setTo] = useState(date === todayKey ? addDays(date, 1) : todayKey);
  const [meal, setMeal] = useState<Meal>(from);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{entries.length} élément(s) du {MEAL_LABELS[from].toLowerCase()}.</p>
      <Field label="Vers le jour"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      <Field label="Repas">
        <select className="input" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>{MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABELS[m]}</option>)}</select>
      </Field>
      <button className="btn-primary w-full" disabled={!isDayKey(to)} onClick={async () => { await duplicateMeal(entries, { date: to, meal }); toast('Repas dupliqué'); onDone(); }}><Copy size={16} />Dupliquer</button>
    </div>
  );
}

function EditEntry({ entry, onDone }: { entry: LogEntry; onDone: () => void }) {
  const { byId } = useFoods();
  const { byId: recipes } = useRecipes();
  const food = entry.foodId ? byId[entry.foodId] : undefined;
  const recipe = entry.recipeId ? recipes[entry.recipeId] : undefined;
  const [qty, setQty] = useState(String(entry.kind === 'recipe' ? entry.servings ?? 1 : entry.grams ?? '').replace('.', ','));
  const [state, setState] = useState<CookState>(entry.state ?? 'raw');
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const v = parseNum(qty);
  if (entry.kind === 'quick') {
    return (
      <div className="space-y-3">
        <p className="text-sm">{entry.name} · {fmt0(entry.nutrients.kcal)} kcal</p>
        <p className="text-[13px] text-muted">Un ajout rapide ne se recalcule pas : supprime-le et recrée-le pour le modifier.</p>
      </div>
    );
  }
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!v || v <= 0) return;
      await updateLogQuantity(entry, entry.kind === 'recipe' ? { servings: v } : { grams: v, state }, { food, recipe, lookup: (id) => byId[id] });
      if (meal !== entry.meal) {
        const { getOne } = await import('../db/db');
        const cur = await getOne('logs', entry.id);
        if (cur) await put('logs', { ...cur, meal });
      }
      toast('Modifié');
      onDone();
    }}>
      <div className="font-semibold">{entry.name}</div>
      <SourceBadge source={entry.source} />
      {food && hasCookStates(food) && entry.kind === 'food' && (
        <Segmented ariaLabel="État" value={state} onChange={setState} options={[{ value: 'raw', label: 'Cru / sec' }, { value: 'cooked', label: 'Cuit' }]} />
      )}
      <Field label={entry.kind === 'recipe' ? 'Portions' : 'Quantité (g)'}><input className="input tabular" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      <Field label="Repas"><select className="input" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>{MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABELS[m]}</option>)}</select></Field>
      <button className="btn-primary w-full" disabled={!v || v <= 0}><Pencil size={16} />Enregistrer</button>
    </form>
  );
}

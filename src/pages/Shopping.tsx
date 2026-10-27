import { RefreshCw, Plus, Share2, Trash2, Star, Archive, Pencil, Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MEAL_PLAN } from '../data/mealPlan';
import { put, putMany, remove, removeMany } from '../db/db';
import { useFoods, useProfile, useRecipes, useStore, useToday } from '../db/hooks';
import { addDays, diffDays, formatDay } from '../lib/dates';
import { uid } from '../lib/format';
import { computeNeeds, estimateBudget, formatQty, mergeShopping, SHOPPING_CATEGORIES, shoppingToText } from '../lib/shopping';
import type { ShoppingCategory, ShoppingItem } from '../lib/types';
import { Card, Empty, Field, Loading, Notice, PageHeader, parseNum, Segmented, Sheet } from '../components/ui';
import { toast } from '../components/toast';

type Period = 'w1' | 'w2' | 'all';
const PERIOD_KEY = 'ft88-shopping-period';

function readPref<T extends string>(k: string, d: T): T {
  try { return (localStorage.getItem(k) as T) || d; } catch { return d; }
}

export default function ShoppingPage() {
  const todayKey = useToday();
  const [profile, updateProfile] = useProfile();
  const items = useStore('shopping');
  const planStates = useStore('planStates');
  const { byId: recipes } = useRecipes();
  const { byId: foods } = useFoods();
  const [period, setPeriodState] = useState<Period>(readPref(PERIOD_KEY, 'all'));
  const [snacks, setSnacks] = useState(true);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [hidePantry, setHidePantry] = useState(false);
  const setPeriod = (p: Period) => { setPeriodState(p); try { localStorage.setItem(PERIOD_KEY, p); } catch { /* préférence non conservée */ } };

  const cycleStart = useMemo(() => {
    if (!profile) return null;
    const d = diffDays(profile.mealPlanStart, todayKey);
    return d < 0 ? profile.mealPlanStart : addDays(profile.mealPlanStart, Math.floor(d / 14) * 14);
  }, [profile, todayKey]);

  async function regenerate(silent = false) {
    if (!profile || !cycleStart || !items || !planStates) return;
    const range = period === 'w1' ? [0, 7] : period === 'w2' ? [7, 14] : [0, 14];
    const days = MEAL_PLAN.slice(range[0], range[1]);
    const skipped = new Set(planStates.filter((p) => p.status === 'skipped').map((p) => `${diffDays(addDays(cycleStart, range[0]), p.date)}|${p.meal}`));
    const needs = computeNeeds(days, recipes, (id) => foods[id], { people: profile.people, includeOptional: snacks, skipped });
    const merged = mergeShopping(needs, items, uid);
    const keep = new Set(merged.map((m) => m.id));
    await removeMany('shopping', items.filter((i) => !keep.has(i.id)).map((i) => i.id));
    await putMany('shopping', merged);
    if (!silent) toast('Liste recalculée depuis le programme');
  }

  // première ouverture : génère la liste automatiquement
  useEffect(() => {
    if (items && items.length === 0 && profile && planStates) regenerate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items?.length === 0, profile?.id, planStates?.length]);

  if (!items || !profile || !cycleStart) return <Loading />;
  const visible = items.filter((i) => !(hidePantry && i.inPantry));
  const budget = estimateBudget(items);
  const remaining = items.filter((i) => !i.checked && !i.inPantry).length;
  const label = period === 'w1' ? `semaine 1 (dès le ${formatDay(cycleStart)})` : period === 'w2' ? `semaine 2 (dès le ${formatDay(addDays(cycleStart, 7))})` : `14 jours (dès le ${formatDay(cycleStart)})`;
  const text = shoppingToText(items, `Courses FITTRACK 88 — ${label}`);

  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Courses" back subtitle={`${remaining} article(s) à acheter · ${label}`} action={<button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={16} />Article</button>} />
      <Card>
        <div className="space-y-3">
          <Segmented ariaLabel="Période" value={period} onChange={setPeriod} options={[{ value: 'w1', label: 'Semaine 1' }, { value: 'w2', label: 'Semaine 2' }, { value: 'all', label: '14 jours' }]} />
          <div className="flex items-center gap-4 flex-wrap text-[14px]">
            <label className="flex items-center gap-2">Personnes
              <select className="input h-9 w-16" value={profile.people} onChange={(e) => updateProfile({ people: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select>
            </label>
            <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[rgb(var(--accent))]" checked={snacks} onChange={(e) => setSnacks(e.target.checked)} />Inclure les collations</label>
          </div>
          <button className="btn-secondary w-full" onClick={() => regenerate()}><RefreshCw size={16} />Recalculer depuis le programme</button>
          <p className="text-[12px] text-muted">Quantités = ingrédients des recettes × portions prévues × personnes, arrondies à 10 g. Les repas marqués « ignoré » sont retirés. Cases cochées, placard, prix et quantités modifiées sont conservés.</p>
        </div>
      </Card>

      {items.length === 0 ? <Empty title="Liste vide" text="Recalcule depuis le programme ou ajoute un article." /> : (
        SHOPPING_CATEGORIES.map((cat) => {
          const list = visible.filter((i) => i.category === cat).sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'fr'));
          if (!list.length) return null;
          return (
            <section key={cat}>
              <h2 className="section-title">{cat}</h2>
              <ul className="card p-0 divide-y divide-line/50">
                {list.map((i) => (
                  <li key={i.id} className={`flex items-center gap-2 px-3 py-2 ${i.inPantry ? 'opacity-50' : ''}`}>
                    <input type="checkbox" className="w-6 h-6 shrink-0 accent-[rgb(var(--accent))]" checked={i.checked} onChange={() => put('shopping', { ...i, checked: !i.checked })} aria-label={`${i.name} acheté`} />
                    <button className="flex-1 min-w-0 text-left" onClick={() => setEditing(i)}>
                      <div className={`text-[15px] ${i.checked ? 'line-through text-muted' : ''}`}>{i.name}</div>
                      <div className="text-[12px] text-muted tabular">
                        {formatQty(i.qty, i.unit)}{i.unit === 'pièce' ? ' pièce(s)' : ''}
                        {i.computedQty != null && i.qty !== i.computedQty ? ` (calculé : ${formatQty(i.computedQty, i.unit)})` : ''}
                        {i.inPantry ? ' · déjà au placard' : ''}{i.price != null ? ` · ${i.price.toFixed(2).replace('.', ',')} €/${i.unit === 'g' ? 'kg' : i.unit === 'ml' ? 'L' : 'pièce'}` : ''}
                      </div>
                    </button>
                    {i.habitual && <Star size={14} className="fill-accent text-accent" aria-label="Produit habituel" />}
                    <button className="p-2 text-muted" onClick={() => put('shopping', { ...i, inPantry: !i.inPantry })} aria-label={i.inPantry ? 'Retirer du placard' : 'Déjà au placard'} aria-pressed={i.inPantry}><Archive size={16} /></button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <Card title="Budget estimatif">
        {budget.priced === 0 ? (
          <p className="text-[14px] text-muted">Aucun prix renseigné. Touche un article pour indiquer le prix que tu paies (au kg, au litre ou à la pièce) : l’application n’affiche aucun prix qu’elle n’a pas de source fiable.</p>
        ) : (
          <p className="text-[14px]"><b className="tabular text-lg">{budget.total.toFixed(2).replace('.', ',')} €</b> pour {budget.priced} article(s) avec prix{budget.unpriced ? `, ${budget.unpriced} sans prix (non comptés)` : ''}. Hors produits déjà au placard. Basé uniquement sur tes prix.</p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title: 'Liste de courses', text });
            else { await navigator.clipboard.writeText(text); toast('Liste copiée'); }
          } catch (e) { if ((e as Error).name !== 'AbortError') toast('Partage impossible', { tone: 'error' }); }
        }}><Share2 size={16} />Partager</button>
        <button className="btn-secondary" onClick={() => {
          const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
          const a = document.createElement('a'); a.href = url; a.download = `courses-${todayKey}.txt`; a.click(); URL.revokeObjectURL(url);
        }}><Download size={16} />Fichier .txt</button>
        <button className="btn-ghost" onClick={() => setHidePantry((h) => !h)}>{hidePantry ? 'Afficher le placard' : 'Masquer le placard'}</button>
        <button className="btn-ghost" onClick={() => putMany('shopping', items.map((i) => ({ ...i, checked: false })))}>Tout décocher</button>
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Article">
        {editing && <ItemForm item={editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Ajouter un article">
        {adding && <ItemForm onDone={() => setAdding(false)} />}
      </Sheet>
      <Notice>Liste de départ indicative de ton cahier des charges (2 kg de poulet, 18 œufs…) : la liste ci-dessus la remplace par des quantités calculées sur les recettes réellement prévues. Ajoute les « fruits variés » et autres produits habituels avec l’étoile.</Notice>
    </div>
  );
}

function ItemForm({ item, onDone }: { item?: ShoppingItem; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [qty, setQty] = useState(item ? String(item.qty).replace('.', ',') : '1');
  const [unit, setUnit] = useState(item?.unit ?? 'pièce');
  const [cat, setCat] = useState<ShoppingCategory>(item?.category ?? 'Autres');
  const [price, setPrice] = useState(item?.price != null ? String(item.price).replace('.', ',') : '');
  const [habitual, setHabitual] = useState(item?.habitual ?? false);
  const q = parseNum(qty);
  const p = parseNum(price);
  const valid = name.trim() && q != null && q > 0 && (price === '' || (p != null && p >= 0));
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!valid) return;
      await put('shopping', { id: item?.id ?? uid(), name: name.trim(), qty: q!, unit, category: cat, checked: item?.checked ?? false, inPantry: item?.inPantry ?? false, manual: item?.manual ?? true, price: price === '' ? undefined : p!, priceUnit: unit, foodId: item?.foodId, computedQty: item?.computedQty, habitual });
      toast('Enregistré');
      onDone();
    }}>
      <Field label="Produit"><input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!!item && !item.manual} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Quantité"><input className="input tabular" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Unité">
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!!item && !item.manual}>{['g', 'ml', 'pièce', 'paquet', 'boîte', 'botte', 'filet'].map((u) => <option key={u}>{u}</option>)}</select>
        </Field>
      </div>
      {(!item || item.manual) && (
        <Field label="Rayon"><select className="input" value={cat} onChange={(e) => setCat(e.target.value as ShoppingCategory)}>{SHOPPING_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      )}
      <Field label={`Prix payé (€ par ${unit === 'g' ? 'kg' : unit === 'ml' ? 'litre' : unit})`} hint="Facultatif. Sert uniquement au budget estimatif.">
        <input className="input tabular" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="ex. 9,90" />
      </Field>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="w-5 h-5 accent-[rgb(var(--accent))]" checked={habitual} onChange={(e) => setHabitual(e.target.checked)} />Produit habituel (gardé à chaque nouvelle liste)</label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!valid}><Pencil size={16} />Enregistrer</button>
        {item && <button type="button" className="btn-danger" onClick={async () => { await remove('shopping', item.id); toast('Supprimé', { undo: () => put('shopping', item) }); onDone(); }} aria-label="Supprimer"><Trash2 size={16} /></button>}
      </div>
    </form>
  );
}

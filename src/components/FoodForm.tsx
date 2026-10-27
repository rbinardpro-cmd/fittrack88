import { useState } from 'react';
import { put } from '../db/db';
import { uid } from '../lib/format';
import { kcalFromMacros, validateFood } from '../lib/nutrition';
import type { Food, FoodCategory } from '../lib/types';
import { Field, Notice, parseNum } from './ui';
import { toast } from './toast';

/** Création / modification d'un aliment personnel, à partir de l'étiquette (valeurs pour 100 g). */
export function FoodForm({ initial, onSaved }: { initial?: Food; onSaved: (f: Food) => void }) {
  const s = (n?: number | null) => (n == null ? '' : String(n).replace('.', ','));
  const [name, setName] = useState(initial?.name ?? '');
  const [kcal, setKcal] = useState(s(initial?.per100.kcal));
  const [protein, setProtein] = useState(s(initial?.per100.protein));
  const [carbs, setCarbs] = useState(s(initial?.per100.carbs));
  const [fat, setFat] = useState(s(initial?.per100.fat));
  const [fiber, setFiber] = useState(s(initial?.per100.fiber));
  const [portionLabel, setPortionLabel] = useState(initial?.portion?.label ?? '');
  const [portionG, setPortionG] = useState(s(initial?.portion?.grams));
  const [hasYield, setHasYield] = useState(!!initial?.cookedYield);
  const [yieldV, setYieldV] = useState(s(initial?.cookedYield ?? 2.3));
  const [category, setCategory] = useState<FoodCategory>(initial?.category ?? 'autre');
  const [errors, setErrors] = useState<string[]>([]);

  const p = parseNum(protein) ?? 0;
  const c = parseNum(carbs) ?? 0;
  const f = parseNum(fat) ?? 0;
  const fi = parseNum(fiber);
  const suggested = kcalFromMacros(p, c, f, fi ?? 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const food: Food = {
      id: initial?.id ?? `perso-${uid()}`,
      name: name.trim(),
      category,
      per100: { kcal: parseNum(kcal) ?? suggested, protein: p, carbs: c, fat: f, fiber: fi },
      portion: portionLabel.trim() && (parseNum(portionG) ?? 0) > 0 ? { label: portionLabel.trim(), grams: parseNum(portionG)! } : undefined,
      cookedYield: hasYield && (parseNum(yieldV) ?? 0) > 0 ? parseNum(yieldV)! : undefined,
      source: initial?.source ?? 'manual',
      sourceNote: initial?.sourceNote ?? 'Aliment personnel (saisi depuis l’étiquette)',
      barcode: initial?.barcode,
      allergens: initial?.allergens,
      custom: true,
      favorite: initial?.favorite,
    };
    const errs = validateFood(food);
    if (hasYield && !(food.cookedYield! > 0.2 && food.cookedYield! < 5)) errs.push('Rendement de cuisson entre 0,2 et 5.');
    setErrors(errs);
    if (errs.length) return;
    await put('foods', food);
    toast(initial ? 'Aliment modifié' : 'Aliment créé');
    onSaved(food);
  }

  const num = (label: string, v: string, set: (s: string) => void, placeholder?: string) => (
    <Field label={label}><input className="input tabular" inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} placeholder={placeholder} /></Field>
  );

  return (
    <form className="space-y-3" onSubmit={save}>
      <Field label="Nom"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Yaourt grec 2 % (marque)" /></Field>
      <p className="text-[12px] text-muted">Valeurs pour 100 g, telles qu’indiquées sur l’étiquette.</p>
      <div className="grid grid-cols-2 gap-3">
        {num('Protéines (g)', protein, setProtein)}
        {num('Glucides (g)', carbs, setCarbs)}
        {num('Lipides (g)', fat, setFat)}
        {num('Fibres (g, facultatif)', fiber, setFiber)}
      </div>
      <Field label="Énergie (kcal)" hint={`Calcul d’après les macros : ≈ ${suggested} kcal. Laisse vide pour l’utiliser.`}>
        <input className="input tabular" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder={String(suggested)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Portion (facultatif)"><input className="input" value={portionLabel} onChange={(e) => setPortionLabel(e.target.value)} placeholder="1 pot" /></Field>
        {num('Poids de la portion (g)', portionG, setPortionG, '125')}
      </div>
      <Field label="Catégorie">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value as FoodCategory)}>
          {(['viande', 'poisson', 'oeuf', 'laitier', 'legume', 'fruit', 'feculent', 'legumineuse', 'matiere_grasse', 'oleagineux', 'epicerie', 'boisson', 'autre'] as FoodCategory[]).map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={hasYield} onChange={(e) => setHasYield(e.target.checked)} className="w-5 h-5 accent-[rgb(var(--accent))]" />
        Les valeurs sont pour l’aliment cru, et il change de poids à la cuisson
      </label>
      {hasYield && num('Rendement de cuisson (poids cuit ÷ poids cru)', yieldV, setYieldV, 'pâtes 2,3 · riz 2,6 · viande 0,75')}
      {errors.length > 0 && <Notice tone="warn"><ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Notice>}
      <button className="btn-primary w-full">{initial ? 'Enregistrer' : 'Créer l’aliment'}</button>
    </form>
  );
}

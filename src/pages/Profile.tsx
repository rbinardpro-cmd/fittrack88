import { useMemo, useState } from 'react';
import { useProfile, useStore, useTargets, useToday } from '../db/hooks';
import { addDays } from '../lib/dates';
import { ACTIVITY_FACTORS, DEFICIT_MAX, suggestAdjustment } from '../lib/energy';
import { fmt0 } from '../lib/format';
import type { ActivityLevel, Profile } from '../lib/types';
import { dailyWeights, linearRegression } from '../lib/weight';
import { Card, Field, Loading, Notice, PageHeader, parseNum, Segmented } from '../components/ui';
import { toast } from '../components/toast';

export default function ProfilePage() {
  const [profile, update] = useProfile();
  const { targets, currentWeight } = useTargets();
  if (!profile || !targets) return <Loading />;
  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Profil et objectifs" back />
      <ProfileForm key={profile.updatedAt} profile={profile} update={update} />
      <Card title="Mes besoins estimés">
        <dl className="grid grid-cols-2 gap-3 text-[14px]">
          <div><dt className="text-muted text-[12px]">Métabolisme de base (Mifflin-St Jeor)</dt><dd className="font-bold tabular text-lg">{fmt0(targets.bmr)} kcal</dd></div>
          <div><dt className="text-muted text-[12px]">Dépense journalière estimée</dt><dd className="font-bold tabular text-lg">{fmt0(targets.tdee)} kcal</dd></div>
          <div><dt className="text-muted text-[12px]">Déficit appliqué</dt><dd className="font-bold tabular text-lg">{fmt0(targets.deficit)} kcal</dd></div>
          <div><dt className="text-muted text-[12px]">Objectif calorique{targets.manual.kcal ? ' (manuel)' : ''}</dt><dd className="font-bold tabular text-lg text-accent">{fmt0(targets.kcal)} kcal</dd></div>
        </dl>
        <p className="text-[12px] text-muted mt-2">Calculé sur ton dernier poids connu ({currentWeight?.toString().replace('.', ',')} kg). Protéines : 1,8 g par kg de poids objectif ; lipides : 30 % des calories ; glucides : le reste. Ce sont des estimations de départ : elles sont affinées par l’observation de ta tendance réelle sur plusieurs semaines.</p>
        {targets.notes.map((n) => <div key={n} className="mt-2"><Notice tone="warn">{n}</Notice></div>)}
      </Card>
      <TargetsForm profile={profile} update={update} auto={targets} />
      <AdjustmentCard />
    </div>
  );
}

function ProfileForm({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => Promise<void> }) {
  const [f, setF] = useState({
    firstName: profile.firstName, age: String(profile.age), heightCm: String(profile.heightCm), startWeightKg: String(profile.startWeightKg).replace('.', ','),
    goalWeightKg: String(profile.goalWeightKg).replace('.', ','), startDate: profile.startDate,
  });
  const [sex, setSex] = useState(profile.sex);
  const [level, setLevel] = useState<ActivityLevel>(profile.activityLevel);
  const [deficit, setDeficit] = useState(profile.deficitKcal);
  const n = (k: keyof typeof f) => parseNum(f[k]);
  const errors: string[] = [];
  if (!(n('age')! >= 15 && n('age')! <= 100)) errors.push('Âge entre 15 et 100 ans.');
  if (!(n('heightCm')! >= 120 && n('heightCm')! <= 230)) errors.push('Taille entre 120 et 230 cm.');
  if (!(n('startWeightKg')! >= 30 && n('startWeightKg')! <= 350)) errors.push('Poids de départ invalide.');
  if (!(n('goalWeightKg')! >= 30 && n('goalWeightKg')! < n('startWeightKg')!)) errors.push('L’objectif doit être inférieur au poids de départ.');
  const bmiGoal = n('goalWeightKg')! / (n('heightCm')! / 100) ** 2;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Mes informations">
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        if (errors.length) return;
        await update({ firstName: f.firstName.trim(), sex, age: n('age')!, heightCm: n('heightCm')!, startWeightKg: n('startWeightKg')!, goalWeightKg: n('goalWeightKg')!, startDate: f.startDate, activityLevel: level, deficitKcal: deficit });
        toast('Profil enregistré');
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input className="input" value={f.firstName} onChange={set('firstName')} /></Field>
          <Field label="Sexe (pour la formule)"><select className="input" value={sex} onChange={(e) => setSex(e.target.value as 'male' | 'female')}><option value="male">Homme</option><option value="female">Femme</option></select></Field>
          <Field label="Âge"><input className="input tabular" inputMode="numeric" value={f.age} onChange={set('age')} /></Field>
          <Field label="Taille (cm)"><input className="input tabular" inputMode="numeric" value={f.heightCm} onChange={set('heightCm')} /></Field>
          <Field label="Poids de départ (kg)"><input className="input tabular" inputMode="decimal" value={f.startWeightKg} onChange={set('startWeightKg')} /></Field>
          <Field label="Objectif (kg)" hint={isFinite(bmiGoal) ? `IMC à l’objectif : ${bmiGoal.toFixed(1).replace('.', ',')}` : undefined}><input className="input tabular" inputMode="decimal" value={f.goalWeightKg} onChange={set('goalWeightKg')} /></Field>
          <Field label="Début du suivi"><input type="date" className="input" value={f.startDate} onChange={set('startDate')} /></Field>
        </div>
        <Field label="Niveau d’activité habituel">
          <select className="input" value={level} onChange={(e) => setLevel(e.target.value as ActivityLevel)}>
            {Object.entries(ACTIVITY_FACTORS).map(([k, v]) => <option key={k} value={k}>{v.label} (×{String(v.factor).replace('.', ',')}) — {v.hint}</option>)}
          </select>
        </Field>
        <Field label={`Déficit visé : ${deficit} kcal/jour`} hint="Entre 0 et 750 kcal, et jamais plus de 25 % de ta dépense. 500 kcal/j correspond à environ 0,5 kg par semaine en théorie : la réalité varie.">
          <input type="range" min={0} max={DEFICIT_MAX} step={50} value={deficit} onChange={(e) => setDeficit(Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" />
        </Field>
        {errors.length > 0 && <Notice tone="warn">{errors.join(' ')}</Notice>}
        <button className="btn-primary w-full" disabled={errors.length > 0}>Enregistrer</button>
      </form>
    </Card>
  );
}

function TargetsForm({ profile, update, auto }: { profile: Profile; update: (p: Partial<Profile>) => Promise<void>; auto: { kcal: number; protein: number; carbs: number; fat: number; fiber: number } }) {
  const o = profile.overrides ?? {};
  const s = (v?: number) => (v == null ? '' : String(v));
  const [v, setV] = useState({ kcal: s(o.kcal), protein: s(o.protein), carbs: s(o.carbs), fat: s(o.fat), fiber: s(o.fiber), water: String(profile.waterGoalMl), steps: String(profile.stepsGoal) });
  const [mode, setMode] = useState<'auto' | 'manual'>(Object.keys(o).length ? 'manual' : 'auto');
  return (
    <Card title="Objectifs quotidiens">
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const num = (x: string) => { const n = parseNum(x); return n != null && n > 0 ? Math.round(n) : undefined; };
        const overrides = mode === 'auto' ? {} : Object.fromEntries(Object.entries({ kcal: num(v.kcal), protein: num(v.protein), carbs: num(v.carbs), fat: num(v.fat), fiber: num(v.fiber) }).filter(([, x]) => x != null));
        const water = num(v.water);
        const steps = num(v.steps);
        await update({ overrides, waterGoalMl: water && water >= 500 && water <= 6000 ? water : profile.waterGoalMl, stepsGoal: steps && steps <= 50000 ? steps : profile.stepsGoal });
        toast('Objectifs enregistrés');
      }}>
        <Segmented ariaLabel="Mode" value={mode} onChange={setMode} options={[{ value: 'auto', label: 'Calculés' }, { value: 'manual', label: 'Personnalisés' }]} />
        {mode === 'manual' && (
          <div className="grid grid-cols-2 gap-3">
            {([['kcal', 'Calories (kcal)'], ['protein', 'Protéines (g)'], ['carbs', 'Glucides (g)'], ['fat', 'Lipides (g)'], ['fiber', 'Fibres (g)']] as const).map(([k, l]) => (
              <Field key={k} label={l}><input className="input tabular" inputMode="numeric" placeholder={`auto : ${auto[k]}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Eau (ml/jour)" hint="Indicatif, pas une prescription."><input className="input tabular" inputMode="numeric" value={v.water} onChange={(e) => setV({ ...v, water: e.target.value })} /></Field>
          <Field label="Pas (par jour)"><input className="input tabular" inputMode="numeric" value={v.steps} onChange={(e) => setV({ ...v, steps: e.target.value })} /></Field>
        </div>
        <button className="btn-primary w-full">Enregistrer</button>
      </form>
    </Card>
  );
}

function AdjustmentCard() {
  const todayKey = useToday();
  const [profile, update] = useProfile();
  const { targets, currentWeight } = useTargets();
  const weights = useStore('weights');
  const logs = useStore('logs');
  const sug = useMemo(() => {
    if (!weights || !logs || !targets || !currentWeight) return null;
    const from = addDays(todayKey, -28);
    const pts = dailyWeights(weights).filter((p) => p.date >= from);
    const reg = linearRegression(pts);
    const span = reg ? reg.spanDays : 0;
    const days = new Map<string, number>();
    for (const l of logs) if (l.date >= from && l.date < todayKey) days.set(l.date, (days.get(l.date) ?? 0) + l.nutrients.kcal);
    const avg = days.size ? [...days.values()].reduce((s, x) => s + x, 0) / days.size : null;
    return suggestAdjustment({ currentTargetKcal: targets.kcal, avgIntakeKcal: avg, loggedDays: days.size, periodDays: Math.min(28, span), slopeKgPerDay: reg?.slope ?? null, currentWeightKg: currentWeight, bmr: targets.bmr });
  }, [weights, logs, targets, currentWeight, todayKey]);
  if (!sug || !profile || !targets) return null;
  return (
    <Card title="Ajustement prudent">
      <p className="text-[14px]">{sug.reason}</p>
      {sug.ready && sug.observedTdee && <p className="text-[13px] text-muted mt-1">Dépense réelle estimée d’après tes apports et ta tendance : ≈ {fmt0(sug.observedTdee)} kcal/j (estimation : précision limitée par l’exactitude du journal).</p>}
      {sug.ready && sug.delta !== 0 && sug.suggestedKcal && (
        <button className="btn-secondary w-full mt-3" onClick={async () => { await update({ overrides: { ...profile.overrides, kcal: sug.suggestedKcal } }); toast(`Objectif passé à ${sug.suggestedKcal} kcal`); }}>
          Appliquer {sug.suggestedKcal} kcal ({sug.delta! > 0 ? '+' : ''}{sug.delta} kcal)
        </button>
      )}
      <p className="text-[12px] text-muted mt-2">L’application ne modifie jamais ton objectif toute seule. Elle propose au plus ±150 kcal, après 3 semaines de données et un journal rempli au moins 80 % des jours.</p>
    </Card>
  );
}

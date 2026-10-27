import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { put } from '../db/db';
import { restoreBackup, validateBackup } from '../db/backup';
import { defaultProfile } from '../db/defaults';
import { today } from '../lib/dates';
import { ACTIVITY_FACTORS, computeTargets } from '../lib/energy';
import { fmt0 } from '../lib/format';
import type { ActivityLevel, Sex } from '../lib/types';
import { Field, Notice, parseNum } from '../components/ui';

/**
 * Premier lancement sur un appareil : chacun crée son propre profil.
 * Rien n'est pré-rempli : les données de chaque téléphone restent séparées.
 */
export default function Welcome() {
  const [f, setF] = useState({ firstName: '', age: '', heightCm: '', weight: '', goal: '' });
  const [sex, setSex] = useState<Sex | ''>('');
  const [level, setLevel] = useState<ActivityLevel>('light');
  const [tried, setTried] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const n = (k: keyof typeof f) => parseNum(f[k]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const errors: string[] = [];
  if (!f.firstName.trim()) errors.push('Indique ton prénom.');
  if (!sex) errors.push('Choisis le sexe utilisé par la formule.');
  if (!(n('age')! >= 15 && n('age')! <= 100)) errors.push('Âge entre 15 et 100 ans.');
  if (!(n('heightCm')! >= 120 && n('heightCm')! <= 230)) errors.push('Taille entre 120 et 230 cm.');
  if (!(n('weight')! >= 30 && n('weight')! <= 350)) errors.push('Poids actuel entre 30 et 350 kg.');
  if (!(n('goal')! >= 30 && n('goal')! < n('weight')!)) errors.push('L’objectif doit être inférieur au poids actuel.');
  const bmiGoal = n('goal')! / (n('heightCm')! / 100) ** 2;

  const todayKey = today();
  const preview = errors.length === 0
    ? computeTargets(defaultProfile(todayKey, { firstName: f.firstName.trim(), sex: sex as Sex, age: n('age')!, heightCm: n('heightCm')!, startWeightKg: n('weight')!, goalWeightKg: n('goal')!, activityLevel: level }), n('weight')!)
    : null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (errors.length) return;
    const profile = defaultProfile(todayKey, { firstName: f.firstName.trim(), sex: sex as Sex, age: n('age')!, heightCm: n('heightCm')!, startWeightKg: n('weight')!, goalWeightKg: n('goal')!, activityLevel: level });
    await put('profile', profile);
  }

  return (
    <main className="min-h-dvh bg-bg">
      <div className="max-w-md mx-auto px-4 py-8 space-y-5 fade-in">
        <header className="space-y-2">
          <div className="text-accent font-extrabold tracking-tight text-lg">FITTRACK 88</div>
          <h1 className="text-2xl font-bold">Bienvenue !</h1>
          <p className="text-[14px] text-muted">Quelques informations pour calculer tes besoins. Elles restent uniquement sur ce téléphone : chaque personne qui installe l’appli a ses propres données, séparées.</p>
        </header>

        <form className="card space-y-3" onSubmit={create} noValidate>
          <Field label="Prénom"><input className="input" value={f.firstName} onChange={set('firstName')} autoComplete="given-name" /></Field>
          <Field label="Sexe (pour la formule de calcul)">
            <select className="input" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              <option value="" disabled>Choisir…</option>
              <option value="female">Femme</option>
              <option value="male">Homme</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Âge"><input className="input tabular" inputMode="numeric" value={f.age} onChange={set('age')} /></Field>
            <Field label="Taille (cm)"><input className="input tabular" inputMode="numeric" value={f.heightCm} onChange={set('heightCm')} /></Field>
            <Field label="Poids actuel (kg)"><input className="input tabular" inputMode="decimal" value={f.weight} onChange={set('weight')} /></Field>
            <Field label="Objectif (kg)" hint={isFinite(bmiGoal) && bmiGoal > 0 ? `IMC à l’objectif : ${bmiGoal.toFixed(1).replace('.', ',')}` : undefined}><input className="input tabular" inputMode="decimal" value={f.goal} onChange={set('goal')} /></Field>
          </div>
          <Field label="Niveau d’activité habituel">
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value as ActivityLevel)}>
              {Object.entries(ACTIVITY_FACTORS).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.hint}</option>)}
            </select>
          </Field>
          {preview && (
            <p className="text-[13px] text-muted">Objectif de départ estimé : <strong className="text-ink tabular">{fmt0(preview.kcal)} kcal/jour</strong> dont {fmt0(preview.protein)} g de protéines. Tu pourras tout ajuster dans Profil.</p>
          )}
          {tried && errors.length > 0 && <Notice tone="warn">{errors.join(' ')}</Notice>}
          <button className="btn-primary w-full">Commencer</button>
        </form>

        <section className="card space-y-2">
          <h2 className="font-semibold">Tu as déjà une sauvegarde ?</h2>
          <p className="text-[13px] text-muted">Pour reprendre tes données sur ce téléphone (fichier « fittrack88-sauvegarde… » créé depuis Données).</p>
          <button className="btn-secondary w-full" onClick={() => input.current?.click()}><Upload size={16} />Restaurer une sauvegarde</button>
          <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setRestoreError(null);
            try {
              const v = validateBackup(JSON.parse(await file.text()));
              if (!v.ok) setRestoreError(v.error);
              else if (!v.backup.data.profile?.length) setRestoreError('Cette sauvegarde ne contient pas de profil.');
              else await restoreBackup(v.backup);
            } catch {
              setRestoreError('Fichier illisible : ce n’est pas une sauvegarde FITTRACK 88.');
            }
          }} />
          {restoreError && <Notice tone="warn">{restoreError}</Notice>}
        </section>
      </div>
    </main>
  );
}

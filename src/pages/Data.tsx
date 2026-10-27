import { Upload, Download, ClipboardPaste, FileJson, Trash2, ShieldCheck, HeartPulse, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { exportBackup, restoreBackup, validateBackup, deleteAllData, type Backup } from '../db/backup';
import { requestPersistence } from '../db/db';
import { useProfile, useRunPlan, useStore, useTargets, useToday } from '../db/hooks';
import { applyImport, recordSync, type ImportSummary } from '../db/importer';
import { toCsv } from '../lib/csv';
import { addDays, formatDay, rangeDays, startOfWeek } from '../lib/dates';
import { parseSimpleJson, parseWeightCsv } from '../lib/healthImport';
import { daySummary, weekSummary } from '../lib/summary';
import { Card, Field, Notice, PageHeader, SourceBadge, Sheet } from '../components/ui';
import { toast } from '../components/toast';
import type { WorkerIn, WorkerOut } from '../workers/healthWorker';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DataPage() {
  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Données" back subtitle="Import, sauvegarde, export et confidentialité" />
      <AppleHealthImport />
      <JsonImport />
      <BackupCard />
      <CsvExports />
      <PrivacyCard />
    </div>
  );
}

function SyncStatus({ id }: { id: string }) {
  const sync = useStore('sync');
  const s = sync?.find((x) => x.id === id);
  if (!s) return <p className="text-[13px] text-muted">Jamais synchronisé.</p>;
  return (
    <div className="flex items-start gap-2 text-[13px]">
      {s.status === 'error' ? <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="text-good shrink-0 mt-0.5" />}
      <div>
        <div>Dernier import : <b>{new Date(s.lastAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</b> · {s.status === 'ok' ? 'réussi' : s.status === 'partial' ? 'partiel' : 'échec'}</div>
        <div className="text-muted">{s.message}</div>
      </div>
    </div>
  );
}

function AppleHealthImport() {
  const todayKey = useToday();
  const [profile] = useProfile();
  const runPlan = useRunPlan();
  const [from, setFrom] = useState(addDays(todayKey, -90));
  const [weights, setWeights] = useState(true);
  const [progress, setProgress] = useState<{ read: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);

  function start(file: File) {
    if (!profile || !runPlan) return;
    setError(null);
    setResult(null);
    setProgress({ read: 0, total: file.size });
    worker.current?.terminate();
    const w = new Worker(new URL('../workers/healthWorker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = async (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === 'progress') setProgress({ read: m.read, total: m.total });
      else if (m.type === 'error') {
        setProgress(null);
        setError(m.message);
        await recordSync({ id: 'apple_health', lastAt: Date.now(), status: 'error', message: m.message });
        w.terminate();
      } else {
        try {
          const sum = await applyImport(m.result, { runPlan, runPlanStart: profile.runPlanStart });
          setResult(sum);
          const msg = `${sum.days} jour(s) d’activité, ${sum.workouts} séance(s) (${sum.newWorkouts} nouvelle(s)), ${sum.weights} pesée(s)${m.result.firstDate ? `, du ${formatDay(m.result.firstDate, { year: true })} au ${formatDay(m.result.lastDate!, { year: true })}` : ''}. Sources : ${m.result.stats.sources.join(', ') || 'aucune'}.`;
          await recordSync({ id: 'apple_health', lastAt: Date.now(), status: m.result.days.length || m.result.workouts.length ? 'ok' : 'partial', message: m.result.days.length || m.result.workouts.length ? msg : 'Aucune donnée trouvée sur la période choisie.', stats: { days: sum.days, workouts: sum.workouts, weights: sum.weights } });
          toast('Import Apple Santé terminé');
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
        setProgress(null);
        w.terminate();
      }
    };
    w.onerror = (e) => { setProgress(null); setError(`Erreur pendant la lecture : ${e.message}`); };
    const msg: WorkerIn = { file, from, importWeights: weights };
    w.postMessage(msg);
  }

  return (
    <Card title={<span className="flex items-center gap-2"><HeartPulse size={18} className="text-accent" />Apple Santé / Apple Watch</span>} action={<button className="text-sm text-accent font-semibold" onClick={() => setHelp(true)}>Comment faire ?</button>}>
      <SyncStatus id="apple_health" />
      <p className="text-[13px] text-muted mt-2">Importe le fichier « export.zip » de l’app Santé : pas, distance, calories actives et au repos, minutes d’exercice, sommeil, fréquence cardiaque au repos, entraînements (durée, distance, FC, dénivelé) et pesées. Le fichier est lu sur ton appareil, rien n’est envoyé.</p>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="Importer depuis le"><input type="date" className="input" value={from} max={todayKey} onChange={(e) => setFrom(e.target.value)} /></Field>
        <label className="flex items-end gap-2 text-[13px] pb-2"><input type="checkbox" className="w-5 h-5 accent-[rgb(var(--accent))]" checked={weights} onChange={(e) => setWeights(e.target.checked)} />Importer les pesées</label>
      </div>
      <input ref={input} type="file" accept=".zip,.xml,application/zip,text/xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) start(f); e.target.value = ''; }} />
      <button className="btn-primary w-full mt-3" disabled={!!progress} onClick={() => input.current?.click()}><Upload size={18} />Choisir export.zip</button>
      {progress && (
        <div className="mt-3">
          <div className="text-[13px] text-muted mb-1 tabular">Lecture… {Math.round(progress.read / 1e6)} / {Math.round(progress.total / 1e6)} Mo</div>
          <div className="h-2 rounded-full bg-surface2 overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${(progress.read / Math.max(1, progress.total)) * 100}%` }} /></div>
        </div>
      )}
      {error && <div className="mt-3"><Notice tone="warn">{error}</Notice></div>}
      {result && <div className="mt-3"><Notice tone="good">{result.days} jour(s) d’activité, {result.workouts} séance(s) ({result.newWorkouts} nouvelle(s){result.linked ? `, ${result.linked} rattachées au programme` : ''}), {result.weights} pesée(s) importée(s){result.skippedWeights ? ` (${result.skippedWeights} ignorées : pesée manuelle le même jour)` : ''}.</Notice></div>}
      <Sheet open={help} onClose={() => setHelp(false)} title="Exporter depuis Apple Santé">
        <ol className="list-decimal pl-5 space-y-2 text-[14px] leading-relaxed">
          <li>Sur l’iPhone, ouvre l’app <b>Santé</b>.</li>
          <li>Touche ta <b>photo de profil</b> en haut à droite.</li>
          <li>Tout en bas : <b>Exporter toutes les données de santé</b>, puis <b>Exporter</b>. Cela peut prendre plusieurs minutes.</li>
          <li>Dans la feuille de partage, choisis <b>Enregistrer dans Fichiers</b>.</li>
          <li>Ici, touche <b>Choisir export.zip</b> et sélectionne le fichier.</li>
        </ol>
        <p className="text-[13px] text-muted mt-3">Le fichier peut peser plusieurs centaines de Mo : il est lu morceau par morceau. Choisis une date de début récente pour aller plus vite. Refaire l’import plus tard ne crée pas de doublons.</p>
        <p className="text-[13px] text-muted mt-2">Doublons iPhone + Apple Watch : pour chaque jour, l’application garde l’appareil qui a enregistré le plus de pas (ou de distance, de calories…) au lieu de les additionner. C’est une approximation : l’app Santé fait une fusion plus fine, que l’export ne permet pas de reproduire exactement.</p>
      </Sheet>
    </Card>
  );
}

function JsonImport() {
  const [profile] = useProfile();
  const runPlan = useRunPlan();
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ tone: 'good' | 'warn'; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const csv = useRef<HTMLInputElement>(null);

  async function importText(t: string) {
    if (!profile || !runPlan) return;
    const r = parseSimpleJson(t);
    if (!r.days.length && !r.workouts.length && !r.weights.length) {
      setMsg({ tone: 'warn', text: r.errors.join(' ') });
      return;
    }
    const sum = await applyImport(r, { runPlan, runPlanStart: profile.runPlanStart });
    const text = `${sum.days} jour(s), ${sum.workouts} séance(s), ${sum.weights} pesée(s) importés.${r.errors.length ? ` Ignorés : ${r.errors.join(' ; ')}` : ''}`;
    await recordSync({ id: 'shortcut', lastAt: Date.now(), status: r.errors.length ? 'partial' : 'ok', message: text });
    setMsg({ tone: r.errors.length ? 'warn' : 'good', text });
    setText('');
  }

  return (
    <Card title={<span className="flex items-center gap-2"><FileJson size={18} className="text-info" />Import JSON (Raccourci iOS) ou CSV</span>}>
      <SyncStatus id="shortcut" />
      <p className="text-[13px] text-muted mt-2">Format décrit dans le README (section « Raccourci iOS »). Pratique pour envoyer chaque jour un résumé Apple Santé via l’app Raccourcis, sans exporter tout l’historique.</p>
      <textarea className="input h-24 py-2 mt-2 font-mono text-[12px]" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"fittrack":1,"days":[{"date":"2026-10-27","steps":8500}]}' aria-label="Données JSON à importer" />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button className="btn-secondary" onClick={async () => {
          try { const t = await navigator.clipboard.readText(); setText(t); await importText(t); } catch { setMsg({ tone: 'warn', text: 'Lecture du presse-papiers refusée : colle le texte dans le champ ci-dessus.' }); }
        }}><ClipboardPaste size={16} />Coller et importer</button>
        <button className="btn-secondary" disabled={!text.trim()} onClick={() => importText(text)}>Importer le texte</button>
        <button className="btn-ghost" onClick={() => file.current?.click()}><Upload size={16} />Fichier .json</button>
        <button className="btn-ghost" onClick={() => csv.current?.click()}><FileSpreadsheet size={16} />Pesées .csv</button>
      </div>
      <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await importText(await f.text()); e.target.value = ''; }} />
      <input ref={csv} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f || !profile || !runPlan) return;
        const r = parseWeightCsv(await f.text());
        const sum = await applyImport({ days: [], workouts: [], weights: r.weights }, { runPlan, runPlanStart: profile.runPlanStart });
        setMsg({ tone: r.errors.length ? 'warn' : 'good', text: `${sum.weights} pesée(s) importée(s)${sum.skippedWeights ? `, ${sum.skippedWeights} ignorée(s) (pesée manuelle le même jour)` : ''}.${r.errors.length ? ` ${r.errors.slice(0, 3).join(' ')}` : ''}` });
      }} />
      <p className="text-[12px] text-muted mt-2">CSV des pesées : une ligne par pesée, « date;poids » (ex. 27/10/2026;118,4).</p>
      {msg && <div className="mt-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </Card>
  );
}

function BackupCard() {
  const [pending, setPending] = useState<{ backup: Backup; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persist, setPersist] = useState<boolean | null>(null);
  const todayKey = useToday();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { navigator.storage?.persisted?.().then(setPersist).catch(() => setPersist(null)); }, []);
  return (
    <Card title="Sauvegarde et transfert">
      <p className="text-[13px] text-muted">Tes données vivent uniquement dans ce navigateur. Fais une sauvegarde régulière (par exemple chaque dimanche) et range-la dans Fichiers / iCloud Drive : c’est aussi le moyen de passer sur un autre appareil.</p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button className="btn-primary" onClick={async () => { download(`fittrack88-sauvegarde-${todayKey}.json`, JSON.stringify(await exportBackup()), 'application/json'); toast('Sauvegarde téléchargée'); }}><Download size={16} />Sauvegarder</button>
        <button className="btn-secondary" onClick={() => input.current?.click()}><Upload size={16} />Restaurer</button>
      </div>
      <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        setError(null);
        try {
          const v = validateBackup(JSON.parse(await f.text()));
          if (!v.ok) setError(v.error); else setPending({ backup: v.backup, counts: v.counts });
        } catch { setError('Fichier illisible : ce n’est pas un JSON valide.'); }
      }} />
      {error && <div className="mt-2"><Notice tone="warn">{error}</Notice></div>}
      <div className="mt-3 text-[12px] text-muted flex items-center gap-2">
        <ShieldCheck size={14} />Stockage persistant : {persist == null ? 'information indisponible' : persist ? 'accordé (le navigateur ne videra pas les données pour faire de la place)' : 'non accordé'}
        {!persist && <button className="text-accent font-semibold" onClick={async () => setPersist(await requestPersistence())}>Demander</button>}
      </div>
      <Sheet open={!!pending} onClose={() => setPending(null)} title="Restaurer la sauvegarde ?">
        {pending && (
          <div className="space-y-3">
            <p className="text-[14px]">Sauvegarde du {new Date(pending.backup.exportedAt).toLocaleString('fr-FR')} :</p>
            <ul className="text-[13px] text-muted grid grid-cols-2 gap-1">{Object.entries(pending.counts).filter(([, n]) => n).map(([k, n]) => <li key={k}>{k} : {n}</li>)}</ul>
            <Notice tone="warn">Toutes les données actuelles de cet appareil seront remplacées par celles de la sauvegarde.</Notice>
            <button className="btn-primary w-full" onClick={async () => { await restoreBackup(pending.backup); setPending(null); toast('Données restaurées'); }}>Remplacer et restaurer</button>
          </div>
        )}
      </Sheet>
    </Card>
  );
}

function CsvExports() {
  const weights = useStore('weights');
  const logs = useStore('logs');
  const workouts = useStore('workouts');
  const activity = useStore('activity');
  const water = useStore('water');
  const planStates = useStore('planStates');
  const { targets, profile } = useTargets();
  const todayKey = useToday();
  if (!weights || !logs || !workouts || !activity || !water || !planStates || !targets || !profile) return null;
  const d = { logs, water, workouts, activity, weights, planStates };
  const stamp = todayKey;
  const csv = (name: string, rows: Record<string, unknown>[]) => download(`fittrack88-${name}-${stamp}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  const exports: [string, () => void][] = [
    ['Pesées', () => csv('pesees', [...weights].sort((a, b) => (a.date < b.date ? -1 : 1)).map((w) => ({ date: w.date, heure: w.time, poids_kg: w.kg, source: w.source, note: w.note })))],
    ['Journal alimentaire', () => csv('journal', [...logs].sort((a, b) => (a.date < b.date ? -1 : 1)).map((l) => ({ date: l.date, repas: l.meal, aliment: l.name, grammes: l.grams, etat: l.state, portions: l.servings, kcal: l.nutrients.kcal, proteines_g: l.nutrients.protein, glucides_g: l.nutrients.carbs, lipides_g: l.nutrients.fat, fibres_g: l.nutrients.fiber, source: l.source })))],
    ['Séances', () => csv('seances', [...workouts].sort((a, b) => (a.date < b.date ? -1 : 1)).map((w) => ({ date: w.date, heure: w.startTime, type: w.type, duree_min: Math.round(w.durationSec / 6) / 10, distance_km: w.distanceKm, fc_moy: w.avgHr, fc_max: w.maxHr, kcal_actives: w.activeKcal, denivele_m: w.elevationM, effort_rpe: w.rpe, douleur: w.pain, terminee: w.completed ? 'oui' : 'non', commentaire: w.comment, source: w.source })))],
    ['Activité et sommeil', () => csv('activite', [...activity].sort((a, b) => (a.id < b.id ? -1 : 1)).map((a) => ({ date: a.id, pas: a.steps, distance_km: a.distanceKm, kcal_actives: a.activeKcal, kcal_repos: a.basalKcal, exercice_min: a.exerciseMin, sommeil_min: a.sleepMin, fc_repos: a.restingHr, source: a.source })))],
    ['Bilan quotidien (90 j)', () => csv('bilan-quotidien', rangeDays(addDays(todayKey, -89), todayKey).map((k) => { const s = daySummary(k, d); return { date: k, kcal: Math.round(s.intake.kcal), objectif_kcal: targets.kcal, proteines_g: Math.round(s.intake.protein), eau_ml: s.waterMl, pas: s.steps, seances: s.workouts.length, course_min: Math.round(s.runSec / 60), poids_kg: s.weightKg, repas_programme: s.planConsumed }; }))],
    ['Rapports hebdomadaires', () => {
      const weeks = Array.from({ length: 12 }, (_, i) => addDays(startOfWeek(todayKey), -7 * (11 - i)));
      csv('rapports-hebdo', weeks.map((w) => { const s = weekSummary(w, d, { kcal: targets.kcal, protein: targets.protein, waterMl: profile.waterGoalMl }); return { semaine_du: w, poids_moyen: s.avgWeight != null ? Math.round(s.avgWeight * 10) / 10 : null, variation: s.weightDelta != null ? Math.round(s.weightDelta * 10) / 10 : null, seances: s.sessions, km: Math.round(s.runKm * 10) / 10, course_min: Math.round(s.runSec / 60), kcal_moy: s.avgKcal != null ? Math.round(s.avgKcal) : null, proteines_moy: s.avgProtein != null ? Math.round(s.avgProtein) : null, jours_journal: s.loggedDays, regularite_repas_pct: s.mealRegularity, points_positifs: s.positives.join(' | '), a_ameliorer: s.improvements.join(' | ') }; }));
    }],
  ];
  return (
    <Card title="Export CSV (Excel, Numbers)">
      <div className="grid grid-cols-2 gap-2">
        {exports.map(([label, fn]) => <button key={label} className="btn-secondary btn-sm h-11" onClick={fn}><FileSpreadsheet size={15} />{label}</button>)}
      </div>
      <p className="text-[12px] text-muted mt-2">Séparateur « ; » et virgule décimale, compatibles avec Excel en français.</p>
    </Card>
  );
}

function PrivacyCard() {
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  return (
    <Card title="Confidentialité">
      <ul className="text-[13px] space-y-1.5 leading-relaxed">
        <li>• Aucune inscription, aucun compte, aucun serveur : tout est stocké dans ce navigateur (IndexedDB).</li>
        <li>• Aucune statistique d’usage, aucun traceur, aucune publicité.</li>
        <li>• Seule connexion externe : la recherche Open Food Facts, uniquement quand tu l’utilises (envoie le texte recherché).</li>
        <li>• Les fichiers Apple Santé sont lus localement, jamais envoyés.</li>
        <li>• Provenance affichée pour chaque donnée : <SourceBadge source="apple_health_export" /> <SourceBadge source="manual" /> <SourceBadge source="estimate" /> <SourceBadge source="open_food_facts" /></li>
      </ul>
      <button className="btn-danger w-full mt-3" onClick={() => setConfirm(true)}><Trash2 size={16} />Supprimer toutes mes données</button>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Tout supprimer ?">
        <div className="space-y-3">
          <Notice tone="warn">Pesées, journal, séances, imports, aliments et recettes personnels seront effacés de cet appareil. C’est irréversible. Fais une sauvegarde avant si tu veux pouvoir revenir en arrière.</Notice>
          <Field label="Tape SUPPRIMER pour confirmer"><input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" /></Field>
          <button className="btn-danger w-full" disabled={typed.trim().toUpperCase() !== 'SUPPRIMER'} onClick={async () => { await deleteAllData(); try { localStorage.clear(); } catch { /* rien */ } setConfirm(false); setTyped(''); toast('Données supprimées'); }}>Supprimer définitivement</button>
        </div>
      </Sheet>
    </Card>
  );
}

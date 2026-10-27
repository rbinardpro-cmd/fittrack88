import { Droplets, Footprints, Moon, Flame, Scale, ChevronRight, Dumbbell, Plus, Activity } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addWater } from '../db/actions';
import { useProfile, useRunPlan, useStore, useTargets, useToday } from '../db/hooks';
import { addDays, diffDays, formatDay, startOfWeek } from '../lib/dates';
import { dayEnergy, sumNutrients } from '../lib/energy';
import { fmt0, fmt1, fmtDuration, fmtKg, fmtSigned1 } from '../lib/format';
import { sessionTotals } from '../lib/running';
import { daySummary, habitScore, kcalMessage } from '../lib/summary';
import { changeOver, computeProgress, dailyWeights, forecastGoal, latestWeight, weeklyAverages } from '../lib/weight';
import { Card, Loading, ProgressBar, Ring, Sheet, SourceBadge, Stat } from '../components/ui';
import { toast } from '../components/toast';
import { WeightQuickAdd } from './Weight';
import { C, TimeChart } from '../components/charts';

export default function Dashboard() {
  const todayKey = useToday();
  const [profile] = useProfile();
  const { targets } = useTargets();
  const weights = useStore('weights');
  const logs = useStore('logs');
  const water = useStore('water');
  const workouts = useStore('workouts');
  const activity = useStore('activity');
  const planStates = useStore('planStates');
  const runPlan = useRunPlan();
  const [weighOpen, setWeighOpen] = useState(false);

  const data = useMemo(() => {
    if (!profile || !weights || !logs || !water || !workouts || !activity || !planStates || !targets) return null;
    const daily = dailyWeights(weights);
    const last = latestWeight(weights);
    const current = last?.kg ?? profile.startWeightKg;
    const progress = computeProgress(profile.startWeightKg, current, profile.goalWeightKg);
    const forecast = forecastGoal(weights, profile.goalWeightKg, todayKey);
    const weeks = weeklyAverages(daily, startOfWeek);
    const s = daySummary(todayKey, { logs, water, workouts, activity, weights, planStates });
    const energy = dayEnergy(targets.tdee, s.activity);
    const habits = habitScore(s, { protein: targets.protein, waterMl: profile.waterGoalMl, steps: profile.stepsGoal });
    // séance prévue aujourd'hui
    const offset = diffDays(profile.runPlanStart, todayKey);
    const planned = offset >= 0 ? runPlan?.find((r) => (r.week - 1) * 7 + r.dayOffset === offset) : undefined;
    const doneToday = workouts.filter((w) => w.date === todayKey && w.completed);
    const fiberKnown = logs.filter((l) => l.date === todayKey).every((l) => l.nutrients.fiber != null);
    return { daily, last, current, progress, forecast, weeks, s, energy, habits, planned, doneToday, fiberKnown, intake: sumNutrients(logs.filter((l) => l.date === todayKey).map((l) => l.nutrients)) };
  }, [profile, weights, logs, water, workouts, activity, planStates, targets, todayKey, runPlan]);

  if (!data || !profile || !targets) return <Loading />;
  const { progress, forecast, s, energy, habits, intake } = data;
  const remaining = targets.kcal - intake.kcal;
  const chart = data.daily.filter((p) => p.date >= addDays(todayKey, -30));
  const lastWeek = data.weeks.slice(-2);

  return (
    <div className="space-y-4 fade-in">
      <header className="pt-5 pb-1">
        <div className="text-sm text-muted capitalize">{formatDay(todayKey, { weekday: true, year: true })}</div>
        <h1 className="text-[28px] font-bold tracking-tight">Bonjour {profile.firstName || ''}</h1>
      </header>

      {/* A. Progression physique */}
      <Card title="Ma progression" action={<Link to="/poids" className="text-sm text-accent font-semibold flex items-center">Poids <ChevronRight size={16} /></Link>}>
        <div className="flex items-center gap-4">
          <Ring pct={progress.progressPct} size={116}>
            <div className="text-[22px] font-bold tabular">{fmt1(Math.max(0, progress.progressPct))} %</div>
            <div className="text-[11px] text-muted">du chemin</div>
          </Ring>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1 min-w-0">
            <Stat label="Poids actuel" value={fmt1(data.current)} unit="kg" sub={data.last ? formatDay(data.last.date) : 'poids de départ'} />
            <Stat label="Objectif" value={fmt1(profile.goalWeightKg)} unit="kg" sub={`départ ${fmt1(profile.startWeightKg)} kg`} />
            <Stat label="Perdus" value={fmt1(progress.lostKg)} unit="kg" tone={progress.lostKg > 0 ? 'good' : undefined} sub={`${fmt1(progress.bodyWeightLostPct)} % du poids initial`} />
            <Stat label="Restants" value={fmt1(progress.remainingKg)} unit="kg" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          {([['7 j', 7], ['30 j', 30], ['90 j', 90], ['Début', 'all']] as const).map(([l, d]) => {
            const v = changeOver(data.daily, d);
            return (
              <div key={l} className="rounded-xl bg-surface2 py-2">
                <div className="text-[11px] text-muted">{l}</div>
                <div className={`tabular text-[15px] font-bold ${v != null && v < 0 ? 'text-good' : ''}`}>{v == null ? '—' : fmtSigned1(v)}</div>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-muted mt-2">Variations calculées sur la moyenne glissante de 7 jours, pour lisser l’eau et la digestion.</p>
        {chart.length >= 2 && (
          <div className="h-36 mt-3 -ml-2">
            <TimeChart data={chart} xKey="date" series={[{ key: 'kg', name: 'Poids', type: 'line', color: C.accent, dots: true }]} refs={[]} fmtX={(d) => formatDay(d)} fmtValue={(v) => fmtKg(v)} />
          </div>
        )}
        <div className="mt-3 rounded-xl border border-line/70 p-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold">Estimation de l’objectif</span>
            {lastWeek.length > 0 && <span className="text-muted tabular">Moy. semaine : {fmtKg(lastWeek[lastWeek.length - 1].avg)}</span>}
          </div>
          {forecast.status === 'ok' ? (
            <div className="mt-1 text-[13px]">
              <div>
                Vers le <b>{formatDay(forecast.dateCentral!, { year: true })}</b>, fourchette du {formatDay(forecast.dateEarly!, { year: true })} {forecast.dateLate ? `au ${formatDay(forecast.dateLate, { year: true })}` : '(borne haute incertaine)'}.
              </div>
              <div className="text-muted mt-0.5">Tendance : {fmtSigned1(forecast.trendKgPerWeek!)} kg/semaine sur {forecast.windowDays} jours. {forecast.message}</div>
            </div>
          ) : (
            <div className="mt-1 text-[13px] text-muted">{forecast.message}</div>
          )}
        </div>
        <button className="btn-primary w-full mt-3" onClick={() => setWeighOpen(true)}>
          <Scale size={18} /> Ajouter une pesée
        </button>
      </Card>

      {/* B. Ma journée */}
      <Card title="Ma journée" action={<Link to="/journal" className="text-sm text-accent font-semibold flex items-center">Journal <ChevronRight size={16} /></Link>}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[12px] text-muted">Calories consommées (alimentation)</div>
            <div className="text-[30px] font-bold tabular leading-none mt-1">
              {fmt0(intake.kcal)} <span className="text-[15px] text-muted font-semibold">/ {fmt0(targets.kcal)} kcal</span>
            </div>
          </div>
          <div className={`text-right text-[13px] font-semibold ${remaining >= 0 ? 'text-good' : 'text-warn'}`}>
            {remaining >= 0 ? `${fmt0(remaining)} restantes` : `+${fmt0(-remaining)} au-delà`}
          </div>
        </div>
        <div className="mt-2"><ProgressBar value={intake.kcal} max={targets.kcal} tone={remaining >= 0 ? 'accent' : 'warn'} label="Calories" /></div>
        <p className="text-[12px] text-muted mt-1.5">{kcalMessage(intake.kcal, targets.kcal)}</p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Macro label="Protéines" v={intake.protein} t={targets.protein} tone="good" />
          <Macro label="Glucides" v={intake.carbs} t={targets.carbs} tone="info" />
          <Macro label="Lipides" v={intake.fat} t={targets.fat} tone="warn" />
          <Macro label={data.fiberKnown ? 'Fibres' : 'Fibres (partielles)'} v={intake.fiber ?? 0} t={targets.fiber} tone="info" />
        </div>

        {/* Eau */}
        <div className="mt-4 flex items-center gap-3">
          <Droplets className="text-info shrink-0" size={20} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[13px]"><span className="font-semibold">Eau</span><span className="tabular text-muted">{fmt1(s.waterMl / 1000)} / {fmt1(profile.waterGoalMl / 1000)} L</span></div>
            <div className="mt-1"><ProgressBar value={s.waterMl} max={profile.waterGoalMl} tone="info" label="Eau" /></div>
          </div>
          <button className="btn-secondary btn-sm" onClick={async () => { await addWater(todayKey, 250); toast('+250 ml'); }}>+250</button>
          <button className="btn-secondary btn-sm" onClick={async () => { await addWater(todayKey, 500); toast('+500 ml'); }}>+500</button>
        </div>
      </Card>

      {/* Énergie & activité */}
      <Card title="Énergie et activité" action={<Link to="/activite" className="text-sm text-accent font-semibold flex items-center">Détail <ChevronRight size={16} /></Link>}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <EnergyBox label="Alimentation" value={intake.kcal} note="consommées" />
          <EnergyBox label="Actives" value={energy.active} note={s.activity ? 'mesurées' : 'non importées'} />
          <EnergyBox label="Dépense totale" value={energy.total} note={energy.method === 'measured' ? 'repos + actives' : 'estimée'} />
        </div>
        <p className="text-[12px] text-muted mt-2">{energy.explanation}</p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <MiniStat icon={<Footprints size={16} />} label="Pas" value={s.activity?.steps != null ? fmt0(s.activity.steps) : '—'} sub={`objectif ${fmt0(profile.stepsGoal)}`} />
          <MiniStat icon={<Activity size={16} />} label="Distance" value={s.activity?.distanceKm != null ? `${fmt1(s.activity.distanceKm)} km` : '—'} />
          <MiniStat icon={<Flame size={16} />} label="Exercice" value={s.activity?.exerciseMin != null ? `${fmt0(s.activity.exerciseMin)} min` : '—'} />
          <MiniStat icon={<Moon size={16} />} label="Sommeil (nuit dernière)" value={s.activity?.sleepMin != null ? fmtDuration(s.activity.sleepMin * 60) : '—'} />
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
          {s.activity ? <><SourceBadge source={s.activity.source} /> importé le {new Date(s.activity.importedAt).toLocaleDateString('fr-FR')}</> : <>Aucune donnée d’activité pour aujourd’hui. <Link className="text-accent font-semibold" to="/donnees">Importer depuis Apple Santé</Link></>}
        </div>
      </Card>

      {/* Entraînement */}
      <Card title="Entraînement" action={<Link to="/course" className="text-sm text-accent font-semibold flex items-center">Programme <ChevronRight size={16} /></Link>}>
        {data.planned ? (
          <div className="flex items-center gap-3">
            <Dumbbell className="text-accent" size={20} />
            <div className="flex-1">
              <div className="font-semibold text-[14px]">Prévu : {data.planned.title}</div>
              <div className="text-[12px] text-muted">{fmtDuration(sessionTotals(data.planned.blocks).totalSec)} au total, dont {fmtDuration(sessionTotals(data.planned.blocks).runSec)} de course lente</div>
            </div>
            <Link to={`/course/seance/${data.planned.id}`} className="btn-secondary btn-sm">Voir</Link>
          </div>
        ) : (
          <div className="text-[14px] text-muted">Pas de séance prévue aujourd’hui : jour de repos ou marche libre.</div>
        )}
        <div className="mt-2 text-[13px]">
          {data.doneToday.length ? (
            data.doneToday.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-1">
                <span>Réalisé : {fmtDuration(w.durationSec)}{w.distanceKm ? ` · ${fmt1(w.distanceKm)} km` : ''}</span>
                <SourceBadge source={w.source} />
              </div>
            ))
          ) : (
            <Link to="/course/saisie" className="inline-flex items-center gap-1 text-accent font-semibold"><Plus size={16} /> Enregistrer une séance</Link>
          )}
        </div>
      </Card>

      {/* Habitudes */}
      <Card title="Mes habitudes du jour" action={<span className="tabular font-bold text-accent">{habits.score} %</span>}>
        <ul className="space-y-1.5">
          {habits.items.map((i) => (
            <li key={i.label} className="flex items-center gap-2 text-[14px]">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${i.done ? 'bg-good text-white' : 'bg-surface2 text-muted'}`} aria-hidden>{i.done ? '✓' : ''}</span>
              <span className={i.done ? '' : 'text-muted'}>{i.label}</span>
              <span className="sr-only">{i.done ? 'fait' : 'pas encore'}</span>
            </li>
          ))}
        </ul>
        <Link to="/bilan" className="btn-secondary w-full mt-3">Bilan du jour et de la semaine</Link>
      </Card>

      <Sheet open={weighOpen} onClose={() => setWeighOpen(false)} title="Nouvelle pesée">
        <WeightQuickAdd onDone={() => setWeighOpen(false)} defaultKg={data.current} />
      </Sheet>
    </div>
  );
}

function Macro({ label, v, t, tone }: { label: string; v: number; t: number; tone: 'good' | 'info' | 'warn' }) {
  return (
    <div>
      <div className="flex justify-between text-[12px]"><span className="font-medium">{label}</span><span className="tabular text-muted">{fmt0(v)} / {fmt0(t)} g</span></div>
      <div className="mt-1"><ProgressBar value={v} max={t} tone={tone} label={label} /></div>
    </div>
  );
}

function EnergyBox({ label, value, note }: { label: string; value: number | null; note: string }) {
  return (
    <div className="rounded-xl bg-surface2 py-2 px-1">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="tabular font-bold text-[17px]">{value == null ? '—' : fmt0(value)}</div>
      <div className="text-[10px] text-muted">{value == null ? 'non disponible' : `kcal · ${note}`}</div>
    </div>
  );
}

function MiniStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[12px] text-muted truncate">{label}</div>
        <div className="font-semibold tabular text-[15px]">{value}</div>
        {sub && <div className="text-[11px] text-muted">{sub}</div>}
      </div>
    </div>
  );
}

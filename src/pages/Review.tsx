import { ChevronLeft, ChevronRight, ThumbsUp, Sprout } from 'lucide-react';
import { useState } from 'react';
import { useProfile, useStore, useTargets, useToday } from '../db/hooks';
import { addDays, formatDay, startOfWeek } from '../lib/dates';
import { dayEnergy } from '../lib/energy';
import { fmt0, fmt1, fmtDuration, fmtSigned1 } from '../lib/format';
import { daySummary, habitScore, kcalMessage, weekSummary } from '../lib/summary';
import { Card, Loading, PageHeader, Segmented, SourceBadge } from '../components/ui';

export default function ReviewPage() {
  const todayKey = useToday();
  const [profile] = useProfile();
  const { targets } = useTargets();
  const logs = useStore('logs');
  const water = useStore('water');
  const workouts = useStore('workouts');
  const activity = useStore('activity');
  const weights = useStore('weights');
  const planStates = useStore('planStates');
  const [tab, setTab] = useState<'day' | 'week'>('day');
  const [day, setDay] = useState(todayKey);
  const [week, setWeek] = useState(startOfWeek(todayKey));
  if (!logs || !water || !workouts || !activity || !weights || !planStates || !targets || !profile) return <Loading />;
  const d = { logs, water, workouts, activity, weights, planStates };

  const nav = (label: string, prev: () => void, next: () => void, canNext: boolean) => (
    <div className="flex items-center justify-between">
      <button className="p-2 rounded-full bg-surface2" onClick={prev} aria-label="Précédent"><ChevronLeft size={18} /></button>
      <div className="font-semibold capitalize">{label}</div>
      <button className="p-2 rounded-full bg-surface2 disabled:opacity-30" onClick={next} disabled={!canNext} aria-label="Suivant"><ChevronRight size={18} /></button>
    </div>
  );

  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Bilans" back />
      <Segmented ariaLabel="Type de bilan" value={tab} onChange={setTab} options={[{ value: 'day', label: 'Jour' }, { value: 'week', label: 'Semaine' }]} />
      {tab === 'day' ? (() => {
        const s = daySummary(day, d);
        const e = dayEnergy(targets.tdee, s.activity);
        const h = habitScore(s, { protein: targets.protein, waterMl: profile.waterGoalMl, steps: profile.stepsGoal });
        const rows: [string, React.ReactNode][] = [
          ['Calories consommées', `${fmt0(s.intake.kcal)} / ${fmt0(targets.kcal)} kcal`],
          ['Dépense énergétique', <span key="e">{fmt0(e.total)} kcal <SourceBadge source={e.method === 'measured' ? 'apple_health_export' : 'estimate'} /></span>],
          ['Protéines', `${fmt0(s.intake.protein)} / ${targets.protein} g`],
          ['Eau', `${fmt1(s.waterMl / 1000)} / ${fmt1(profile.waterGoalMl / 1000)} L`],
          ['Pas', s.steps != null ? fmt0(s.steps) : 'non disponible'],
          ['Activité sportive', s.workouts.length ? s.workouts.map((w) => `${fmtDuration(w.durationSec)}${w.distanceKm ? ` · ${fmt1(w.distanceKm)} km` : ''}`).join(', ') : 'aucune séance'],
          ['Programme alimentaire', `${s.planConsumed} repas sur 3 suivis ou remplacés`],
          ['Poids', s.weightKg != null ? `${fmt1(s.weightKg)} kg` : 'pas de pesée'],
        ];
        return (
          <>
            {nav(formatDay(day, { weekday: true }), () => setDay(addDays(day, -1)), () => setDay(addDays(day, 1)), day < todayKey)}
            <Card>
              <dl className="divide-y divide-line/50">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2 text-[14px]"><dt className="text-muted">{k}</dt><dd className="font-semibold text-right tabular">{v}</dd></div>)}</dl>
              <p className="text-[13px] mt-3">{kcalMessage(s.intake.kcal, targets.kcal)}</p>
            </Card>
            <Card title={`Habitudes : ${h.score} %`}>
              <ul className="space-y-1 text-[14px]">{h.items.map((i) => <li key={i.label} className={i.done ? '' : 'text-muted'}>{i.done ? '✓' : '○'} {i.label}</li>)}</ul>
              <p className="text-[12px] text-muted mt-2">Le score mesure la régularité, pas la perfection : une journée au-dessus de l’objectif n’est pas un échec.</p>
            </Card>
          </>
        );
      })() : (() => {
        const w = weekSummary(week, d, { kcal: targets.kcal, protein: targets.protein, waterMl: profile.waterGoalMl });
        const rows: [string, string][] = [
          ['Poids moyen', w.avgWeight != null ? `${fmt1(w.avgWeight)} kg` : '—'],
          ['Variation du poids moyen', w.weightDelta != null ? `${fmtSigned1(w.weightDelta)} kg vs semaine précédente` : 'pas assez de pesées'],
          ['Séances', String(w.sessions)],
          ['Distance courue', `${fmt1(w.runKm)} km`],
          ['Durée de course', fmtDuration(w.runSec)],
          ['Calories moyennes', w.avgKcal != null ? `${fmt0(w.avgKcal)} kcal (${w.loggedDays} jours notés)` : '—'],
          ['Protéines moyennes', w.avgProtein != null ? `${fmt0(w.avgProtein)} g` : '—'],
          ['Régularité des repas', `${w.mealRegularity} % des jours`],
        ];
        return (
          <>
            {nav(`Semaine du ${formatDay(week)}`, () => setWeek(addDays(week, -7)), () => setWeek(addDays(week, 7)), week < startOfWeek(todayKey))}
            <Card><dl className="divide-y divide-line/50">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2 text-[14px]"><dt className="text-muted">{k}</dt><dd className="font-semibold text-right tabular">{v}</dd></div>)}</dl></Card>
            <Card title={<span className="flex items-center gap-2"><ThumbsUp size={16} className="text-good" />Points positifs</span>}>
              <ul className="space-y-1.5 text-[14px]">{w.positives.map((p) => <li key={p}>{p}</li>)}</ul>
            </Card>
            {w.improvements.length > 0 && (
              <Card title={<span className="flex items-center gap-2"><Sprout size={16} className="text-info" />Pistes pour la semaine prochaine</span>}>
                <ul className="space-y-1.5 text-[14px]">{w.improvements.map((p) => <li key={p}>{p}</li>)}</ul>
              </Card>
            )}
          </>
        );
      })()}
    </div>
  );
}

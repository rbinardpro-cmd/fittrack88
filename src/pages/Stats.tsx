import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useStore, useTargets, useToday } from '../db/hooks';
import { addDays, formatDay, rangeDays, startOfWeek } from '../lib/dates';
import { dayEnergy } from '../lib/energy';
import { fmt0, fmt1, fmtDuration } from '../lib/format';
import { daySummary, weekSummary } from '../lib/summary';
import { C, ChartCard, LegendDot, TimeChart } from '../components/charts';
import { Card, Loading, PageHeader, Segmented } from '../components/ui';

export default function StatsPage() {
  const todayKey = useToday();
  const [profile] = useProfile();
  const { targets } = useTargets();
  const logs = useStore('logs');
  const water = useStore('water');
  const workouts = useStore('workouts');
  const activity = useStore('activity');
  const weights = useStore('weights');
  const planStates = useStore('planStates');
  const [range, setRange] = useState<'7' | '30' | '90'>('30');

  const data = useMemo(() => {
    if (!logs || !water || !workouts || !activity || !weights || !planStates || !targets || !profile) return null;
    const d = { logs, water, workouts, activity, weights, planStates };
    const days = rangeDays(addDays(todayKey, -Number(range) + 1), todayKey).map((k) => {
      const s = daySummary(k, d);
      const e = dayEnergy(targets.tdee, s.activity);
      return { date: k, kcal: s.logged ? Math.round(s.intake.kcal) : null, protein: s.logged ? Math.round(s.intake.protein) : null, expenditure: e.method === 'measured' ? e.total : null, waterL: s.waterMl ? Math.round(s.waterMl / 100) / 10 : null, logged: s.mealsLogged >= 2, trained: s.workouts.length > 0 };
    });
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(startOfWeek(todayKey), -7 * (7 - i))).map((w) => weekSummary(w, d, { kcal: targets.kcal, protein: targets.protein, waterMl: profile.waterGoalMl }));
    return { days, weeks };
  }, [logs, water, workouts, activity, weights, planStates, targets, profile, range, todayKey]);

  if (!data || !targets || !profile) return <Loading />;
  const fmtD = (d: string) => formatDay(d);
  const logged = data.days.filter((d) => d.kcal != null);
  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Statistiques" back subtitle={<span>Voir aussi : <Link className="text-accent" to="/poids">poids</Link> · <Link className="text-accent" to="/course">course</Link> · <Link className="text-accent" to="/activite">pas</Link> · <Link className="text-accent" to="/sommeil">sommeil</Link></span>} />
      <Segmented ariaLabel="Période" value={range} onChange={setRange} options={[{ value: '7', label: '7 jours' }, { value: '30', label: '30 jours' }, { value: '90', label: '90 jours' }]} />

      <ChartCard title="Calories consommées et objectif" subtitle="Jours sans journal non affichés." legend={<><LegendDot color={C.accent} label="Consommées" /><LegendDot color={C.muted} dashed label="Objectif" /></>} rows={logged} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'kcal', label: 'kcal' }]}>
        <TimeChart data={logged} xKey="date" series={[{ key: 'kcal', name: 'Consommées', type: 'bar', color: C.accent }]} refs={[{ y: targets.kcal, label: `${fmt0(targets.kcal)}` }]} fmtX={fmtD} fmtValue={(v) => `${fmt0(v)} kcal`} yDomain={[0, 'auto']} />
      </ChartCard>
      <ChartCard title="Protéines et objectif (g)" legend={<><LegendDot color={C.accent} label="Consommées" /><LegendDot color={C.muted} dashed label="Objectif" /></>} rows={logged} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'protein', label: 'g' }]}>
        <TimeChart data={logged} xKey="date" series={[{ key: 'protein', name: 'Protéines', type: 'bar', color: C.accent }]} refs={[{ y: targets.protein, label: `${targets.protein} g` }]} fmtX={fmtD} fmtValue={(v) => `${fmt0(v)} g`} yDomain={[0, 'auto']} />
      </ChartCard>
      <ChartCard title="Apports et dépense énergétique (kcal)" subtitle={`Dépense mesurée (Apple Santé : repos + actives). Sans import, ta dépense estimée est de ${fmt0(targets.tdee)} kcal/j (ligne pointillée).`} legend={<><LegendDot color={C.accent} label="Apports" /><LegendDot color={C.info} label="Dépense mesurée" /><LegendDot color={C.muted} dashed label="Dépense estimée" /></>} rows={data.days.filter((d) => d.kcal != null || d.expenditure != null)} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'kcal', label: 'Apports' }, { key: 'expenditure', label: 'Dépense mesurée' }]}>
        <TimeChart data={data.days} xKey="date" series={[{ key: 'kcal', name: 'Apports', type: 'bar', color: C.accent }, { key: 'expenditure', name: 'Dépense mesurée', type: 'line', color: C.info, dots: true }]} refs={[{ y: targets.tdee, label: 'estimée' }]} fmtX={fmtD} fmtValue={(v) => `${fmt0(v)} kcal`} yDomain={[0, 'auto']} />
      </ChartCard>
      <ChartCard title="Eau (L)" rows={data.days.filter((d) => d.waterL != null)} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'waterL', label: 'Litres', format: (v) => fmt1(Number(v)) }]}>
        <TimeChart data={data.days} xKey="date" series={[{ key: 'waterL', name: 'Eau', type: 'bar', color: C.info }]} refs={[{ y: profile.waterGoalMl / 1000, label: 'objectif' }]} fmtX={fmtD} fmtValue={(v) => `${fmt1(v)} L`} yDomain={[0, 'auto']} />
      </ChartCard>

      <Card title="Régularité">
        <div className="flex flex-wrap gap-1" role="list" aria-label="Régularité par jour">
          {data.days.map((d) => (
            <div key={d.date} role="listitem" title={`${formatDay(d.date)} : ${d.logged ? 'journal rempli' : 'journal incomplet'}${d.trained ? ', séance faite' : ''}`}
              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${d.logged ? 'bg-accent/80 text-white' : 'bg-surface2 text-muted'}`}>
              {d.trained ? '●' : Number(d.date.slice(8))}
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted mt-2">Case colorée : au moins 2 repas notés. ● : séance réalisée. {data.days.filter((d) => d.logged).length} jours notés et {data.days.filter((d) => d.trained).length} jours d’entraînement sur {data.days.length}.</p>
      </Card>

      <Card title="Comparaison des semaines">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[13px] tabular min-w-[520px]">
            <thead className="text-muted text-left"><tr>{['Semaine du', 'Poids moy.', 'kcal moy.', 'Prot. moy.', 'Séances', 'Course', 'Journal'].map((h) => <th key={h} className="font-medium py-1 pr-2">{h}</th>)}</tr></thead>
            <tbody>
              {[...data.weeks].reverse().map((w) => (
                <tr key={w.from} className="border-t border-line/60">
                  <td className="py-1.5 pr-2">{formatDay(w.from)}</td>
                  <td className="pr-2">{w.avgWeight != null ? fmt1(w.avgWeight) : '—'}</td>
                  <td className="pr-2">{w.avgKcal != null ? fmt0(w.avgKcal) : '—'}</td>
                  <td className="pr-2">{w.avgProtein != null ? `${fmt0(w.avgProtein)} g` : '—'}</td>
                  <td className="pr-2">{w.sessions}</td>
                  <td className="pr-2">{w.runSec ? `${fmtDuration(w.runSec)}${w.runKm ? ` · ${fmt1(w.runKm)} km` : ''}` : '—'}</td>
                  <td>{w.loggedDays}/7</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

import { Pencil, Trash2, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { put, remove } from '../db/db';
import { useProfile, useStore, useToday } from '../db/hooks';
import { addDays, formatDay, isDayKey, nowTime, startOfWeek } from '../lib/dates';
import { fmt1, fmtKg, fmtSigned1, uid } from '../lib/format';
import type { WeightEntry } from '../lib/types';
import { computeProgress, dailyWeights, forecastGoal, projectionSeries, rollingAverage, weeklyAverages } from '../lib/weight';
import { C, ChartCard, LegendDot, TimeChart } from '../components/charts';
import { Card, Empty, Field, Loading, Notice, PageHeader, parseNum, Segmented, Sheet, SourceBadge } from '../components/ui';
import { toast } from '../components/toast';

type Period = '7' | '30' | '90' | 'all';

export function WeightQuickAdd({ onDone, defaultKg, entry }: { onDone: () => void; defaultKg?: number; entry?: WeightEntry }) {
  const todayKey = useToday();
  const [date, setDate] = useState(entry?.date ?? todayKey);
  const [time, setTime] = useState(entry?.time ?? nowTime());
  const [kg, setKg] = useState(entry ? String(entry.kg).replace('.', ',') : defaultKg ? String(Math.round(defaultKg * 10) / 10).replace('.', ',') : '');
  const [note, setNote] = useState(entry?.note ?? '');
  const value = parseNum(kg);
  const valid = value != null && value >= 30 && value <= 350 && isDayKey(date) && date <= todayKey;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        await put('weights', { id: entry?.id ?? uid(), date, time, kg: Math.round(value! * 10) / 10, source: entry?.source ?? 'manual', note: note.trim() || undefined });
        toast(entry ? 'Pesée modifiée' : 'Pesée enregistrée');
        onDone();
      }}
    >
      <Field label="Poids (kg)">
        <input className="input text-2xl font-bold h-14 tabular" inputMode="decimal" autoFocus value={kg} onChange={(e) => setKg(e.target.value)} placeholder="118,4" aria-invalid={kg !== '' && !valid} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className="input" value={date} max={todayKey} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Heure"><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <Field label="Note (facultatif)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. après un repas salé" /></Field>
      {kg !== '' && !valid && <p className="text-[13px] text-warn">Indique un poids entre 30 et 350 kg et une date qui n’est pas dans le futur.</p>}
      <p className="text-[12px] text-muted">Conseil : pèse-toi dans les mêmes conditions (le matin, à jeun, après être passé aux toilettes) pour des données comparables.</p>
      <button className="btn-primary w-full" disabled={!valid}>{entry ? 'Enregistrer' : 'Ajouter la pesée'}</button>
    </form>
  );
}

export default function WeightPage() {
  const todayKey = useToday();
  const [profile] = useProfile();
  const weights = useStore('weights');
  const [period, setPeriod] = useState<Period>('90');
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const [adding, setAdding] = useState(false);

  const view = useMemo(() => {
    if (!weights || !profile) return null;
    const daily = rollingAverage(dailyWeights(weights));
    const from = period === 'all' ? '0000-00-00' : addDays(todayKey, -Number(period));
    const fc = forecastGoal(weights, profile.goalWeightKg, todayKey);
    const proj = projectionSeries(fc, todayKey, profile.goalWeightKg);
    const rows: Record<string, unknown>[] = daily
      .filter((p) => p.date >= from)
      .map((p) => ({ date: p.date, kg: Math.round(p.kg * 10) / 10, avg: Math.round(p.avg * 10) / 10 }));
    const projRows = proj.slice(1).map((p) => ({ date: p.date, central: p.central, low: p.low, high: p.high }));
    if (rows.length && proj.length) Object.assign(rows[rows.length - 1], { central: proj[0].central, low: proj[0].low, high: proj[0].high });
    const weeks = weeklyAverages(dailyWeights(weights), startOfWeek).reverse();
    const sorted = [...weights].sort((a, b) => (a.date + (a.time ?? '') < b.date + (b.time ?? '') ? 1 : -1));
    const cur = daily.length ? daily[daily.length - 1].kg : profile.startWeightKg;
    return { rows, projRows, fc, weeks, sorted, progress: computeProgress(profile.startWeightKg, cur, profile.goalWeightKg) };
  }, [weights, profile, period, todayKey]);

  if (!view || !profile) return <Loading />;
  const showProj = period === 'all' || period === '90';
  const chartData: Record<string, unknown>[] = showProj ? [...view.rows, ...view.projRows] : view.rows;

  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Poids" back subtitle={`${fmt1(view.progress.lostKg)} kg perdus · ${fmt1(view.progress.progressPct)} % vers ${profile.goalWeightKg} kg`} action={<button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Scale size={16} />Pesée</button>} />
      <Segmented ariaLabel="Période" value={period} onChange={setPeriod} options={[{ value: '7', label: '7 j' }, { value: '30', label: '30 j' }, { value: '90', label: '90 j' }, { value: 'all', label: 'Depuis le début' }]} />
      <ChartCard
        title="Poids dans le temps"
        subtitle={showProj && view.projRows.length ? 'La zone colorée est une fourchette indicative, pas une promesse.' : undefined}
        legend={<><LegendDot color={C.accent} label="Pesées" /><LegendDot color={C.ink} label="Moyenne 7 j" />{showProj && view.projRows.length > 0 && <LegendDot color={C.accent} dashed label="Projection" />}<LegendDot color={C.muted} dashed label="Objectif" /></>}
        rows={view.rows}
        columns={[{ key: 'date', label: 'Date', format: (v) => formatDay(String(v), { year: true }) }, { key: 'kg', label: 'Poids (kg)', format: (v) => fmt1(Number(v)) }, { key: 'avg', label: 'Moy. 7 j', format: (v) => fmt1(Number(v)) }]}
      >
        <TimeChart
          data={chartData}
          xKey="date"
          series={[
            { key: 'kg', name: 'Pesée', type: 'line', color: C.accent, dots: true },
            { key: 'avg', name: 'Moyenne 7 j', type: 'line', color: C.ink },
            ...(showProj ? [{ key: 'central', name: 'Projection', type: 'line' as const, color: C.accent, dashed: true }] : []),
          ]}
          band={showProj ? { low: 'low', high: 'high', name: 'Fourchette' } : undefined}
          refs={[{ y: profile.goalWeightKg, label: `Objectif ${profile.goalWeightKg} kg` }]}
          fmtX={(d) => formatDay(d)}
          fmtValue={(v) => fmtKg(v)}
          yDomain={[(min: number) => Math.floor(Math.min(min, profile.goalWeightKg) - 1), (max: number) => Math.ceil(max + 1)]}
        />
      </ChartCard>

      <Card title="Tendance et estimation">
        {view.fc.status === 'ok' ? (
          <div className="text-[14px] space-y-1">
            <div>Tendance récente : <b className="tabular">{fmtSigned1(view.fc.trendKgPerWeek!)} kg/semaine</b> (sur {view.fc.windowDays} jours).</div>
            <div>Objectif estimé vers le <b>{formatDay(view.fc.dateCentral!, { year: true })}</b>.</div>
            <div className="text-muted">Fourchette : du {formatDay(view.fc.dateEarly!, { year: true })} {view.fc.dateLate ? `au ${formatDay(view.fc.dateLate, { year: true })}` : 'à une date encore trop incertaine'}.</div>
          </div>
        ) : (
          <p className="text-[14px] text-muted">{view.fc.message}</p>
        )}
        <div className="mt-3"><Notice>Une hausse d’un jour à l’autre n’est pas une prise de graisse : l’eau, le sel, le glycogène et le contenu digestif font varier le poids de 0,5 à 2 kg. C’est la tendance sur plusieurs semaines qui compte.</Notice></div>
      </Card>

      {view.weeks.length > 0 && (
        <Card title="Moyennes hebdomadaires">
          <table className="w-full text-[14px] tabular">
            <thead><tr className="text-left text-muted text-[12px]"><th className="font-medium py-1">Semaine du</th><th className="font-medium">Moyenne</th><th className="font-medium">Variation</th><th className="font-medium">Pesées</th></tr></thead>
            <tbody>
              {view.weeks.slice(0, 12).map((w, i) => {
                const prev = view.weeks[i + 1];
                return (
                  <tr key={w.week} className="border-t border-line/60">
                    <td className="py-1.5">{formatDay(w.week)}</td>
                    <td>{fmtKg(w.avg)}</td>
                    <td className={prev && w.avg < prev.avg ? 'text-good' : ''}>{prev ? fmtSigned1(w.avg - prev.avg) : '—'}</td>
                    <td className="text-muted">{w.n}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Historique des pesées">
        {view.sorted.length === 0 ? (
          <Empty icon={<Scale size={18} />} title="Aucune pesée" text={`Le suivi part de ton poids de départ (${profile.startWeightKg} kg).`} action={<button className="btn-primary" onClick={() => setAdding(true)}>Ajouter une pesée</button>} />
        ) : (
          <ul className="divide-y divide-line/60">
            {view.sorted.map((w) => (
              <li key={w.id} className="flex items-center gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold tabular">{fmtKg(w.kg)}</div>
                  <div className="text-[12px] text-muted">{formatDay(w.date, { weekday: true, year: true })}{w.time ? ` · ${w.time}` : ''}{w.note ? ` · ${w.note}` : ''}</div>
                </div>
                <SourceBadge source={w.source} />
                <button className="p-2 rounded-lg hover:bg-surface2" onClick={() => setEditing(w)} aria-label={`Modifier la pesée du ${formatDay(w.date)}`}><Pencil size={16} /></button>
                <button
                  className="p-2 rounded-lg hover:bg-surface2 text-muted"
                  aria-label={`Supprimer la pesée du ${formatDay(w.date)}`}
                  onClick={async () => {
                    await remove('weights', w.id);
                    toast('Pesée supprimée', { undo: () => put('weights', w) });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Nouvelle pesée">
        <WeightQuickAdd onDone={() => setAdding(false)} defaultKg={view.sorted[0]?.kg ?? profile.startWeightKg} />
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Modifier la pesée">
        {editing && <WeightQuickAdd entry={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

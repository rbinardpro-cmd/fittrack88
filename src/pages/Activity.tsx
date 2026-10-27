import { Plus, Pencil, Trash2, Moon, Footprints } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { put, remove } from '../db/db';
import { useProfile, useStore, useToday } from '../db/hooks';
import { addDays, formatDay, isDayKey } from '../lib/dates';
import { fmt0, fmt1, fmtDuration } from '../lib/format';
import type { DailyActivity } from '../lib/types';
import { C, ChartCard, TimeChart } from '../components/charts';
import { Card, Empty, Field, Loading, PageHeader, parseNum, Segmented, Sheet, SourceBadge } from '../components/ui';
import { toast } from '../components/toast';

export default function ActivityPage({ focus }: { focus?: 'sleep' }) {
  const todayKey = useToday();
  const [profile] = useProfile();
  const activity = useStore('activity');
  const sync = useStore('sync');
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [edit, setEdit] = useState<DailyActivity | 'new' | null>(null);
  const rows = useMemo(() => (activity ?? []).filter((a) => a.id >= addDays(todayKey, -Number(range) + 1)).sort((a, b) => (a.id < b.id ? -1 : 1)), [activity, range, todayKey]);
  if (!activity || !profile) return <Loading />;
  const last = sync?.find((s) => s.id === 'apple_health');
  const chartRows = rows.map((a) => ({ date: a.id, steps: a.steps ?? null, km: a.distanceKm ?? null, active: a.activeKcal ?? null, total: a.activeKcal != null && a.basalKcal != null ? Math.round(a.activeKcal + a.basalKcal) : null, sleepH: a.sleepMin != null ? Math.round(a.sleepMin / 6) / 10 : null, ex: a.exerciseMin ?? null }));
  const fmtD = (d: string) => formatDay(d);
  const sleepRows = chartRows.filter((r) => r.sleepH != null);
  const sleepBlock = (
    <ChartCard title="Sommeil (heures)" subtitle={sleepRows.length ? undefined : 'Disponible si le suivi du sommeil est activé sur l’Apple Watch et importé.'} rows={sleepRows} columns={[{ key: 'date', label: 'Nuit se terminant le', format: (v) => fmtD(String(v)) }, { key: 'sleepH', label: 'Heures', format: (v) => fmt1(Number(v)) }]}>
      <TimeChart data={sleepRows} xKey="date" series={[{ key: 'sleepH', name: 'Sommeil', type: 'bar', color: C.info }]} fmtX={fmtD} fmtValue={(v) => fmtDuration(v * 3600)} yDomain={[0, 'auto']} />
    </ChartCard>
  );
  return (
    <div className="space-y-4 fade-in">
      <PageHeader title={focus === 'sleep' ? 'Sommeil' : 'Activité quotidienne'} back action={<button className="btn-primary btn-sm" onClick={() => setEdit('new')}><Plus size={16} />Saisir</button>} />
      <Card>
        <p className="text-[13px]">{last ? <>Dernier import Apple Santé : <b>{new Date(last.lastAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</b>.</> : 'Aucun import Apple Santé pour le moment.'} <Link to="/donnees" className="text-accent font-semibold">Importer</Link></p>
        <p className="text-[12px] text-muted mt-1">Les données ne se mettent pas à jour toutes seules : une application web n’a pas accès à Apple Santé. Importe ton export quand tu veux rafraîchir, ou saisis les valeurs à la main.</p>
      </Card>
      <Segmented ariaLabel="Période" value={range} onChange={setRange} options={[{ value: '7', label: '7 j' }, { value: '30', label: '30 j' }, { value: '90', label: '90 j' }]} />
      {focus === 'sleep' && sleepBlock}
      <ChartCard title="Pas quotidiens" rows={chartRows.filter((r) => r.steps != null)} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'steps', label: 'Pas', format: (v) => fmt0(Number(v)) }]}>
        <TimeChart data={chartRows} xKey="date" series={[{ key: 'steps', name: 'Pas', type: 'bar', color: C.accent }]} refs={[{ y: profile.stepsGoal, label: `Objectif ${fmt0(profile.stepsGoal)}` }]} fmtX={fmtD} fmtValue={(v) => fmt0(v)} yDomain={[0, 'auto']} />
      </ChartCard>
      <ChartCard title="Dépense énergétique mesurée (kcal)" subtitle="Repos + actives, quand Apple Santé fournit les deux." rows={chartRows.filter((r) => r.total != null)} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'total', label: 'Totale' }, { key: 'active', label: 'Actives' }]}>
        <TimeChart data={chartRows.filter((r) => r.total != null)} xKey="date" series={[{ key: 'total', name: 'Totale', type: 'line', color: C.accent, dots: true }]} fmtX={fmtD} fmtValue={(v) => `${fmt0(v)} kcal`} />
      </ChartCard>
      {focus !== 'sleep' && sleepBlock}

      <Card title="Historique">
        {rows.length === 0 ? <Empty icon={<Footprints size={18} />} title="Aucune donnée sur la période" /> : (
          <ul className="divide-y divide-line/50">
            {[...rows].reverse().map((a) => (
              <li key={a.id} className="py-2 flex items-center gap-2">
                <button className="flex-1 min-w-0 text-left" onClick={() => setEdit(a)}>
                  <div className="text-[14px] font-semibold">{formatDay(a.id, { weekday: true })}</div>
                  <div className="text-[12px] text-muted tabular flex flex-wrap gap-x-3">
                    {a.steps != null && <span>{fmt0(a.steps)} pas</span>}
                    {a.distanceKm != null && <span>{fmt1(a.distanceKm)} km</span>}
                    {a.activeKcal != null && <span>{fmt0(a.activeKcal)} kcal act.</span>}
                    {a.exerciseMin != null && <span>{fmt0(a.exerciseMin)} min exercice</span>}
                    {a.sleepMin != null && <span><Moon size={11} className="inline" /> {fmtDuration(a.sleepMin * 60)}</span>}
                  </div>
                </button>
                <SourceBadge source={a.source} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Activité du jour">
        {edit && <ActivityForm entry={edit === 'new' ? undefined : edit} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  );
}

function ActivityForm({ entry, onDone }: { entry?: DailyActivity; onDone: () => void }) {
  const todayKey = useToday();
  const s = (n?: number) => (n == null ? '' : String(n).replace('.', ','));
  const [date, setDate] = useState(entry?.id ?? todayKey);
  const [v, setV] = useState({ steps: s(entry?.steps), distanceKm: s(entry?.distanceKm), activeKcal: s(entry?.activeKcal), basalKcal: s(entry?.basalKcal), exerciseMin: s(entry?.exerciseMin), sleepH: entry?.sleepMin != null ? s(Math.round(entry.sleepMin / 6) / 10) : '' });
  const n = (x: string) => (x.trim() ? parseNum(x) ?? NaN : undefined);
  const vals = { steps: n(v.steps), distanceKm: n(v.distanceKm), activeKcal: n(v.activeKcal), basalKcal: n(v.basalKcal), exerciseMin: n(v.exerciseMin), sleepH: n(v.sleepH) };
  const invalid = Object.values(vals).some((x) => x != null && (!isFinite(x) || x < 0)) || (vals.sleepH ?? 0) > 24 || !isDayKey(date);
  const fields: [keyof typeof v, string][] = [['steps', 'Pas'], ['distanceKm', 'Distance (km)'], ['activeKcal', 'Calories actives'], ['basalKcal', 'Calories au repos'], ['exerciseMin', 'Exercice (min)'], ['sleepH', 'Sommeil (h)']];
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      if (invalid) return;
      await put('activity', { ...(entry ?? {}), id: date, steps: vals.steps, distanceKm: vals.distanceKm, activeKcal: vals.activeKcal, basalKcal: vals.basalKcal, exerciseMin: vals.exerciseMin, sleepMin: vals.sleepH != null ? Math.round(vals.sleepH * 60) : undefined, source: 'manual', importedAt: Date.now() });
      toast('Activité enregistrée');
      onDone();
    }}>
      {entry && entry.source !== 'manual' && <p className="text-[12px] text-muted">Données importées : une modification les passe en « saisie manuelle ».</p>}
      <Field label="Date"><input type="date" className="input" value={date} max={todayKey} disabled={!!entry} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([k, l]) => <Field key={k} label={l}><input className="input tabular" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={invalid}><Pencil size={16} />Enregistrer</button>
        {entry && <button type="button" className="btn-danger" aria-label="Supprimer" onClick={async () => { await remove('activity', entry.id); toast('Supprimé', { undo: () => put('activity', entry) }); onDone(); }}><Trash2 size={16} /></button>}
      </div>
    </form>
  );
}

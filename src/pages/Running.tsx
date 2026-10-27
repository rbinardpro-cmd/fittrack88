import { Plus, Check, Moon, ChevronRight, AlertTriangle, Pencil, Trash2, Watch, Copy, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { put, putMany, remove } from '../db/db';
import { useProfile, useRunPlan, useStore, useToday } from '../db/hooks';
import { addDays, dayName, diffDays, formatDay, isDayKey, startOfWeek } from '../lib/dates';
import { fmt0, fmt1, fmtDuration, fmtPace, uid } from '../lib/format';
import { assessTolerance, describeBlock, flattenSession, paceSecPerKm, parseDuration, sessionTotals, speedKmh, WORKOUT_TYPES } from '../lib/running';
import type { IntervalBlock, RunSession, Workout, WorkoutType } from '../lib/types';
import { C, ChartCard, TimeChart } from '../components/charts';
import { Card, Empty, Field, Loading, Notice, PageHeader, parseNum, Segmented, Sheet, SourceBadge } from '../components/ui';
import { toast } from '../components/toast';
import { IntervalTimer } from '../components/IntervalTimer';

const SAFETY = 'En cas de douleur au genou, d’aggravation d’une douleur articulaire, de douleur thoracique, d’essoufflement inhabituel ou de malaise : arrête la séance et fais-toi examiner (médecin, kinésithérapeute) avant de reprendre.';

export function sessionDate(start: string, s: RunSession) {
  return addDays(start, (s.week - 1) * 7 + s.dayOffset);
}

export default function RunningPage() {
  const todayKey = useToday();
  const [profile, updateProfile] = useProfile();
  const plan = useRunPlan();
  const workouts = useStore('workouts');
  const [tab, setTab] = useState<'plan' | 'history' | 'progress'>('plan');
  if (!profile || !plan || !workouts) return <Loading />;
  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Course à pied" subtitle="Reprise progressive, à ton rythme" action={<Link to="/course/saisie" className="btn-primary btn-sm"><Plus size={16} />Séance</Link>} />
      <Segmented ariaLabel="Section" value={tab} onChange={setTab} options={[{ value: 'plan', label: 'Programme' }, { value: 'history', label: 'Historique' }, { value: 'progress', label: 'Progression' }]} />
      {tab === 'plan' && <PlanView plan={plan} workouts={workouts} start={profile.runPlanStart} todayKey={todayKey} setStart={(d) => updateProfile({ runPlanStart: d })} />}
      {tab === 'history' && <History workouts={workouts} />}
      {tab === 'progress' && <Progress workouts={workouts} todayKey={todayKey} />}
    </div>
  );
}

function PlanView({ plan, workouts, start, todayKey, setStart }: { plan: RunSession[]; workouts: Workout[]; start: string; todayKey: string; setStart: (d: string) => void }) {
  const weeks = [...new Set(plan.map((s) => s.week))].sort((a, b) => a - b);
  const curWeek = Math.max(1, Math.min(weeks[weeks.length - 1], Math.floor(diffDays(start, todayKey) / 7) + 1));
  const weekStart = (w: number) => addDays(start, (w - 1) * 7);
  const curWorkouts = workouts.filter((w) => w.date >= weekStart(curWeek) && w.date < weekStart(curWeek + 1) && (w.type === 'course' || w.type === 'course_marche'));
  const tol = assessTolerance(curWorkouts);

  async function addWeek() {
    const last = weeks[weeks.length - 1];
    const copy = plan.filter((s) => s.week === last).map((s) => ({ ...s, id: uid(), week: last + 1, title: s.title.replace(/Semaine \d+/, `Semaine ${last + 1}`) }));
    await putMany('runPlan', [...plan, ...copy]);
    toast(`Semaine ${last + 1} ajoutée (copie de la semaine ${last}, à ajuster)`);
  }

  return (
    <div className="space-y-4">
      {todayKey < start && (
        <Notice>Le programme commence le {formatDay(start, { weekday: true })} <button className="font-semibold text-accent" onClick={() => setStart(todayKey)}>Commencer aujourd’hui</button> (la séance 1 tombe alors aujourd’hui, avec toujours un jour de repos entre deux séances).</Notice>
      )}
      <Notice tone="warn"><AlertTriangle size={14} className="inline mr-1" />{SAFETY}</Notice>
      <Card title={todayKey < start ? 'Avant de commencer' : `Semaine en cours : ${curWeek}`}>
        <p className="text-[14px]">{tol.message}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button className="btn-secondary btn-sm" onClick={() => { setStart(addDays(start, 7)); toast('Semaine répétée : le programme est décalé de 7 jours'); }}><RotateCcw size={15} />Répéter cette semaine</button>
          {curWeek === weeks[weeks.length - 1] && <button className="btn-secondary btn-sm" onClick={addWeek}><Copy size={15} />Ajouter une semaine</button>}
        </div>
        <p className="text-[12px] text-muted mt-2">La progression n’est jamais automatique. Le programme ne s’intensifie pas pour « brûler plus de calories ».</p>
      </Card>

      {weeks.map((w) => {
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart(w), i));
        const sessions = plan.filter((s) => s.week === w);
        const done = workouts.filter((x) => x.date >= days[0] && x.date <= days[6] && x.completed);
        const vol = done.reduce((s, x) => s + x.durationSec, 0);
        const km = done.reduce((s, x) => s + (x.distanceKm ?? 0), 0);
        return (
          <Card key={w} title={`Semaine ${w} · dès le ${formatDay(days[0])}`} action={<span className="text-[12px] text-muted tabular">{done.length}/{sessions.length} · {fmtDuration(vol)}{km ? ` · ${fmt1(km)} km` : ''}</span>}>
            <ul className="divide-y divide-line/50">
              {days.map((d, i) => {
                const s = sessions.find((x) => x.dayOffset === i);
                const doneDay = workouts.filter((x) => x.date === d && x.completed);
                const linked = s ? workouts.find((x) => x.plannedSessionId === s.id) : undefined;
                return (
                  <li key={d} className={`flex items-center gap-3 py-2 ${d === todayKey ? 'bg-accent/5 -mx-2 px-2 rounded-lg' : ''}`}>
                    <div className="w-10 text-center shrink-0">
                      <div className="text-[10px] uppercase text-muted font-semibold">{dayName(d).slice(0, 3)}</div>
                      <div className="font-bold tabular">{Number(d.slice(8))}</div>
                    </div>
                    {s ? (
                      <Link to={`/course/seance/${s.id}`} className="flex-1 min-w-0">
                        <div className="font-semibold text-[14px] flex items-center gap-1">{s.title}<ChevronRight size={14} className="text-muted" /></div>
                        <div className="text-[12px] text-muted">{fmtDuration(sessionTotals(s.blocks).totalSec)} · dont {fmtDuration(sessionTotals(s.blocks).runSec)} de course</div>
                      </Link>
                    ) : (
                      <div className="flex-1 text-[13px] text-muted flex items-center gap-1.5"><Moon size={14} />Repos ou marche libre</div>
                    )}
                    {(linked || (s && doneDay.length)) ? <span className="w-7 h-7 rounded-full bg-good text-white flex items-center justify-center" aria-label="Séance faite"><Check size={16} /></span>
                      : !s && doneDay.length ? <span className="text-[11px] text-good font-semibold">{doneDay.length} activité</span>
                      : s && d < todayKey ? <span className="text-[11px] text-muted">non faite</span> : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
      <Card>
        <div className="flex gap-3 items-start">
          <Watch size={20} className="text-accent shrink-0 mt-0.5" />
          <p className="text-[13px] leading-relaxed">Astuce Apple Watch Ultra (gratuit) : dans l’app Exercice, sur « Course en extérieur », touche « … » puis « Créer un exercice › Personnalisé » et reproduis les blocs (échauffement, répétitions course/marche, récupération). La montre te guide par vibrations, et la séance part dans Apple Santé, que tu peux ensuite importer ici.</p>
        </div>
      </Card>
      <p className="text-[12px] text-muted px-1">Début du programme : {formatDay(start, { weekday: true, year: true })}. <label className="inline">Modifier : <input type="date" className="bg-transparent text-accent" value={start} onChange={(e) => isDayKey(e.target.value) && setStart(e.target.value)} /></label></p>
    </div>
  );
}

function History({ workouts }: { workouts: Workout[] }) {
  const nav = useNavigate();
  const list = [...workouts].sort((a, b) => (a.date + (a.startTime ?? '') < b.date + (b.startTime ?? '') ? 1 : -1));
  if (!list.length) return <Empty title="Aucune séance" text="Enregistre ta première séance, ou importe tes entraînements depuis Apple Santé." action={<Link className="btn-primary" to="/course/saisie">Enregistrer une séance</Link>} />;
  return (
    <ul className="space-y-2">
      {list.map((w) => {
        const pace = paceSecPerKm(w.durationSec, w.distanceKm);
        return (
          <li key={w.id} className="card p-3">
            <button className="w-full text-left" onClick={() => nav(`/course/saisie?id=${w.id}`)}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[14px]">{WORKOUT_TYPES[w.type]}{!w.completed && <span className="text-warn"> · interrompue</span>}</div>
                <SourceBadge source={w.source} />
              </div>
              <div className="text-[12px] text-muted">{formatDay(w.date, { weekday: true, year: true })}{w.startTime ? ` · ${w.startTime}` : ''}</div>
              <div className="flex gap-4 mt-1.5 text-[14px] tabular flex-wrap">
                <span>{fmtDuration(w.durationSec)}</span>
                {w.distanceKm != null && <span>{fmt1(w.distanceKm)} km</span>}
                {pace && <span>{fmtPace(pace)}/km</span>}
                {w.avgHr && <span>♥ {w.avgHr}{w.maxHr ? `/${w.maxHr}` : ''} bpm</span>}
                {w.rpe && <span>RPE {w.rpe}/10</span>}
              </div>
              {w.pain && <div className="text-[12px] text-warn mt-1">Douleur : {w.pain}</div>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Progress({ workouts, todayKey }: { workouts: Workout[]; todayKey: string }) {
  const [range, setRange] = useState<'56' | '180' | 'all'>('56');
  const runs = workouts.filter((w) => w.completed && (w.type === 'course' || w.type === 'course_marche') && (range === 'all' || w.date >= addDays(todayKey, -Number(range)))).sort((a, b) => (a.date < b.date ? -1 : 1));
  const perRun = runs.map((w) => ({ date: w.date, min: Math.round(w.durationSec / 60), km: w.distanceKm ?? null, pace: paceSecPerKm(w.durationSec, w.distanceKm) ? Math.round(paceSecPerKm(w.durationSec, w.distanceKm)! / 6) / 10 : null, hr: w.avgHr ?? null, hrMax: w.maxHr ?? null }));
  const weekly = useMemo(() => {
    const m = new Map<string, { week: string; sessions: number; min: number; km: number }>();
    for (const w of runs) {
      const k = startOfWeek(w.date);
      const e = m.get(k) ?? { week: k, sessions: 0, min: 0, km: 0 };
      e.sessions++; e.min += Math.round(w.durationSec / 60); e.km = Math.round((e.km + (w.distanceKm ?? 0)) * 10) / 10;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => (a.week < b.week ? -1 : 1));
  }, [runs]);
  const fmtD = (d: string) => formatDay(d);
  return (
    <div className="space-y-4">
      <Segmented ariaLabel="Période" value={range} onChange={setRange} options={[{ value: '56', label: '8 semaines' }, { value: '180', label: '6 mois' }, { value: 'all', label: 'Tout' }]} />
      <ChartCard title="Volume hebdomadaire (minutes)" rows={weekly} columns={[{ key: 'week', label: 'Semaine du', format: (v) => fmtD(String(v)) }, { key: 'sessions', label: 'Séances' }, { key: 'min', label: 'Minutes' }, { key: 'km', label: 'km' }]}>
        <TimeChart data={weekly} xKey="week" series={[{ key: 'min', name: 'Minutes', type: 'bar', color: C.accent }]} fmtX={fmtD} fmtValue={(v) => `${fmt0(v)} min`} />
      </ChartCard>
      <ChartCard title="Distance par séance (km)" rows={perRun.filter((r) => r.km != null)} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'km', label: 'km', format: (v) => fmt1(Number(v)) }]}>
        <TimeChart data={perRun.filter((r) => r.km != null)} xKey="date" series={[{ key: 'km', name: 'Distance', type: 'bar', color: C.accent }]} fmtX={fmtD} fmtValue={(v) => `${fmt1(v)} km`} />
      </ChartCard>
      <ChartCard title="Durée des séances (min)" rows={perRun} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'min', label: 'Minutes' }]}>
        <TimeChart data={perRun} xKey="date" series={[{ key: 'min', name: 'Durée', type: 'line', color: C.accent, dots: true }]} fmtX={fmtD} fmtValue={(v) => `${fmt0(v)} min`} />
      </ChartCard>
      <ChartCard title="Allure moyenne (min/km)" subtitle="Plus bas = plus rapide. Sur un fractionné course/marche, l’allure inclut la marche." rows={perRun.filter((r) => r.pace != null)} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'pace', label: 'min/km', format: (v) => fmtPace(Number(v) * 60) }]}>
        <TimeChart data={perRun.filter((r) => r.pace != null)} xKey="date" series={[{ key: 'pace', name: 'Allure', type: 'line', color: C.accent, dots: true }]} fmtX={fmtD} fmtValue={(v) => `${fmtPace(v * 60)}/km`} yDomain={['auto', 'auto']} />
      </ChartCard>
      <ChartCard title="Fréquence cardiaque moyenne pendant les séances (bpm)" rows={perRun.filter((r) => r.hr != null)} columns={[{ key: 'date', label: 'Date', format: (v) => fmtD(String(v)) }, { key: 'hr', label: 'Moyenne' }, { key: 'hrMax', label: 'Max' }]}>
        <TimeChart data={perRun.filter((r) => r.hr != null)} xKey="date" series={[{ key: 'hr', name: 'FC moyenne', type: 'line', color: C.accent, dots: true }]} fmtX={fmtD} fmtValue={(v) => `${fmt0(v)} bpm`} />
      </ChartCard>
    </div>
  );
}

export function SessionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [profile] = useProfile();
  const plan = useRunPlan();
  const workouts = useStore('workouts');
  const [editing, setEditing] = useState(false);
  const [timer, setTimer] = useState(false);
  if (!plan || !profile || !workouts) return <Loading />;
  const s = plan.find((x) => x.id === id);
  if (!s) return <div><PageHeader title="Séance" back /><Empty title="Séance introuvable" /></div>;
  const t = sessionTotals(s.blocks);
  const date = sessionDate(profile.runPlanStart, s);
  const linked = workouts.find((w) => w.plannedSessionId === s.id);
  return (
    <div className="space-y-4 fade-in">
      <PageHeader title={s.title} back subtitle={`Prévue le ${formatDay(date, { weekday: true })}`} action={<button className="btn-secondary btn-sm" onClick={() => setEditing(true)}><Pencil size={15} />Modifier</button>} />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card p-3"><div className="text-[11px] text-muted">Durée totale</div><div className="font-bold text-lg tabular">{fmtDuration(t.totalSec)}</div></div>
        <div className="card p-3"><div className="text-[11px] text-muted">Course lente</div><div className="font-bold text-lg tabular text-accent">{fmtDuration(t.runSec)}</div></div>
        <div className="card p-3"><div className="text-[11px] text-muted">Marche</div><div className="font-bold text-lg tabular">{fmtDuration(t.walkSec)}</div></div>
      </div>
      <Card title="Déroulé">
        <ol className="space-y-2">{s.blocks.map((b, i) => <li key={i} className="flex gap-2 text-[14px]"><span className="w-6 h-6 rounded-full bg-surface2 text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>{describeBlock(b)}</li>)}</ol>
        {s.notes && <p className="text-[13px] text-muted mt-2">{s.notes}</p>}
        <p className="text-[13px] text-muted mt-3">« Course lente » : tu dois pouvoir parler en faisant des phrases. Si ce n’est pas le cas, ralentis ou marche.</p>
      </Card>
      <Notice tone="warn"><AlertTriangle size={14} className="inline mr-1" />{SAFETY}</Notice>
      <button className="btn-secondary w-full" onClick={() => setTimer(true)}>Lancer le minuteur d’intervalles</button>
      {linked ? (
        <Link to={`/course/saisie?id=${linked.id}`} className="btn-secondary w-full"><Check size={16} />Séance enregistrée le {formatDay(linked.date)} · voir</Link>
      ) : (
        <button className="btn-primary w-full" onClick={() => nav(`/course/saisie?session=${s.id}&d=${date}`)}><Check size={18} />J’ai fait cette séance</button>
      )}
      <Sheet open={editing} onClose={() => setEditing(false)} title="Modifier la séance">
        {editing && <SessionEditor session={s} plan={plan} onDone={() => setEditing(false)} />}
      </Sheet>
      <Sheet open={timer} onClose={() => setTimer(false)} title={s.title}>
        {timer && <IntervalTimer steps={flattenSession(s.blocks)} />}
      </Sheet>
    </div>
  );
}

function SessionEditor({ session, plan, onDone }: { session: RunSession; plan: RunSession[]; onDone: () => void }) {
  const warm = session.blocks.find((b) => b.kind === 'walk');
  const rep = session.blocks.find((b) => b.kind === 'repeat') as Extract<IntervalBlock, { kind: 'repeat' }> | undefined;
  const cool = [...session.blocks].reverse().find((b) => b.kind === 'walk');
  const [w, setW] = useState(String((warm && 'sec' in warm ? warm.sec : 300) / 60).replace('.', ','));
  const [times, setTimes] = useState(String(rep?.times ?? 6));
  const [run, setRun] = useState(String((rep?.runSec ?? 60) / 60).replace('.', ','));
  const [walk, setWalk] = useState(String((rep?.walkSec ?? 120) / 60).replace('.', ','));
  const [c, setC] = useState(String((cool && 'sec' in cool ? cool.sec : 120) / 60).replace('.', ','));
  const [day, setDay] = useState(session.dayOffset);
  const v = [w, run, walk, c].map((x) => parseNum(x));
  const n = parseNum(times);
  const valid = v.every((x) => x != null && x >= 0 && x <= 60) && n != null && n >= 1 && n <= 20 && (v[1] ?? 0) > 0;
  const blocks: IntervalBlock[] = valid ? [
    { kind: 'walk', label: 'Marche active (échauffement)', sec: Math.round(v[0]! * 60) },
    { kind: 'repeat', times: Math.round(n!), runSec: Math.round(v[1]! * 60), walkSec: Math.round(v[2]! * 60) },
    { kind: 'walk', label: 'Marche tranquille (retour au calme)', sec: Math.round(v[3]! * 60) },
  ] : [];
  const sameWeekDays = plan.filter((x) => x.week === session.week && x.id !== session.id).map((x) => x.dayOffset);
  const restOk = sameWeekDays.every((d) => Math.abs(d - day) >= 2);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Échauffement (min de marche)"><input className="input tabular" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /></Field>
        <Field label="Répétitions"><input className="input tabular" inputMode="numeric" value={times} onChange={(e) => setTimes(e.target.value)} /></Field>
        <Field label="Course lente (min)"><input className="input tabular" inputMode="decimal" value={run} onChange={(e) => setRun(e.target.value)} /></Field>
        <Field label="Marche entre (min)"><input className="input tabular" inputMode="decimal" value={walk} onChange={(e) => setWalk(e.target.value)} /></Field>
        <Field label="Retour au calme (min)"><input className="input tabular" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} /></Field>
        <Field label="Jour"><select className="input" value={day} onChange={(e) => setDay(Number(e.target.value))}>{['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
      </div>
      {valid && <p className="text-[14px]">Durée totale : <b className="tabular">{fmtDuration(sessionTotals(blocks).totalSec)}</b>, dont {fmtDuration(sessionTotals(blocks).runSec)} de course.</p>}
      {!restOk && <Notice tone="warn">Garde au moins un jour de repos entre deux séances de course.</Notice>}
      <button className="btn-primary w-full" disabled={!valid} onClick={async () => {
        const next = plan.map((x) => (x.id === session.id ? { ...x, blocks, dayOffset: day, notes: undefined } : x));
        await putMany('runPlan', next);
        toast('Séance modifiée');
        onDone();
      }}>Enregistrer</button>
    </div>
  );
}

export function WorkoutForm() {
  const todayKey = useToday();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const workouts = useStore('workouts');
  const plan = useRunPlan();
  const editId = params.get('id');
  const existing = workouts?.find((w) => w.id === editId);
  if (!workouts || !plan) return <Loading />;
  if (editId && !existing) return <div><PageHeader title="Séance" back /><Empty title="Séance introuvable" /></div>;
  const sessionId = params.get('session') ?? undefined;
  const session = plan.find((s) => s.id === sessionId);
  const d = params.get('d');
  return <WorkoutFormInner key={editId ?? 'new'} existing={existing} session={session} defaultDate={isDayKey(d) && d <= todayKey ? d : todayKey} onDone={() => nav(-1)} />;
}

function WorkoutFormInner({ existing, session, defaultDate, onDone }: { existing?: Workout; session?: RunSession; defaultDate: string; onDone: () => void }) {
  const todayKey = useToday();
  const s = (n?: number) => (n == null ? '' : String(n).replace('.', ','));
  const [date, setDate] = useState(existing?.date ?? defaultDate);
  const [time, setTime] = useState(existing?.startTime ?? '');
  const [type, setType] = useState<WorkoutType>(existing?.type ?? (session ? 'course_marche' : 'course'));
  const [dur, setDur] = useState(existing ? fmtClock(existing.durationSec) : session ? fmtClock(sessionTotals(session.blocks).totalSec) : '');
  const [dist, setDist] = useState(s(existing?.distanceKm));
  const [avgHr, setAvgHr] = useState(s(existing?.avgHr));
  const [maxHr, setMaxHr] = useState(s(existing?.maxHr));
  const [kcal, setKcal] = useState(s(existing?.activeKcal));
  const [elev, setElev] = useState(s(existing?.elevationM));
  const [rpe, setRpe] = useState(existing?.rpe ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [pain, setPain] = useState(existing?.pain ?? '');
  const [completed, setCompleted] = useState(existing?.completed ?? true);
  const sec = parseDuration(dur);
  const km = parseNum(dist);
  const errors: string[] = [];
  if (!sec || sec <= 0 || sec > 24 * 3600) errors.push('Durée invalide (ex. 25:30 ou 26).');
  if (dist && (km == null || km < 0 || km > 300)) errors.push('Distance invalide.');
  for (const [l, v, lo, hi] of [['FC moyenne', avgHr, 30, 230], ['FC max', maxHr, 30, 240], ['Calories', kcal, 0, 5000], ['Dénivelé', elev, 0, 10000]] as const) {
    const n = parseNum(v);
    if (v && (n == null || n < lo || n > hi)) errors.push(`${l} invalide.`);
  }
  if (!isDayKey(date) || date > todayKey) errors.push('Date invalide.');
  const pace = sec && km ? paceSecPerKm(sec, km) : null;
  const speed = sec && km ? speedKmh(sec, km) : null;

  return (
    <div className="space-y-4 fade-in">
      <PageHeader title={existing ? 'Modifier la séance' : 'Nouvelle séance'} back subtitle={session ? session.title : undefined} />
      {existing && existing.source !== 'manual' && <Notice>Séance importée (<SourceBadge source={existing.source} />). Tes modifications seront conservées, mais un nouvel import de la même séance peut les remplacer.</Notice>}
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        if (errors.length) return;
        const n = (x: string) => (x ? parseNum(x) ?? undefined : undefined);
        const w: Workout = {
          ...(existing ?? {}),
          id: existing?.id ?? uid(), date, startTime: time || undefined, type, durationSec: sec!, distanceKm: n(dist), avgHr: n(avgHr), maxHr: n(maxHr),
          activeKcal: n(kcal), elevationM: n(elev), rpe: rpe || undefined, comment: comment.trim() || undefined, pain: pain.trim() || undefined, completed,
          plannedSessionId: existing?.plannedSessionId ?? session?.id, source: existing?.source ?? 'manual',
        };
        await put('workouts', w);
        toast(pain.trim() ? 'Séance enregistrée. Prends soin de cette douleur : repos et avis médical si elle persiste.' : 'Séance enregistrée');
        onDone();
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className="input" value={date} max={todayKey} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Heure de début"><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Type"><select className="input" value={type} onChange={(e) => setType(e.target.value as WorkoutType)}>{Object.entries(WORKOUT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durée (min ou h:mm:ss)"><input className="input tabular" inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="25:00" /></Field>
          <Field label="Distance (km)"><input className="input tabular" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="3,2" /></Field>
        </div>
        {pace && <p className="text-[14px] tabular">Allure moyenne <b>{fmtPace(pace)}/km</b> · vitesse <b>{fmt1(speed!)} km/h</b> (calculées)</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="FC moyenne (bpm)"><input className="input tabular" inputMode="numeric" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} /></Field>
          <Field label="FC max (bpm)"><input className="input tabular" inputMode="numeric" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} /></Field>
          <Field label="Calories actives (kcal)"><input className="input tabular" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} /></Field>
          <Field label="Dénivelé + (m)"><input className="input tabular" inputMode="numeric" value={elev} onChange={(e) => setElev(e.target.value)} /></Field>
        </div>
        <div>
          <span className="label">Effort perçu : {rpe ? `${rpe}/10` : 'non renseigné'}</span>
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button type="button" key={n} onClick={() => setRpe(rpe === n ? 0 : n)} aria-pressed={rpe === n} className={`h-9 rounded-lg text-[13px] font-bold tabular ${rpe === n ? 'bg-accent text-white' : 'bg-surface2'}`}>{n}</button>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-muted mt-1"><span>très facile</span><span>maximal</span></div>
        </div>
        <Field label="Douleurs éventuelles"><input className="input" value={pain} onChange={(e) => setPain(e.target.value)} placeholder="ex. genou droit, légère" /></Field>
        {pain.trim() && <Notice tone="warn">{SAFETY}</Notice>}
        <Field label="Commentaire"><textarea className="input h-20 py-2" value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="w-5 h-5 accent-[rgb(var(--accent))]" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />Séance terminée</label>
        {errors.length > 0 && dur !== '' && <Notice tone="warn">{errors.join(' ')}</Notice>}
        <button className="btn-primary w-full" disabled={errors.length > 0}>Enregistrer</button>
        {existing && <button type="button" className="btn-danger w-full" onClick={async () => { await remove('workouts', existing.id); toast('Séance supprimée', { undo: () => put('workouts', existing) }); onDone(); }}><Trash2 size={16} />Supprimer</button>}
      </form>
    </div>
  );
}

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

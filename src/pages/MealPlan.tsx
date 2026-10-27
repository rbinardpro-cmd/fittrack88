import { Check, RefreshCw, SkipForward, Clock, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MEAL_LABELS, MEAL_PLAN } from '../data/mealPlan';
import { setPlanStatus } from '../db/actions';
import { useFoods, useProfile, useRecipes, useStore, useTargets, useToday } from '../db/hooks';
import { addDays, dayName, diffDays, formatDay } from '../lib/dates';
import { fmt0 } from '../lib/format';
import { recipeNutrition } from '../lib/recipes';
import type { Meal, PlanStatus } from '../lib/types';
import { AddFood } from '../components/AddFood';
import { Card, Loading, Notice, PageHeader, parseNum, Sheet } from '../components/ui';
import { toast } from '../components/toast';

const STATUS: Record<PlanStatus, { label: string; cls: string }> = {
  planned: { label: 'Prévu', cls: 'bg-surface2 text-muted' },
  consumed: { label: 'Consommé', cls: 'bg-good/15 text-good' },
  replaced: { label: 'Remplacé', cls: 'bg-info/15 text-info' },
  skipped: { label: 'Ignoré', cls: 'bg-surface2 text-muted line-through' },
};

/** Index du jour dans le cycle de 14 jours (le programme recommence ensuite). */
export function planDayIndex(start: string, date: string): number | null {
  const d = diffDays(start, date);
  if (d < 0) return null;
  return d % 14;
}

export default function MealPlanPage() {
  const todayKey = useToday();
  const [profile, updateProfile] = useProfile();
  const { byId: recipes } = useRecipes();
  const { byId: foods } = useFoods();
  const planStates = useStore('planStates');
  const { targets } = useTargets();
  const [selected, setSelected] = useState<string | null>(null);
  const [consume, setConsume] = useState<{ meal: Meal; recipeId: string } | null>(null);
  const [replace, setReplace] = useState<Meal | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const start = profile?.mealPlanStart;
  const cycleStart = useMemo(() => {
    if (!start) return null;
    const d = diffDays(start, todayKey);
    return d < 0 ? start : addDays(start, Math.floor(d / 14) * 14);
  }, [start, todayKey]);
  const date = selected ?? (start && todayKey >= start ? todayKey : start ?? todayKey);

  useEffect(() => {
    stripRef.current?.querySelector('[aria-current="date"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [date]);

  if (!profile || !planStates || !cycleStart) return <Loading />;
  const idx = planDayIndex(profile.mealPlanStart, date);
  const plan = idx == null ? [] : MEAL_PLAN[idx];
  const lookup = (id: string) => foods[id];
  const dayKcal = plan.filter((p) => !p.optional).reduce((s, p) => s + recipeNutrition(recipes[p.recipeId], lookup).perServing.kcal * p.servings, 0);
  const days = Array.from({ length: 14 }, (_, i) => addDays(cycleStart, i));

  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Programme repas" subtitle={`14 jours · cycle commencé le ${formatDay(cycleStart, { weekday: true })}`} action={<Link to="/recettes" className="btn-secondary btn-sm">Recettes</Link>} />
      {todayKey < profile.mealPlanStart && (
        <Notice>Le programme commence le {formatDay(profile.mealPlanStart, { weekday: true })} <button className="font-semibold text-accent" onClick={() => updateProfile({ mealPlanStart: todayKey })}>Commencer aujourd’hui</button></Notice>
      )}
      <div ref={stripRef} className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 snap-x" role="tablist" aria-label="Jours du programme">
        {days.map((d, i) => {
          const sel = d === date;
          const done = planStates.filter((p) => p.date === d && p.meal !== 'snack' && (p.status === 'consumed' || p.status === 'replaced')).length;
          return (
            <button key={d} role="tab" aria-selected={sel} aria-current={sel ? 'date' : undefined} onClick={() => setSelected(d)}
              className={`snap-center shrink-0 w-14 rounded-2xl py-2 text-center border ${sel ? 'bg-ink text-bg border-ink' : 'bg-surface border-line/70'} ${d === todayKey && !sel ? 'ring-2 ring-accent' : ''}`}>
              <div className="text-[10px] uppercase font-semibold opacity-70">{dayName(d).slice(0, 3)}</div>
              <div className="text-[17px] font-bold tabular">{Number(d.slice(8))}</div>
              <div className="text-[9px] opacity-70">J{i + 1}{done ? ` · ${done}/3` : ''}</div>
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-bold capitalize">{formatDay(date, { weekday: true })} {idx != null && <span className="text-muted font-medium">· jour {idx + 1}{idx % 7 >= 5 ? ' (week-end, repas à la maison)' : ''}</span>}</h2>
        <span className="text-[13px] text-muted tabular">≈ {fmt0(dayKcal)} kcal prévues{targets ? ` / ${fmt0(targets.kcal)}` : ''}</span>
      </div>

      {plan.map((p) => {
        const r = recipes[p.recipeId];
        const n = recipeNutrition(r, lookup).perServing;
        const st = planStates.find((s) => s.id === `${date}|${p.meal}`);
        const status = st?.status ?? 'planned';
        return (
          <Card key={p.meal}>
            <div className="flex items-start gap-3">
              <span className="text-3xl" aria-hidden>{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-muted uppercase tracking-wide">{MEAL_LABELS[p.meal]}{p.optional ? ' · facultatif' : ''}</span>
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${STATUS[status].cls}`}>{STATUS[status].label}{status === 'consumed' && st?.servings && st.servings !== 1 ? ` (${String(st.servings).replace('.', ',')} portion)` : ''}</span>
                </div>
                <Link to={`/recettes/${r.id}`} className="font-semibold text-[15px] leading-snug flex items-center gap-1">{r.name}<ChevronRight size={14} className="text-muted" /></Link>
                <div className="text-[12px] text-muted tabular">{fmt0(n.kcal)} kcal · {fmt0(n.protein)} g prot. · <Clock size={11} className="inline" /> {r.prepMin + r.cookMin} min</div>
                {p.note && <div className="text-[12px] text-muted mt-0.5">{p.note}</div>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <button className={`btn-sm btn ${status === 'consumed' ? 'bg-good text-white' : 'bg-surface2'}`} onClick={() => setConsume({ meal: p.meal, recipeId: r.id })}><Check size={15} />Mangé</button>
              <button className={`btn-sm btn ${status === 'replaced' ? 'bg-info text-white' : 'bg-surface2'}`} onClick={async () => { await setPlanStatus({ date, meal: p.meal, status: 'replaced', lookup }); setReplace(p.meal); }}><RefreshCw size={15} />Remplacé</button>
              <button className={`btn-sm btn ${status === 'skipped' ? 'bg-ink text-bg' : 'bg-surface2'}`} onClick={async () => {
                await setPlanStatus({ date, meal: p.meal, status: status === 'skipped' ? 'planned' : 'skipped', lookup });
              }}><SkipForward size={15} />{status === 'skipped' ? 'Rétablir' : 'Ignoré'}</button>
            </div>
            {(status === 'consumed' || status === 'replaced') && (
              <button className="text-[12px] text-muted underline mt-2" onClick={() => setPlanStatus({ date, meal: p.meal, status: 'planned', lookup })}>Remettre en « prévu »{status === 'consumed' ? ' (retire l’entrée du journal)' : ''}</button>
            )}
          </Card>
        );
      })}
      <p className="text-[12px] text-muted px-1">Les repas principaux laissent une marge d’environ 300 à 500 kcal sous ton objectif pour la collation, les boissons et les extras. Si tu as encore faim, augmente d’abord les légumes, puis la portion (bouton « Mangé » › 1,5 portion).</p>
      <p className="text-[12px] text-muted px-1">Un repas prévu n’est jamais compté dans tes calories tant que tu n’as pas appuyé sur « Mangé ». « Remplacé » ouvre le journal pour noter ce que tu as mangé à la place.</p>

      <Sheet open={!!consume} onClose={() => setConsume(null)} title="Repas consommé">
        {consume && <ConsumeForm date={date} meal={consume.meal} recipeId={consume.recipeId} onDone={() => setConsume(null)} />}
      </Sheet>
      <Sheet open={replace != null} onClose={() => setReplace(null)} title="Qu’as-tu mangé à la place ?">
        {replace && <AddFood date={date} meal={replace} onDone={() => setReplace(null)} />}
      </Sheet>
    </div>
  );
}

function ConsumeForm({ date, meal, recipeId, onDone }: { date: string; meal: Meal; recipeId: string; onDone: () => void }) {
  const { byId: recipes } = useRecipes();
  const { byId: foods } = useFoods();
  const [servings, setServings] = useState('1');
  const r = recipes[recipeId];
  const s = parseNum(servings) ?? 0;
  const per = recipeNutrition(r, (id) => foods[id]).perServing;
  return (
    <div className="space-y-3">
      <div className="font-semibold">{r.emoji} {r.name}</div>
      <div className="flex flex-wrap gap-2">
        {['0.5', '1', '1.5', '2'].map((v) => <button key={v} className={`chip ${servings === v ? 'chip-active' : ''}`} onClick={() => setServings(v)}>{v.replace('.', ',')} portion{Number(v) > 1 ? 's' : ''}</button>)}
      </div>
      <input className="input tabular" inputMode="decimal" value={servings.replace('.', ',')} onChange={(e) => setServings(e.target.value.replace(',', '.'))} aria-label="Nombre de portions" />
      {s > 0 && <p className="text-[14px] tabular">{fmt0(per.kcal * s)} kcal · {fmt0(per.protein * s)} g protéines · {fmt0(per.carbs * s)} g glucides · {fmt0(per.fat * s)} g lipides</p>}
      <button className="btn-primary w-full" disabled={!(s > 0 && s <= 10)} onClick={async () => {
        await setPlanStatus({ date, meal, status: 'consumed', recipe: r, servings: s, lookup: (id) => foods[id] });
        toast('Ajouté à ton journal');
        onDone();
      }}><Check size={18} />Ajouter à mon journal</button>
    </div>
  );
}

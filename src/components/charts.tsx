import { useState, type ReactNode } from 'react';
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Table2 } from 'lucide-react';

/*
 * Graphiques : une seule échelle verticale par graphique, traits fins, grille discrète,
 * infobulle au survol / toucher, et une vue tableau pour l'accessibilité.
 * Les couleurs viennent des variables CSS du thème (validées en clair et en sombre).
 */

export const C = {
  accent: 'rgb(var(--accent))',
  info: 'rgb(var(--info))',
  muted: 'rgb(var(--muted))',
  line: 'rgb(var(--line))',
  ink: 'rgb(var(--ink))',
  surface: 'rgb(var(--surface))',
};

const axis = { stroke: C.muted, fontSize: 11, tickLine: false, axisLine: false } as const;

export interface Column<T> { key: keyof T & string; label: string; format?: (v: unknown) => string }

export function ChartCard<T extends Record<string, unknown>>({ title, subtitle, children, rows, columns, legend }: {
  title: string; subtitle?: ReactNode; children: ReactNode; rows: T[]; columns: Column<T>[]; legend?: ReactNode;
}) {
  const [table, setTable] = useState(false);
  return (
    <section className="card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {subtitle && <div className="text-[12px] text-muted">{subtitle}</div>}
        </div>
        <button className={`p-2 rounded-lg ${table ? 'bg-ink text-bg' : 'bg-surface2 text-muted'}`} onClick={() => setTable((t) => !t)} aria-pressed={table} aria-label={table ? 'Afficher le graphique' : 'Afficher les données en tableau'}>
          <Table2 size={16} />
        </button>
      </div>
      {legend && <div className="flex flex-wrap gap-3 text-[12px] text-muted mb-2">{legend}</div>}
      {rows.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted text-center px-6">Pas encore de données sur cette période.</div>
      ) : table ? (
        <div className="max-h-64 overflow-auto text-[13px]">
          <table className="w-full tabular">
            <thead className="text-muted text-left sticky top-0 bg-surface">
              <tr>{columns.map((c) => <th key={c.key} className="py-1 pr-2 font-medium">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line/60">
                  {columns.map((c) => <td key={c.key} className="py-1 pr-2">{c.format ? c.format(r[c.key]) : r[c.key] == null ? '—' : String(r[c.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-52 -ml-2">{children}</div>
      )}
    </section>
  );
}

export function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-4" style={{ borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
      {label}
    </span>
  );
}

function TooltipBox({ active, payload, label, fmtLabel, fmtValue }: {
  active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string;
  fmtLabel: (l: string) => string; fmtValue: (v: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-surface border border-line shadow-lg px-2.5 py-1.5 text-[12px] tabular">
      <div className="font-semibold mb-0.5">{fmtLabel(String(label))}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-ink">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name} :</span> {fmtValue(p.value, p.dataKey)}
        </div>
      ))}
    </div>
  );
}

/** Séries temporelles : lignes et/ou barres sur une seule échelle, avec lignes de référence optionnelles. */
export function TimeChart<T extends Record<string, unknown>>({ data, xKey, series, refs, fmtX, fmtValue, yDomain, band }: {
  data: T[];
  xKey: keyof T & string;
  series: { key: keyof T & string; name: string; type: 'line' | 'bar'; color: string; dashed?: boolean; dots?: boolean }[];
  refs?: { y: number; label: string }[];
  fmtX: (v: string) => string;
  fmtValue: (v: number, key: string) => string;
  yDomain?: [number | 'auto' | ((n: number) => number), number | 'auto' | ((n: number) => number)];
  band?: { low: keyof T & string; high: keyof T & string; name: string };
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={C.line} strokeOpacity={0.6} />
        <XAxis dataKey={xKey} {...axis} tickFormatter={fmtX} minTickGap={24} />
        <YAxis {...axis} width={44} domain={yDomain ?? ['auto', 'auto']} tickFormatter={(v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} />
        <Tooltip cursor={{ stroke: C.muted, strokeDasharray: '3 3' }} content={<TooltipBox fmtLabel={fmtX} fmtValue={fmtValue} />} />
        {band && <Area dataKey={(d: T) => [d[band.low], d[band.high]] as unknown as number} name={band.name} stroke="none" fill={C.accent} fillOpacity={0.12} isAnimationActive={false} />}
        {refs?.map((r) => (
          <ReferenceLine key={r.label} y={r.y} stroke={C.muted} strokeDasharray="4 4" label={{ value: r.label, position: 'insideTopRight', fill: C.muted, fontSize: 11 }} />
        ))}
        {series.map((s) =>
          s.type === 'bar' ? (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
          ) : (
            <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} dot={s.dots ? { r: 3, strokeWidth: 0, fill: s.color } : false} activeDot={{ r: 5, stroke: C.surface, strokeWidth: 2 }} connectNulls type="monotone" />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

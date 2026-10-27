/** Génère un CSV compatible Excel FR (séparateur « ; », BOM UTF-8, décimales à virgule). */
export function toCsv(rows: Record<string, unknown>[], columns?: { key: string; label: string }[]): string {
  if (!rows.length && !columns) return '';
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const cell = (v: unknown) => {
    if (v == null) return '';
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return '﻿' + [cols.map((c) => cell(c.label)).join(';'), ...rows.map((r) => cols.map((c) => cell(r[c.key])).join(';'))].join('\r\n');
}

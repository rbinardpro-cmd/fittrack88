import type { DailyActivity, DayKey, WeightEntry, Workout, WorkoutType } from './types';

/*
 * Lecture de l'export Apple Santé (Santé › photo de profil › « Exporter toutes les données de santé »).
 * Le fichier export.zip contient apple_health_export/export.xml, qui peut peser plusieurs centaines de Mo :
 * il est donc lu par morceaux (streaming), sans jamais être chargé entièrement en mémoire.
 *
 * Ce module ne fait que du texte → données : il est testable sans navigateur.
 *
 * Déduplication : Apple Santé reçoit souvent les mêmes pas de l'iPhone ET de l'Apple Watch.
 * L'app Santé les fusionne avec des priorités que l'export ne contient pas. Ici, pour chaque jour
 * et chaque type de mesure, on garde la source (appareil) qui a le total le plus élevé, au lieu
 * d'additionner les sources. C'est une approximation documentée, qui évite le double comptage.
 */

const T = {
  steps: 'HKQuantityTypeIdentifierStepCount',
  distance: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  active: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  basal: 'HKQuantityTypeIdentifierBasalEnergyBurned',
  exercise: 'HKQuantityTypeIdentifierAppleExerciseTime',
  bodyMass: 'HKQuantityTypeIdentifierBodyMass',
  restingHr: 'HKQuantityTypeIdentifierRestingHeartRate',
  heartRate: 'HKQuantityTypeIdentifierHeartRate',
  sleep: 'HKCategoryTypeIdentifierSleepAnalysis',
} as const;

const ASLEEP = new Set([
  'HKCategoryValueSleepAnalysisAsleep',
  'HKCategoryValueSleepAnalysisAsleepUnspecified',
  'HKCategoryValueSleepAnalysisAsleepCore',
  'HKCategoryValueSleepAnalysisAsleepDeep',
  'HKCategoryValueSleepAnalysisAsleepREM',
]);

type Metric = 'steps' | 'distanceKm' | 'activeKcal' | 'basalKcal' | 'exerciseMin';

export interface HealthImportResult {
  days: DailyActivity[];
  workouts: Workout[];
  weights: WeightEntry[];
  stats: { records: number; workouts: number; ignored: number; sources: string[] };
  firstDate: DayKey | null;
  lastDate: DayKey | null;
}

export function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1]] = decodeXml(m[2]);
  return out;
}

function decodeXml(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&');
}

/** « 2026-10-27 07:30:00 +0100 » → Date ; la journée retenue est celle de l'heure locale d'enregistrement. */
export function parseHealthDate(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/);
  if (!m) return new Date(s);
  const [, y, mo, d, h, mi, se, sign, oh, om] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}${sign}${oh}:${om}`);
}
export const healthDayKey = (s: string): DayKey => s.slice(0, 10);
const timeOf = (s: string) => s.slice(11, 16);

function toKm(value: number, unit: string): number {
  if (unit === 'km') return value;
  if (unit === 'm') return value / 1000;
  if (unit === 'mi') return value * 1.609344;
  if (unit === 'ft') return value * 0.0003048;
  if (unit === 'yd') return value * 0.0009144;
  return NaN;
}
function toKcal(value: number, unit: string): number {
  if (unit === 'kcal' || unit === 'Cal') return value;
  if (unit === 'kJ') return value / 4.184;
  if (unit === 'cal') return value / 1000;
  return NaN;
}
function toKg(value: number, unit: string): number {
  if (unit === 'kg') return value;
  if (unit === 'lb') return value * 0.45359237;
  if (unit === 'g') return value / 1000;
  return NaN;
}

function mapWorkoutType(t: string): WorkoutType {
  if (t === 'HKWorkoutActivityTypeRunning') return 'course';
  if (t === 'HKWorkoutActivityTypeWalking' || t === 'HKWorkoutActivityTypeHiking') return 'marche';
  if (t === 'HKWorkoutActivityTypeCycling') return 'velo';
  if (t.includes('StrengthTraining') || t.includes('CrossTraining')) return 'renforcement';
  return 'autre';
}

interface WorkoutDraft {
  attrs: Record<string, string>;
  distanceKm?: number;
  activeKcal?: number;
  avgHr?: number;
  maxHr?: number;
  elevationM?: number;
}

export class HealthExportScanner {
  private buf = '';
  private sums = new Map<string, Map<string, number>>(); // `${day}|${metric}` → source → somme
  private sleep = new Map<string, Map<string, [number, number][]>>(); // day → source → intervalles
  private resting = new Map<string, number[]>();
  private weightsByDay = new Map<string, { time: string; kg: number }>();
  private workouts: Workout[] = [];
  private current: WorkoutDraft | null = null;
  private sources = new Set<string>();
  private records = 0;
  private ignored = 0;

  constructor(private opts: { from?: DayKey; to?: DayKey; importWeights?: boolean } = {}) {}

  private inRange(day: DayKey) {
    return (!this.opts.from || day >= this.opts.from) && (!this.opts.to || day <= this.opts.to);
  }

  push(chunk: string) {
    this.buf += chunk;
    let pos = 0;
    for (;;) {
      const lt = this.buf.indexOf('<', pos);
      if (lt < 0) {
        pos = this.buf.length;
        break;
      }
      // commentaires / DOCTYPE : chercher la fin propre à chaque construction
      if (this.buf.startsWith('<!--', lt)) {
        const end = this.buf.indexOf('-->', lt);
        if (end < 0) { pos = lt; break; }
        pos = end + 3;
        continue;
      }
      if (this.buf.startsWith('<!DOCTYPE', lt)) {
        const end = this.buf.indexOf(']>', lt);
        if (end < 0) { pos = lt; break; }
        pos = end + 2;
        continue;
      }
      const gt = this.buf.indexOf('>', lt);
      if (gt < 0) {
        pos = lt;
        break;
      }
      this.handleTag(this.buf.slice(lt, gt + 1));
      pos = gt + 1;
    }
    this.buf = this.buf.slice(pos);
  }

  private add(day: string, metric: Metric, source: string, v: number) {
    if (!isFinite(v)) return;
    const key = `${day}|${metric}`;
    let m = this.sums.get(key);
    if (!m) this.sums.set(key, (m = new Map()));
    m.set(source, (m.get(source) ?? 0) + v);
  }

  private handleTag(tag: string) {
    if (tag.startsWith('<Record ')) return this.handleRecord(tag);
    if (tag.startsWith('<Workout ')) {
      const attrs = parseAttrs(tag);
      this.current = { attrs };
      if (tag.endsWith('/>')) this.finishWorkout();
      return;
    }
    if (tag === '</Workout>') return this.finishWorkout();
    if (this.current && tag.startsWith('<WorkoutStatistics ')) {
      const a = parseAttrs(tag);
      if (a.type === T.distance && a.sum) this.current.distanceKm = toKm(Number(a.sum), a.unit);
      else if (a.type === T.active && a.sum) this.current.activeKcal = toKcal(Number(a.sum), a.unit);
      else if (a.type === T.heartRate) {
        if (a.average) this.current.avgHr = Number(a.average);
        if (a.maximum) this.current.maxHr = Number(a.maximum);
      }
      return;
    }
    if (this.current && tag.startsWith('<MetadataEntry ')) {
      const a = parseAttrs(tag);
      if (a.key === 'HKElevationAscended' && a.value) {
        const [v, u] = a.value.split(' ');
        const n = Number(v);
        this.current.elevationM = u === 'cm' ? n / 100 : u === 'm' ? n : u === 'ft' ? n * 0.3048 : undefined;
      }
    }
  }

  private handleRecord(tag: string) {
    const a = parseAttrs(tag);
    const type = a.type;
    if (!type || !a.startDate) return;
    const day = healthDayKey(a.endDate && type === T.sleep ? a.endDate : a.startDate);
    if (!this.inRange(day)) return;
    const source = a.sourceName || 'inconnu';
    const v = Number(a.value);
    switch (type) {
      case T.steps: this.add(day, 'steps', source, v); break;
      case T.distance: this.add(day, 'distanceKm', source, toKm(v, a.unit)); break;
      case T.active: this.add(day, 'activeKcal', source, toKcal(v, a.unit)); break;
      case T.basal: this.add(day, 'basalKcal', source, toKcal(v, a.unit)); break;
      case T.exercise: this.add(day, 'exerciseMin', source, v); break;
      case T.restingHr: {
        const l = this.resting.get(day) ?? [];
        l.push(v);
        this.resting.set(day, l);
        break;
      }
      case T.bodyMass: {
        if (!this.opts.importWeights) break;
        const kg = toKg(v, a.unit);
        const prev = this.weightsByDay.get(day);
        const time = timeOf(a.startDate);
        // première pesée de la journée (souvent le matin, la plus comparable)
        if (isFinite(kg) && (!prev || time < prev.time)) this.weightsByDay.set(day, { time, kg });
        break;
      }
      case T.sleep: {
        if (!ASLEEP.has(a.value)) break;
        const s = parseHealthDate(a.startDate).getTime();
        const e = parseHealthDate(a.endDate).getTime();
        if (!(e > s)) break;
        let bySrc = this.sleep.get(day);
        if (!bySrc) this.sleep.set(day, (bySrc = new Map()));
        const l = bySrc.get(source) ?? [];
        l.push([s, e]);
        bySrc.set(source, l);
        break;
      }
      default:
        this.ignored++;
        return;
    }
    this.records++;
    this.sources.add(source);
  }

  private finishWorkout() {
    const w = this.current;
    this.current = null;
    if (!w) return;
    const a = w.attrs;
    if (!a.startDate) return;
    const day = healthDayKey(a.startDate);
    if (!this.inRange(day)) return;
    let durationSec = Number(a.duration);
    if (a.durationUnit === 'min') durationSec *= 60;
    else if (a.durationUnit === 'h' || a.durationUnit === 'hr') durationSec *= 3600;
    if (!isFinite(durationSec) || durationSec <= 0) {
      durationSec = (parseHealthDate(a.endDate).getTime() - parseHealthDate(a.startDate).getTime()) / 1000;
    }
    // anciens exports : totaux en attributs du Workout
    const distanceKm = w.distanceKm ?? (a.totalDistance ? toKm(Number(a.totalDistance), a.totalDistanceUnit) : undefined);
    const activeKcal = w.activeKcal ?? (a.totalEnergyBurned ? toKcal(Number(a.totalEnergyBurned), a.totalEnergyBurnedUnit) : undefined);
    const type = mapWorkoutType(a.workoutActivityType ?? '');
    this.workouts.push({
      id: `ah-${a.startDate}-${a.workoutActivityType}`,
      externalId: `${a.startDate}|${a.workoutActivityType}`,
      date: day,
      startTime: timeOf(a.startDate),
      type,
      durationSec: Math.round(durationSec),
      distanceKm: distanceKm != null && isFinite(distanceKm) ? Math.round(distanceKm * 100) / 100 : undefined,
      activeKcal: activeKcal != null && isFinite(activeKcal) ? Math.round(activeKcal) : undefined,
      avgHr: w.avgHr ? Math.round(w.avgHr) : undefined,
      maxHr: w.maxHr ? Math.round(w.maxHr) : undefined,
      elevationM: w.elevationM != null ? Math.round(w.elevationM) : undefined,
      completed: true,
      source: 'apple_health_export',
      comment: a.sourceName ? `Importé depuis ${a.sourceName}` : undefined,
    });
    this.sources.add(a.sourceName ?? 'inconnu');
  }

  finish(now = Date.now()): HealthImportResult {
    this.push('');
    const days = new Map<string, DailyActivity>();
    const devices = new Map<string, Set<string>>();
    const get = (day: string) => {
      let d = days.get(day);
      if (!d) days.set(day, (d = { id: day, source: 'apple_health_export', importedAt: now }));
      return d;
    };
    for (const [key, bySource] of this.sums) {
      const [day, metric] = key.split('|') as [string, Metric];
      let best = -Infinity;
      let bestSrc = '';
      for (const [src, v] of bySource) if (v > best) { best = v; bestSrc = src; }
      const d = get(day);
      const val = metric === 'distanceKm' ? Math.round(best * 100) / 100 : Math.round(best);
      (d as unknown as Record<string, number>)[metric] = val;
      let s = devices.get(day);
      if (!s) devices.set(day, (s = new Set()));
      s.add(bestSrc);
    }
    for (const [day, bySource] of this.sleep) {
      let best = 0;
      for (const intervals of bySource.values()) best = Math.max(best, mergedMinutes(intervals));
      if (best > 0) get(day).sleepMin = Math.round(best);
    }
    for (const [day, l] of this.resting) get(day).restingHr = Math.round(l.reduce((s, x) => s + x, 0) / l.length);
    for (const [day, s] of devices) get(day).deviceNote = [...s].join(', ');

    const weights: WeightEntry[] = [...this.weightsByDay].map(([date, w]) => ({
      id: `ah-w-${date}`,
      date,
      time: w.time,
      kg: Math.round(w.kg * 10) / 10,
      source: 'apple_health_export',
    }));
    const list = [...days.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
    return {
      days: list,
      workouts: this.workouts.sort((a, b) => (a.date < b.date ? -1 : 1)),
      weights,
      stats: { records: this.records, workouts: this.workouts.length, ignored: this.ignored, sources: [...this.sources] },
      firstDate: list[0]?.id ?? null,
      lastDate: list[list.length - 1]?.id ?? null,
    };
  }
}

/** Durée totale en minutes d'intervalles éventuellement chevauchants. */
export function mergedMinutes(intervals: [number, number][]): number {
  const s = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curS = -1;
  let curE = -1;
  for (const [a, b] of s) {
    if (a > curE) {
      if (curE > curS) total += curE - curS;
      curS = a;
      curE = b;
    } else curE = Math.max(curE, b);
  }
  if (curE > curS) total += curE - curS;
  return total / 60000;
}

// ---------- Import JSON (Raccourci iOS ou fichier) ----------

export interface SimpleImport {
  days: DailyActivity[];
  workouts: Workout[];
  weights: WeightEntry[];
  errors: string[];
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').replace(/\s/g, ''));
  return isFinite(n) && n >= 0 ? n : undefined;
};

/**
 * Format JSON documenté dans le README (utilisable par un Raccourci iOS) :
 * { "fittrack": 1, "days": [{ "date": "2026-10-27", "steps": 8500, "distanceKm": 6.1,
 *   "activeKcal": 520, "basalKcal": 2150, "exerciseMin": 35, "sleepMin": 410 }],
 *   "workouts": [{ "date": "...", "type": "course", "durationMin": 28, "distanceKm": 3.2, "avgHr": 142 }],
 *   "weights": [{ "date": "...", "kg": 118.4 }] }
 */
export function parseSimpleJson(text: string, now = Date.now()): SimpleImport {
  const errors: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { days: [], workouts: [], weights: [], errors: ['Le texte n’est pas un JSON valide.'] };
  }
  const obj = (data ?? {}) as Record<string, unknown>;
  const dayRe = /^\d{4}-\d{2}-\d{2}$/;
  const days: DailyActivity[] = [];
  for (const [i, raw] of (Array.isArray(obj.days) ? obj.days : []).entries()) {
    const r = raw as Record<string, unknown>;
    const date = String(r.date ?? '').slice(0, 10);
    if (!dayRe.test(date)) { errors.push(`days[${i}] : date invalide`); continue; }
    days.push({
      id: date,
      steps: num(r.steps),
      distanceKm: num(r.distanceKm),
      activeKcal: num(r.activeKcal),
      basalKcal: num(r.basalKcal),
      exerciseMin: num(r.exerciseMin),
      sleepMin: num(r.sleepMin),
      restingHr: num(r.restingHr),
      source: 'shortcut_import',
      importedAt: now,
    });
  }
  const workouts: Workout[] = [];
  for (const [i, raw] of (Array.isArray(obj.workouts) ? obj.workouts : []).entries()) {
    const r = raw as Record<string, unknown>;
    const date = String(r.date ?? '').slice(0, 10);
    const durMin = num(r.durationMin);
    if (!dayRe.test(date) || !durMin) { errors.push(`workouts[${i}] : date ou durée invalide`); continue; }
    const type = (['course', 'marche', 'course_marche', 'velo', 'renforcement', 'autre'].includes(String(r.type)) ? r.type : 'course') as WorkoutType;
    const start = typeof r.startTime === 'string' ? r.startTime : undefined;
    workouts.push({
      id: `imp-${date}-${start ?? i}-${type}`,
      externalId: `${date}|${start ?? i}|${type}`,
      date, startTime: start, type,
      durationSec: Math.round(durMin * 60),
      distanceKm: num(r.distanceKm), avgHr: num(r.avgHr), maxHr: num(r.maxHr),
      activeKcal: num(r.activeKcal), elevationM: num(r.elevationM),
      completed: true, source: 'shortcut_import',
    });
  }
  const weights: WeightEntry[] = [];
  for (const [i, raw] of (Array.isArray(obj.weights) ? obj.weights : []).entries()) {
    const r = raw as Record<string, unknown>;
    const date = String(r.date ?? '').slice(0, 10);
    const kg = num(r.kg);
    if (!dayRe.test(date) || !kg || kg < 30 || kg > 350) { errors.push(`weights[${i}] : date ou poids invalide`); continue; }
    weights.push({ id: `imp-w-${date}`, date, kg, source: 'shortcut_import' });
  }
  if (!days.length && !workouts.length && !weights.length && !errors.length) errors.push('Aucune donnée reconnue (clés attendues : days, workouts, weights).');
  return { days, workouts, weights, errors };
}

/** CSV de pesées : « date;poids » (séparateur ; ou ,), dates AAAA-MM-JJ ou JJ/MM/AAAA. */
export function parseWeightCsv(text: string): { weights: WeightEntry[]; errors: string[] } {
  const weights: WeightEntry[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const sep = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 2) { if (i > 0) errors.push(`Ligne ${i + 1} : format attendu date;poids`); return; }
    let date = cells[0];
    const fr = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (fr) date = `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
    const kg = Number(cells[1].replace(',', '.'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(kg >= 30 && kg <= 350)) {
      if (i > 0) errors.push(`Ligne ${i + 1} ignorée : « ${line} »`); // la 1re ligne peut être un en-tête
      return;
    }
    weights.push({ id: `csv-w-${date}`, date, kg: Math.round(kg * 10) / 10, source: 'file_import' });
  });
  return { weights, errors };
}

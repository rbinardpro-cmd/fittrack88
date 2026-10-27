import { describe, expect, it } from 'vitest';
import { HealthExportScanner, mergedMinutes, parseSimpleJson, parseWeightCsv } from '../src/lib/healthImport';
import { offToFood } from '../src/lib/off';
import { toCsv } from '../src/lib/csv';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary)*)>
<!ATTLIST Record type CDATA #REQUIRED>
]>
<HealthData locale="fr_FR">
 <ExportDate value="2026-10-27 20:00:00 +0100"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone de Romain" unit="count" startDate="2026-10-26 08:00:00 +0100" endDate="2026-10-26 08:10:00 +0100" value="1000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch de Romain" unit="count" startDate="2026-10-26 08:00:00 +0100" endDate="2026-10-26 08:10:00 +0100" value="1100"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch de Romain" unit="count" startDate="2026-10-26 18:00:00 +0100" endDate="2026-10-26 18:30:00 +0100" value="4000">
  <MetadataEntry key="HKMetadataKeyFoo" value="bar"/>
 </Record>
 <Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="Apple Watch de Romain" unit="km" startDate="2026-10-26 18:00:00 +0100" endDate="2026-10-26 18:30:00 +0100" value="3.2"/>
 <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="Apple Watch de Romain" unit="kJ" startDate="2026-10-26 18:00:00 +0100" endDate="2026-10-26 18:30:00 +0100" value="1673.6"/>
 <Record type="HKQuantityTypeIdentifierBasalEnergyBurned" sourceName="Apple Watch de Romain" unit="kcal" startDate="2026-10-26 00:00:00 +0100" endDate="2026-10-26 23:59:00 +0100" value="2150"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Balance" unit="kg" startDate="2026-10-26 07:05:00 +0100" endDate="2026-10-26 07:05:00 +0100" value="118.62"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Balance" unit="kg" startDate="2026-10-26 21:00:00 +0100" endDate="2026-10-26 21:00:00 +0100" value="119.9"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch de Romain" startDate="2026-10-25 23:30:00 +0100" endDate="2026-10-26 03:30:00 +0100" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch de Romain" startDate="2026-10-26 03:00:00 +0100" endDate="2026-10-26 06:30:00 +0100" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch de Romain" startDate="2026-10-26 06:30:00 +0100" endDate="2026-10-26 06:45:00 +0100" value="HKCategoryValueSleepAnalysisAwake"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch de Romain" unit="count/min" startDate="2026-10-26 18:05:00 +0100" endDate="2026-10-26 18:05:00 +0100" value="140"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="27.5" durationUnit="min" sourceName="Apple Watch de Romain" startDate="2026-10-26 18:00:00 +0100" endDate="2026-10-26 18:27:30 +0100">
  <MetadataEntry key="HKElevationAscended" value="2350 cm"/>
  <WorkoutEvent type="HKWorkoutEventTypeSegment" date="2026-10-26 18:00:00 +0100"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2026-10-26 18:00:00 +0100" endDate="2026-10-26 18:27:30 +0100" sum="312.4" unit="kcal"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" startDate="2026-10-26 18:00:00 +0100" endDate="2026-10-26 18:27:30 +0100" sum="3.21" unit="km"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" startDate="2026-10-26 18:00:00 +0100" endDate="2026-10-26 18:27:30 +0100" average="141.6" minimum="90" maximum="168" unit="count/min"/>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="0.5" durationUnit="hr" totalDistance="2.5" totalDistanceUnit="km" totalEnergyBurned="150" totalEnergyBurnedUnit="kcal" sourceName="Apple Watch de Romain" startDate="2025-01-10 12:00:00 +0100" endDate="2025-01-10 12:30:00 +0100"/>
</HealthData>`;

function scan(text: string, chunk: number, opts = {}) {
  const s = new HealthExportScanner(opts);
  for (let i = 0; i < text.length; i += chunk) s.push(text.slice(i, i + chunk));
  return s.finish(0);
}

describe('import export Apple Santé', () => {
  it('agrège par jour sans additionner iPhone et Apple Watch', () => {
    const r = scan(XML, 100000, { importWeights: true });
    const d = r.days.find((x) => x.id === '2026-10-26')!;
    expect(d.steps).toBe(5100); // la Watch (1100 + 4000) l'emporte sur l'iPhone (1000), pas 6100
    expect(d.distanceKm).toBe(3.2);
    expect(d.activeKcal).toBe(400); // 1673,6 kJ → 400 kcal
    expect(d.basalKcal).toBe(2150);
    expect(d.sleepMin).toBe(420); // 23:30→06:30, chevauchement fusionné, « éveillé » exclu
    expect(d.deviceNote).toContain('Apple Watch');
  });
  it('donne le même résultat quel que soit le découpage du flux', () => {
    const a = scan(XML, 100000, { importWeights: true });
    const b = scan(XML, 7, { importWeights: true });
    expect(b).toEqual(a);
  });
  it('lit les séances (nouveau et ancien format)', () => {
    const r = scan(XML, 4096);
    expect(r.workouts).toHaveLength(2);
    const run = r.workouts.find((w) => w.type === 'course')!;
    expect(run).toMatchObject({ date: '2026-10-26', durationSec: 1650, distanceKm: 3.21, activeKcal: 312, avgHr: 142, maxHr: 168, elevationM: 24, startTime: '18:00' });
    const walk = r.workouts.find((w) => w.type === 'marche')!;
    expect(walk).toMatchObject({ durationSec: 1800, distanceKm: 2.5, activeKcal: 150 });
  });
  it('garde la première pesée du jour, seulement si demandé', () => {
    expect(scan(XML, 4096).weights).toHaveLength(0);
    const w = scan(XML, 4096, { importWeights: true }).weights;
    expect(w).toEqual([{ id: 'ah-w-2026-10-26', date: '2026-10-26', time: '07:05', kg: 118.6, source: 'apple_health_export' }]);
  });
  it('filtre par période', () => {
    const r = scan(XML, 4096, { from: '2026-01-01' });
    expect(r.workouts).toHaveLength(1);
  });
  it('fusion des intervalles de sommeil', () => {
    expect(mergedMinutes([[0, 60_000 * 60], [30 * 60_000, 90 * 60_000], [120 * 60_000, 150 * 60_000]])).toBe(120);
  });
});

describe('import JSON simple (Raccourci)', () => {
  it('lit jours, séances, pesées et signale les erreurs', () => {
    const r = parseSimpleJson(JSON.stringify({
      fittrack: 1,
      days: [{ date: '2026-10-27', steps: '8 500', activeKcal: 520.4 }, { date: 'hier' }],
      workouts: [{ date: '2026-10-27', durationMin: 28, distanceKm: 3.2 }],
      weights: [{ date: '2026-10-27', kg: 118.4 }, { date: '2026-10-27', kg: 5 }],
    }));
    expect(r.days).toHaveLength(1);
    expect(r.days[0].steps).toBe(8500);
    expect(r.workouts[0].durationSec).toBe(1680);
    expect(r.weights).toHaveLength(1);
    expect(r.errors).toHaveLength(2);
  });
  it('JSON invalide', () => {
    expect(parseSimpleJson('{pas du json').errors[0]).toMatch(/JSON/);
  });
});

describe('CSV', () => {
  it('lit des pesées FR et ISO avec en-tête', () => {
    const r = parseWeightCsv('date;poids\n27/10/2026;118,4\n2026-10-28;118.1\nnimporte quoi');
    expect(r.weights.map((w) => [w.date, w.kg])).toEqual([['2026-10-27', 118.4], ['2026-10-28', 118.1]]);
    expect(r.errors).toHaveLength(1);
  });
  it('génère un CSV compatible Excel FR', () => {
    const csv = toCsv([{ a: 1.5, b: 'x;y' }]);
    expect(csv).toBe('\uFEFFa;b\r\n1,5;"x;y"');
  });
});

describe('Open Food Facts', () => {
  it('convertit un produit complet', () => {
    const f = offToFood({ code: '123', product_name: 'Skyr', brands: 'Marque, Autre', nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 } })!;
    expect(f.per100).toEqual({ kcal: 63, protein: 11, carbs: 4, fat: 0.2, fiber: null });
    expect(f.name).toBe('Skyr (Marque)');
    expect(f.source).toBe('open_food_facts');
  });
  it("refuse un produit aux valeurs incomplètes (on n'invente rien)", () => {
    expect(offToFood({ code: '1', product_name: 'X', nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { addDays } from '../src/lib/dates';
import type { WeightEntry } from '../src/lib/types';
import { changeOver, computeProgress, dailyWeights, forecastGoal, linearRegression, rollingAverage } from '../src/lib/weight';

const w = (date: string, kg: number): WeightEntry => ({ id: date + kg, date, kg, source: 'manual' });

describe('progression vers l’objectif', () => {
  it('exemple du cahier des charges : 120 → 110 pour 88 = 31,25 %', () => {
    const p = computeProgress(120, 110, 88);
    expect(p.lostKg).toBe(10);
    expect(p.remainingKg).toBe(22);
    expect(p.progressPct).toBe(31.25);
    // à ne pas confondre avec le % de poids perdu
    expect(p.bodyWeightLostPct).toBe(8.33);
  });
  it('gère une prise de poids (avancement négatif) et l’objectif atteint', () => {
    expect(computeProgress(120, 121, 88).progressPct).toBeLessThan(0);
    const done = computeProgress(120, 87.5, 88);
    expect(done.progressPct).toBe(100);
    expect(done.remainingKg).toBe(0);
    expect(done.reached).toBe(true);
  });
});

describe('pesées', () => {
  it('fait la moyenne de plusieurs pesées le même jour et trie', () => {
    const d = dailyWeights([w('2026-10-02', 119), w('2026-10-01', 120), w('2026-10-01', 119)]);
    expect(d).toEqual([{ date: '2026-10-01', kg: 119.5 }, { date: '2026-10-02', kg: 119 }]);
  });
  it('lisse sur 7 jours', () => {
    const d = dailyWeights([w('2026-10-01', 120), w('2026-10-04', 118), w('2026-10-10', 116)]);
    const r = rollingAverage(d);
    expect(r[1].avg).toBe(119);
    expect(r[2].avg).toBe(117); // le 4 (6 jours avant) est dans la fenêtre, le 1er non
  });
  it('variation sur une période', () => {
    const entries = Array.from({ length: 31 }, (_, i) => w(addDays('2026-09-01', i), 120 - i * 0.1));
    const d = dailyWeights(entries);
    const c7 = changeOver(d, 7)!;
    expect(c7).toBeCloseTo(-0.7, 1);
    expect(changeOver(d, 90)).toBeNull();
  });
});

describe('prévision', () => {
  it("refuse d'estimer une date avec une seule semaine de données", () => {
    const entries = Array.from({ length: 7 }, (_, i) => w(addDays('2026-10-01', i), 120 - i * 0.2));
    const f = forecastGoal(entries, 88, '2026-10-07');
    expect(f.status).toBe('not_enough_data');
    expect(f.dateCentral).toBeUndefined();
  });
  it('donne une fourchette ordonnée quand la tendance est à la baisse', () => {
    // −0,1 kg/j avec un bruit d'eau ±0,4 kg
    const noise = [0.3, -0.2, 0.4, -0.4, 0.1, 0, -0.3, 0.2];
    const entries = Array.from({ length: 28 }, (_, i) => w(addDays('2026-10-01', i), 120 - i * 0.1 + noise[i % 8]));
    const f = forecastGoal(entries, 88, '2026-10-28');
    expect(f.status).toBe('ok');
    expect(f.trendKgPerWeek!).toBeCloseTo(-0.7, 0);
    expect(f.dateEarly! <= f.dateCentral!).toBe(true);
    expect(f.dateLate == null || f.dateCentral! <= f.dateLate).toBe(true);
  });
  it('ne donne pas de date si la tendance est stable ou en hausse', () => {
    const entries = Array.from({ length: 21 }, (_, i) => w(addDays('2026-10-01', i), 118 + (i % 3) * 0.3));
    expect(forecastGoal(entries, 88, '2026-10-21').status).toBe('not_losing');
  });
  it('régression exacte sur une droite', () => {
    const r = linearRegression([{ date: '2026-01-01', kg: 100 }, { date: '2026-01-11', kg: 99 }, { date: '2026-01-21', kg: 98 }])!;
    expect(r.slope).toBeCloseTo(-0.1, 10);
    expect(r.se).toBeCloseTo(0, 10);
  });
});

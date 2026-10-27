import { describe, expect, it } from 'vitest';
import { bmrMifflin, computeTargets, dayEnergy, suggestAdjustment, sumNutrients, tdee } from '../src/lib/energy';
import { defaultProfile } from '../src/db/defaults';

describe('Mifflin-St Jeor', () => {
  it('calcule le métabolisme de base de Romain (120 kg, 187 cm, 31 ans, homme)', () => {
    // 10×120 + 6,25×187 − 5×31 + 5 = 1200 + 1168,75 − 155 + 5
    expect(bmrMifflin({ sex: 'male', weightKg: 120, heightCm: 187, age: 31 })).toBeCloseTo(2218.75, 2);
  });
  it('applique −161 pour une femme', () => {
    expect(bmrMifflin({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 })).toBeCloseTo(600 + 1031.25 - 150 - 161, 2);
  });
  it('multiplie par le facteur d’activité', () => {
    expect(tdee(2000, 'light')).toBeCloseTo(2750, 5);
  });
});

describe('objectifs', () => {
  const p = defaultProfile('2026-10-27', { firstName: 'Romain', sex: 'male', age: 31, heightCm: 187, startWeightKg: 120, goalWeightKg: 88, activityLevel: 'light' });
  it('donne un déficit modéré et des macros cohérentes', () => {
    const t = computeTargets(p, 120);
    expect(t.bmr).toBe(2219);
    expect(t.tdee).toBe(Math.round(2218.75 * 1.375));
    expect(t.deficit).toBe(500);
    expect(t.kcal).toBe(Math.round((2218.75 * 1.375 - 500) / 10) * 10);
    expect(t.protein).toBe(Math.round(1.8 * 88));
    // les macros reconstituent les calories (à l'arrondi près)
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(10);
  });
  it('borne un déficit excessif', () => {
    const t = computeTargets({ ...p, deficitKcal: 2000 }, 120);
    expect(t.deficit).toBeLessThanOrEqual(750);
    expect(t.notes.length).toBeGreaterThan(0);
  });
  it('ne descend jamais sous le métabolisme de base', () => {
    const t = computeTargets({ ...p, activityLevel: 'sedentary', deficitKcal: 750 }, 60);
    expect(t.kcal).toBeGreaterThanOrEqual(t.bmr - 5);
  });
  it('respecte les objectifs saisis à la main', () => {
    const t = computeTargets({ ...p, overrides: { kcal: 2400, protein: 170 } }, 120);
    expect(t.kcal).toBe(2400);
    expect(t.protein).toBe(170);
    expect(t.manual.kcal).toBe(true);
  });
});

describe('dépense du jour sans double comptage', () => {
  it('utilise repos + actif quand Apple Santé fournit les deux', () => {
    const e = dayEnergy(3050, { activeKcal: 600, basalKcal: 2200 });
    expect(e.total).toBe(2800);
    expect(e.method).toBe('measured');
  });
  it("n'ajoute pas les calories actives à une estimation qui les inclut déjà", () => {
    const e = dayEnergy(3050, { activeKcal: 600 });
    expect(e.total).toBe(3050);
    expect(e.method).toBe('estimated');
  });
});

describe('ajustement prudent', () => {
  const base = { currentTargetKcal: 2550, loggedDays: 25, periodDays: 28, currentWeightKg: 115, bmr: 2170 };
  it('refuse sans assez de recul', () => {
    expect(suggestAdjustment({ ...base, periodDays: 10, avgIntakeKcal: 2500, slopeKgPerDay: -0.1 }).ready).toBe(false);
  });
  it('refuse si le journal est trop incomplet', () => {
    expect(suggestAdjustment({ ...base, loggedDays: 10, avgIntakeKcal: 2500, slopeKgPerDay: -0.1 }).ready).toBe(false);
  });
  it('ne propose rien quand le rythme est bon', () => {
    const s = suggestAdjustment({ ...base, avgIntakeKcal: 2550, slopeKgPerDay: -0.1 }); // 0,6 %/sem
    expect(s.delta).toBe(0);
    expect(s.observedTdee).toBe(Math.round(2550 + 770));
  });
  it('limite toute variation à 150 kcal', () => {
    const fast = suggestAdjustment({ ...base, avgIntakeKcal: 2000, slopeKgPerDay: -0.25 });
    const slow = suggestAdjustment({ ...base, avgIntakeKcal: 2550, slopeKgPerDay: 0 });
    expect(Math.abs(fast.delta!)).toBeLessThanOrEqual(150);
    expect(Math.abs(slow.delta!)).toBeLessThanOrEqual(150);
  });
});

describe('somme des nutriments', () => {
  it('additionne et gère les fibres inconnues', () => {
    const s = sumNutrients([
      { kcal: 100, protein: 10, carbs: 5, fat: 2, fiber: 1 },
      { kcal: 50, protein: 1, carbs: 10, fat: 0, fiber: null },
    ]);
    expect(s).toEqual({ kcal: 150, protein: 11, carbs: 15, fat: 2, fiber: 1 });
    expect(sumNutrients([{ kcal: 1, protein: 0, carbs: 0, fat: 0, fiber: null }]).fiber).toBeNull();
  });
});

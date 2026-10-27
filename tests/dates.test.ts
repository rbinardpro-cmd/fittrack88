import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isDayKey, rangeDays, startOfWeek, toDayKey, weekdayMon0 } from '../src/lib/dates';

// Les tests tournent avec TZ=Europe/Paris (voir package.json).
describe('dates et fuseau horaire', () => {
  it('le fuseau de test est bien Europe/Paris', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Paris');
  });
  it('passage à l’heure d’hiver (25 oct. 2026, journée de 25 h)', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('passage à l’heure d’été (29 mars 2026, journée de 23 h)', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(rangeDays('2026-03-28', '2026-03-30')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
  });
  it('une saisie à 23 h 30 reste sur la bonne journée locale', () => {
    expect(toDayKey(new Date(2026, 9, 27, 23, 30))).toBe('2026-10-27');
    expect(toDayKey(new Date(2026, 9, 28, 0, 15))).toBe('2026-10-28');
  });
  it('années bissextiles et fin de mois', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('semaines du lundi au dimanche', () => {
    expect(weekdayMon0('2026-10-26')).toBe(0); // lundi
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26'); // dimanche
  });
  it('valide les clés de jour', () => {
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-10-27')).toBe(true);
    expect(isDayKey('27/10/2026')).toBe(false);
  });
});

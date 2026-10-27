import type { IntervalBlock, RunSession, Workout } from './types';

export interface SessionTotals {
  totalSec: number;
  runSec: number;
  walkSec: number;
}

/** Durée exacte d'une séance à partir de ses intervalles. */
export function sessionTotals(blocks: IntervalBlock[]): SessionTotals {
  let run = 0;
  let walk = 0;
  for (const b of blocks) {
    if (b.kind === 'run') run += b.sec;
    else if (b.kind === 'walk') walk += b.sec;
    else {
      run += b.times * b.runSec;
      walk += b.times * b.walkSec;
    }
  }
  return { totalSec: run + walk, runSec: run, walkSec: walk };
}

/** Liste d'étapes à plat, pour un minuteur ou l'affichage détaillé. */
export function flattenSession(blocks: IntervalBlock[]): { kind: 'run' | 'walk'; label: string; sec: number }[] {
  const out: { kind: 'run' | 'walk'; label: string; sec: number }[] = [];
  for (const b of blocks) {
    if (b.kind === 'repeat') {
      for (let i = 0; i < b.times; i++) {
        out.push({ kind: 'run', label: `Course lente ${i + 1}/${b.times}`, sec: b.runSec });
        out.push({ kind: 'walk', label: `Marche ${i + 1}/${b.times}`, sec: b.walkSec });
      }
    } else out.push({ kind: b.kind, label: b.label, sec: b.sec });
  }
  return out;
}

export function describeBlock(b: IntervalBlock): string {
  const m = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return sec ? `${min} min ${sec}` : `${min} min`;
  };
  if (b.kind === 'repeat') return `${b.times} × (${m(b.runSec)} de course lente + ${m(b.walkSec)} de marche)`;
  return `${m(b.sec)} — ${b.label}`;
}

/** Allure en secondes par km (null si distance inconnue). */
export function paceSecPerKm(durationSec: number, distanceKm?: number | null): number | null {
  if (!distanceKm || distanceKm <= 0 || durationSec <= 0) return null;
  return durationSec / distanceKm;
}

export function speedKmh(durationSec: number, distanceKm?: number | null): number | null {
  if (!distanceKm || distanceKm <= 0 || durationSec <= 0) return null;
  return distanceKm / (durationSec / 3600);
}

/** Parse « 7:30 » ou « 7'30 » (min/km) en secondes. */
export function parsePace(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})\s*[:'’]\s*(\d{1,2})"?$/);
  if (!m) return null;
  const sec = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 ? sec : null;
}

/** Parse « 25:30 », « 1:02:00 » ou « 25 » (minutes) en secondes. */
export function parseDuration(s: string): number | null {
  const t = s.trim();
  if (/^\d+([.,]\d+)?$/.test(t)) return Math.round(Number(t.replace(',', '.')) * 60);
  const parts = t.split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export interface Tolerance {
  canProgress: boolean;
  message: string;
}

/**
 * Faut-il passer à l'étape suivante ? Jamais automatique : on regarde les séances terminées
 * de la semaine. Douleur signalée ou effort perçu ≥ 8 → on conseille de répéter la semaine.
 */
export function assessTolerance(weekWorkouts: Workout[]): Tolerance {
  const done = weekWorkouts.filter((w) => w.completed);
  if (weekWorkouts.some((w) => w.pain && w.pain.trim())) {
    return { canProgress: false, message: 'Une douleur a été signalée cette semaine : répète la semaine actuelle, ou fais une pause. Si la douleur persiste, s’aggrave ou touche une articulation (genou notamment), demande l’avis d’un professionnel de santé avant de reprendre.' };
  }
  if (done.some((w) => (w.rpe ?? 0) >= 8)) {
    return { canProgress: false, message: 'Une séance a été ressentie comme très difficile (effort ≥ 8/10) : mieux vaut répéter cette semaine avant d’augmenter.' };
  }
  if (done.length < 2) {
    return { canProgress: false, message: 'Termine au moins 2 séances de la semaine avant de passer à la suivante.' };
  }
  return { canProgress: true, message: 'Séances bien tolérées : tu peux passer à la semaine suivante si tu te sens prêt.' };
}

/** Programme de reprise fourni (semaines 1 et 2), séances lundi / mercredi / samedi : repos entre chaque. */
export const DEFAULT_RUN_PLAN: RunSession[] = [
  {
    id: 'w1s1', week: 1, dayOffset: 0, title: 'Semaine 1 · Séance 1',
    blocks: [
      { kind: 'walk', label: 'Marche active (échauffement)', sec: 300 },
      { kind: 'repeat', times: 6, runSec: 60, walkSec: 120 },
      { kind: 'walk', label: 'Marche tranquille (retour au calme)', sec: 120 },
    ],
  },
  {
    id: 'w1s2', week: 1, dayOffset: 2, title: 'Semaine 1 · Séance 2', notes: 'Identique à la séance 1.',
    blocks: [
      { kind: 'walk', label: 'Marche active (échauffement)', sec: 300 },
      { kind: 'repeat', times: 6, runSec: 60, walkSec: 120 },
      { kind: 'walk', label: 'Marche tranquille (retour au calme)', sec: 120 },
    ],
  },
  {
    id: 'w1s3', week: 1, dayOffset: 5, title: 'Semaine 1 · Séance 3',
    blocks: [
      { kind: 'walk', label: 'Marche active (échauffement)', sec: 300 },
      { kind: 'repeat', times: 6, runSec: 90, walkSec: 120 },
      { kind: 'walk', label: 'Marche tranquille (retour au calme)', sec: 180 },
    ],
  },
  {
    id: 'w2s1', week: 2, dayOffset: 0, title: 'Semaine 2 · Séance 1',
    blocks: [
      { kind: 'walk', label: 'Marche active (échauffement)', sec: 300 },
      { kind: 'repeat', times: 5, runSec: 120, walkSec: 120 },
      { kind: 'walk', label: 'Marche tranquille (retour au calme)', sec: 120 },
    ],
  },
  {
    id: 'w2s2', week: 2, dayOffset: 2, title: 'Semaine 2 · Séance 2', notes: 'Identique à la séance 1.',
    blocks: [
      { kind: 'walk', label: 'Marche active (échauffement)', sec: 300 },
      { kind: 'repeat', times: 5, runSec: 120, walkSec: 120 },
      { kind: 'walk', label: 'Marche tranquille (retour au calme)', sec: 120 },
    ],
  },
  {
    id: 'w2s3', week: 2, dayOffset: 5, title: 'Semaine 2 · Séance 3',
    blocks: [
      { kind: 'walk', label: 'Marche active (échauffement)', sec: 300 },
      { kind: 'repeat', times: 4, runSec: 180, walkSec: 120 },
      { kind: 'walk', label: 'Marche tranquille (retour au calme)', sec: 300 },
    ],
  },
];

export const WORKOUT_TYPES: Record<string, string> = {
  course: 'Course à pied',
  course_marche: 'Course / marche (fractionné)',
  marche: 'Marche',
  velo: 'Vélo',
  renforcement: 'Renforcement',
  autre: 'Autre',
};

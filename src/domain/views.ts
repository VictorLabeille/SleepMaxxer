/**
 * Vues Semaine et Mois (cadrage §2.B, décision du 2026-09-06) : la donnée elle-même, autrement —
 * l'axe vertical est l'heure de la journée, de midi à midi, et chaque barre est la plage de
 * sommeil, si bien que la régularité des horaires se lit d'un coup d'œil. Une vue, pas une
 * statistique : la seule valeur calculée est la durée moyenne, comparée à la période précédente.
 */
import type { Night } from '../data/types';
import { addDays, isoDay, noonOf, parseDay } from './format';
import { isInProgress } from './nights';

export type Period = 'day' | 'week' | 'month';

export interface Range {
  from: string;
  to: string;
}

/** Du lundi au dimanche. */
export function weekOf(day: string): Range {
  const d = parseDay(day);
  const offset = (d.getDay() + 6) % 7;
  const from = addDays(day, -offset);
  return { from, to: addDays(from, 6) };
}

export function monthOf(day: string): Range {
  const d = parseDay(day);
  return {
    from: isoDay(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: isoDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

export function previousRange(period: Exclude<Period, 'day'>, r: Range): Range {
  if (period === 'week') return { from: addDays(r.from, -7), to: addDays(r.to, -7) };
  return monthOf(addDays(r.from, -1));
}

export function rangeDays(r: Range): string[] {
  const days: string[] = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) days.push(d);
  return days;
}

export function nightsIn<N extends Night>(nights: readonly N[], r: Range): N[] {
  return nights.filter((n) => n.day >= r.from && n.day <= r.to);
}

/** Durée moyenne des nuits complètes de la période ; `null` s'il n'y en a aucune. */
export function averageInBed(nights: readonly Night[]): number | null {
  const complete = nights.filter((n) => n.bedtime !== null && n.risetime !== null);
  if (complete.length === 0) return null;
  const total = complete.reduce((acc, n) => acc + ((n.risetime ?? 0) - (n.bedtime ?? 0)), 0);
  return total / complete.length;
}

export interface Bar {
  night: Night;
  /** Minutes depuis midi, le jour de la nuit. */
  startMin: number;
  endMin: number;
  estimated: boolean;
  ongoing: boolean;
}

export function nightBar(n: Night, now: number, estimated: boolean): Bar | null {
  if (n.bedtime === null) return null;
  const end = n.risetime ?? (isInProgress(n) ? now : null);
  if (end === null) return null;
  const noon = noonOf(n.day);
  const clamp = (v: number) => Math.min(1440, Math.max(0, v));
  return {
    night: n,
    startMin: clamp((n.bedtime - noon) / 60),
    endMin: clamp((end - noon) / 60),
    estimated,
    ongoing: n.risetime === null,
  };
}

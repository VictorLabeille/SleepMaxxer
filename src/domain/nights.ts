/**
 * Ce qu'une nuit du collecteur signifie pour l'interface : où elle en est, et d'où vient chacune
 * de ses heures. L'app restitue l'étiquette que le collecteur a posée ; elle n'en fabrique aucune.
 */
import type { Night } from '../data/types';

export type TimeOrigin = 'confirmé' | 'estimé' | 'corrigé';

export type NightPhase =
  /** Appui retenu par le collecteur, réveil pas encore joint : jamais « suivi en cours ». */
  | 'waiting-device'
  /** Session ouverte dans le réveil. */
  | 'ongoing'
  /** Session close par le firmware à l'heure de l'alarme ; le lever attend la fin de l'alarme. */
  | 'awaiting-rise'
  | 'complete'
  /** Close sans alarme (expiration à 12 h) : pas d'heure de lever, visiblement anormale. */
  | 'abnormal';

export function nightPhase(n: Night): NightPhase {
  if (n.state === 'pending_device') return 'waiting-device';
  if (n.state === 'open') return 'ongoing';
  if (n.state === 'abnormal') return n.risetime === null ? 'abnormal' : 'complete';
  return n.risetime === null ? 'awaiting-rise' : 'complete';
}

export function isInProgress(n: Night): boolean {
  const p = nightPhase(n);
  return p === 'waiting-device' || p === 'ongoing' || p === 'awaiting-rise';
}

/**
 * Confirmé : l'heure est mesurée — un geste dans l'app (`confirmed`), ou une transition que le
 * collecteur a vue (`observed`) : coucher relevé dans `wungt`, lever pris à l'extinction de
 * l'alarme. Corrigé : une correction à la main — elle ne produit jamais « estimé » (cadrage §6).
 * Estimé : une heure *déduite*. Depuis le 2026-09-16, plus rien n'en produit — le collecteur ne
 * déduit rien, et sans geste il n'ouvre aucune nuit. Le libellé est gardé pour le jour où une
 * déduction existera : le collecteur relève déjà la lumière et le bruit de la chambre.
 */
export function timeOrigin(n: Night, field: 'bedtime' | 'risetime'): TimeOrigin | null {
  const value = field === 'bedtime' ? n.bedtime : n.risetime;
  if (value === null) return null;
  const origin = field === 'bedtime' ? n.bedtime_origin : n.risetime_origin;
  if (origin === 'corrected') return 'corrigé';
  if (origin === 'estimated') return 'estimé';
  return 'confirmé';
}

/**
 * Le relevé d'une heure corrigée, à montrer à côté d'elle — le cadrage exige que la valeur
 * d'origine reste consultable. `null` quand l'heure n'est pas corrigée, et quand la nuit a été
 * copiée avant le 2026-09-15 : le collecteur ne servait pas encore le relevé.
 */
export function observedTime(
  n: Night,
  field: 'bedtime' | 'risetime',
): { value: number; origin: TimeOrigin } | null {
  const origin = field === 'bedtime' ? n.bedtime_origin : n.risetime_origin;
  if (origin !== 'corrected') return null;
  const value = field === 'bedtime' ? n.bedtime_observed : n.risetime_observed;
  if (value === null || value === undefined) return null;
  const observed = field === 'bedtime' ? n.bedtime_observed_origin : n.risetime_observed_origin;
  return { value, origin: observed === 'estimated' ? 'estimé' : 'confirmé' };
}

/** Temps au lit ; pour une nuit en cours, la durée qui court. */
export function inBedSeconds(n: Night, now: number): number | null {
  if (n.bedtime === null) return null;
  if (n.risetime !== null) return n.risetime - n.bedtime;
  if (isInProgress(n)) return Math.max(0, now - n.bedtime);
  return null;
}

/** Fin de la fenêtre de mesure d'une nuit : son lever, ou maintenant si elle court encore. */
export function nightEnd(n: Night, now: number): number | null {
  if (n.risetime !== null) return n.risetime;
  if (isInProgress(n)) return now;
  return null;
}

/** La nuit que les gestes concernent : la dernière, si elle n'est pas terminée. */
export function currentNight(nights: readonly Night[]): Night | null {
  let last: Night | null = null;
  for (const n of nights) {
    if (n.bedtime === null) continue;
    if (last === null || (last.bedtime ?? 0) < n.bedtime) last = n;
  }
  return last && isInProgress(last) ? last : null;
}

/**
 * L'instant d'une heure choisie à la roue. La roue ne donne qu'une heure et des minutes : on
 * retient, parmi les jours autour de celui de la nuit, l'instant le plus proche de la valeur
 * actuelle — ou, pour un lever qui n'existait pas, le premier qui suit le coucher. Une nuit à
 * cheval sur minuit se corrige ainsi sans avoir à choisir de date.
 */
export function resolveCorrection(n: Night, field: 'bedtime' | 'risetime', hour: number, minute: number): number {
  const [y, m, d] = n.day.split('-').map(Number);
  const candidates = [-1, 0, 1, 2].map((offset) => new Date(y, m - 1, d + offset, hour, minute).getTime() / 1000);
  const current = field === 'bedtime' ? n.bedtime : n.risetime;
  if (current !== null) {
    return candidates.reduce((best, c) => (Math.abs(c - current) < Math.abs(best - current) ? c : best));
  }
  const after = candidates.filter((c) => n.bedtime === null || c > n.bedtime);
  return after.length > 0 ? after[0] : candidates[1];
}

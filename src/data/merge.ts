/**
 * Règles de fusion d'un élément reçu du collecteur dans la copie locale. Partagées par la base
 * SQLite (qui les applique en SQL) et par les tests, pour qu'elles ne divergent pas.
 */
import type { Aggregate, Night, Outage } from './types';

/** Le collecteur fait autorité, mais une version plus ancienne d'une nuit n'en écrase pas une plus récente. */
export function acceptNight(existing: Night | undefined, incoming: Night): boolean {
  return existing === undefined || incoming.seq >= existing.seq;
}

export function acceptOutage(existing: Outage | undefined, incoming: Outage): boolean {
  return existing === undefined || incoming.seq >= existing.seq;
}

/** Un agrégat ne change pas ; seul son type, effacé par un mode de rattrapage, peut arriver après. */
export function mergeAggregate(existing: Aggregate | undefined, incoming: Aggregate): Aggregate {
  if (existing === undefined) return incoming;
  return { ...existing, kind: existing.kind ?? incoming.kind };
}

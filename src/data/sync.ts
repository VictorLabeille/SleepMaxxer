/**
 * Rattrapage de la copie locale : unidirectionnel, par ajout, reprenable (cadrage §2.C et §3.E).
 * Le collecteur fait autorité ; le téléphone tient une copie, jamais une source.
 *
 * Trois passes, chacune reprenable là où elle s'est arrêtée — chaque page s'enregistre avec son
 * curseur, d'un bloc :
 *
 * 1. **Récentes d'abord** : `GET /v1/sync?before=` sur deux pages de nuits, avec leurs points.
 *    C'est ce qu'on regarde ; la première réponse fixe aussi la séquence de référence.
 * 2. **Au fil de l'eau** : `since_seq` depuis le dernier élément reçu. Une nuit corrigée après
 *    copie reprend une séquence plus récente et revient d'office.
 * 3. **Tout le reste** : `since_seq=0` jusqu'à la séquence de référence, en fond. Le mode
 *    `before` ne porte ni les points hors des nuits, ni les indisponibilités (écart 6 du
 *    collecteur) : sans cette passe, la copie ne serait pas complète.
 *
 * Les points sont dédoublonnés par `seq`, les nuits par `id` — une nuit reçue deux fois est
 * remplacée par la version la plus récente du collecteur.
 */
import type { CollectorApi } from './api';
import type { Aggregate, Night, NightWithSeries, Outage, Reading, SyncItem } from './types';

export interface SyncPage {
  readings: Reading[];
  aggregates: Aggregate[];
  nights: Night[];
  outages: Outage[];
}

export interface SyncCursor {
  /** `current_seq` au premier contact : sépare le rattrapage de fond du fil de l'eau. */
  highSeq: number | null;
  /** Dernière séquence reçue au fil de l'eau. */
  liveSeq: number | null;
  /** Progression du rattrapage de fond, de 0 à `highSeq`. */
  backfillSeq: number | null;
  /** Borne de la dernière page de nuits récentes à demander, ou `null` quand c'est fait. */
  recentBefore: number | null;
  /** Rattrapage suspendu : le collecteur en sait moins que le téléphone. */
  suspended: string | null;
}

export interface SyncStore {
  getCursor(): Promise<SyncCursor>;
  /** Enregistre une page et le curseur qui la suit, d'un bloc : ce qui est copié l'est définitivement. */
  apply(page: SyncPage, cursor: Partial<SyncCursor>): Promise<void>;
}

export interface SyncProgress {
  phase: 'recent' | 'live' | 'backfill';
  /** Part du rattrapage de fond déjà faite, de 0 à 1. */
  fraction: number | null;
}

export type SyncOutcome = { kind: 'done' } | { kind: 'suspended'; reason: string };

export const RECENT_PAGE_NIGHTS = 7;
export const ITEMS_PAGE = 2000;

export const SUSPENDED_COLLECTOR_BEHIND =
  'Le collecteur en sait moins que ce téléphone : il a été réinstallé ou restauré depuis une ' +
  'sauvegarde plus ancienne. La copie locale est gardée intacte et le rattrapage est suspendu.';

const EMPTY: SyncPage = { readings: [], aggregates: [], nights: [], outages: [] };

function withoutSeries(n: NightWithSeries): Night {
  const { readings: _r, aggregates: _a, ...night } = n;
  return night;
}

export function pageFromNights(nights: readonly NightWithSeries[]): SyncPage {
  return {
    readings: nights.flatMap((n) => n.readings ?? []),
    aggregates: nights.flatMap((n) => n.aggregates ?? []),
    nights: nights.map(withoutSeries),
    outages: [],
  };
}

export function pageFromItems(items: readonly SyncItem[]): SyncPage {
  const page: SyncPage = { readings: [], aggregates: [], nights: [], outages: [] };
  for (const item of items) {
    switch (item.kind) {
      case 'reading': {
        const { kind: _k, ...reading } = item;
        page.readings.push(reading);
        break;
      }
      case 'aggregate': {
        // Le collecteur a écrasé le type de l'agrégat avec le genre de l'élément (écart 4) :
        // on le stocke sans type plutôt que de le deviner.
        const { kind: _k, ...rest } = item;
        page.aggregates.push({ ...rest, kind: null });
        break;
      }
      case 'night': {
        const { kind: _k, ...night } = item;
        page.nights.push(night);
        break;
      }
      case 'outage': {
        const { kind: _k, ...outage } = item;
        page.outages.push(outage);
        break;
      }
    }
  }
  return page;
}

function maxSeq(items: readonly { seq: number }[], floor: number): number {
  return items.reduce((acc, i) => Math.max(acc, i.seq), floor);
}

function oldestBedtime(nights: readonly Night[]): number | null {
  const times = nights.map((n) => n.bedtime).filter((t): t is number => t !== null);
  return times.length ? Math.min(...times) : null;
}

export interface SyncOptions {
  now: () => number;
  onProgress?: (p: SyncProgress) => void;
}

export async function runSync(
  api: CollectorApi,
  store: SyncStore,
  { now, onProgress }: SyncOptions,
): Promise<SyncOutcome> {
  let cursor = await store.getCursor();
  if (cursor.suspended) return { kind: 'suspended', reason: cursor.suspended };

  // Premier contact : les nuits les plus récentes, et la séquence de référence.
  if (cursor.highSeq === null) {
    onProgress?.({ phase: 'recent', fraction: null });
    const first = await api.syncBefore(now(), RECENT_PAGE_NIGHTS);
    const page = pageFromNights(first.nights);
    await store.apply(page, {
      highSeq: first.current_seq,
      liveSeq: first.current_seq,
      backfillSeq: 0,
      recentBefore: first.count >= RECENT_PAGE_NIGHTS ? oldestBedtime(page.nights) : null,
      suspended: null,
    });
    cursor = await store.getCursor();
  }

  // Une seconde page de nuits récentes, avant le reste.
  if (cursor.recentBefore !== null) {
    onProgress?.({ phase: 'recent', fraction: null });
    const r = await api.syncBefore(cursor.recentBefore, RECENT_PAGE_NIGHTS);
    await store.apply(pageFromNights(r.nights), { recentBefore: null });
  }

  // Au fil de l'eau.
  onProgress?.({ phase: 'live', fraction: null });
  let since = cursor.liveSeq ?? cursor.highSeq ?? 0;
  for (let firstPage = true; ; firstPage = false) {
    const r = await api.syncSince(since, ITEMS_PAGE);
    if (firstPage && r.current_seq < since) {
      // Le collecteur a perdu de la mémoire. S'aligner détruirait ce que la copie protège :
      // le téléphone garde tout et le dit (cadrage §3.E).
      await store.apply(EMPTY, { suspended: SUSPENDED_COLLECTOR_BEHIND });
      return { kind: 'suspended', reason: SUSPENDED_COLLECTOR_BEHIND };
    }
    if (r.count === 0) break;
    const next = maxSeq(r.items, since);
    await store.apply(pageFromItems(r.items), { liveSeq: next });
    since = next;
    if (r.count < ITEMS_PAGE) break;
  }

  // Tout le reste, jusqu'à la séquence de référence.
  const high = cursor.highSeq ?? 0;
  let back = cursor.backfillSeq ?? 0;
  while (back < high) {
    onProgress?.({ phase: 'backfill', fraction: high > 0 ? back / high : null });
    const r = await api.syncSince(back, ITEMS_PAGE);
    if (r.count === 0) {
      await store.apply(EMPTY, { backfillSeq: high });
      break;
    }
    const next = Math.min(maxSeq(r.items, back), high);
    await store.apply(pageFromItems(r.items), { backfillSeq: next });
    back = next;
  }
  return { kind: 'done' };
}

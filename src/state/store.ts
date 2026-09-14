/**
 * L'état vivant de l'app : où est le collecteur, ce qu'il dit du réveil, où en est le rattrapage.
 * Les données historiques, elles, sont dans la copie locale (SQLite) ; `dataVersion` avance à
 * chaque écriture pour que les écrans relisent.
 */
import { create } from 'zustand';

import type { CatalogResponse, CollectorStatus, DeviceMirror } from '../data/types';
import type { CollectorReach, NetworkKind } from './link';

export interface SyncState {
  running: boolean;
  phase: 'recent' | 'live' | 'backfill' | null;
  fraction: number | null;
  error: string | null;
  suspended: string | null;
  lastOkAt: number | null;
}

export interface AppState {
  booted: boolean;
  baseUrl: string | null;
  collector: CollectorReach;
  network: NetworkKind;
  status: CollectorStatus | null;
  /** Miroir de l'appareil. Hors liaison, le dernier connu, daté. */
  device: DeviceMirror | null;
  catalog: CatalogResponse | null;
  hasCopy: boolean;
  sync: SyncState;
  dataVersion: number;
}

export const useApp = create<AppState>(() => ({
  booted: false,
  baseUrl: null,
  collector: 'searching',
  network: 'unknown',
  status: null,
  device: null,
  catalog: null,
  hasCopy: false,
  sync: { running: false, phase: null, fraction: null, error: null, suspended: null, lastOkAt: null },
  dataVersion: 0,
}));

export function bumpData(): void {
  useApp.setState((s) => ({ dataVersion: s.dataVersion + 1 }));
}

export function setSync(patch: Partial<SyncState>): void {
  useApp.setState((s) => ({ sync: { ...s.sync, ...patch } }));
}

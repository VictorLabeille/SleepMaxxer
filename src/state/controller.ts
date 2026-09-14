/**
 * Chef d'orchestre : trouver le collecteur, tenir le miroir de l'appareil à jour, rattraper la
 * copie locale — à l'ouverture, au retour du réseau, au retour au premier plan, sans geste ni
 * redémarrage (cadrage §3.A). Pas de tâche de fond, pas de permission supplémentaire (§2.C).
 */
import * as Network from 'expo-network';
import { AppState, type AppStateStatus } from 'react-native';

import { CollectorUnreachableError, createCollectorApi, type CollectorApi } from '../data/api';
import { copyCounts, getMeta, getMetaJson, getMetaNumber, setMeta, setMetaJson, sqliteSyncStore } from '../data/db';
import { discoverCollector } from '../data/discovery';
import { runSync } from '../data/sync';
import type { CatalogResponse, DeviceMirror } from '../data/types';
import type { NetworkKind } from './link';
import { bumpData, setSync, useApp } from './store';

const LIVE_EVERY_MS = 15_000;
const SYNC_EVERY_MS = 5 * 60_000;
const RETRY_EVERY_MS = 30_000;

const META_URL = 'collector.url';
export const META_DEVICE = 'device.last';
const META_CATALOG = 'catalog.last';
export const META_LAST_SYNC = 'sync.lastOkAt';
export const META_FIRST_COPY = 'backup.firstCopyAt';

let api: CollectorApi | null = null;
let connecting: Promise<void> | null = null;
let timers: ReturnType<typeof setInterval>[] = [];
let started = false;

const now = () => Date.now() / 1000;

export function getApi(): CollectorApi | null {
  return api;
}

function networkKind(state: Network.NetworkState): NetworkKind {
  if (state.isConnected === false) return 'none';
  if (state.type === Network.NetworkStateType.WIFI || state.type === Network.NetworkStateType.ETHERNET) return 'wifi';
  if (state.type === Network.NetworkStateType.UNKNOWN || state.type === undefined) return 'unknown';
  return 'other';
}

export function markUnreachable(): void {
  api = null;
  useApp.setState({ collector: 'unreachable' });
}

async function tryUrl(url: string): Promise<boolean> {
  const candidate = createCollectorApi(url);
  try {
    const status = await candidate.status();
    api = candidate;
    useApp.setState({ baseUrl: candidate.baseUrl, collector: 'ok', status });
    await setMeta(META_URL, candidate.baseUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * L'adresse retenue d'abord (une requête), puis la découverte mDNS. `EXPO_PUBLIC_COLLECTOR_URL`
 * ne sert qu'au développement — émulateur, aperçu web — et n'existe pas dans une version livrée.
 */
export function connect(): Promise<void> {
  if (connecting) return connecting;
  connecting = (async () => {
    if (useApp.getState().collector !== 'ok') useApp.setState({ collector: 'searching' });
    const override = process.env.EXPO_PUBLIC_COLLECTOR_URL || null;
    const remembered = override ?? (await getMeta(META_URL));
    let ok = remembered ? await tryUrl(remembered) : false;
    if (!ok && !override) {
      const found = await discoverCollector();
      ok = found ? await tryUrl(found) : false;
    }
    if (!ok) {
      markUnreachable();
      return;
    }
    await Promise.all([refreshLive(), refreshCatalog()]);
    void syncNow();
  })().finally(() => {
    connecting = null;
  });
  return connecting;
}

export async function refreshLive(): Promise<void> {
  const a = api;
  if (!a) return;
  try {
    const [status, device] = await Promise.all([a.status(), a.device()]);
    useApp.setState({ status, device, collector: 'ok' });
    await setMetaJson(META_DEVICE, device);
  } catch (e) {
    if (e instanceof CollectorUnreachableError) markUnreachable();
  }
}

async function refreshCatalog(): Promise<void> {
  const a = api;
  if (!a) return;
  try {
    const catalog = await a.catalog();
    useApp.setState({ catalog });
    await setMetaJson(META_CATALOG, catalog);
  } catch {
    // Le catalogue en cache, ou à défaut le relevé de SleepMapper, prend le relais.
  }
}

/** Met à jour le miroir avec l'état relu par le relais après une écriture confirmée. */
export function applyConfirmedPort(port: string, body: unknown, observedAt: number | null): void {
  useApp.setState((s) => {
    if (!s.device) return {};
    const previous = s.device.ports[port];
    return {
      device: {
        ...s.device,
        ports: {
          ...s.device.ports,
          [port]: { body, since: observedAt ?? now(), observed_at: observedAt ?? now(), ...(previous ? {} : {}) },
        },
      } as DeviceMirror,
    };
  });
}

function describeSyncError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/full|SQLITE_FULL|no space|ENOSPC/i.test(message)) {
    return 'Espace disque insuffisant : le rattrapage s’est arrêté proprement, la copie existante reste lisible.';
  }
  return `Le rattrapage s’est interrompu (${message}). Il reprendra là où il s’est arrêté.`;
}

export async function syncNow(): Promise<void> {
  const a = api;
  if (!a || useApp.getState().sync.running) return;
  setSync({ running: true, error: null });
  try {
    const outcome = await runSync(a, sqliteSyncStore, {
      now,
      onProgress: (p) => {
        setSync({ phase: p.phase, fraction: p.fraction });
        bumpData();
      },
    });
    if (outcome.kind === 'suspended') {
      setSync({ suspended: outcome.reason });
    } else {
      const t = now();
      await setMeta(META_LAST_SYNC, String(t));
      if ((await getMeta(META_FIRST_COPY)) === null) await setMeta(META_FIRST_COPY, String(t));
      setSync({ lastOkAt: t, suspended: null });
    }
    useApp.setState({ hasCopy: (await copyCounts()).nights > 0 || useApp.getState().hasCopy });
  } catch (e) {
    if (e instanceof CollectorUnreachableError) markUnreachable();
    else setSync({ error: describeSyncError(e) });
  } finally {
    setSync({ running: false, phase: null, fraction: null });
    bumpData();
  }
}

/** Relit la copie après une restauration, sans attendre le collecteur. */
export async function reloadFromCopy(): Promise<void> {
  const counts = await copyCounts();
  const [lastOkAt, suspended, device] = await Promise.all([
    getMetaNumber(META_LAST_SYNC),
    getMeta('sync.suspended'),
    getMetaJson<DeviceMirror>(META_DEVICE),
  ]);
  useApp.setState((s) => ({
    hasCopy: counts.nights > 0 || counts.readings > 0,
    device: s.device ?? device,
    sync: { ...s.sync, lastOkAt, suspended },
  }));
  bumpData();
}

function onAppState(state: AppStateStatus): void {
  if (state !== 'active') return;
  if (api) {
    void refreshLive();
    void syncNow();
  } else {
    void connect();
  }
}

export async function start(): Promise<void> {
  if (started) return;
  started = true;
  const [counts, lastOkAt, suspended, device, catalog] = await Promise.all([
    copyCounts(),
    getMetaNumber(META_LAST_SYNC),
    getMeta('sync.suspended'),
    getMetaJson<DeviceMirror>(META_DEVICE),
    getMetaJson<CatalogResponse>(META_CATALOG),
  ]);
  useApp.setState((s) => ({
    booted: true,
    hasCopy: counts.nights > 0 || counts.readings > 0,
    device,
    catalog,
    sync: { ...s.sync, lastOkAt, suspended },
  }));

  try {
    useApp.setState({ network: networkKind(await Network.getNetworkStateAsync()) });
  } catch {
    useApp.setState({ network: 'unknown' });
  }
  Network.addNetworkStateListener((state) => {
    const kind = networkKind(state);
    const previous = useApp.getState().network;
    useApp.setState({ network: kind });
    if (kind !== previous && kind !== 'none') void connect();
  });
  AppState.addEventListener('change', onAppState);

  void connect();
  timers = [
    setInterval(() => {
      if (AppState.currentState === 'active' && api) void refreshLive();
    }, LIVE_EVERY_MS),
    setInterval(() => {
      if (AppState.currentState === 'active' && api) void syncNow();
    }, SYNC_EVERY_MS),
    setInterval(() => {
      if (AppState.currentState === 'active' && !api && !connecting) void connect();
    }, RETRY_EVERY_MS),
  ];
}

export function stopTimers(): void {
  timers.forEach(clearInterval);
  timers = [];
}

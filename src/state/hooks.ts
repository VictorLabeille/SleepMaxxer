/** Lectures de la copie locale et de l'état vivant, pour les écrans. */
import { useEffect, useMemo, useState } from 'react';

import { getMetaNumber, listNights, outagesOverlapping, readingsBetween, setMeta } from '../data/db';
import type { Night, Outage } from '../data/types';
import type { StoredNight } from '../domain/backup';
import { backupReminderDue, REMINDER_DAYS } from '../domain/backup';
import { dateTimeShort } from '../domain/format';
import { nightEnd } from '../domain/nights';
import type { ReadingPoint } from '../domain/stats';
import { META_FIRST_COPY } from './controller';
import { deriveLink, type LinkView } from './link';
import { useApp } from './store';

export const META_LAST_EXPORT = 'backup.lastExportAt';
const META_REMINDER_SNOOZE = 'backup.reminderSnoozedUntil';

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): { data: T | undefined; loading: boolean } {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean }>({ data: undefined, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true }));
    fn()
      .then((data) => alive && setState({ data, loading: false }))
      .catch(() => alive && setState((s) => ({ data: s.data, loading: false })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useNights(): { nights: StoredNight[]; loading: boolean } {
  const version = useApp((s) => s.dataVersion);
  const { data, loading } = useAsync(listNights, [version]);
  return { nights: data ?? [], loading: loading && data === undefined };
}

export function useCopyLabel(): string | null {
  const lastOkAt = useApp((s) => s.sync.lastOkAt);
  return lastOkAt ? `copie du ${dateTimeShort(lastOkAt)}` : null;
}

export function useLink(): LinkView {
  const collector = useApp((s) => s.collector);
  const network = useApp((s) => s.network);
  const status = useApp((s) => s.status);
  const hasCopy = useApp((s) => s.hasCopy);
  const copyLabel = useCopyLabel();
  return useMemo(
    () =>
      deriveLink({
        collector,
        network,
        deviceReachable: status ? status.reveil.joignable : null,
        deviceCause: status?.reveil.cause_indisponibilite ?? null,
        hasCopy,
        copyLabel,
      }),
    [collector, network, status, hasCopy, copyLabel],
  );
}

export interface NightSeries {
  readings: ReadingPoint[];
  outages: Outage[];
  start: number;
  end: number;
}

/** Les relevés et les indisponibilités d'une nuit, sur sa fenêtre : du coucher au lever. */
export function useNightSeries(night: Night | null, now: number): { series: NightSeries | null; loading: boolean } {
  const version = useApp((s) => s.dataVersion);
  // Une nuit en cours se relit à la minute, pas à chaque seconde.
  const minute = Math.floor(now / 60) * 60;
  const end = night ? nightEnd(night, minute) : null;
  const { data, loading } = useAsync(async () => {
    if (!night || night.bedtime === null || end === null) return null;
    const [readings, outages] = await Promise.all([
      readingsBetween(night.bedtime, end),
      outagesOverlapping(night.bedtime, end),
    ]);
    return { readings, outages, start: night.bedtime, end };
  }, [night?.id, night?.seq, night?.bedtime, end, version]);
  return { series: data ?? null, loading };
}

export function useBackupReminder(): { due: boolean; snooze: () => Promise<void> } {
  const version = useApp((s) => s.dataVersion);
  const [bump, setBump] = useState(0);
  const now = useNow(60_000);
  const { data } = useAsync(async () => {
    const [last, first, snoozed] = await Promise.all([
      getMetaNumber(META_LAST_EXPORT),
      getMetaNumber(META_FIRST_COPY),
      getMetaNumber(META_REMINDER_SNOOZE),
    ]);
    return backupReminderDue(Date.now() / 1000, last, first, snoozed);
  }, [version, bump, Math.floor(now / 3600)]);
  return {
    due: data ?? false,
    snooze: async () => {
      await setMeta(META_REMINDER_SNOOZE, String(Date.now() / 1000 + REMINDER_DAYS * 86400));
      setBump((b) => b + 1);
    },
  };
}

/**
 * Faux collecteur, en mémoire, qui reproduit le rattrapage du vrai (`store/db.py` du dépôt
 * Somneo-Scraper à `4019c88`) — y compris ses écarts connus : le mode `before` ne porte que les
 * nuits closes, et `since_seq` efface le type des agrégats. Les valeurs sont synthétiques : aucune
 * donnée réelle de la chambre ne vit dans ce dépôt public.
 */
import type { CollectorApi } from '../api';
import { acceptNight, acceptOutage, mergeAggregate } from '../merge';
import type { SyncCursor, SyncPage, SyncStore } from '../sync';
import type { Aggregate, AggregateKind, Night, Outage, Reading, SyncItem } from '../types';

export class FakeCollector {
  seq = 0;
  /** Sert l'ancien contrat : pas d'`aggregate_kind`, pas de relevé à côté d'une correction. Au
   *  moins un test doit garder cette forme — une copie faite avant le 2026-09-15 en est pleine. */
  legacy = false;
  readings: Reading[] = [];
  aggregates: Aggregate[] = [];
  nights: Night[] = [];
  outages: Outage[] = [];
  calls: string[] = [];

  private next(): number {
    this.seq += 1;
    return this.seq;
  }

  addReading(ts: number, temp = 20): void {
    this.readings.push({
      seq: this.next(), ts, mslux: 0, mstmp: temp, msrhu: 50, mssnd: 30,
      avlux: 0, avtmp: temp, avrhu: 50, avsnd: 30,
    });
  }

  addAggregate(ts: number, kind: AggregateKind): void {
    this.aggregates.push({ seq: this.next(), ts, kind, avg: 1, lo: 0, hi: 2, hist: null });
  }

  addNight(id: number, day: string, bedtime: number, risetime: number | null): void {
    this.nights.push({
      id, seq: this.next(), day, bedtime, risetime, state: risetime === null ? 'open' : 'closed',
      bedtime_origin: 'confirmed', risetime_origin: risetime === null ? null : 'confirmed',
      raw_tg2bd: null, raw_tendb: null,
    });
  }

  addOutage(id: number, start: number, end: number | null, cause: string): void {
    this.outages.push({ id, seq: this.next(), start, end, cause, failures: 1 });
  }

  /**
   * Comme le collecteur depuis le 2026-09-15 : la valeur servie change, l'origine devient
   * `corrected`, le relevé est gardé à côté et le retour entre au journal. La nuit reprend une
   * séquence, ce qui la fait revenir au rattrapage.
   */
  correct(id: number, field: 'bedtime' | 'risetime', value: number | null): void {
    const n = this.nights.find((x) => x.id === id);
    if (!n) throw new Error('nuit inconnue');
    if (!this.legacy && n.bedtime_observed === undefined) {
      n.bedtime_observed = n.bedtime;
      n.risetime_observed = n.risetime;
      n.bedtime_observed_origin = n.bedtime_origin;
      n.risetime_observed_origin = n.risetime_origin;
    }
    const observed = field === 'bedtime' ? n.bedtime_observed : n.risetime_observed;
    const observedOrigin = field === 'bedtime' ? n.bedtime_observed_origin : n.risetime_observed_origin;
    if (field === 'bedtime') {
      n.bedtime = value ?? observed ?? null;
      n.bedtime_origin = value === null ? observedOrigin ?? null : 'corrected';
    } else {
      n.risetime = value ?? observed ?? null;
      n.risetime_origin = value === null ? observedOrigin ?? null : 'corrected';
    }
    if (!this.legacy) {
      n.corrections = [
        ...(n.corrections ?? []),
        { id: (n.corrections?.length ?? 0) + 1, seq: this.seq + 1, night_id: id, ts: 0, field, value },
      ];
    }
    n.seq = this.next();
  }

  /** Collecteur réinstallé : sa mémoire repart de zéro. */
  wipe(): void {
    this.seq = 0;
    this.readings = [];
    this.aggregates = [];
    this.nights = [];
    this.outages = [];
  }

  api(): CollectorApi {
    const self = this;
    const unused = () => Promise.reject(new Error('non utilisé par ce test'));
    return {
      baseUrl: 'http://collecteur.test',
      async syncBefore(before, limit) {
        self.calls.push(`before:${before}`);
        const nights = self.nights
          .filter((n) => n.bedtime !== null && n.bedtime < before)
          .sort((a, b) => (b.bedtime ?? 0) - (a.bedtime ?? 0))
          .slice(0, limit)
          .map((n) => {
            if (n.bedtime === null || n.risetime === null) return { ...n };
            const inside = (ts: number) => ts >= (n.bedtime ?? 0) && ts <= (n.risetime ?? 0);
            return {
              ...n,
              readings: self.readings.filter((r) => inside(r.ts)).map((r) => ({ ...r })),
              aggregates: self.aggregates.filter((a) => inside(a.ts)).map((a) => ({ ...a })),
            };
          });
        return { served_at: 0, current_seq: self.seq, mode: 'before', before, count: nights.length, nights };
      },
      async syncSince(since, limit) {
        self.calls.push(`since:${since}`);
        const tables: [string, { seq: number }[]][] = [
          ['reading', self.readings],
          ['aggregate', self.aggregates],
          ['night', self.nights],
          ['outage', self.outages],
        ];
        const items: SyncItem[] = [];
        for (const [kind, rows] of tables) {
          rows
            .filter((r) => r.seq > since)
            .sort((a, b) => a.seq - b.seq)
            .slice(0, limit)
            // `kind` porte le genre de l'élément ; pour un agrégat, son type vient à côté, sous
            // `aggregate_kind` (contrat du 2026-09-15). En mode `legacy`, il manque.
            .forEach((r) => {
              const typed = kind === 'aggregate' && !self.legacy
                ? { aggregate_kind: (r as unknown as Aggregate).kind }
                : {};
              items.push({ ...r, kind, ...typed } as unknown as SyncItem);
            });
        }
        items.sort((a, b) => a.seq - b.seq);
        const page = items.slice(0, limit);
        return { served_at: 0, current_seq: self.seq, mode: 'since_seq', since_seq: since, count: page.length, items: page };
      },
      status: unused, device: unused, catalog: unused, night: unused, bedtime: unused, risetime: unused,
      correctNight: unused, light: unused, nightlight: unused, sunset: unused, sunsetSettings: unused,
      snooze: unused, alarm: unused, createAlarm: unused, updateAlarm: unused, deleteAlarm: unused,
      settingsSnapshot: unused, aggregatesFrom: unused,
    };
  }
}

/** La copie locale, en mémoire, avec les règles de fusion de la vraie. */
export class MemoryStore implements SyncStore {
  readings = new Map<number, Reading>();
  aggregates = new Map<number, Aggregate>();
  nights = new Map<number, Night>();
  outages = new Map<number, Outage>();
  cursor: SyncCursor = { highSeq: null, liveSeq: null, backfillSeq: null, recentBefore: null, suspended: null };
  applied: SyncPage[] = [];
  /** Échoue au n-ième enregistrement, pour simuler une app fermée en plein rattrapage. */
  failOnApply: number | null = null;

  async getCursor(): Promise<SyncCursor> {
    return { ...this.cursor };
  }

  async apply(page: SyncPage, cursor: Partial<SyncCursor>): Promise<void> {
    if (this.failOnApply !== null && this.applied.length + 1 === this.failOnApply) {
      this.failOnApply = null;
      throw new Error('interrompu');
    }
    this.applied.push(page);
    page.readings.forEach((r) => { if (!this.readings.has(r.seq)) this.readings.set(r.seq, r); });
    page.aggregates.forEach((a) => this.aggregates.set(a.seq, mergeAggregate(this.aggregates.get(a.seq), a)));
    page.nights.forEach((n) => { if (acceptNight(this.nights.get(n.id), n)) this.nights.set(n.id, n); });
    page.outages.forEach((o) => { if (acceptOutage(this.outages.get(o.id), o)) this.outages.set(o.id, o); });
    this.cursor = { ...this.cursor, ...cursor };
  }
}

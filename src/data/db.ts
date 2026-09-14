/**
 * La copie locale : complète, indéfinie, sans purge (cadrage §2.C). Une copie, jamais une source —
 * elle ne reçoit que ce que le collecteur sert, et les règles de fusion sont celles de `merge.ts`.
 */
import * as SQLite from 'expo-sqlite';

import type { StoredNight } from '../domain/backup';
import type { ReadingPoint } from '../domain/stats';
import type { Metric } from '../domain/thresholds';
import type { SyncCursor, SyncPage, SyncStore } from './sync';
import type { Aggregate, Night, Outage, Reading } from './types';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS reading (
  seq INTEGER PRIMARY KEY, ts REAL NOT NULL,
  mslux REAL, mstmp REAL, msrhu REAL, mssnd REAL,
  avlux REAL, avtmp REAL, avrhu REAL, avsnd REAL
);
CREATE INDEX IF NOT EXISTS idx_reading_ts ON reading (ts);
CREATE TABLE IF NOT EXISTS aggregate (
  seq INTEGER PRIMARY KEY, ts REAL NOT NULL, kind TEXT,
  avg REAL, lo REAL, hi REAL, hist TEXT
);
CREATE TABLE IF NOT EXISTS night (
  id INTEGER PRIMARY KEY, seq INTEGER NOT NULL, day TEXT NOT NULL,
  bedtime REAL, risetime REAL, state TEXT NOT NULL,
  bedtime_origin TEXT, risetime_origin TEXT, raw_tg2bd TEXT, raw_tendb TEXT,
  corrected TEXT
);
CREATE INDEX IF NOT EXISTS idx_night_bedtime ON night (bedtime);
CREATE TABLE IF NOT EXISTS outage (
  id INTEGER PRIMARY KEY, seq INTEGER NOT NULL, start REAL NOT NULL, "end" REAL,
  cause TEXT NOT NULL, failures INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outage_start ON outage (start);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('sleepmaxxer.db');
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}

type Executor = Pick<SQLite.SQLiteDatabase, 'runAsync'>;

// ---- méta ------------------------------------------------------------------------------

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

async function setMetaWith(ex: Executor, key: string, value: string | null): Promise<void> {
  if (value === null) await ex.runAsync('DELETE FROM meta WHERE key = ?', key);
  else await ex.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

export async function setMeta(key: string, value: string | null): Promise<void> {
  await setMetaWith(await getDb(), key, value);
}

export async function getMetaNumber(key: string): Promise<number | null> {
  const v = await getMeta(key);
  return v === null ? null : Number(v);
}

export async function getMetaJson<T>(key: string): Promise<T | null> {
  const v = await getMeta(key);
  if (v === null) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export async function setMetaJson(key: string, value: unknown): Promise<void> {
  await setMeta(key, value === null ? null : JSON.stringify(value));
}

// ---- écriture par lots -------------------------------------------------------------------

/** Insère par paquets : une requête par ligne coûterait un aller-retour natif chacune. */
async function insertRows(
  ex: Executor,
  head: string,
  tail: string,
  columns: number,
  rows: readonly (readonly SQLite.SQLiteBindValue[])[],
): Promise<void> {
  const perStatement = Math.max(1, Math.floor(900 / columns));
  const tuple = `(${new Array(columns).fill('?').join(', ')})`;
  for (let i = 0; i < rows.length; i += perStatement) {
    const chunk = rows.slice(i, i + perStatement);
    await ex.runAsync(`${head} VALUES ${chunk.map(() => tuple).join(', ')} ${tail}`, chunk.flat());
  }
}

const READING_COLUMNS = ['seq', 'ts', 'mslux', 'mstmp', 'msrhu', 'mssnd', 'avlux', 'avtmp', 'avrhu', 'avsnd'] as const;
const NIGHT_COLUMNS = [
  'id', 'seq', 'day', 'bedtime', 'risetime', 'state',
  'bedtime_origin', 'risetime_origin', 'raw_tg2bd', 'raw_tendb',
] as const;

async function writePage(ex: Executor, page: SyncPage): Promise<void> {
  await insertRows(
    ex,
    `INSERT OR IGNORE INTO reading (${READING_COLUMNS.join(', ')})`,
    '',
    READING_COLUMNS.length,
    page.readings.map((r) => READING_COLUMNS.map((c) => r[c] ?? null)),
  );
  await insertRows(
    ex,
    'INSERT INTO aggregate (seq, ts, kind, avg, lo, hi, hist)',
    'ON CONFLICT(seq) DO UPDATE SET kind = COALESCE(aggregate.kind, excluded.kind)',
    7,
    page.aggregates.map((a) => [a.seq, a.ts, a.kind, a.avg, a.lo, a.hi, a.hist]),
  );
  // Une nuit reçue deux fois : la version du collecteur remplace la copie, sauf si elle est plus
  // ancienne que celle déjà copiée. La mention « corrigé » connue du téléphone est gardée.
  await insertRows(
    ex,
    `INSERT INTO night (${NIGHT_COLUMNS.join(', ')})`,
    `ON CONFLICT(id) DO UPDATE SET ${NIGHT_COLUMNS.filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ')} WHERE excluded.seq >= night.seq`,
    NIGHT_COLUMNS.length,
    page.nights.map((n) => NIGHT_COLUMNS.map((c) => n[c] ?? null)),
  );
  await insertRows(
    ex,
    'INSERT INTO outage (id, seq, start, "end", cause, failures)',
    'ON CONFLICT(id) DO UPDATE SET seq = excluded.seq, start = excluded.start, "end" = excluded."end", cause = excluded.cause, failures = excluded.failures WHERE excluded.seq >= outage.seq',
    6,
    page.outages.map((o) => [o.id, o.seq, o.start, o.end, o.cause, o.failures]),
  );
}

// ---- rattrapage --------------------------------------------------------------------------

const CURSOR_KEYS: Record<keyof SyncCursor, string> = {
  highSeq: 'sync.highSeq',
  liveSeq: 'sync.liveSeq',
  backfillSeq: 'sync.backfillSeq',
  recentBefore: 'sync.recentBefore',
  suspended: 'sync.suspended',
};

export const sqliteSyncStore: SyncStore = {
  async getCursor() {
    const [highSeq, liveSeq, backfillSeq, recentBefore, suspended] = await Promise.all([
      getMetaNumber(CURSOR_KEYS.highSeq),
      getMetaNumber(CURSOR_KEYS.liveSeq),
      getMetaNumber(CURSOR_KEYS.backfillSeq),
      getMetaNumber(CURSOR_KEYS.recentBefore),
      getMeta(CURSOR_KEYS.suspended),
    ]);
    return { highSeq, liveSeq, backfillSeq, recentBefore, suspended };
  },
  async apply(page, cursor) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await writePage(txn, page);
      for (const [k, v] of Object.entries(cursor) as [keyof SyncCursor, number | string | null][]) {
        await setMetaWith(txn, CURSOR_KEYS[k], v === null ? null : String(v));
      }
    });
  },
};

// ---- lectures ----------------------------------------------------------------------------

export async function listNights(): Promise<StoredNight[]> {
  const db = await getDb();
  return db.getAllAsync<StoredNight>('SELECT * FROM night ORDER BY bedtime ASC, id ASC');
}

export async function readingsBetween(from: number, to: number): Promise<ReadingPoint[]> {
  const db = await getDb();
  return db.getAllAsync<ReadingPoint>(
    'SELECT ts, mslux, mstmp, msrhu, mssnd FROM reading WHERE ts >= ? AND ts <= ? ORDER BY ts',
    from,
    to,
  );
}

export async function outagesOverlapping(from: number, to: number): Promise<Outage[]> {
  const db = await getDb();
  return db.getAllAsync<Outage>(
    'SELECT * FROM outage WHERE start < ? AND COALESCE("end", 1e12) > ? ORDER BY start',
    to,
    from,
  );
}

export async function latestReading(): Promise<Reading | null> {
  const db = await getDb();
  return db.getFirstAsync<Reading>('SELECT * FROM reading ORDER BY ts DESC LIMIT 1');
}

export type NightAverages = Map<number, Partial<Record<Metric, number | null>>>;

/** Moyenne de chaque grandeur, par nuit close — pour le calendrier. */
export async function nightAverages(): Promise<NightAverages> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; temp: number | null; hum: number | null; lux: number | null; snd: number | null }>(
    `SELECT n.id AS id, AVG(r.mstmp) AS temp, AVG(r.msrhu) AS hum, AVG(r.mslux) AS lux, AVG(r.mssnd) AS snd
       FROM night n JOIN reading r ON r.ts >= n.bedtime AND r.ts <= n.risetime
      WHERE n.bedtime IS NOT NULL AND n.risetime IS NOT NULL
      GROUP BY n.id`,
  );
  return new Map(rows.map((r) => [r.id, { temp: r.temp, hum: r.hum, lux: r.lux, snd: r.snd }]));
}

export interface CopyCounts {
  nights: number;
  readings: number;
  aggregates: number;
  outages: number;
}

export async function copyCounts(): Promise<CopyCounts> {
  const db = await getDb();
  const row = await db.getFirstAsync<CopyCounts>(
    `SELECT (SELECT COUNT(*) FROM night) AS nights, (SELECT COUNT(*) FROM reading) AS readings,
            (SELECT COUNT(*) FROM aggregate) AS aggregates, (SELECT COUNT(*) FROM outage) AS outages`,
  );
  return row ?? { nights: 0, readings: 0, aggregates: 0, outages: 0 };
}

// ---- réponses d'écriture -----------------------------------------------------------------

/**
 * Une nuit renvoyée par le collecteur après un geste ou une correction : c'est l'état confirmé,
 * pas un affichage optimiste. `correctedField` garde en mémoire qu'une heure a été corrigée ici,
 * ce que le collecteur ne sert pas encore (écart 2).
 */
export async function storeNightFromCollector(
  night: Night,
  correctedFields: readonly string[] = [],
): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await writePage(txn, { readings: [], aggregates: [], outages: [], nights: [night] });
    if (correctedFields.length > 0) {
      const row = await txn.getFirstAsync<{ corrected: string | null }>('SELECT corrected FROM night WHERE id = ?', night.id);
      const set = new Set((row?.corrected ?? '').split(',').filter(Boolean));
      correctedFields.forEach((f) => set.add(f));
      await txn.runAsync('UPDATE night SET corrected = ? WHERE id = ?', [...set].join(','), night.id);
    }
  });
}

// ---- sauvegarde ----------------------------------------------------------------------------

export async function readEverything(): Promise<{
  nights: StoredNight[];
  readings: Reading[];
  aggregates: Aggregate[];
  outages: Outage[];
}> {
  const db = await getDb();
  const [nights, readings, aggregates, outages] = await Promise.all([
    db.getAllAsync<StoredNight>('SELECT * FROM night ORDER BY id'),
    db.getAllAsync<Reading>('SELECT * FROM reading ORDER BY seq'),
    db.getAllAsync<Aggregate>('SELECT * FROM aggregate ORDER BY seq'),
    db.getAllAsync<Outage>('SELECT * FROM outage ORDER BY id'),
  ]);
  return { nights, readings, aggregates, outages };
}

/** Restauration : remplacement complet et atomique, jamais partiel (cadrage §3.E). */
export async function replaceEverything(data: {
  nights: StoredNight[];
  readings: Reading[];
  aggregates: Aggregate[];
  outages: Outage[];
  cursor: SyncCursor;
}): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync('DELETE FROM reading; DELETE FROM aggregate; DELETE FROM night; DELETE FROM outage;');
    await writePage(txn, { readings: data.readings, aggregates: data.aggregates, nights: data.nights, outages: data.outages });
    for (const n of data.nights) {
      if (n.corrected) await txn.runAsync('UPDATE night SET corrected = ? WHERE id = ?', n.corrected, n.id);
    }
    for (const [k, v] of Object.entries(data.cursor) as [keyof SyncCursor, number | string | null][]) {
      await setMetaWith(txn, CURSOR_KEYS[k], v === null ? null : String(v));
    }
  });
}

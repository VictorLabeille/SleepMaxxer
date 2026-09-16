/**
 * Sauvegarde exportée vers le Drive (cadrage §2.C) : les données **et** les réglages du réveil,
 * pour remettre en état un téléphone neuf, ou un réveil réinitialisé. Le fichier sert à
 * restaurer ; le téléphone sert à consulter.
 *
 * Un fichier invalide — tronqué, d'une autre app, d'une version future — est refusé net : jamais
 * d'import partiel (cadrage §3.E).
 */
import type { SyncCursor } from '../data/sync';
import type { Aggregate, DeviceMirror, Night, NightCorrection, Outage, Reading, SettingsSnapshot } from '../data/types';

export const BACKUP_FORMAT = 'sleepmaxxer-backup';
/** 2 depuis le 2026-09-16 : le journal des corrections et l'instantané des réglages s'y ajoutent.
 *  Une sauvegarde de version 1 se relit telle quelle — ses deux champs arrivent vides. */
export const BACKUP_VERSION = 2;

/** Palier du rappel de sauvegarde, en jours (cadrage §6 : compté en jours, la donnée arrivant seule). */
export const REMINDER_DAYS = 7;

/**
 * Une nuit de la copie locale. Depuis le 2026-09-16, elle ne porte rien que le collecteur n'ait
 * servi : l'origine servie fait foi, le téléphone n'a plus de mémoire des corrections (§9.1).
 */
export type StoredNight = Night;

export interface BackupContent {
  nights: StoredNight[];
  readings: Reading[];
  aggregates: Aggregate[];
  outages: Outage[];
  corrections: NightCorrection[];
  cursor: SyncCursor;
  settings: DeviceMirror | null;
  /** L'instantané des seize profils, **à côté** de `settings` et non à sa place (§9.6) : s'il
   *  manque, l'export garde ce que `settings` donnait déjà. */
  snapshot: SettingsSnapshot | null;
}

const READING_COLUMNS = ['seq', 'ts', 'mslux', 'mstmp', 'msrhu', 'mssnd', 'avlux', 'avtmp', 'avrhu', 'avsnd'] as const;
const AGGREGATE_COLUMNS = ['seq', 'ts', 'kind', 'avg', 'lo', 'hi', 'hist'] as const;

export function buildBackup(content: BackupContent, exportedAt: number, appVersion: string): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: exportedAt,
    app: `SleepMaxxer ${appVersion}`,
    nights: content.nights,
    outages: content.outages,
    // Colonnes nommées une fois : un an de relevés se compte déjà en dizaines de Mo.
    readings: { columns: READING_COLUMNS, rows: content.readings.map((r) => READING_COLUMNS.map((c) => r[c])) },
    aggregates: { columns: AGGREGATE_COLUMNS, rows: content.aggregates.map((a) => AGGREGATE_COLUMNS.map((c) => a[c])) },
    corrections: content.corrections,
    cursor: content.cursor,
    settings: content.settings,
    snapshot: content.snapshot,
  });
}

/** Taille annoncée avant l'export (cadrage §3.E), à partir des volumes de la copie. */
export function estimateBackupBytes(counts: { nights: number; readings: number; aggregates: number; outages: number }): number {
  return 2000 + counts.nights * 260 + counts.readings * 72 + counts.aggregates * 90 + counts.outages * 90;
}

export type ParsedBackup = { ok: true; content: BackupContent; exportedAt: number } | { ok: false; reason: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isStrOrNull = (v: unknown) => v === null || typeof v === 'string';
const NIGHT_STATES = new Set(['pending_device', 'open', 'closed', 'abnormal']);

function table<T>(value: unknown, columns: readonly string[], check: (row: unknown[]) => boolean): T[] | null {
  if (!value || typeof value !== 'object') return null;
  const t = value as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(t.columns) || t.columns.join(',') !== columns.join(',')) return null;
  if (!Array.isArray(t.rows)) return null;
  const out: T[] = [];
  for (const row of t.rows) {
    if (!Array.isArray(row) || row.length !== columns.length || !check(row)) return null;
    out.push(Object.fromEntries(columns.map((c, i) => [c, row[i]])) as T);
  }
  return out;
}

function validNight(n: unknown): n is StoredNight {
  if (!n || typeof n !== 'object') return false;
  const o = n as Record<string, unknown>;
  return (
    isNum(o.id) && isNum(o.seq) && typeof o.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.day) &&
    isNumOrNull(o.bedtime) && isNumOrNull(o.risetime) && typeof o.state === 'string' && NIGHT_STATES.has(o.state) &&
    isStrOrNull(o.bedtime_origin ?? null) && isStrOrNull(o.risetime_origin ?? null)
  );
}

function validCorrection(c: unknown): c is NightCorrection {
  if (!c || typeof c !== 'object') return false;
  const x = c as Record<string, unknown>;
  return (
    isNum(x.id) && isNum(x.seq) && isNum(x.night_id) && isNum(x.ts) &&
    (x.field === 'bedtime' || x.field === 'risetime') && isNumOrNull(x.value ?? null)
  );
}

function validOutage(o: unknown): o is Outage {
  if (!o || typeof o !== 'object') return false;
  const x = o as Record<string, unknown>;
  return isNum(x.id) && isNum(x.seq) && isNum(x.start) && isNumOrNull(x.end) && typeof x.cause === 'string';
}

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Le fichier n'est pas une sauvegarde lisible : il est peut-être tronqué." };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: "Ce fichier n'est pas une sauvegarde SleepMaxxer." };
  const b = raw as Record<string, unknown>;
  if (b.format !== BACKUP_FORMAT) return { ok: false, reason: "Ce fichier n'est pas une sauvegarde SleepMaxxer." };
  if (!isNum(b.version) || b.version > BACKUP_VERSION) {
    return { ok: false, reason: 'Cette sauvegarde vient d’une version plus récente de l’app : elle ne peut pas être relue ici.' };
  }
  const corrupt: ParsedBackup = { ok: false, reason: 'La sauvegarde est incomplète ou abîmée. Rien n’a été modifié.' };
  if (!Array.isArray(b.nights) || !b.nights.every(validNight)) return corrupt;
  if (!Array.isArray(b.outages) || !b.outages.every(validOutage)) return corrupt;
  const readings = table<Reading>(b.readings, READING_COLUMNS, (r) => isNum(r[0]) && isNum(r[1]) && r.slice(2).every(isNumOrNull));
  const aggregates = table<Aggregate>(b.aggregates, AGGREGATE_COLUMNS, (r) => isNum(r[0]) && isNum(r[1]) && isStrOrNull(r[2]));
  if (!readings || !aggregates) return corrupt;
  // Version 1 : ni journal ni instantané. Leur absence n'est pas une corruption.
  const rawCorrections = b.corrections ?? [];
  if (!Array.isArray(rawCorrections) || !rawCorrections.every(validCorrection)) return corrupt;
  const c = (b.cursor ?? {}) as Record<string, unknown>;
  const cursor: SyncCursor = {
    highSeq: isNum(c.highSeq) ? c.highSeq : null,
    liveSeq: isNum(c.liveSeq) ? c.liveSeq : null,
    backfillSeq: isNum(c.backfillSeq) ? c.backfillSeq : null,
    recentBefore: isNum(c.recentBefore) ? c.recentBefore : null,
    suspended: typeof c.suspended === 'string' ? c.suspended : null,
  };
  return {
    ok: true,
    exportedAt: isNum(b.exported_at) ? b.exported_at : 0,
    content: {
      nights: b.nights as StoredNight[],
      outages: b.outages as Outage[],
      readings,
      aggregates,
      corrections: rawCorrections as NightCorrection[],
      cursor,
      settings: (b.settings as DeviceMirror | null) ?? null,
      snapshot: (b.snapshot as SettingsSnapshot | null) ?? null,
    },
  };
}

/**
 * Invite non bloquante quand du temps a passé depuis le dernier export réussi. Fermée sans agir,
 * elle revient au palier suivant, pas à chaque ouverture ; un export annulé ne compte pas.
 */
export function backupReminderDue(
  now: number,
  lastExportAt: number | null,
  firstCopyAt: number | null,
  snoozedUntil: number | null,
): boolean {
  const reference = lastExportAt ?? firstCopyAt;
  if (reference === null) return false;
  if (snoozedUntil !== null && now < snoozedUntil) return false;
  return now - reference >= REMINDER_DAYS * 86400;
}

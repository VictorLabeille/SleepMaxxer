/**
 * Alarmes : jours de répétition, PowerWake, et ce qu'une édition envoie au relais.
 */
import type { AlarmEdit, AlarmProfile } from '../data/types';

/**
 * Bornes relevées dans SleepMapper (`docs/sleepmapper/README.md`), vérifiées aussi par le relais
 * du collecteur. **Elles ne s'uniformisent pas** : un lever de soleil ne s'éteint pas (minimum 1),
 * un coucher de soleil si (minimum 0), et leurs durées maximales diffèrent.
 */
export const BOUNDS = {
  riseDuration: { min: 5, max: 40, step: 5 },
  riseIntensity: { min: 1, max: 25, step: 1 },
  volume: { min: 1, max: 25, step: 1 },
  snooze: { min: 1, max: 20, step: 1 },
  /** Minutes après l'heure de l'alarme (relevé dans SleepMapper le 2026-09-13). */
  powerwakeDelta: { min: 1, max: 59, step: 1 },
  lightLevel: { min: 1, max: 25, step: 1 },
  sunsetDuration: { min: 5, max: 60, step: 5 },
  sunsetIntensity: { min: 0, max: 25, step: 1 },
} as const;

/** Masque `daynm` : bit 1 = lundi … bit 7 = dimanche (`docs/somneo-api.md` §4). */
export const DAY_BITS = [2, 4, 8, 16, 32, 64, 128] as const;
export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function maskToDays(mask: number): boolean[] {
  return DAY_BITS.map((bit) => (mask & bit) !== 0);
}

export function daysToMask(days: readonly boolean[]): number {
  return DAY_BITS.reduce((acc, bit, i) => (days[i] ? acc | bit : acc), 0);
}

/**
 * Libellé déduit de la combinaison cochée, comme dans SleepMapper, où les jours se cochent un à
 * un sans raccourci.
 */
export function daysLabel(mask: number | null): string {
  if (mask === null) return '';
  if (mask === 0) return 'Une seule fois';
  if (mask === 254) return 'Tous les jours';
  if (mask === 62) return 'Jours de la semaine';
  if (mask === 192) return 'Week-end';
  return DAY_SHORT.filter((_, i) => (mask & DAY_BITS[i]) !== 0).join(' ');
}

const minutesOf = (h: number, m: number) => h * 60 + m;

/** Délai du PowerWake après l'alarme, en minutes, ou `null` s'il n'est pas armé. */
export function powerwakeDelta(p: Pick<AlarmProfile, 'pwrsz' | 'pszhr' | 'pszmn' | 'almhr' | 'almmn'>): number | null {
  if (!p.pwrsz) return null;
  return (minutesOf(p.pszhr, p.pszmn) - minutesOf(p.almhr, p.almmn) + 1440) % 1440;
}

export function addMinutes(hour: number, minute: number, delta: number): { hour: number; minute: number } {
  const total = (minutesOf(hour, minute) + delta + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

export interface AlarmForm {
  hour: number;
  minute: number;
  days: number;
  ctype: number;
  curve: number;
  durat: number;
  snddv: string;
  sndch: string;
  sndlv: number;
  powerwakeOn: boolean;
  powerwakeDelta: number;
}

const DEFAULT_POWERWAKE_DELTA = 10;

export function formFromProfile(p: AlarmProfile): AlarmForm {
  const delta = powerwakeDelta(p);
  return {
    hour: p.almhr,
    minute: p.almmn,
    days: p.daynm,
    ctype: p.ctype,
    curve: p.curve,
    durat: p.durat,
    snddv: p.snddv,
    sndch: String(p.sndch ?? ''),
    sndlv: p.sndlv,
    powerwakeOn: delta !== null,
    powerwakeDelta: delta ?? DEFAULT_POWERWAKE_DELTA,
  };
}

/**
 * Ce qui a changé, et seulement cela. Le PowerWake est renvoyé dès que l'heure bouge : le relais
 * calcule son heure depuis celle de l'alarme, et une alarme déplacée sans lui laisserait le
 * PowerWake à l'ancienne heure.
 */
export function alarmEdit(before: AlarmForm, after: AlarmForm): AlarmEdit {
  const edit: AlarmEdit = {};
  if (after.hour !== before.hour) edit.hour = after.hour;
  if (after.minute !== before.minute) edit.minute = after.minute;
  if (after.days !== before.days) edit.days = after.days;
  if (after.ctype !== before.ctype) edit.ctype = after.ctype;
  if (after.curve !== before.curve) edit.curve = after.curve;
  if (after.durat !== before.durat) edit.durat = after.durat;
  if (after.snddv !== before.snddv || after.sndch !== before.sndch) {
    edit.snddv = after.snddv;
    edit.sndch = after.sndch;
  }
  if (after.sndlv !== before.sndlv) edit.sndlv = after.sndlv;
  const timeMoved = edit.hour !== undefined || edit.minute !== undefined;
  const powerwakeChanged =
    after.powerwakeOn !== before.powerwakeOn ||
    (after.powerwakeOn && after.powerwakeDelta !== before.powerwakeDelta);
  if (powerwakeChanged || (after.powerwakeOn && timeMoved)) {
    edit.powerwake = after.powerwakeOn
      ? { on: true, delta: after.powerwakeDelta }
      : { on: false };
  }
  return edit;
}

export function isEmptyEdit(edit: AlarmEdit): boolean {
  return Object.keys(edit).length === 0;
}

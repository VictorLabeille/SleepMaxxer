/**
 * Mise en forme des heures, durées, dates et mesures. Heures et dates en heure locale du
 * téléphone ; les durées se calculent en secondes depuis l'époque, ce qui garde juste une nuit qui
 * traverse le changement d'heure (cadrage §3.F).
 */
import { type Band, type Metric, METRICS } from './thresholds';

export const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export const pad2 = (n: number): string => String(n).padStart(2, '0');

const NARROW_NBSP = '\u202f';

/** Nombre à la française : virgule décimale, espace fine entre milliers. */
export function formatNumber(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
  const sign = value < 0 && Number(fixed) !== 0 ? '−' : '';
  return sign + grouped + (frac ? `,${frac}` : '');
}

/** Une mesure avec la précision de son capteur — aucun arrondi qui invente de la précision. */
export function formatMeasure(metric: Metric, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return formatNumber(value, METRICS[metric].decimals);
}

export function bandRangeLabel(metric: Metric, b: Band): string {
  const unit = METRICS[metric].unit;
  const n = (v: number) => formatNumber(v, 0);
  if (b.from !== null && b.to === null) return `${n(b.from)} ${unit} et plus`;
  if (b.from === null && b.to !== null) return `moins de ${n(b.to)} ${unit}`;
  return `${n(b.from ?? 0)} – ${n(b.to ?? 0)} ${unit}`;
}

export function hhmm(epoch: number): string {
  const d = new Date(epoch * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** « 7:22 » — le chiffre porteur du disque. */
export function durationShort(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  return `${Math.floor(minutes / 60)}:${pad2(minutes % 60)}`;
}

/** « 7 h 22 » — dans une phrase. */
export function durationLong(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  return `${Math.floor(minutes / 60)} h ${pad2(minutes % 60)}`;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Minuit local du jour donné. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

export function dayOfEpoch(epoch: number): string {
  return isoDay(new Date(epoch * 1000));
}

/** Midi local du jour : l'origine de l'axe « midi → midi » des vues agrégées. */
export function noonOf(day: string): number {
  const d = parseDay(day);
  d.setHours(12, 0, 0, 0);
  return d.getTime() / 1000;
}

const dayNumber = (n: number): string => (n === 1 ? '1er' : String(n));

export function dayMonth(day: string): string {
  const d = parseDay(day);
  return `${dayNumber(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

export function monthYear(year: number, monthIndex: number): string {
  return `${MONTHS[monthIndex]} ${year}`;
}

export function dateShort(epoch: number): string {
  const d = new Date(epoch * 1000);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function dateTimeShort(epoch: number): string {
  return `${dateShort(epoch)} à ${hhmm(epoch)}`;
}

/**
 * « Nuit du 13 au 14 septembre ». Une nuit est rattachée au jour de son coucher (cadrage §3.B) :
 * un coucher après minuit appartient donc au jour qui commence, et s'intitule « Nuit du 14
 * septembre » plutôt que d'annoncer un soir qui n'est pas le sien.
 */
export function nightLabel(night: { day: string; bedtime: number | null }): string {
  const start = parseDay(night.day);
  if (night.bedtime !== null && new Date(night.bedtime * 1000).getHours() < 12) {
    return `Nuit du ${dayMonth(night.day)}`;
  }
  const next = parseDay(addDays(night.day, 1));
  if (next.getMonth() === start.getMonth()) {
    return `Nuit du ${dayNumber(start.getDate())} au ${dayNumber(next.getDate())} ${MONTHS[start.getMonth()]}`;
  }
  return `Nuit du ${dayMonth(night.day)} au ${dayMonth(isoDay(next))}`;
}

export function ago(epoch: number, now: number): string {
  const s = now - epoch;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `le ${dateTimeShort(epoch)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 0)} ko`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} Mo`;
}

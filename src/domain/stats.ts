/**
 * Minimum, moyenne, maximum et trous de collecte, calculés sur la copie locale : ils se
 * recalculent, donc ils ne divergent jamais de leur série, et ils marchent hors du domicile.
 */
import type { Metric } from './thresholds';

export interface ReadingPoint {
  ts: number;
  mslux: number | null;
  mstmp: number | null;
  msrhu: number | null;
  mssnd: number | null;
}

export const READING_KEY = {
  temp: 'mstmp',
  hum: 'msrhu',
  lux: 'mslux',
  snd: 'mssnd',
} as const satisfies Record<Metric, keyof ReadingPoint>;

export interface Summary {
  min: number;
  avg: number;
  max: number;
  count: number;
  /** Premier et dernier relevé : la période réellement couverte. */
  first: number;
  last: number;
}

/** Porte sur ce qui a été mesuré, jamais sur la nuit entière (cadrage §3.C). */
export function summarize(readings: readonly ReadingPoint[], metric: Metric): Summary | null {
  const key = READING_KEY[metric];
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  let first = Infinity;
  let last = -Infinity;
  for (const r of readings) {
    const v = r[key];
    if (v === null || v === undefined) continue;
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
    count += 1;
    first = Math.min(first, r.ts);
    last = Math.max(last, r.ts);
  }
  if (count === 0) return null;
  return { min, avg: sum / count, max, count, first, last };
}

/** Pas de collecte médian, en secondes. La cadence est un réglage du collecteur (60, 30, 15 s). */
export function medianStep(timestamps: readonly number[]): number {
  if (timestamps.length < 2) return 60;
  const deltas: number[] = [];
  for (let i = 1; i < timestamps.length; i += 1) deltas.push(timestamps[i] - timestamps[i - 1]);
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)] || 60;
}

export interface Gap {
  from: number;
  to: number;
}

/**
 * Les trous d'une série sur une fenêtre : avant le premier relevé, entre deux relevés trop
 * éloignés, après le dernier. Un trou se montre, il ne se comble jamais par interpolation.
 */
export function findGaps(
  timestamps: readonly number[],
  windowStart: number,
  windowEnd: number,
  step = medianStep(timestamps),
): Gap[] {
  const threshold = Math.max(3 * step, 150);
  if (timestamps.length === 0) return windowEnd > windowStart ? [{ from: windowStart, to: windowEnd }] : [];
  const gaps: Gap[] = [];
  if (timestamps[0] - windowStart > threshold) gaps.push({ from: windowStart, to: timestamps[0] });
  for (let i = 1; i < timestamps.length; i += 1) {
    if (timestamps[i] - timestamps[i - 1] > threshold) {
      gaps.push({ from: timestamps[i - 1], to: timestamps[i] });
    }
  }
  const last = timestamps[timestamps.length - 1];
  if (windowEnd - last > threshold) gaps.push({ from: last, to: windowEnd });
  return gaps;
}

export interface OutageSpan {
  start: number;
  end: number | null;
  cause: string;
}

const CAUSE_LABELS: Record<string, string> = {
  'collecteur arrêté': 'collecteur arrêté',
  'carte hors réseau': 'carte hors réseau',
  'réveil injoignable': 'réveil injoignable',
  'appareil saturé': 'réveil saturé',
};

/**
 * Les causes d'un trou, telles que le collecteur les a enregistrées. Aucune n'est déduite : un
 * trou qu'aucune indisponibilité ne couvre dit que la cause manque (cadrage §3.C).
 */
export function gapCause(gap: Gap, outages: readonly OutageSpan[], now: number): string {
  const causes = new Set<string>();
  for (const o of outages) {
    const end = o.end ?? now;
    if (o.start < gap.to && end > gap.from) causes.add(CAUSE_LABELS[o.cause] ?? o.cause);
  }
  if (causes.size === 0) return 'cause non fournie par le collecteur';
  return [...causes].join(', ');
}

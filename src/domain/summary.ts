/**
 * Le résumé d'une nuit pour le coach Google Health : un texte copié tel quel, qui dit ce qui
 * manque plutôt que de l'omettre (cadrage §3.G). Contenu : la proposition du cadrage §6 —
 * date, coucher, lever, temps au lit, puis min / moyenne / max par grandeur.
 */
import type { Night } from '../data/types';
import { durationLong, formatMeasure, hhmm, nightLabel, parseDay } from './format';
import { type TimeOrigin, isInProgress } from './nights';
import type { Summary } from './stats';
import { METRIC_ORDER, METRICS, type Metric } from './thresholds';

export interface CoachSummaryInput {
  night: Night;
  bedtimeOrigin: TimeOrigin | null;
  risetimeOrigin: TimeOrigin | null;
  stats: Partial<Record<Metric, Summary | null>>;
  /** Pourquoi les conditions manquent, quand ce n'est pas faute de relevés (nuit sans lever). */
  conditionsUnavailable?: string;
}

export type CoachSummary = { ok: true; text: string } | { ok: false; reason: string };

export function coachSummary({
  night,
  bedtimeOrigin,
  risetimeOrigin,
  stats,
  conditionsUnavailable,
}: CoachSummaryInput): CoachSummary {
  if (isInProgress(night)) {
    return { ok: false, reason: "La nuit n'est pas terminée : le résumé se copie après le lever." };
  }
  const year = parseDay(night.day).getFullYear();
  const lines = ['Coach, voici ma nuit à consigner.', '', `- ${nightLabel(night)} ${year}`];

  lines.push(
    night.bedtime === null
      ? '- Couché : heure inconnue'
      : `- Couché : ${hhmm(night.bedtime)} (${bedtimeOrigin ?? 'confirmé'})`,
  );
  lines.push(
    night.risetime === null
      ? '- Levé : heure inconnue, la nuit est restée ouverte'
      : `- Levé : ${hhmm(night.risetime)} (${risetimeOrigin ?? 'confirmé'})`,
  );
  lines.push(
    night.bedtime !== null && night.risetime !== null
      ? `- Temps au lit : ${durationLong(night.risetime - night.bedtime)}`
      : '- Temps au lit : inconnu, une des deux heures manque',
  );

  const measured = METRIC_ORDER.filter((m) => stats[m]);
  lines.push('');
  if (measured.length === 0) {
    lines.push(conditionsUnavailable ?? 'Aucun relevé de conditions pour cette nuit.');
  } else {
    lines.push('Conditions de la chambre (min / moyenne / max) :');
    for (const m of METRIC_ORDER) {
      const s = stats[m];
      const info = METRICS[m];
      lines.push(
        s
          ? `- ${info.name} : ${formatMeasure(m, s.min)} / ${formatMeasure(m, s.avg)} / ${formatMeasure(m, s.max)} ${info.unit}`
          : `- ${info.name} : pas de données`,
      );
    }
    const counts = measured.map((m) => stats[m] as Summary);
    const first = Math.min(...counts.map((s) => s.first));
    const last = Math.max(...counts.map((s) => s.last));
    const count = Math.max(...counts.map((s) => s.count));
    lines.push(`Relevés : ${count}, de ${hhmm(first)} à ${hhmm(last)}.`);
  }
  return { ok: true, text: lines.join('\n') };
}

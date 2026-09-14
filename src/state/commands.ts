/**
 * Les écritures, toutes par le relais du collecteur, une à la fois. **Jamais d'affichage
 * optimiste** : l'écran ne montre une valeur qu'une fois relue dans l'appareil — le relais
 * répond avec l'état relu, et un `200` que la relecture ne confirme pas est un échec (`502`).
 */
import { CollectorUnreachableError, refusalReason, type CollectorApi } from '../data/api';
import { storeNightFromCollector } from '../data/db';
import { serialize } from '../data/queue';
import type { NightDetail, WriteBody, WriteResult } from '../data/types';
import { applyConfirmedPort, getApi, markUnreachable, refreshLive } from './controller';
import { bumpData } from './store';

export type CommandOutcome =
  | { ok: true; status: number; body: WriteBody }
  | { ok: false; status: number | null; body: WriteBody | null; message: string };

function messageFor(r: WriteResult): string {
  const reason = refusalReason(r.body);
  switch (r.status) {
    case 409:
      return reason ?? 'Action impossible dans l’état actuel.';
    case 422:
      return reason ? `Refusé : ${reason}.` : 'Valeur refusée.';
    case 502:
      return `Le réveil n’a pas appliqué la commande${reason ? ` — ${reason}` : ''}. L’état affiché est celui qu’il a relu.`;
    case 503:
      return 'Le réveil ne répond pas : la commande n’a pas été appliquée.';
    default:
      return `Réponse inattendue du collecteur (${r.status}).`;
  }
}

export async function command(run: (api: CollectorApi) => Promise<WriteResult>): Promise<CommandOutcome> {
  const api = getApi();
  if (!api) return { ok: false, status: null, body: null, message: 'Collecteur injoignable : rien n’a été envoyé.' };
  try {
    const r = await serialize(() => run(api));
    // L'état relu, confirmé ou non, remplace ce que l'écran croyait : l'appareil fait foi.
    if (typeof r.body.port === 'string' && r.body.state !== undefined && r.body.state !== null) {
      applyConfirmedPort(r.body.port, r.body.state, typeof r.body.observed_at === 'number' ? r.body.observed_at : null);
    }
    void refreshLive();
    if (r.status >= 200 && r.status < 300) return { ok: true, status: r.status, body: r.body };
    return { ok: false, status: r.status, body: r.body, message: messageFor(r) };
  } catch (e) {
    if (e instanceof CollectorUnreachableError) markUnreachable();
    return { ok: false, status: null, body: null, message: 'Collecteur injoignable : la commande n’a pas abouti.' };
  }
}

/** Geste de nuit : la nuit renvoyée est l'état du collecteur, enregistré tel quel. */
export async function nightGesture(kind: 'bedtime' | 'risetime'): Promise<CommandOutcome> {
  const outcome = await command((api) => (kind === 'bedtime' ? api.bedtime() : api.risetime()));
  const night = outcome.body?.night as NightDetail | null | undefined;
  if (night) {
    await storeNightFromCollector(night);
    bumpData();
  }
  return outcome;
}

/** La seule écriture du téléphone dans la mémoire du collecteur (cadrage §5). */
export async function correctNight(id: number, field: 'bedtime' | 'risetime', value: number): Promise<CommandOutcome> {
  const outcome = await command((api) => api.correctNight(id, field, value));
  const night = outcome.ok ? (outcome.body.night as NightDetail | null | undefined) : null;
  if (night) {
    await storeNightFromCollector(night, [field]);
    bumpData();
  }
  return outcome;
}

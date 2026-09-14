/**
 * État de la liaison, tel que l'utilisateur doit le comprendre (cadrage §3.A). Deux pannes
 * indépendantes existent, et un message unique les masquerait : le collecteur muet (le réveil va
 * peut-être très bien) et le réveil injoignable (le collecteur répond, l'historique est à jour).
 * Hors du domicile n'est pas une panne, et ne s'affiche pas comme telle.
 *
 * Depuis la copie locale, l'historique reste lisible dans tous les cas : ce qui distingue les
 * situations, c'est le rattrapage, le temps réel et le pilotage — d'où les quatre rangs.
 */

export type CollectorReach = 'searching' | 'ok' | 'unreachable';

/**
 * Le type de réseau, sans permission de localisation : hors Wi-Fi, on est sûrement hors du
 * domicile ; en Wi-Fi, on ne sait pas lequel — le message le dit.
 */
export type NetworkKind = 'wifi' | 'other' | 'none' | 'unknown';

export type LinkKind = 'searching' | 'first-run' | 'ok' | 'device-down' | 'collector-down' | 'away';

export interface LinkInput {
  collector: CollectorReach;
  network: NetworkKind;
  deviceReachable: boolean | null;
  deviceCause: string | null;
  hasCopy: boolean;
  /** « copie du 14 sept. à 17:45 » : la copie est datée, elle s'arrête au dernier rattrapage. */
  copyLabel: string | null;
}

export interface AvailabilityRow {
  ok: boolean;
  note: string;
}

export interface LinkView {
  kind: LinkKind;
  /** Pilotage du réveil (lumière, alarmes, coucher de soleil, gestes de nuit). */
  canControl: boolean;
  /** Correction d'heure : une écriture dans le collecteur seul. */
  canCorrect: boolean;
  /** Pourquoi le pilotage est indisponible — il est désactivé, jamais masqué. */
  controlReason: string | null;
  /** Une seule des situations est une panne : l'ambre lui est réservé. */
  isFailure: boolean;
  title: string;
  body: string;
  rows: { history: AvailabilityRow; sync: AvailabilityRow; live: AvailabilityRow; control: AvailabilityRow };
  retryLabel: string | null;
}

function deviceCauseTitle(cause: string | null): { title: string; note: string } {
  if (cause === 'appareil saturé') {
    return { title: 'Le réveil est saturé', note: 'Le collecteur réessaie de lui-même' };
  }
  return { title: 'Le réveil ne répond pas', note: "Le réveil n'est pas joignable" };
}

export function deriveLink(i: LinkInput): LinkView {
  const copy = i.copyLabel ? `La copie locale, ${i.copyLabel}` : 'La copie locale, jusqu’au dernier rattrapage';

  if (i.collector === 'ok' && i.deviceReachable !== false) {
    return {
      kind: 'ok',
      canControl: true,
      canCorrect: true,
      controlReason: null,
      isFailure: false,
      title: 'Collecteur joignable',
      body: '',
      rows: {
        history: { ok: true, note: 'Toutes les nuits, jusqu’à la dernière collectée' },
        sync: { ok: true, note: 'La copie du téléphone est à jour' },
        live: { ok: true, note: 'Relevés du collecteur' },
        control: { ok: true, note: 'Alarmes et lumière disponibles' },
      },
      retryLabel: null,
    };
  }

  if (i.collector === 'ok') {
    const c = deviceCauseTitle(i.deviceCause);
    return {
      kind: 'device-down',
      canControl: false,
      canCorrect: true,
      controlReason: `${c.title} : le pilotage est indisponible, l'historique reste complet.`,
      isFailure: false,
      title: c.title,
      body:
        'Le collecteur fonctionne et détient tout l’historique — il est lisible en entier, et la copie du ' +
        'téléphone se met à jour normalement. Seuls le temps réel et le pilotage sont indisponibles.',
      rows: {
        history: { ok: true, note: 'Toutes les nuits, jusqu’à la dernière collectée' },
        sync: { ok: true, note: 'La copie du téléphone est à jour' },
        live: { ok: false, note: c.note },
        control: { ok: false, note: 'Alarmes et lumière indisponibles' },
      },
      retryLabel: 'Réessayer le réveil',
    };
  }

  if (i.collector === 'searching') {
    return {
      kind: 'searching',
      canControl: false,
      canCorrect: false,
      controlReason: 'Recherche du collecteur…',
      isFailure: false,
      title: 'Recherche du collecteur…',
      body: i.hasCopy ? 'L’historique de la copie locale reste lisible pendant ce temps.' : '',
      rows: {
        history: { ok: i.hasCopy, note: i.hasCopy ? copy : 'Aucune nuit copiée pour l’instant' },
        sync: { ok: false, note: 'En attente du collecteur' },
        live: { ok: false, note: 'En attente du collecteur' },
        control: { ok: false, note: 'En attente du collecteur' },
      },
      retryLabel: null,
    };
  }

  if (!i.hasCopy) {
    return {
      kind: 'first-run',
      canControl: false,
      canCorrect: false,
      controlReason: 'Le collecteur n’a pas encore été trouvé.',
      isFailure: false,
      title: 'Bienvenue',
      body:
        'Pour la première ouverture, le téléphone doit être sur le Wi-Fi de la maison et le collecteur ' +
        'démarré. L’app le trouve seule, sans adresse à saisir, puis copie tout l’historique.',
      rows: {
        history: { ok: false, note: 'Aucune nuit copiée pour l’instant' },
        sync: { ok: false, note: 'Commence dès que le collecteur répond' },
        live: { ok: false, note: 'Arrive avec le collecteur' },
        control: { ok: false, note: 'Arrive avec le collecteur' },
      },
      retryLabel: 'Chercher le collecteur',
    };
  }

  if (i.network !== 'wifi') {
    return {
      kind: 'away',
      canControl: false,
      canCorrect: false,
      controlReason: 'Hors du réseau domestique : le réveil se pilote à la maison.',
      isFailure: false,
      title: 'Hors du réseau domestique',
      body:
        'L’application ne sort jamais de la maison : le collecteur n’est pas exposé sur internet. Tout ' +
        'l’historique reste consultable — il est déjà dans la poche — mais en lecture seule.',
      rows: {
        history: { ok: true, note: 'Tout l’historique, en lecture seule' },
        sync: { ok: false, note: 'Reprend au retour sur le réseau domestique' },
        live: { ok: false, note: 'Hors de portée du collecteur' },
        control: { ok: false, note: 'Le réveil se pilote à la maison' },
      },
      retryLabel: null,
    };
  }

  return {
    kind: 'collector-down',
    canControl: false,
    canCorrect: false,
    controlReason: 'Collecteur injoignable : le pilotage passe par lui.',
    isFailure: true,
    title: 'Le collecteur ne répond pas',
    body:
      'Somneo-Scraper est injoignable sur ce réseau — il est arrêté, ou ce n’est pas le Wi-Fi de la ' +
      'maison. Le réveil, lui, va peut-être très bien. L’historique reste lisible — il est sur ce ' +
      'téléphone — mais il ne se met plus à jour, et rien ne se pilote.',
    rows: {
      history: { ok: true, note: copy },
      sync: { ok: false, note: 'Rien de neuf tant que le collecteur est muet' },
      live: { ok: false, note: 'Aucun relevé accessible' },
      control: { ok: false, note: 'Le pilotage passe par le collecteur' },
    },
    retryLabel: 'Réessayer',
  };
}

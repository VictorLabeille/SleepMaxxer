/**
 * Formes des réponses de l'API du collecteur (Somneo-Scraper, `/v1`), relevées sur le collecteur
 * déployé le 2026-09-14. Le contrat est dans le cadrage de l'app (§5) et le plan technique du
 * collecteur (§7) ; ses écarts connus, dans `.claude/specs/2026-09-14-ecarts-contrat-sleepmaxxer.md`
 * du dépôt Somneo-Scraper.
 *
 * Toutes les heures sont en secondes depuis l'époque, dans le référentiel du collecteur (NTP) —
 * jamais dans celui du réveil (cadrage §3.F).
 */

export type Epoch = number;

export type NightState = 'pending_device' | 'open' | 'closed' | 'abnormal';

export interface Night {
  id: number;
  seq: number;
  /** Jour local (Europe/Paris) de l'heure de coucher : une nuit appartient à ce jour. */
  day: string;
  bedtime: Epoch | null;
  risetime: Epoch | null;
  state: NightState;
  /** `confirmed` (appui dans l'app), `observed` (transition vue par le collecteur, ou appui dans
   *  SleepMapper), `pending` (retenu en attendant le réveil). */
  bedtime_origin: string | null;
  /** `confirmed` (geste de lever) ou `observed` (extinction de l'alarme, vue par le collecteur).
   *  `estimated` reste défini mais plus rien ne le produit depuis le 2026-09-16 — `domain/nights.ts`. */
  risetime_origin: string | null;
  raw_tg2bd: string | null;
  raw_tendb: string | null;
  /** Le relevé, servi à côté de l'heure qui fait foi : une correction ne l'écrase jamais. Absents
   *  d'une nuit copiée avant le 2026-09-15 — le collecteur ne les servait pas encore. */
  bedtime_observed?: Epoch | null;
  risetime_observed?: Epoch | null;
  bedtime_observed_origin?: string | null;
  risetime_observed_origin?: string | null;
  /** Journal des corrections de cette nuit, dans l'ordre. */
  corrections?: NightCorrection[];
}

export interface NightCorrection {
  id: number;
  seq: number;
  night_id: number;
  ts: Epoch;
  field: 'bedtime' | 'risetime';
  /** `null` : retour au relevé — la correction en vigueur est levée, et le retour entre au journal. */
  value: Epoch | null;
}

export interface NightDetail extends Night {
  corrections?: NightCorrection[];
}

export interface Reading {
  seq: number;
  ts: Epoch;
  mslux: number | null;
  mstmp: number | null;
  msrhu: number | null;
  mssnd: number | null;
  avlux: number | null;
  avtmp: number | null;
  avrhu: number | null;
  avsnd: number | null;
}

export type AggregateKind = 'temp' | 'hum' | 'snd' | 'lux';

export interface Aggregate {
  seq: number;
  ts: Epoch;
  /** `null` seulement pour un agrégat copié avant le 2026-09-15, quand le rattrapage par séquence
   *  effaçait le type (écart 4). Depuis, le type arrive sous `aggregate_kind`. */
  kind: AggregateKind | null;
  avg: number | null;
  lo: number | null;
  hi: number | null;
  hist: string | null;
}

export interface Outage {
  id: number;
  seq: number;
  start: Epoch;
  end: Epoch | null;
  /** `réveil injoignable`, `appareil saturé`, `carte hors réseau`, `collecteur arrêté`. */
  cause: string;
  failures: number;
}

/** Un élément de `/v1/sync?since_seq` : la ligne de sa table, plus son genre dans `kind`. */
export type SyncItem =
  | (Reading & { kind: 'reading' })
  | (Omit<Aggregate, 'kind'> & { kind: 'aggregate'; aggregate_kind?: AggregateKind | null })
  | (Night & { kind: 'night' })
  | (Outage & { kind: 'outage' });

export interface SyncSinceResponse {
  served_at: Epoch;
  current_seq: number;
  mode: 'since_seq';
  since_seq: number;
  count: number;
  items: SyncItem[];
}

export interface NightWithSeries extends Night {
  readings?: Reading[];
  aggregates?: Aggregate[];
}

export interface SyncBeforeResponse {
  served_at: Epoch;
  current_seq: number;
  mode: 'before';
  before: Epoch;
  count: number;
  nights: NightWithSeries[];
}

export interface CollectorStatus {
  served_at: Epoch;
  reveil: {
    joignable: boolean;
    cause_indisponibilite: string | null;
    depuis: Epoch | null;
    adresse_connue: string | null;
    dernier_releve_at: Epoch | null;
  };
  horloge: {
    ecart_s: number | null;
    seuil_s: number;
    au_dela_du_seuil: boolean;
    correction: string;
    mesure_at: Epoch | null;
    observed_at: Epoch | null;
  };
  cloud: {
    dcs_state: string | null;
    lastsignon: string | null;
    transport_state: string | null;
    allowuploads: boolean | null;
    url: string | null;
  };
  alarmes: { masquees_armees: number[] };
  collecteur: {
    demarre_at: Epoch;
    dernier_battement_at: Epoch | null;
    cadence_wusrd_s: number;
    /** `false` : la carte est repartie d'une coupure sans avoir revu NTP. L'app le signale, elle
     *  ne corrige rien (cadrage §3.F). Absent d'un collecteur antérieur au 2026-09-15. */
    heure_synchronisee?: boolean | null;
  };
  disque: { total: number; libre: number; base_octets: number };
  indisponibilites_ouvertes: Outage[];
}

export interface PortMirror<T> {
  body: T;
  /** Depuis quand le port vaut ce corps. */
  since: Epoch;
  /** Dernière lecture qui l'a confirmé. */
  observed_at: Epoch;
}

export interface LightBody {
  onoff: boolean;
  /** Intensité, 0–25 sur l'appareil ; le relais n'accepte que 1–25 (éteindre, c'est `onoff`). */
  ltlvl: number;
  /** Veilleuse. */
  ngtlt: boolean;
}

export interface SunsetBody {
  onoff: boolean;
  durat: number;
  curve: number;
  ctype: number;
  snddv: string;
  sndch: string;
  sndlv: number;
  sndss?: number;
}

export interface AlarmRootBody {
  prfnr: number;
  /** Durée du rappel, en minutes : **globale** à toutes les alarmes. */
  snztm: number;
}

export interface AlarmSummary {
  n: number;
  enabled: boolean;
  hour: number | null;
  minute: number | null;
  /** Masque `daynm` : bit 1 = lundi … bit 7 = dimanche, 0 = une seule fois. */
  days: number | null;
  powerwake: { on: boolean; hour: number; minute: number } | null;
}

export interface DeviceMirror {
  served_at: Epoch;
  ports: {
    wulgt?: PortMirror<LightBody> | null;
    wudsk?: PortMirror<SunsetBody> | null;
    wualm?: PortMirror<AlarmRootBody> | null;
    'wualm/aenvs'?: PortMirror<Record<string, unknown>> | null;
    'wualm/aalms'?: PortMirror<Record<string, unknown>> | null;
    wusts?: PortMirror<{ wusts: number } & Record<string, unknown>> | null;
    wungt?: PortMirror<Record<string, unknown>> | null;
    [port: string]: PortMirror<unknown> | null | undefined;
  };
  wusts_bits: number[];
  alarms: AlarmSummary[];
  hidden_armed_alarms: number[];
}

/** Un profil d'alarme (`wualm/prfwu`), relu sur l'appareil à la demande. */
export interface AlarmProfile {
  prfnr: number;
  prfen: boolean;
  prfvs: boolean;
  almhr: number;
  almmn: number;
  daynm: number;
  /** Intensité du lever, 1–25. */
  curve: number;
  /** Durée du lever, 5–40 min. */
  durat: number;
  /** Thème lumineux : rang (à partir de 0) dans `files/lightthemes`. */
  ctype: number;
  /** Source sonore : `wus` (son de réveil), `fmr` (radio), `off`. */
  snddv: string;
  /** Piste : clé dans `files/wakeup` pour `wus`, présélection pour `fmr`. */
  sndch: string;
  sndlv: number;
  pwrsz: number | boolean;
  pszhr: number;
  pszmn: number;
  [field: string]: unknown;
}

/**
 * `GET /v1/settings/snapshot` : le dernier corps de chacun des seize profils d'alarme, et les
 * ports de réglage. Sert l'export — plus riche que `device.last`, qui ne porte que les profils
 * visibles. `complete` est faux tant que le collecteur n'a pas relu les seize (fenêtre 12 h–18 h).
 */
export interface SettingsSnapshot {
  served_at: Epoch;
  profiles: Record<string, { body: AlarmProfile; since: Epoch } | undefined>;
  complete: boolean;
  ports: Record<string, PortMirror<unknown> | null | undefined>;
}

export type CatalogFile = 'wakeup' | 'lightthemes' | 'dusklightthemes' | 'winddowndusk';

export interface CatalogResponse {
  served_at: Epoch;
  catalog: Partial<
    Record<CatalogFile, { source: string; themes: Record<string, { name?: string } | undefined> }>
  >;
}

/** Champs éditables d'un profil ; numéros bruts de l'appareil pour thème et son. */
export interface AlarmEdit {
  enabled?: boolean;
  hour?: number;
  minute?: number;
  days?: number;
  ctype?: number;
  curve?: number;
  durat?: number;
  snddv?: string;
  sndch?: string;
  sndlv?: number;
  powerwake?: { on: boolean; delta?: number };
}

export interface SunsetSettings {
  durat?: number;
  curve?: number;
  ctype?: number;
  snddv?: string;
  sndch?: string;
  sndlv?: number;
}

/** Corps commun des réponses d'écriture du relais. */
export interface WriteBody {
  served_at?: Epoch;
  ok?: boolean;
  /** Raison d'un refus, rendue par le relais. */
  reason?: string;
  /** Raison d'un refus, rendue par FastAPI (`HTTPException`). */
  detail?: unknown;
  state?: unknown;
  profile?: AlarmProfile | null;
  n?: number;
  night?: NightDetail | null;
  /** Geste de nuit : `pris`, `en attente du réveil`, `déjà en cours`, `rien à fermer dans le réveil`. */
  device?: string;
  [key: string]: unknown;
}

export interface WriteResult {
  status: number;
  body: WriteBody;
}

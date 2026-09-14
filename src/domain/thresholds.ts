/**
 * Seuils de qualité du sommeil. Ce sont ceux du constructeur, relevés dans SleepMapper le
 * 5 septembre 2026 et consignés dans `docs/seuils-conditions-sommeil.md` — leur seule trace. C'est
 * ce qui autorise un verdict : la source est citable. Aucun seuil ici n'est inventé.
 *
 * Deux familles, à ne pas aplatir :
 * - température et humidité **jugent** : cinq bandes symétriques autour d'une plage idéale ;
 * - lumière et bruit **comparent** : un seul seuil de qualité, puis des repères (« bibliothèque
 *   municipale »), qui ne sont jamais des jugements.
 */

export type Metric = 'temp' | 'hum' | 'lux' | 'snd';

export const METRIC_ORDER: readonly Metric[] = ['temp', 'hum', 'lux', 'snd'];

export const IDEAL_LABEL = 'Conditions de sommeil idéales';

export const THRESHOLDS_SOURCE =
  'Seuils du constructeur, relevés dans SleepMapper (Philips) le 5 septembre 2026.';

export interface Band {
  /** Borne basse incluse ; `null` = pas de borne. */
  from: number | null;
  /** Borne haute exclue ; `null` = pas de borne. */
  to: number | null;
  label: string;
  ideal: boolean;
}

export interface MetricInfo {
  key: Metric;
  name: string;
  unit: string;
  /** Précision du capteur : une décimale pour la température, entiers pour le reste (cadrage §3.C). */
  decimals: number;
  family: 'judge' | 'scale';
  logScale: boolean;
  ideal: { from: number; to: number };
  /** Du plus haut au plus bas, comme la réglette de SleepMapper. */
  bands: Band[];
  chartTitle: string;
  /** Texte d'accompagnement de SleepMapper, cité tel quel. */
  explanation: string;
}

const band = (from: number | null, to: number | null, label: string, ideal = false): Band => ({
  from,
  to,
  label,
  ideal,
});

export const METRICS: Record<Metric, MetricInfo> = {
  temp: {
    key: 'temp',
    name: 'Température',
    unit: '°C',
    decimals: 1,
    family: 'judge',
    logScale: false,
    ideal: { from: 17, to: 19 },
    bands: [
      band(22, null, 'Trop chaud'),
      band(19, 22, 'Chaud'),
      band(17, 19, IDEAL_LABEL, true),
      band(14, 17, 'Froid'),
      band(null, 14, 'Trop froid'),
    ],
    chartTitle: 'Température (°C)',
    explanation:
      "L'identification de votre température idéale de sommeil est un sujet très personnel. " +
      "Certaines personnes aiment dormir dans une chambre chaude, d'autres la préfèrent plus " +
      'fraîche. Les recherches montrent cependant que votre sommeil peut être perturbé lorsque ' +
      'votre environnement est trop chaud ou trop froid.',
  },
  hum: {
    key: 'hum',
    name: 'Humidité',
    unit: '%',
    decimals: 0,
    family: 'judge',
    logScale: false,
    ideal: { from: 40, to: 60 },
    bands: [
      band(70, null, 'Trop humide'),
      band(60, 70, 'Humide'),
      band(40, 60, IDEAL_LABEL, true),
      band(30, 40, 'Sec'),
      band(null, 30, 'Trop sec'),
    ],
    chartTitle: 'Humidité (%)',
    explanation:
      "Un niveau adapté d'humidité dans votre chambre vous permettra de mieux dormir, mais aussi " +
      "apaisera les éventuels symptômes d'un rhume et des allergies, comme la sécheresse du nez et " +
      'le mal de gorge. Soyez vigilant malgré tout, car un environnement très humide est gênant et ' +
      'peut entraîner la formation de moisissures toxiques dans votre chambre.',
  },
  lux: {
    key: 'lux',
    name: 'Lumière',
    unit: 'lux',
    decimals: 0,
    family: 'scale',
    logScale: true,
    ideal: { from: 0, to: 10 },
    bands: [
      band(10000, null, 'Lumière du jour'),
      band(1000, 10000, 'Centre commercial'),
      band(500, 1000, 'Site'),
      band(200, 500, 'Accueil'),
      band(40, 200, 'Lampe de poche'),
      band(10, 40, 'Crépuscule'),
      band(0, 10, IDEAL_LABEL, true),
    ],
    chartTitle: 'Lumière (lux)',
    explanation:
      'Les très faibles niveaux de lumière, comme celle des éclairages publics à travers les ' +
      'rideaux, peuvent atteindre plus de 40 lux. Même s’ils ne vous réveilleront pas ' +
      'nécessairement, la qualité de votre sommeil peut en être affectée.',
  },
  snd: {
    key: 'snd',
    name: 'Bruit',
    unit: 'dB',
    decimals: 0,
    family: 'scale',
    logScale: false,
    ideal: { from: 0, to: 30 },
    bands: [
      band(120, null, 'Marteau-piqueur'),
      band(110, 120, 'Groupe de rock'),
      band(100, 110, "Survol d'avion"),
      band(90, 100, 'Mixeur ménager'),
      band(80, 90, 'Route passante'),
      band(70, 80, 'Aspirateur'),
      band(60, 70, 'Voix normales'),
      band(50, 60, 'Rue à faible trafic'),
      band(40, 50, 'Ville la nuit'),
      band(30, 40, 'Bibliothèque municipale'),
      band(0, 30, IDEAL_LABEL, true),
    ],
    chartTitle: 'Bruit (dB)',
    explanation:
      'Même si le vent soufflant dans les feuilles peut constituer un bruit ambiant agréable la ' +
      'nuit, votre climatisation, vos voisins rentrant chez eux ou tout autre bruit d’un volume ' +
      'supérieur à 40 dB peuvent facilement perturber votre sommeil.',
  },
};

export function bandFor(metric: Metric, value: number): Band {
  const bands = METRICS[metric].bands;
  const found = bands.find(
    (b) => (b.from === null || value >= b.from) && (b.to === null || value < b.to),
  );
  // Une mesure sous la plus basse borne (lumière négative, par exemple) tombe dans la dernière
  // bande : l'app ne corrige ni ne masque une valeur aberrante (cadrage §3.C).
  return found ?? bands[bands.length - 1];
}

export type VerdictTone = 'ideal' | 'out' | 'reference';

export interface Verdict {
  text: string;
  tone: VerdictTone;
  band: Band;
}

export function verdict(metric: Metric, value: number): Verdict {
  const info = METRICS[metric];
  const b = bandFor(metric, value);
  if (b.ideal) return { text: IDEAL_LABEL, tone: 'ideal', band: b };
  if (info.family === 'judge') {
    const side = value >= info.ideal.to ? 'au-dessus' : 'en dessous';
    return { text: `${b.label} — ${side} de la plage idéale`, tone: 'out', band: b };
  }
  // Lumière et bruit : un repère de comparaison, jamais un jugement.
  return { text: `Équivalent : ${b.label.toLowerCase()}`, tone: 'reference', band: b };
}

/**
 * Noms des thèmes lumineux et des sons. L'appareil les publie (`files/*`, servis par
 * `GET /v1/catalog/themes`) ; ce qu'il ne publie pas — « aucun son », la radio FM, les couleurs —
 * vient du relevé de SleepMapper (`docs/sleepmapper/README.md`), qui en est la seule trace.
 *
 * Numérotation, établie dans `pysomneo` (`api.get_themes`) : un thème lumineux est son **rang** à
 * partir de 0 dans le fichier (`ctype`) ; un son est sa clé à partir de 1 (`sndch`).
 */
import type { CatalogFile, CatalogResponse } from '../data/types';

/** Dégradés relevés dans SleepMapper le 2026-09-06, du haut vers le bas. */
const THEME_COLORS: Record<string, [string, string]> = {
  'sunny day': ['#F7C05A', '#FDF0D5'],
  'island red': ['#F4671F', '#FCE6C4'],
  'nordic white': ['#B5AE7C', '#F0E9C8'],
  'caribbean red': ['#F04A1E', '#F7A03C'],
};

/** Listes de SleepMapper, dans l'ordre de ses écrans — secours si le catalogue manque. */
const RELEVE: Record<CatalogFile, string[]> = {
  lightthemes: ['Sunny day', 'Island red', 'Nordic white', 'Caribbean red'],
  dusklightthemes: ['Sunny day', 'Island red', 'Nordic white', 'Caribbean red'],
  wakeup: [
    'Forest Birds',
    'Summer Birds',
    'Buddha Wakeup',
    'Morning Alps',
    'Yoga Harmony',
    'Nepal Bowls',
    'Summer Lake',
    'Ocean Waves',
  ],
  winddowndusk: ['Soft Rain', 'Ocean Waves', 'Under Water', 'Summer Lake'],
};

interface Entry {
  key: string;
  name: string;
}

function entries(catalog: CatalogResponse | null, file: CatalogFile): Entry[] {
  const themes = catalog?.catalog?.[file]?.themes;
  if (themes && Object.keys(themes).length > 0) {
    return Object.entries(themes)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([key, v]) => ({ key, name: v?.name ?? '' }));
  }
  return RELEVE[file].map((name, i) => ({ key: String(i + 1), name }));
}

export interface ThemeOption {
  ctype: number;
  name: string;
  colors: [string, string] | null;
}

export function lightThemes(
  catalog: CatalogResponse | null,
  file: 'lightthemes' | 'dusklightthemes',
): ThemeOption[] {
  return entries(catalog, file).map((e, index) => ({
    ctype: index,
    name: e.name || `Thème ${index + 1}`,
    colors: THEME_COLORS[e.name.toLowerCase()] ?? null,
  }));
}

export interface SoundOption {
  snddv: string;
  sndch: string;
  name: string;
}

export const NO_SOUND: SoundOption = { snddv: 'off', sndch: '', name: 'Aucun son' };

export function wakeSounds(catalog: CatalogResponse | null): SoundOption[] {
  return entries(catalog, 'wakeup')
    .filter((e) => e.name)
    .map((e) => ({ snddv: 'wus', sndch: e.key, name: e.name }));
}

export function duskSounds(catalog: CatalogResponse | null): SoundOption[] {
  return entries(catalog, 'winddowndusk')
    .filter((e) => e.name)
    .map((e) => ({ snddv: 'dus', sndch: e.key, name: e.name }));
}

export function themeName(options: readonly ThemeOption[], ctype: number): string {
  return options.find((o) => o.ctype === ctype)?.name ?? `Thème ${ctype + 1}`;
}

export function soundName(options: readonly SoundOption[], snddv: string, sndch: string): string {
  if (snddv === 'off') return NO_SOUND.name;
  if (snddv === 'fmr') return `Radio FM${sndch ? ` (présélection ${sndch})` : ''}`;
  const found = options.find((o) => o.snddv === snddv && o.sndch === String(sndch));
  return found?.name ?? 'Son inconnu';
}

export function sameSound(a: { snddv: string; sndch: string }, b: { snddv: string; sndch: string }): boolean {
  if (a.snddv === 'off' && b.snddv === 'off') return true;
  return a.snddv === b.snddv && String(a.sndch) === String(b.sndch);
}

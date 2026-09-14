/**
 * Direction retenue le 2026-09-06 (cadrage §5) : sobre — fond de nuit en dégradé, cartes à peine
 * détachées, une seule couleur d'accent, le chiffre comme élément porteur. Couleurs reprises des
 * maquettes (`design/Main.dc.html`), converties d'oklch en hexadécimal.
 *
 * Pas de flou sur les cartes : sur un fond uni, il n'a rien à flouter (le « verre discret » de la
 * direction artistique n'est qu'un aplat translucide). Et une interface sombre, parce que la
 * lumière de l'écran pollue le capteur que l'app exploite.
 */
export const colors = {
  bgTop: '#0c2832',
  bgMid: '#051922',
  bgBottom: '#031018',
  text: '#f1f6f8',
  textSoft: 'rgba(255,255,255,0.62)',
  textMuted: 'rgba(255,255,255,0.48)',
  textFaint: 'rgba(255,255,255,0.34)',
  accent: '#57c8c4',
  onAccent: '#04161f',
  /** Réservé à ce qui sort de la plage, et à la seule vraie panne. */
  amber: '#f5ad5a',
  amberSoft: 'rgba(245,173,90,0.12)',
  amberBorder: 'rgba(245,173,90,0.3)',
  estimated: '#eea753',
  green: '#6dd17f',
  danger: '#f97770',
  dangerBorder: 'rgba(213,87,83,0.4)',
  errorBg: 'rgba(225,75,57,0.14)',
  errorBorder: 'rgba(225,75,57,0.45)',
  errorText: '#ffbda5',
  sheet: '#081b23',
  glass: 'rgba(255,255,255,0.045)',
  glassBorder: 'rgba(255,255,255,0.085)',
  hairline: 'rgba(255,255,255,0.06)',
  track: 'rgba(255,255,255,0.12)',
  switchOff: 'rgba(255,255,255,0.16)',
  scrim: 'rgba(0,0,0,0.55)',
} as const;

export const fonts = {
  extralight: 'Manrope_200ExtraLight',
  light: 'Manrope_300Light',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const radius = { card: 20, control: 16, pill: 999 } as const;

/** Cible tactile minimale : le geste du coucher se fait d'une main, dans le noir. */
export const TOUCH = 44;

/**
 * Les pièces communes des écrans. Une carte par fonction, le détail derrière la carte, le chiffre
 * comme élément porteur (cadrage §2.E, familiarité d'usage avec SleepMapper).
 */
import RNSlider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './Icon';
import { colors, fonts, radius, TOUCH } from './theme';

// ---- texte -------------------------------------------------------------------------------

type Weight = keyof typeof fonts;

export function T({
  children,
  size = 14,
  weight = 'regular',
  color = colors.text,
  style,
  numberOfLines,
  center,
}: {
  children: ReactNode;
  size?: number;
  weight?: Weight;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  center?: boolean;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts[weight], fontSize: size, color, lineHeight: Math.round(size * 1.38) }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

// ---- écran -------------------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[colors.bgTop, colors.bgMid, colors.bgBottom]}
      locations={[0, 0.42, 1]}
      style={{ flex: 1, paddingTop: insets.top }}
    >
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {footer}
    </LinearGradient>
  );
}

export function TitleBar({ title }: { title: string }) {
  return (
    <View style={{ paddingTop: 8, paddingBottom: 16, alignItems: 'center' }}>
      <T size={19} weight="medium">{title}</T>
    </View>
  );
}

export function Header({
  title,
  onBack = () => router.back(),
  right,
  closeIcon = false,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  closeIcon?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 10 }}>
      {closeIcon ? <View style={{ width: TOUCH }} /> : (
        <Pressable accessibilityLabel="Retour" onPress={onBack} style={styles.iconButton} hitSlop={8}>
          <Icon name="chevron-left" size={22} color="rgba(255,255,255,0.85)" strokeWidth={1.8} />
        </Pressable>
      )}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <T size={18} weight="medium" numberOfLines={1}>{title}</T>
      </View>
      {closeIcon ? (
        <Pressable accessibilityLabel="Fermer" onPress={onBack} style={styles.iconButton} hitSlop={8}>
          <Icon name="close" size={22} color="rgba(255,255,255,0.85)" strokeWidth={1.8} />
        </Pressable>
      ) : (
        <View style={{ minWidth: TOUCH, alignItems: 'flex-end' }}>{right}</View>
      )}
    </View>
  );
}

// ---- blocs -------------------------------------------------------------------------------

export function Section({ children }: { children: string }) {
  return (
    <T size={12.5} weight="semibold" color="rgba(255,255,255,0.42)" style={{ paddingHorizontal: 20, paddingBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' }}>
      {children}
    </T>
  );
}

export function Card({ children, style, onPress, disabled }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; disabled?: boolean }) {
  const body = <View style={[styles.card, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
      {body}
    </Pressable>
  );
}

export function NavCard({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ marginHorizontal: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 }}>
      <Icon name={icon} color={colors.accent} size={22} strokeWidth={1.5} />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15.5} weight="semibold">{title}</T>
        {subtitle ? <T size={12.5} color={colors.textMuted}>{subtitle}</T> : null}
      </View>
      <Icon name="chevron-right" size={16} color="rgba(255,255,255,0.3)" strokeWidth={1.8} />
    </Card>
  );
}

export function Row({
  label,
  value,
  onPress,
  last,
  disabled,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.hairline },
        pressed && { backgroundColor: 'rgba(255,255,255,0.04)' },
        disabled && { opacity: 0.45 },
      ]}
    >
      <T size={14.5} weight="medium" style={{ flex: 1 }}>{label}</T>
      {value ? <T size={14.5} color={colors.textSoft} style={{ maxWidth: '60%' }} numberOfLines={1}>{value}</T> : null}
      {onPress ? <Icon name="chevron-right" size={15} color="rgba(255,255,255,0.3)" strokeWidth={1.8} /> : null}
    </Pressable>
  );
}

// ---- contrôles -----------------------------------------------------------------------------

export function Toggle({
  value,
  onPress,
  disabled,
  pending,
  label,
}: {
  value: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Commande envoyée, pas encore confirmée : l'interrupteur garde l'état relu et patiente. */
  pending?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: disabled || pending, busy: pending }}
      onPress={onPress}
      disabled={disabled || pending}
      hitSlop={8}
      style={[
        styles.toggle,
        { backgroundColor: value ? colors.accent : colors.switchOff, justifyContent: value ? 'flex-end' : 'flex-start' },
        (disabled || pending) && { opacity: 0.5 },
      ]}
    >
      <View style={styles.knob}>{pending ? <ActivityIndicator size="small" color={colors.onAccent} /> : null}</View>
    </Pressable>
  );
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  onComplete,
  disabled,
  pending,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange?: (v: number) => void;
  onComplete?: (v: number) => void;
  disabled?: boolean;
  /**
   * La valeur montrée est demandée, pas encore relue dans l'appareil : elle perd la couleur
   * d'accent, réservée à ce que l'appareil a confirmé. Le curseur, lui, reste manipulable.
   */
  pending?: boolean;
  hint?: string;
}) {
  return (
    <View style={{ opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T size={14} weight="medium">{label}</T>
        <T size={13.5} weight="semibold" color={pending ? colors.textSoft : colors.accent}>{`${value}${unit}`}</T>
      </View>
      <RNSlider
        style={{ height: 40, marginHorizontal: -8 }}
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onChange?.(Math.round(v))}
        onSlidingComplete={(v) => onComplete?.(Math.round(v))}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.track}
        thumbTintColor="#ffffff"
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={11.5} color={colors.textFaint}>{`${min}${unit}`}</T>
        {hint ? <T size={11.5} color={colors.textFaint}>{hint}</T> : null}
        <T size={11.5} color={colors.textFaint}>{`${max}${unit}`}</T>
      </View>
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'secondary',
  disabled,
  loading,
  icon,
  style,
  big,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
}) {
  const fg = kind === 'primary' ? colors.onAccent : kind === 'danger' ? colors.danger : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        big && { minHeight: 60 },
        kind === 'primary' && { backgroundColor: colors.accent },
        kind === 'secondary' && { backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
        kind === 'danger' && { borderWidth: 1, borderColor: colors.dangerBorder },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.72 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={17} color={fg} /> : null}
      <T size={big ? 16.5 : 15} weight={kind === 'primary' ? 'bold' : 'semibold'} color={fg}>{label}</T>
    </Pressable>
  );
}

export function Notice({ tone = 'info', children, style }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const palette =
    tone === 'error'
      ? { bg: colors.errorBg, border: colors.errorBorder, fg: colors.errorText }
      : tone === 'warn'
        ? { bg: colors.amberSoft, border: colors.amberBorder, fg: '#fac285' }
        : { bg: 'rgba(255,255,255,0.045)', border: 'rgba(255,255,255,0.1)', fg: colors.textSoft };
  return (
    <View style={[{ borderRadius: 14, padding: 12, borderWidth: 1, backgroundColor: palette.bg, borderColor: palette.border }, style]}>
      {typeof children === 'string' ? <T size={12.5} color={palette.fg}>{children}</T> : children}
    </View>
  );
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={colors.accent} />
      <T size={13} color={colors.textMuted}>{label}</T>
    </View>
  );
}

export const styles = StyleSheet.create({
  iconButton: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: 1, borderRadius: radius.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14, minHeight: TOUCH },
  // `flexDirection: 'row'` n'est pas décoratif : sans lui React Native empile en colonne et le
  // `justifyContent` de `Toggle` joue sur la verticale, où la course est nulle (31 − 2×3 = 25, la
  // hauteur du rond). Le rond resterait à gauche quel que soit l'état.
  toggle: { width: 52, height: 31, borderRadius: radius.pill, padding: 3, flexDirection: 'row' },
  knob: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 50, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16 },
});

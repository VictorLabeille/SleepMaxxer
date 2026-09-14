/**
 * États dégradés (`design/EtatsDegrades.dc.html`). Le panneau complet dit ce qui reste
 * disponible, rang par rang ; la bannière courte le rappelle sur l'écran des nuits.
 */
import { View } from 'react-native';

import type { LinkView } from '../state/link';
import { Icon } from './Icon';
import { Button, Card, T } from './kit';
import { colors } from './theme';

function AvailabilityRow({ label, ok, note, last }: { label: string; ok: boolean; note: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.hairline, opacity: ok ? 1 : 0.6 }}>
      <Icon name={ok ? 'check' : 'close'} size={20} color={ok ? colors.green : colors.textFaint} strokeWidth={1.8} />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={14.5} weight="medium">{label}</T>
        <T size={12} color={colors.textMuted}>{note}</T>
      </View>
    </View>
  );
}

export function LinkPanel({ link, onRetry, busy }: { link: LinkView; onRetry?: () => void; busy?: boolean }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 14,
          borderRadius: 18,
          padding: 16,
          flexDirection: 'row',
          gap: 13,
          backgroundColor: link.isFailure ? colors.amberSoft : colors.glass,
          borderWidth: 1,
          borderColor: link.isFailure ? colors.amberBorder : 'rgba(255,255,255,0.1)',
        }}
      >
        <Icon name="alert" size={22} color={link.isFailure ? colors.amber : colors.textSoft} />
        <View style={{ flex: 1, gap: 5 }}>
          <T size={14.5} weight="semibold">{link.title}</T>
          {link.body ? <T size={12.5} color={colors.textSoft}>{link.body}</T> : null}
        </View>
      </View>
      <Card style={{ marginHorizontal: 16, overflow: 'hidden' }}>
        <AvailabilityRow label="Historique des nuits" {...link.rows.history} />
        <AvailabilityRow label="Rattrapage de la copie" {...link.rows.sync} />
        <AvailabilityRow label="Conditions en temps réel" {...link.rows.live} />
        <AvailabilityRow label="Pilotage du réveil" {...link.rows.control} last />
      </Card>
      {link.retryLabel && onRetry ? (
        <Button label={link.retryLabel} icon="refresh" onPress={onRetry} loading={busy} style={{ marginHorizontal: 16, marginTop: 12 }} />
      ) : null}
    </View>
  );
}

export function LinkBanner({ link, copyLabel, onRetry, busy }: { link: LinkView; copyLabel: string | null; onRetry?: () => void; busy?: boolean }) {
  if (link.kind === 'ok' || link.kind === 'searching') return null;
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: link.isFailure ? colors.amberSoft : colors.glass,
        borderWidth: 1,
        borderColor: link.isFailure ? colors.amberBorder : 'rgba(255,255,255,0.1)',
      }}
    >
      <Icon name="alert" size={20} color={link.isFailure ? colors.amber : colors.textSoft} />
      <View style={{ flex: 1 }}>
        <T size={13.5} weight="semibold">{link.title}</T>
        <T size={12} color={colors.textMuted}>
          {link.kind === 'device-down' ? 'Historique complet ; pilotage indisponible.' : copyLabel ? `Lecture seule — ${copyLabel}.` : 'Lecture seule.'}
        </T>
      </View>
      {link.retryLabel && onRetry ? <Button label="Réessayer" onPress={onRetry} loading={busy} style={{ minHeight: 40, paddingHorizontal: 12 }} /> : null}
    </View>
  );
}

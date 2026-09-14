/**
 * Les alarmes que le réveil déclare visibles — parité avec la façade, pas avec l'API : les seize
 * emplacements existent, les dormants ne s'affichent pas (cadrage §2.A).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import type { AlarmSummary } from '../../data/types';
import { daysLabel } from '../../domain/alarms';
import { pad2 } from '../../domain/format';
import { command } from '../../state/commands';
import { useLink } from '../../state/hooks';
import { useApp } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Header, Notice, Screen, T, Toggle } from '../../ui/kit';
import { colors } from '../../ui/theme';

const time = (a: AlarmSummary) => `${pad2(a.hour ?? 0)}:${pad2(a.minute ?? 0)}`;

export default function AlarmsScreen() {
  const device = useApp((s) => s.device);
  const link = useLink();
  const [busy, setBusy] = useState<number | 'add' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alarms = device?.alarms ?? [];

  const toggle = async (a: AlarmSummary) => {
    setBusy(a.n);
    setError(null);
    const r = await command((api) => api.updateAlarm(a.n, { enabled: !a.enabled }));
    setBusy(null);
    if (!r.ok) setError(r.message);
  };

  const add = async () => {
    setBusy('add');
    setError(null);
    const r = await command((api) => api.createAlarm());
    setBusy(null);
    if (r.ok && typeof r.body.n === 'number') router.push({ pathname: '/alarms/[n]', params: { n: String(r.body.n) } });
    else if (!r.ok) setError(r.message);
  };

  return (
    <Screen>
      <Header
        title="Alarmes"
        right={
          <Pressable accessibilityLabel="Ajouter une alarme" onPress={add} disabled={!link.canControl || busy !== null} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: link.canControl ? 1 : 0.4 }}>
            {busy === 'add' ? <ActivityIndicator color={colors.accent} /> : <Icon name="plus" size={22} color={colors.accent} strokeWidth={1.8} />}
          </Pressable>
        }
      />
      {!link.canControl ? <Notice style={{ marginHorizontal: 16, marginBottom: 12 }}>{link.controlReason ?? ''}</Notice> : null}
      {error ? <Notice tone="error" style={{ marginHorizontal: 16, marginBottom: 12 }}>{error}</Notice> : null}
      {device === null ? (
        <T color={colors.textMuted} style={{ paddingHorizontal: 24, paddingVertical: 20 }}>Les alarmes n’ont pas encore été relues sur le réveil.</T>
      ) : alarms.length === 0 ? (
        <T color={colors.textMuted} style={{ paddingHorizontal: 24, paddingVertical: 20 }}>Aucune alarme visible sur le réveil.</T>
      ) : (
        alarms.map((a) => (
          <Pressable
            key={a.n}
            onPress={() => router.push({ pathname: '/alarms/[n]', params: { n: String(a.n) } })}
            disabled={!link.canControl}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.hairline, backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent' })}
          >
            <View style={{ flex: 1, gap: 5, opacity: a.enabled ? 1 : 0.42 }}>
              <T size={44} weight="light" style={{ letterSpacing: -1.5, lineHeight: 50 }}>{time(a)}</T>
              <T size={13.5} color={colors.textSoft}>{daysLabel(a.days)}</T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 14 }}>
              {a.powerwake?.on ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: a.enabled ? 1 : 0.42 }}>
                  <Icon name="bolt" size={15} color={colors.accent} />
                  <T size={13.5} weight="medium" color="rgba(255,255,255,0.75)">{`${pad2(a.powerwake.hour)}:${pad2(a.powerwake.minute)}`}</T>
                </View>
              ) : null}
              <Toggle label={`Alarme de ${time(a)}`} value={a.enabled} pending={busy === a.n} disabled={!link.canControl || (busy !== null && busy !== a.n)} onPress={() => toggle(a)} />
            </View>
          </Pressable>
        ))
      )}
      <T size={12.5} color="rgba(255,255,255,0.38)" style={{ paddingHorizontal: 24, paddingTop: 22 }}>
        Le réveil garde seize emplacements en mémoire. Seuls ceux qu'il affiche sur sa façade apparaissent ici. Supprimer une alarme la masque : elle ne peut plus sonner, et ses réglages restent dans le réveil.
      </T>
    </Screen>
  );
}

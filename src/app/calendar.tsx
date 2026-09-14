/**
 * Historique en calendrier mensuel : une pastille par jour, la durée ou la moyenne d'une grandeur.
 * Un jour sans donnée est dessiné vide — l'absence se voit ; un jour à venir n'a pas de pastille.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { nightAverages } from '../data/db';
import type { StoredNight } from '../domain/backup';
import { durationShort, formatMeasure, isoDay, monthYear, parseDay } from '../domain/format';
import { inBedSeconds, isInProgress, parseCorrected } from '../domain/nights';
import { METRIC_ORDER, METRICS, type Metric } from '../domain/thresholds';
import { useAsync, useNights, useNow } from '../state/hooks';
import { useApp } from '../state/store';
import { Icon } from '../ui/Icon';
import { Header, Screen, T } from '../ui/kit';
import { colors } from '../ui/theme';

type Choice = 'bed' | Metric;
const CHOICES: { key: Choice; label: string }[] = [
  { key: 'bed', label: 'Temps au lit' },
  ...METRIC_ORDER.map((m) => ({ key: m as Choice, label: METRICS[m].name })),
];

export default function CalendarScreen() {
  const { nights } = useNights();
  const version = useApp((s) => s.dataVersion);
  const { data: averages } = useAsync(nightAverages, [version]);
  const now = useNow();
  const [choice, setChoice] = useState(0);
  const today = isoDay(new Date());
  const withBed = nights.filter((n) => n.bedtime !== null);
  const firstDay = withBed[0]?.day ?? today;
  const [month, setMonth] = useState(() => {
    const d = parseDay(withBed[withBed.length - 1]?.day ?? today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const byDay = new Map<string, StoredNight[]>();
  for (const n of withBed) byDay.set(n.day, [...(byDay.get(n.day) ?? []), n]);

  const first = new Date(month.y, month.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => isoDay(new Date(month.y, month.m, i + 1)))];
  const minKey = firstDay.slice(0, 7);
  const maxKey = today.slice(0, 7);
  const key = `${month.y}-${String(month.m + 1).padStart(2, '0')}`;
  const shift = (k: number) => {
    const d = new Date(month.y, month.m + k, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const current = CHOICES[choice];

  const valueOf = (n: StoredNight): string => {
    if (current.key === 'bed') {
      const s = inBedSeconds(n, now);
      return s === null ? '—' : durationShort(s);
    }
    return formatMeasure(current.key, averages?.get(n.id)?.[current.key] ?? null);
  };

  return (
    <Screen>
      <Header title="Historique" closeIcon onBack={() => router.back()} />
      <Pressable onPress={() => setChoice((c) => (c + 1) % CHOICES.length)} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14 }}>
        <T size={17} weight="medium">{current.label}</T>
        <Icon name="chevron-down" size={16} color={colors.textSoft} />
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
        <Pressable accessibilityLabel="Mois précédent" onPress={() => shift(-1)} disabled={key <= minKey} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: key <= minKey ? 0.28 : 1 }}>
          <Icon name="chevron-left" size={21} color="rgba(255,255,255,0.75)" />
        </Pressable>
        <T size={19} weight="bold">{monthYear(month.y, month.m)}</T>
        <Pressable accessibilityLabel="Mois suivant" onPress={() => shift(1)} disabled={key >= maxKey} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: key >= maxKey ? 0.28 : 1 }}>
          <Icon name="chevron-right" size={21} color="rgba(255,255,255,0.75)" />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <T key={i} size={14} color={colors.textSoft} center style={{ flex: 1 }}>{d}</T>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 }}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 70 }} />;
          const dayNights = byDay.get(day) ?? [];
          const n = dayNights[0];
          const inHistory = day >= firstDay && day <= today;
          const estimated = n ? n.risetime_origin === 'estimated' && !parseCorrected(n.corrected).has('risetime') : false;
          const ongoing = n ? isInProgress(n) : false;
          return (
            <Pressable
              key={day}
              disabled={!n}
              onPress={() => n && router.navigate({ pathname: '/sleep', params: { night: String(n.id), tab: current.key === 'bed' ? 'bed' : 'cond' } })}
              style={{ width: `${100 / 7}%`, height: 70, alignItems: 'center', gap: 4, paddingTop: 4 }}
            >
              <T size={13} color={inHistory ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)'}>{String(Number(day.slice(8)))}</T>
              {n ? (
                <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: estimated || ongoing ? 'transparent' : '#ffffff', borderWidth: estimated || ongoing ? 1.5 : 0, borderStyle: estimated ? 'dashed' : 'solid', borderColor: ongoing ? colors.accent : colors.estimated }}>
                  <T size={11} weight="semibold" color={estimated ? '#fac285' : ongoing ? colors.accent : colors.onAccent}>{valueOf(n)}</T>
                  {dayNights.length > 1 ? <View style={{ position: 'absolute', right: -2, top: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><T size={9.5} weight="bold" color={colors.onAccent}>{`+${dayNights.length - 1}`}</T></View> : null}
                </View>
              ) : inHistory ? (
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.045)' }} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: '#ffffff' }} />
          <T size={12.5} color={colors.textSoft}>Confirmé</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.estimated }} />
          <T size={12.5} color={colors.textSoft}>Estimé</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <T size={12.5} color={colors.textSoft}>Sans donnée</T>
        </View>
      </View>
    </Screen>
  );
}

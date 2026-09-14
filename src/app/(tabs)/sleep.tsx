/**
 * Mon Sommeil — consulter. Nuit par nuit, et en vues Semaine et Mois. Tout se lit dans la copie
 * locale : hors du domicile, l'historique reste entier, en lecture seule (cadrage §2.C).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import type { StoredNight } from '../../domain/backup';
import { addDays, dayMonth, durationLong, hhmm, isoDay, monthYear, nightLabel, parseDay } from '../../domain/format';
import { parseCorrected } from '../../domain/nights';
import { averageInBed, monthOf, nightBar, nightsIn, previousRange, rangeDays, weekOf, type Bar, type Period } from '../../domain/views';
import { connect, refreshLive } from '../../state/controller';
import { useBackupReminder, useCopyLabel, useLink, useNights, useNightSeries, useNow } from '../../state/hooks';
import { useApp } from '../../state/store';
import { BedBars } from '../../ui/charts';
import { Icon } from '../../ui/Icon';
import { Button, Card, Loading, Notice, Screen, T, TitleBar } from '../../ui/kit';
import { LinkBanner, LinkPanel } from '../../ui/LinkPanel';
import { BedView, ConditionsView, SummarySheet } from '../../ui/night-views';
import { colors } from '../../ui/theme';

const PERIOD_LABEL: Record<Period, string> = { day: 'Jours', week: 'Semaine', month: 'Mois' };
const WEEK_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const isEstimated = (n: StoredNight) => n.risetime_origin === 'estimated' && !parseCorrected(n.corrected).has('risetime');

function ArrowButton({ direction, onPress, disabled }: { direction: 'left' | 'right'; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable accessibilityLabel={direction === 'left' ? 'Précédent' : 'Suivant'} onPress={onPress} disabled={disabled} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.28 : 1 }}>
      <Icon name={direction === 'left' ? 'chevron-left' : 'chevron-right'} size={20} color="rgba(255,255,255,0.62)" />
    </Pressable>
  );
}

function AggregateView({ period, nights, anchorDay, onAnchor, now }: { period: 'week' | 'month'; nights: StoredNight[]; anchorDay: string; onAnchor: (day: string) => void; now: number }) {
  const width = useWindowDimensions().width - 28;
  const range = period === 'week' ? weekOf(anchorDay) : monthOf(anchorDay);
  const inRange = nightsIn(nights, range);
  const avg = averageInBed(inRange);
  const prevAvg = averageInBed(nightsIn(nights, previousRange(period, range)));
  const days = rangeDays(range);
  const bars = inRange.map((n) => nightBar(n, now, isEstimated(n))).filter((b): b is Bar => b !== null);
  const firstDay = nights[0]?.day ?? range.from;
  const lastDay = isoDay(new Date());
  const start = parseDay(range.from);
  const title = period === 'week' ? `${dayMonth(range.from)} – ${dayMonth(range.to)}` : monthYear(start.getFullYear(), start.getMonth());
  const previousName = period === 'week' ? 'la semaine précédente' : 'le mois précédent';
  const compare =
    avg === null
      ? 'Aucune nuit complète sur cette période.'
      : prevAvg === null
        ? `Pas de nuit complète ${previousName} : rien à comparer.`
        : `${avg < prevAvg ? 'Inférieure' : avg > prevAvg ? 'Supérieure' : 'Égale'} à la moyenne de ${previousName}, qui était de ${durationLong(prevAvg)}.`;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <ArrowButton direction="left" disabled={range.from <= firstDay} onPress={() => onAnchor(addDays(range.from, -1))} />
        <View style={{ alignItems: 'center' }}>
          <T size={14.5} weight="medium">{title}</T>
          <T size={12} color={colors.textMuted}>{`${inRange.length} nuit${inRange.length > 1 ? 's' : ''} relevée${inRange.length > 1 ? 's' : ''}`}</T>
        </View>
        <ArrowButton direction="right" disabled={range.to >= lastDay} onPress={() => onAnchor(addDays(range.to, 1))} />
      </View>
      <Card style={{ marginHorizontal: 16, marginVertical: 14, padding: 16, flexDirection: 'row', gap: 13 }}>
        <Icon name="bed" size={26} color={colors.accent} strokeWidth={1.5} />
        <View style={{ flex: 1, gap: 4 }}>
          <T size={13} color={colors.accent}>Durée moyenne passée au lit</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T size={26} weight="light">{avg === null ? '—' : durationLong(avg)}</T>
            {avg !== null && prevAvg !== null && avg !== prevAvg ? (
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: avg < prevAvg ? '0deg' : '180deg' }] }}>
                <Icon name="arrow-down" size={12} color="#ffffff" strokeWidth={2.4} />
              </View>
            ) : null}
          </View>
          <T size={12.5} color={colors.textSoft}>{compare}</T>
        </View>
      </Card>
      <View style={{ paddingHorizontal: 14 }}>
        <T size={17} weight="bold" style={{ paddingBottom: 8 }}>Temps au lit</T>
        <BedBars
          days={days}
          bars={bars}
          width={width}
          labelFor={(_, i) => (period === 'week' ? WEEK_LETTERS[i] : i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : null)}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: '#ffffff' }} />
            <T size={12} color={colors.textSoft}>Temps au lit confirmé</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={{ width: 13, height: 13, borderRadius: 3, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.estimated }} />
            <T size={12} color={colors.textSoft}>Temps au lit estimé</T>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function SleepScreen() {
  const params = useLocalSearchParams<{ night?: string; tab?: string }>();
  const [tab, setTab] = useState<'bed' | 'cond'>('bed');
  const [period, setPeriod] = useState<Period>('day');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (params.night) {
      setSelectedId(Number(params.night));
      setPeriod('day');
    }
    if (params.tab === 'bed' || params.tab === 'cond') setTab(params.tab);
  }, [params.night, params.tab]);

  const { nights, loading } = useNights();
  const link = useLink();
  const copyLabel = useCopyLabel();
  const now = useNow();
  const collector = useApp((s) => s.collector);
  const syncRunning = useApp((s) => s.sync.running);
  const reminder = useBackupReminder();

  const withBed = nights.filter((n) => n.bedtime !== null);
  const selected = selectedId !== null ? withBed.find((n) => n.id === selectedId) : undefined;
  const night = selected ?? withBed[withBed.length - 1] ?? null;
  const position = night ? withBed.indexOf(night) : -1;
  const { series, loading: seriesLoading } = useNightSeries(period === 'day' ? night : null, now);

  const retry = async () => {
    setRetrying(true);
    await (collector === 'ok' ? refreshLive() : connect());
    setRetrying(false);
  };
  const cyclePeriod = () => {
    setPeriod((p) => (p === 'day' ? 'week' : p === 'week' ? 'month' : 'day'));
    setAnchor(null);
  };

  const footer =
    period === 'day' && night ? (
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <Button label="Copier le résumé de la nuit" icon="copy" onPress={() => setSummaryOpen(true)} />
      </View>
    ) : null;

  const readingsCount = series?.readings.length ?? 0;
  const nightSub = night
    ? `${night.bedtime !== null ? hhmm(night.bedtime) : '—'} – ${night.risetime !== null ? hhmm(night.risetime) : 'en cours'} · ${readingsCount} relevé${readingsCount > 1 ? 's' : ''}`
    : '';

  return (
    <Screen footer={footer}>
      <TitleBar title="Mon Sommeil" />
      {!night && link.kind === 'first-run' ? null : <LinkBanner link={link} copyLabel={copyLabel} onRetry={retry} busy={retrying} />}
      {reminder.due ? (
        <Notice tone="warn" style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <T size={12.5} color="#fac285">Aucune sauvegarde depuis une semaine : la copie de ce téléphone est le seul double de l’historique.</T>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 8 }}>
            <Pressable onPress={() => router.push('/backup')}><T size={13} weight="semibold" color={colors.accent}>Exporter</T></Pressable>
            <Pressable onPress={reminder.snooze}><T size={13} weight="semibold" color={colors.textSoft}>Plus tard</T></Pressable>
          </View>
        </Notice>
      ) : null}

      {loading ? (
        <Loading />
      ) : !night ? (
        link.kind === 'first-run' ? (
          <LinkPanel link={link} onRetry={retry} busy={retrying} />
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <Notice>Aucune nuit enregistrée pour l’instant. Une nuit apparaît dès que le geste « je me couche » est fait — ici ou dans SleepMapper.</Notice>
            {syncRunning ? <Loading label="Rattrapage de la copie en cours…" /> : null}
          </View>
        )
      ) : (
        <>
          {period === 'day' ? (
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
              {(['bed', 'cond'] as const).map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingTop: 12, paddingBottom: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? colors.accent : 'transparent' }}>
                  <T size={14.5} weight="medium" color={tab === t ? colors.accent : 'rgba(255,255,255,0.44)'}>{t === 'bed' ? 'Temps au lit' : 'Conditions'}</T>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <Pressable accessibilityLabel="Historique" onPress={() => router.push('/calendar')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="calendar" size={21} color={colors.accent} />
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              {period === 'day' ? (
                <>
                  <T size={14.5} weight="medium" numberOfLines={1}>{nightLabel(night)}</T>
                  <T size={12} color={colors.textMuted}>{nightSub}</T>
                </>
              ) : (
                <T size={14.5} weight="medium">{period === 'week' ? 'Vue de la semaine' : 'Vue du mois'}</T>
              )}
            </View>
            <Pressable onPress={cyclePeriod} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 44 }}>
              <T size={14.5} weight="medium">{PERIOD_LABEL[period]}</T>
              <Icon name="chevron-down" size={16} color={colors.textSoft} />
            </Pressable>
          </View>

          {period === 'day' ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }}>
                <ArrowButton direction="left" disabled={position <= 0} onPress={() => setSelectedId(withBed[position - 1].id)} />
                {position < withBed.length - 1 ? (
                  <Pressable onPress={() => setSelectedId(null)} style={{ minHeight: 44, justifyContent: 'center' }}>
                    <T size={13} weight="semibold" color={colors.accent}>Dernière nuit</T>
                  </Pressable>
                ) : null}
                <ArrowButton direction="right" disabled={position >= withBed.length - 1} onPress={() => setSelectedId(withBed[position + 1].id)} />
              </View>
              {tab === 'bed' ? (
                <BedView night={night} canCorrect={link.canCorrect} correctReason={link.controlReason} now={now} />
              ) : (
                <ConditionsView night={night} series={series} loading={seriesLoading} />
              )}
            </>
          ) : (
            <AggregateView period={period} nights={withBed} anchorDay={anchor ?? night.day} onAnchor={setAnchor} now={now} />
          )}
          <SummarySheet visible={summaryOpen} onClose={() => setSummaryOpen(false)} night={night} series={series} />
        </>
      )}
    </Screen>
  );
}

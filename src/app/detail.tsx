/**
 * Détail d'une mesure : la courbe de la nuit, ses minimum, moyenne et maximum, et l'échelle des
 * seuils consultable — c'est elle qui rend le verdict vérifiable (cadrage §2.B).
 */
import { useLocalSearchParams } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';

import { bandRangeLabel, formatMeasure, hhmm, nightLabel } from '../domain/format';
import { findGaps, gapCause, medianStep, READING_KEY, summarize } from '../domain/stats';
import { bandFor, METRICS, THRESHOLDS_SOURCE, type Metric } from '../domain/thresholds';
import { useNights, useNightSeries, useNow } from '../state/hooks';
import { NightChart } from '../ui/charts';
import { Card, Header, Loading, Notice, Screen, T } from '../ui/kit';
import { NO_RISE_CONDITIONS } from '../ui/night-views';
import { colors } from '../ui/theme';

const isMetric = (m: string | undefined): m is Metric => m === 'temp' || m === 'hum' || m === 'lux' || m === 'snd';

export default function DetailScreen() {
  const params = useLocalSearchParams<{ night: string; metric: string }>();
  const metric: Metric = isMetric(params.metric) ? params.metric : 'temp';
  const info = METRICS[metric];
  const width = useWindowDimensions().width - 12;
  const now = useNow();
  const { nights, loading } = useNights();
  const night = nights.find((n) => n.id === Number(params.night)) ?? null;
  const { series, loading: seriesLoading } = useNightSeries(night, now);

  const key = READING_KEY[metric];
  const points = series ? series.readings.filter((r) => r[key] !== null) : [];
  const stats = series ? summarize(series.readings, metric) : null;
  const step = medianStep(points.map((p) => p.ts));
  const breakAfter = Math.max(3 * step, 150);
  const gaps = series ? findGaps(points.map((p) => p.ts), series.start, series.end, step) : [];
  const currentBand = stats ? bandFor(metric, stats.avg) : null;

  return (
    <Screen>
      <Header title={info.name} />
      {loading || (night && seriesLoading && !series) ? (
        <Loading />
      ) : !night ? (
        <Notice style={{ margin: 16 }}>Cette nuit n’est pas dans la copie locale.</Notice>
      ) : (
        <>
          <T size={12.5} color={colors.textMuted} center style={{ paddingBottom: 16 }}>
            {`${nightLabel(night)} · ${night.bedtime !== null ? hhmm(night.bedtime) : '—'} – ${night.risetime !== null ? hhmm(night.risetime) : 'en cours'}`}
          </T>
          <T size={15} weight="semibold" style={{ paddingHorizontal: 20, paddingBottom: 6 }}>{info.chartTitle}</T>
          {!series ? (
            <Notice style={{ marginHorizontal: 16 }}>{NO_RISE_CONDITIONS}</Notice>
          ) : !stats ? (
            <Notice style={{ marginHorizontal: 16 }}>Pas de données pour cette grandeur cette nuit.</Notice>
          ) : stats.count === 1 ? (
            <Notice style={{ marginHorizontal: 16 }}>{`Un seul relevé : ${formatMeasure(metric, stats.avg)} ${info.unit} à ${hhmm(stats.first)}. Un point ne fait pas une courbe.`}</Notice>
          ) : (
            <View style={{ paddingHorizontal: 6, paddingTop: 6 }}>
              <NightChart metric={metric} readings={series.readings} start={series.start} end={series.end} gaps={gaps} width={width} breakAfter={breakAfter} />
            </View>
          )}
          {series && stats && stats.first - series.start > breakAfter ? (
            <T size={12} color={colors.textMuted} style={{ paddingHorizontal: 20, paddingTop: 8 }}>
              {`La collecte n’a commencé qu’à ${hhmm(stats.first)} : minimum, moyenne et maximum portent sur ce qui a été mesuré.`}
            </T>
          ) : null}
          {series && gaps.length > 0 && stats ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 3 }}>
              {gaps.map((g) => (
                <T key={`${g.from}`} size={12} color={colors.textMuted}>{`Pas de relevé de ${hhmm(g.from)} à ${hhmm(g.to)} — ${gapCause(g, series.outages, now)}.`}</T>
              ))}
            </View>
          ) : null}
          {stats ? (
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14 }}>
              {([['Minimum', stats.min], ['Moyenne', stats.avg], ['Maximum', stats.max]] as const).map(([label, v]) => (
                <Card key={label} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', gap: 4 }}>
                  <T size={11.5} color={colors.textMuted}>{label}</T>
                  <T size={19}>{`${formatMeasure(metric, v)} ${info.unit}`}</T>
                </Card>
              ))}
            </View>
          ) : null}

          <T size={12.5} weight="semibold" color="rgba(255,255,255,0.42)" style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' }}>Échelle</T>
          <Card style={{ marginHorizontal: 16, padding: 16, gap: 11 }}>
            {info.bands.map((b) => {
              const here = currentBand === b;
              return (
                <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 5, height: 20, borderRadius: 3, backgroundColor: b.ideal ? colors.accent : 'rgba(255,255,255,0.22)' }} />
                  <T size={13.5} weight={b.ideal || here ? 'semibold' : 'regular'} color={b.ideal ? colors.accent : here ? colors.text : colors.textSoft} style={{ flex: 1 }}>
                    {here ? `${b.label} — moyenne de la nuit` : b.label}
                  </T>
                  <T size={13} color="rgba(255,255,255,0.42)">{bandRangeLabel(metric, b)}</T>
                </View>
              );
            })}
          </Card>
          <T size={12.5} color={colors.textSoft} style={{ paddingHorizontal: 20, paddingTop: 14 }}>{`« ${info.explanation} »`}</T>
          <T size={11} color={colors.textFaint} style={{ paddingHorizontal: 20, paddingTop: 8 }}>{`Texte et seuils de SleepMapper (Philips). ${THRESHOLDS_SOURCE}`}</T>
        </>
      )}
    </Screen>
  );
}

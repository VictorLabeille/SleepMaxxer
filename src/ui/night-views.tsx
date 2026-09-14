/**
 * Une nuit, vue par ses deux onglets : temps au lit, conditions de la chambre — et son résumé
 * pour le coach. Un verdict n'est affiché qu'avec son seuil sourcé ; une donnée absente se dit.
 */
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { StoredNight } from '../domain/backup';
import { durationShort, formatMeasure, hhmm } from '../domain/format';
import { inBedSeconds, isInProgress, nightPhase, parseCorrected, resolveCorrection, timeOrigin, type TimeOrigin } from '../domain/nights';
import { findGaps, READING_KEY, summarize, type Summary } from '../domain/stats';
import { coachSummary } from '../domain/summary';
import { METRIC_ORDER, METRICS, THRESHOLDS_SOURCE, verdict, type Metric } from '../domain/thresholds';
import { correctNight } from '../state/commands';
import type { NightSeries } from '../state/hooks';
import { Icon, type IconName } from './Icon';
import { Button, Card, Loading, Notice, Row, T } from './kit';
import { Sheet, TimeSheet } from './Sheet';
import { colors } from './theme';

export const METRIC_ICON: Record<Metric, IconName> = { temp: 'thermometer', hum: 'drop', lux: 'sun', snd: 'speaker' };

const ORIGIN_COLOR: Record<TimeOrigin, string> = {
  confirmé: 'rgba(255,255,255,0.4)',
  estimé: colors.estimated,
  corrigé: colors.accent,
};

export function nightStats(series: NightSeries | null): Partial<Record<Metric, Summary | null>> {
  if (!series) return {};
  return Object.fromEntries(METRIC_ORDER.map((m) => [m, summarize(series.readings, m)]));
}

export const NO_RISE_CONDITIONS = "Conditions non calculées : la nuit n'a pas d'heure de lever, sa fin n'est pas connue.";

function Disk({ night, now }: { night: StoredNight; now: number }) {
  const seconds = inBedSeconds(night, now);
  const running = isInProgress(night);
  return (
    <View style={{ width: 222, height: 222, borderRadius: 111, borderWidth: 1.5, borderColor: running ? 'rgba(87,200,196,0.55)' : 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Icon name="bed" size={24} color="rgba(255,255,255,0.6)" strokeWidth={1.4} />
      <T size={54} weight="extralight" color={seconds === null ? 'rgba(255,255,255,0.4)' : colors.text} style={{ letterSpacing: -2, lineHeight: 62 }}>
        {seconds === null ? '— —' : durationShort(seconds)}
      </T>
      <T size={14} color={colors.textSoft}>{running ? 'Temps au lit, en cours' : 'Temps au lit'}</T>
    </View>
  );
}

function TimePill({ label, time, origin, placeholder }: { label: string; time: number | null; origin: TimeOrigin | null; placeholder: string }) {
  return (
    <Card style={{ flex: 1, padding: 14, alignItems: 'center', gap: 5 }}>
      <T size={12} color={colors.textMuted}>{label}</T>
      <T size={24} weight="light">{time === null ? placeholder : hhmm(time)}</T>
      <T size={10.5} weight="semibold" color={origin ? ORIGIN_COLOR[origin] : colors.textFaint} style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {origin ?? ' '}
      </T>
    </Card>
  );
}

export function BedView({ night, canCorrect, correctReason, now }: { night: StoredNight; canCorrect: boolean; correctReason: string | null; now: number }) {
  const phase = nightPhase(night);
  const corrected = parseCorrected(night.corrected);
  const inProgress = isInProgress(night);
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState<'bedtime' | 'risetime' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setDone(null);
  }, [night.id]);

  const reference = picker === 'risetime' ? night.risetime ?? (night.bedtime !== null ? night.bedtime + 8 * 3600 : now) : night.bedtime ?? now;
  const refDate = new Date(reference * 1000);

  const confirm = async (hour: number, minute: number) => {
    if (!picker) return;
    const value = resolveCorrection(night, picker, hour, minute);
    const bed = picker === 'bedtime' ? value : night.bedtime;
    const rise = picker === 'risetime' ? value : night.risetime;
    if (bed !== null && rise !== null && rise <= bed) {
      setError("L'heure de lever précède l'heure de coucher. La correction est refusée, l'heure précédente est conservée.");
      return;
    }
    if (value > Date.now() / 1000 + 60) {
      setError('Cette heure est dans le futur : la correction est refusée.');
      return;
    }
    setBusy(true);
    setError(null);
    const r = await correctNight(night.id, picker, value);
    setBusy(false);
    if (r.ok) {
      setDone(`Heure de ${picker === 'bedtime' ? 'coucher' : 'lever'} corrigée : ${hhmm(value)}.`);
      setPicker(null);
    } else {
      setError(r.message);
    }
  };

  return (
    <View style={{ alignItems: 'center', gap: 20, paddingTop: 18, paddingHorizontal: 20 }}>
      <Disk night={night} now={now} />
      {phase === 'waiting-device' ? (
        <Notice tone="warn" style={{ alignSelf: 'stretch' }}>Coucher enregistré, en attente du réveil : la session s’ouvrira dès qu’il répondra. L’heure de l’appui fait foi.</Notice>
      ) : null}
      {phase === 'abnormal' ? (
        <Notice tone="warn" style={{ alignSelf: 'stretch' }}>Nuit restée ouverte : aucune heure de lever. Le réveil l’a close seul au bout de 12 h, sans alarme. Corrigez le lever à la main si besoin.</Notice>
      ) : null}
      {phase === 'awaiting-rise' ? (
        <Notice style={{ alignSelf: 'stretch' }}>Nuit close par l’alarme : le lever sera pris à la fin de la sonnerie.</Notice>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
        <TimePill label="Coucher" time={night.bedtime} origin={timeOrigin(night, 'bedtime', corrected)} placeholder="—" />
        <TimePill label="Lever" time={night.risetime} origin={timeOrigin(night, 'risetime', corrected)} placeholder={inProgress ? 'en cours' : '—'} />
      </View>
      {editing ? (
        <Card style={{ alignSelf: 'stretch', overflow: 'hidden' }}>
          <Row label="Heure de coucher" value={night.bedtime !== null ? hhmm(night.bedtime) : '—'} disabled={!canCorrect} onPress={() => { setError(null); setPicker('bedtime'); }} />
          <Row label="Heure de lever" value={night.risetime !== null ? hhmm(night.risetime) : '—'} disabled={!canCorrect || inProgress} onPress={() => { setError(null); setPicker('risetime'); }} last />
          <T size={11.5} color="rgba(255,255,255,0.42)" style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
            {canCorrect ? 'La correction s’enregistre dans le collecteur. Elle ne touche pas ce que le réveil a enregistré.' : correctReason ?? ''}
          </T>
        </Card>
      ) : null}
      {done ? <Notice style={{ alignSelf: 'stretch' }}>{done}</Notice> : null}
      <Button label={editing ? 'Terminer' : 'Corriger les heures'} onPress={() => { setEditing(!editing); setDone(null); }} style={{ alignSelf: 'stretch' }} />
      <TimeSheet
        visible={picker !== null}
        title={picker === 'bedtime' ? 'Heure de coucher' : 'Heure de lever'}
        hour={refDate.getHours()}
        minute={refDate.getMinutes()}
        error={error}
        busy={busy}
        onCancel={() => { setPicker(null); setError(null); }}
        onConfirm={confirm}
      />
    </View>
  );
}

export function ConditionsView({ night, series, loading }: { night: StoredNight; series: NightSeries | null; loading: boolean }) {
  if (!series) {
    if (loading) return <Loading />;
    return <Notice style={{ margin: 16 }}>{`${NO_RISE_CONDITIONS} Corrigez l’heure de lever pour les voir.`}</Notice>;
  }
  const inProgress = isInProgress(night);
  const stats = nightStats(series);
  const latest = inProgress ? series.readings[series.readings.length - 1] ?? null : null;
  const valueOf = (m: Metric): number | null => (inProgress ? (latest ? latest[READING_KEY[m]] : null) : stats[m]?.avg ?? null);
  const counted = Math.max(0, ...METRIC_ORDER.map((m) => stats[m]?.count ?? 0));
  const measured = METRIC_ORDER.map((m) => stats[m]).filter((s): s is Summary => !!s);
  const gaps = findGaps(series.readings.map((r) => r.ts), series.start, series.end);

  let coverage: string;
  if (inProgress) coverage = latest ? `Nuit en cours : valeurs du dernier relevé, à ${hhmm(latest.ts)}.` : 'Nuit en cours : pas encore de relevé.';
  else if (counted === 0) coverage = 'Aucun relevé pour cette nuit : le collecteur ne mesurait pas. Les heures, elles, restent valables.';
  else coverage = `Moyennes de la nuit, sur ${counted} relevés de ${hhmm(Math.min(...measured.map((s) => s.first)))} à ${hhmm(Math.max(...measured.map((s) => s.last)))}.`;

  return (
    <View>
      {inProgress ? <T size={17} weight="semibold" style={{ paddingHorizontal: 20, paddingTop: 16 }}>Maintenant</T> : null}
      <Card style={{ marginHorizontal: 16, marginTop: 14, overflow: 'hidden' }}>
        {METRIC_ORDER.map((m, i) => {
          const v = valueOf(m);
          const info = METRICS[m];
          const vd = v === null ? null : verdict(m, v);
          const tone = vd?.tone === 'out' ? colors.amber : vd?.tone === 'ideal' ? colors.accent : 'rgba(255,255,255,0.66)';
          return (
            <Pressable
              key={m}
              onPress={() => router.push({ pathname: '/detail', params: { night: String(night.id), metric: m } })}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16, minHeight: 64, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: colors.hairline, backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent' })}
            >
              <Icon name={METRIC_ICON[m]} size={22} color={v === null ? colors.textFaint : tone} strokeWidth={1.5} />
              <View style={{ flex: 1, gap: 3 }}>
                <T size={15} weight="semibold">{info.name}</T>
                <T size={12.5} color={colors.textMuted}>{vd ? vd.text : 'Pas de données'}</T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                <T size={25} weight="light" style={{ letterSpacing: -0.5 }}>{formatMeasure(m, v)}</T>
                {v !== null ? <T size={13} color={colors.textMuted}>{info.unit}</T> : null}
              </View>
              <Icon name="chevron-right" size={16} color="rgba(255,255,255,0.3)" strokeWidth={1.8} />
            </Pressable>
          );
        })}
      </Card>
      <T size={12} color={colors.textMuted} style={{ paddingHorizontal: 20, paddingTop: 10 }}>{coverage}</T>
      {!inProgress && gaps.length > 0 && counted > 0 ? (
        <T size={12} color={colors.textMuted} style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          {`${gaps.length} trou${gaps.length > 1 ? 's' : ''} de collecte cette nuit — le détail d’une mesure en donne la cause.`}
        </T>
      ) : null}
      <T size={11} color={colors.textFaint} style={{ paddingHorizontal: 20, paddingTop: 8 }}>{THRESHOLDS_SOURCE}</T>
    </View>
  );
}

export function SummarySheet({ visible, onClose, night, series }: { visible: boolean; onClose: () => void; night: StoredNight; series: NightSeries | null }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (visible) setCopied(false);
  }, [visible]);
  const corrected = parseCorrected(night.corrected);
  const result = coachSummary({
    night,
    bedtimeOrigin: timeOrigin(night, 'bedtime', corrected),
    risetimeOrigin: timeOrigin(night, 'risetime', corrected),
    stats: nightStats(series),
    conditionsUnavailable: series ? undefined : NO_RISE_CONDITIONS,
  });
  return (
    <Sheet visible={visible} onClose={onClose} title="Résumé de la nuit" subtitle="Heures et conditions dans un seul texte, à coller au coach de Google Health.">
      {result.ok ? (
        <ScrollView style={{ maxHeight: 340, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.32)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }} contentContainerStyle={{ padding: 14 }}>
          <T size={12} color="rgba(255,255,255,0.82)" style={{ lineHeight: 19 }}>{result.text}</T>
        </ScrollView>
      ) : (
        <Notice>{result.reason}</Notice>
      )}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Button label="Fermer" onPress={onClose} style={{ flex: 1 }} />
        {result.ok ? (
          <Button
            label={copied ? 'Copié' : 'Copier'}
            icon={copied ? 'check' : 'copy'}
            kind="primary"
            onPress={async () => {
              await Clipboard.setStringAsync(result.text);
              setCopied(true);
            }}
            style={{ flex: 1.4 }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

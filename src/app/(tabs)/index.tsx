/**
 * Mon Appareil — piloter. Une carte par fonction, jamais de réglage détaillé sur l'accueil.
 * Le geste « je me couche » domine l'écran : il se fait d'une main, dans le noir (cadrage §2).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Night } from '../../data/types';
import { BOUNDS } from '../../domain/alarms';
import { lightThemes, themeName } from '../../domain/catalog';
import { ago, formatNumber, hhmm, pad2 } from '../../domain/format';
import { currentNight, nightPhase } from '../../domain/nights';
import { command, nightGesture } from '../../state/commands';
import { connect, refreshLive } from '../../state/controller';
import { useLink, useNights, useNow } from '../../state/hooks';
import type { LinkView } from '../../state/link';
import { useApp } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Button, Card, NavCard, Notice, Screen, Section, SliderRow, T, TitleBar, Toggle } from '../../ui/kit';
import { LinkPanel } from '../../ui/LinkPanel';
import { colors } from '../../ui/theme';

function DeviceHeader({ link, now }: { link: LinkView; now: number }) {
  const status = useApp((s) => s.status);
  const dot = link.kind === 'ok' ? colors.green : link.isFailure ? colors.amber : 'rgba(255,255,255,0.35)';
  const lastReading = status?.reveil.dernier_releve_at;
  const subtitle =
    link.kind === 'ok'
      ? `Collecteur joignable${lastReading ? ` · relevé ${ago(lastReading, now)}` : ''}`
      : link.kind === 'device-down'
        ? `Collecteur joignable · ${status?.reveil.cause_indisponibilite ?? 'réveil injoignable'}`
        : link.title;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 20 }}>
      <View style={{ width: 54, height: 54, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="clock" size={28} color="rgba(255,255,255,0.8)" strokeWidth={1.4} />
        <View style={{ position: 'absolute', right: -3, top: -3, width: 15, height: 15, borderRadius: 8, backgroundColor: dot, borderWidth: 2.5, borderColor: colors.bgTop }} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <T size={16} weight="semibold">Somneo HF3671</T>
        <T size={12.5} color={colors.textMuted}>{subtitle}</T>
      </View>
    </View>
  );
}

/**
 * Le geste de coucher. Si le réveil ne répond pas, l'appui n'est jamais perdu : le collecteur le
 * retient, et l'écran dit « en attente du réveil », jamais « suivi en cours » (cadrage §5).
 */
function BedtimeCard({ current, collectorOk }: { current: Night | null; collectorOk: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const phase = current ? nightPhase(current) : null;
  const inProgress = phase === 'waiting-device' || phase === 'ongoing' || phase === 'awaiting-rise';

  const press = async () => {
    const kind = inProgress ? 'risetime' : 'bedtime';
    setBusy(true);
    setMessage(null);
    const r = await nightGesture(kind);
    setBusy(false);
    const n = r.body?.night ?? null;
    if (!r.ok) {
      setMessage({ tone: 'error', text: r.message });
    } else if (kind === 'bedtime' && r.status === 202 && n?.bedtime) {
      setMessage({ tone: 'info', text: `Le réveil ne répond pas : l'appui de ${hhmm(n.bedtime)} est retenu par le collecteur et fait foi. La session s'ouvrira dès son retour.` });
    } else if (kind === 'bedtime' && r.status === 200) {
      setMessage({ tone: 'info', text: 'Une nuit est déjà en cours : rien n’a été écrit.' });
    } else if (kind === 'risetime' && n?.risetime) {
      setMessage({
        tone: 'info',
        text: r.status === 202 ? `Lever enregistré à ${hhmm(n.risetime)} ; la session du réveil se fermera à son retour.` : `Lever enregistré à ${hhmm(n.risetime)}.`,
      });
    }
  };

  let state: string | null = null;
  if (current && current.bedtime !== null) {
    if (phase === 'waiting-device') state = `Coucher enregistré à ${hhmm(current.bedtime)} — en attente du réveil`;
    else if (phase === 'ongoing') state = `Suivi en cours depuis ${hhmm(current.bedtime)}`;
    else if (phase === 'awaiting-rise') state = 'Nuit close par l’alarme — le lever sera pris à la fin de la sonnerie';
  }

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <Icon name="moon" size={19} color="rgba(255,255,255,0.72)" strokeWidth={1.5} />
        <T size={15.5} weight="semibold" style={{ flex: 1 }}>Suivi de l'heure de coucher</T>
      </View>
      {state ? (
        <T size={13.5} weight="medium" color={phase === 'waiting-device' ? colors.amber : colors.text} style={{ marginBottom: 12 }}>{state}</T>
      ) : null}
      <Button
        big
        label={inProgress ? 'Je me lève' : 'Je me couche'}
        kind={inProgress ? 'secondary' : 'primary'}
        onPress={press}
        loading={busy}
        disabled={!collectorOk}
      />
      <T size={12} color="rgba(255,255,255,0.42)" center style={{ marginTop: 11 }}>
        {collectorOk ? 'L’heure retenue est celle de l’appui, tenue par le collecteur.' : 'Collecteur injoignable : le geste ne peut pas être transmis.'}
      </T>
      {message ? <Notice tone={message.tone} style={{ marginTop: 12 }}>{message.text}</Notice> : null}
    </Card>
  );
}

function LightCard({ link }: { link: LinkView }) {
  const light = useApp((s) => s.device?.ports.wulgt?.body ?? null);
  const [busy, setBusy] = useState<'onoff' | 'level' | 'night' | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { min, max } = BOUNDS.lightLevel;
  const level = Math.min(max, Math.max(min, light?.ltlvl ?? min));
  const disabled = !link.canControl || !light || busy !== null;

  const run = async (what: 'onoff' | 'level' | 'night', fn: Parameters<typeof command>[0]) => {
    setBusy(what);
    setError(null);
    const r = await command(fn);
    setBusy(null);
    setDrag(null);
    if (!r.ok) setError(r.message);
  };

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 24, padding: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Icon name="sun" size={19} color={light?.onoff ? colors.accent : 'rgba(255,255,255,0.72)'} strokeWidth={1.5} />
        <T size={15.5} weight="semibold" style={{ flex: 1 }}>Lumière</T>
        <Toggle label="Lumière" value={!!light?.onoff} pending={busy === 'onoff'} disabled={disabled && busy !== 'onoff'} onPress={() => light && run('onoff', (api) => api.light(!light.onoff))} />
      </View>
      {light?.onoff ? (
        <View style={{ marginTop: 12 }}>
          <SliderRow
            label="Intensité"
            value={drag ?? level}
            min={min}
            max={max}
            hint={busy === 'level' ? 'envoi au réveil…' : undefined}
            disabled={disabled}
            onChange={setDrag}
            onComplete={(v) => run('level', (api) => api.light(true, v))}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button label="−" onPress={() => run('level', (api) => api.light(true, Math.max(min, level - 1)))} disabled={disabled || level <= min} style={{ flex: 1 }} />
            <Button label="+" onPress={() => run('level', (api) => api.light(true, Math.min(max, level + 1)))} disabled={disabled || level >= max} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.hairline }}>
        <Icon name="moon" size={17} color={light?.ngtlt ? colors.accent : 'rgba(255,255,255,0.6)'} strokeWidth={1.5} />
        <T size={14.5} weight="medium" style={{ flex: 1 }}>Veilleuse</T>
        <Toggle label="Veilleuse" value={!!light?.ngtlt} pending={busy === 'night'} disabled={disabled && busy !== 'night'} onPress={() => light && run('night', (api) => api.nightlight(!light.ngtlt))} />
      </View>
      {!link.canControl ? <T size={12} color={colors.textMuted} style={{ marginTop: 12 }}>{link.controlReason}</T> : null}
      {link.canControl && !light ? <T size={12} color={colors.textMuted} style={{ marginTop: 12 }}>État de la lampe pas encore relu.</T> : null}
      {error ? <Notice tone="error" style={{ marginTop: 12 }}>{error}</Notice> : null}
    </Card>
  );
}

export default function DeviceScreen() {
  const link = useLink();
  const now = useNow();
  const status = useApp((s) => s.status);
  const device = useApp((s) => s.device);
  const catalog = useApp((s) => s.catalog);
  const collector = useApp((s) => s.collector);
  const sync = useApp((s) => s.sync);
  const { nights } = useNights();
  const [retrying, setRetrying] = useState(false);
  const [disarming, setDisarming] = useState(false);
  const [disarmError, setDisarmError] = useState<string | null>(null);

  const retry = async () => {
    setRetrying(true);
    await (collector === 'ok' ? refreshLive() : connect());
    setRetrying(false);
  };

  const active = (device?.alarms ?? []).filter((a) => a.enabled && a.hour !== null);
  const alarmSubtitle = device
    ? active.length
      ? active.map((a) => `${pad2(a.hour ?? 0)}:${pad2(a.minute ?? 0)}`).join(' · ')
      : 'Aucune alarme active'
    : 'État du réveil pas encore relu';
  const sunset = device?.ports.wudsk?.body;
  const sunsetSubtitle = sunset
    ? `${sunset.durat} minutes · ${themeName(lightThemes(catalog, 'dusklightthemes'), sunset.ctype)}${sunset.onoff ? ' · en cours' : ''}`
    : 'État du réveil pas encore relu';
  const copySubtitle = sync.running
    ? `Rattrapage en cours${sync.fraction !== null ? ` · ${Math.round(sync.fraction * 100)} %` : ''}`
    : sync.suspended
      ? 'Rattrapage suspendu — voir le détail'
      : sync.error
        ? 'Rattrapage interrompu'
        : sync.lastOkAt
          ? `À jour · ${ago(sync.lastOkAt, now)}`
          : 'Pas encore copiée';

  const hidden = status?.alarmes.masquees_armees ?? device?.hidden_armed_alarms ?? [];
  const drift = status?.horloge;

  const disarm = async () => {
    setDisarming(true);
    setDisarmError(null);
    for (const n of hidden) {
      const r = await command((api) => api.updateAlarm(n, { enabled: false }));
      if (!r.ok) {
        setDisarmError(r.message);
        break;
      }
    }
    setDisarming(false);
  };

  return (
    <Screen>
      <TitleBar title="Mon Appareil" />
      <DeviceHeader link={link} now={now} />
      {link.kind !== 'ok' && link.kind !== 'searching' ? <LinkPanel link={link} onRetry={retry} busy={retrying} /> : null}
      {drift?.au_dela_du_seuil && drift.ecart_s !== null ? (
        <Notice tone="warn" style={{ marginHorizontal: 16, marginBottom: 16 }}>
          {`L’horloge du réveil s’écarte de ${formatNumber(Math.abs(drift.ecart_s), 0)} s de l’heure réseau (seuil : ${drift.seuil_s} s). L’app ne peut pas la remettre à l’heure : le réveil ne l’accepte pas. Les heures des nuits, elles, viennent du collecteur et restent justes.`}
        </Notice>
      ) : null}
      {hidden.length > 0 ? (
        <Notice tone="warn" style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <T size={12.5} color="#fac285">{`Alarme masquée mais armée (emplacement ${hidden.join(', ')}) : elle peut sonner sans apparaître ici.`}</T>
          <Pressable onPress={disarm} disabled={disarming || !link.canControl} style={{ marginTop: 8 }}>
            <T size={13} weight="semibold" color={colors.accent}>{disarming ? 'Désactivation…' : 'La désactiver'}</T>
          </Pressable>
          {disarmError ? <T size={12} color={colors.errorText} style={{ marginTop: 6 }}>{disarmError}</T> : null}
        </Notice>
      ) : null}

      <Section>Préparez-vous à dormir</Section>
      <NavCard icon="bell" title="Alarmes" subtitle={alarmSubtitle} onPress={() => router.push('/alarms')} />

      <Section>S'endormir</Section>
      <NavCard icon="sunset" title="Coucher de soleil" subtitle={sunsetSubtitle} onPress={() => router.push('/sunset')} />

      <Section>Télécommande</Section>
      <BedtimeCard current={currentNight(nights)} collectorOk={collector === 'ok'} />
      <LightCard link={link} />

      <Section>Copie locale</Section>
      <NavCard icon="archive" title="Copie et sauvegarde" subtitle={copySubtitle} onPress={() => router.push('/backup')} />
    </Screen>
  );
}

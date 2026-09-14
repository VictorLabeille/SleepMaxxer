/**
 * Coucher de soleil : lancement, arrêt, et réglage de ses paramètres. Le réglage détaillé vit
 * derrière « Régler », pas sur l'écran — comme SleepMapper.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import type { SunsetBody, SunsetSettings } from '../data/types';
import { BOUNDS } from '../domain/alarms';
import { duskSounds, lightThemes, NO_SOUND, sameSound, soundName, themeName } from '../domain/catalog';
import { command } from '../state/commands';
import { useLink } from '../state/hooks';
import { useApp } from '../state/store';
import { Icon } from '../ui/Icon';
import { Button, Card, Header, Notice, Screen, SliderRow, T } from '../ui/kit';
import { colors } from '../ui/theme';

const FIELDS = ['durat', 'curve', 'ctype', 'snddv', 'sndch', 'sndlv'] as const;

function changes(from: SunsetBody, to: SunsetBody): SunsetSettings {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) if (String(from[f]) !== String(to[f])) out[f] = to[f];
  if (out.snddv !== undefined || out.sndch !== undefined) {
    out.snddv = to.snddv;
    out.sndch = to.sndch;
  }
  return out as SunsetSettings;
}

function Option({ label, checked, onPress, swatch }: { label: string; checked: boolean; onPress: () => void; swatch?: [string, string] | null }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9, minHeight: 46, opacity: pressed ? 0.7 : 1 })}>
      {swatch ? <LinearGradient colors={swatch} style={{ width: 32, height: 32, borderRadius: 16 }} /> : null}
      <T size={14.5} style={{ flex: 1 }}>{label}</T>
      {checked ? <Icon name="check" size={20} color="#ffffff" strokeWidth={2} /> : null}
    </Pressable>
  );
}

export default function SunsetScreen() {
  const body = useApp((s) => s.device?.ports.wudsk?.body ?? null);
  const catalog = useApp((s) => s.catalog);
  const link = useLink();
  const [draft, setDraft] = useState<SunsetBody | null>(null);
  const [busy, setBusy] = useState<'run' | 'apply' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const themes = lightThemes(catalog, 'dusklightthemes');
  const sounds = duskSounds(catalog);
  const running = !!body?.onoff;
  const pending = body && draft ? changes(body, draft) : {};
  const hasChanges = Object.keys(pending).length > 0;
  const shown = draft ?? body;

  const toggleRun = async () => {
    if (!body) return;
    setBusy('run');
    setMessage(null);
    const r = await command((api) => api.sunset(!body.onoff));
    setBusy(null);
    if (!r.ok) setMessage(r.message);
  };

  const apply = async () => {
    setBusy('apply');
    setMessage(null);
    const r = await command((api) => api.sunsetSettings(pending));
    setBusy(null);
    if (r.ok) setDraft(null);
    else setMessage(r.message);
  };

  const set = (patch: Partial<SunsetBody>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Screen>
      <Header
        title="Coucher de soleil"
        right={
          body ? (
            <Pressable onPress={() => setDraft(draft ? null : { ...body })} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
              <T size={15} weight="medium" color={draft ? colors.accent : colors.textSoft}>{draft ? 'Fermer' : 'Régler'}</T>
            </Pressable>
          ) : null
        }
      />
      {!link.canControl ? <Notice style={{ marginHorizontal: 16, marginBottom: 12 }}>{link.controlReason ?? ''}</Notice> : null}
      {!shown ? (
        <T color={colors.textMuted} style={{ padding: 24 }}>Le coucher de soleil n’a pas encore été relu sur le réveil.</T>
      ) : (
        <View style={{ alignItems: 'center', paddingHorizontal: 16, gap: 24, paddingTop: 12 }}>
          <View style={{ width: 278, height: 278, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={278} height={278} style={{ position: 'absolute' }}>
              <Defs>
                <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={running ? '#dd9231' : '#ffffff'} stopOpacity={running ? 0.42 : 0.07} />
                  <Stop offset="1" stopColor={running ? '#dd9231' : '#ffffff'} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={139} cy={139} r={139} fill="url(#halo)" />
            </Svg>
            <View style={{ width: 226, height: 226, borderRadius: 113, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Icon name="sunset" size={26} color="rgba(255,255,255,0.7)" strokeWidth={1.4} />
              <T size={54} weight="extralight" style={{ letterSpacing: -2, lineHeight: 62 }}>{`${shown.durat}:00`}</T>
              <T size={14} color={colors.textSoft}>minutes</T>
              <T size={12} color={colors.textMuted} style={{ marginTop: 4 }}>{`${themeName(themes, shown.ctype)} · ${soundName(sounds, shown.snddv, shown.sndch)}`}</T>
            </View>
          </View>

          {draft ? (
            <Card style={{ alignSelf: 'stretch', padding: 18, gap: 10 }}>
              <SliderRow label="Durée" unit=" min" value={draft.durat} {...BOUNDS.sunsetDuration} onChange={(durat) => set({ durat })} />
              <SliderRow label="Intensité lumineuse" value={draft.curve} {...BOUNDS.sunsetIntensity} onChange={(curve) => set({ curve })} />
              <T size={12.5} color={colors.textSoft} style={{ paddingTop: 6 }}>Choisissez un jeu de couleurs pour votre coucher de soleil.</T>
              {themes.map((t) => (
                <Option key={t.ctype} label={t.name} swatch={t.colors} checked={t.ctype === draft.ctype} onPress={() => set({ ctype: t.ctype })} />
              ))}
              <T size={12.5} weight="semibold" color="rgba(255,255,255,0.42)" style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.hairline, letterSpacing: 0.5, textTransform: 'uppercase' }}>Sons ambiants</T>
              {draft.snddv === 'fmr' ? <Option label={soundName(sounds, 'fmr', draft.sndch)} checked onPress={() => undefined} /> : null}
              {[NO_SOUND, ...sounds].map((s) => (
                <Option key={`${s.snddv}-${s.sndch}`} label={s.name} checked={sameSound(s, draft)} onPress={() => set({ snddv: s.snddv, sndch: s.sndch })} />
              ))}
              {draft.snddv !== 'off' ? <SliderRow label="Volume" value={Math.max(BOUNDS.volume.min, draft.sndlv)} {...BOUNDS.volume} onChange={(sndlv) => set({ sndlv })} /> : null}
              {running ? <T size={12} color={colors.textMuted}>Il est en cours : l’appliquer l’arrête un instant, puis le relance.</T> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Button label="Annuler" onPress={() => setDraft(null)} style={{ flex: 1 }} />
                <Button label="Appliquer" kind="primary" onPress={apply} loading={busy === 'apply'} disabled={!hasChanges || !link.canControl || busy !== null} style={{ flex: 1.4 }} />
              </View>
            </Card>
          ) : null}

          {message ? <Notice tone="error" style={{ alignSelf: 'stretch' }}>{message}</Notice> : null}
          <Button
            big
            label={running ? 'Arrêter' : 'Démarrer'}
            kind={running ? 'secondary' : 'primary'}
            onPress={toggleRun}
            loading={busy === 'run'}
            disabled={!link.canControl || !body || busy !== null || !!draft}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      )}
    </Screen>
  );
}

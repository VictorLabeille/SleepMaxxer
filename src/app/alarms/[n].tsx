/**
 * Modifier une alarme. Le seul endroit où l'app va au-delà de SleepMapper (cadrage §2.A) : durée
 * et intensité du lever, volume. S'il devient un formulaire, il aura échoué — d'où les listes
 * derrière des rangs, et une seule action d'enregistrement.
 *
 * Le profil est relu sur l'appareil à l'ouverture (`GET /v1/alarms/{n}`) : le miroir peut dater de
 * la veille. Après l'envoi, l'écran reprend le profil que le relais a relu — jamais la saisie.
 *
 * Le départ en douceur (`sndss`) n'est pas proposé : son effet physique n'est pas établi, et le
 * collecteur demande de ne pas le montrer tant qu'il ne l'est pas.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { addMinutes, alarmEdit, BOUNDS, DAY_NAMES, daysLabel, daysToMask, formFromProfile, isEmptyEdit, maskToDays, type AlarmForm } from '../../domain/alarms';
import { lightThemes, NO_SOUND, sameSound, soundName, wakeSounds } from '../../domain/catalog';
import { pad2 } from '../../domain/format';
import { command } from '../../state/commands';
import { useLink } from '../../state/hooks';
import { useApp } from '../../state/store';
import { Icon } from '../../ui/Icon';
import { Button, Card, Header, Loading, Notice, Row, Screen, SliderRow, T, Toggle } from '../../ui/kit';
import { Sheet, TimeSheet } from '../../ui/Sheet';
import { colors } from '../../ui/theme';

type Picker = 'time' | 'days' | 'theme' | 'sound' | null;

function CheckRow({ label, checked, onPress, swatch }: { label: string; checked: boolean; onPress: () => void; swatch?: [string, string] | null }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, minHeight: 48, opacity: pressed ? 0.7 : 1 })}>
      {swatch !== undefined ? (
        swatch ? <LinearGradient colors={swatch} style={{ width: 36, height: 36, borderRadius: 18 }} /> : <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)' }} />
      ) : null}
      <T size={15.5} style={{ flex: 1 }}>{label}</T>
      {checked ? <Icon name="check" size={22} color="#ffffff" strokeWidth={2} /> : null}
    </Pressable>
  );
}

export default function AlarmEditScreen() {
  const { n: param } = useLocalSearchParams<{ n: string }>();
  const n = Number(param);
  const catalog = useApp((s) => s.catalog);
  const snoozeOnDevice = useApp((s) => s.device?.ports.wualm?.body?.snztm ?? null);
  const link = useLink();

  const [original, setOriginal] = useState<AlarmForm | null>(null);
  const [form, setForm] = useState<AlarmForm | null>(null);
  const [snooze, setSnooze] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const r = await command((api) => api.alarm(n));
    if (r.ok && r.body.profile) {
      const f = formFromProfile(r.body.profile);
      setOriginal(f);
      setForm(f);
    } else {
      setLoadError(r.ok ? 'Le profil relu est illisible.' : r.message);
    }
  }, [n]);

  useEffect(() => {
    void load();
  }, [load]);

  const themes = lightThemes(catalog, 'lightthemes');
  const sounds = wakeSounds(catalog);
  const edit = original && form ? alarmEdit(original, form) : {};
  const snoozeValue = snooze ?? snoozeOnDevice;
  const snoozeChanged = snooze !== null && snooze !== snoozeOnDevice;
  const dirty = !isEmptyEdit(edit) || snoozeChanged;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    let failure: string | null = null;
    if (!isEmptyEdit(edit)) {
      const r = await command((api) => api.updateAlarm(n, edit));
      // Réussite ou échec, l'écran reprend ce que le réveil a relu.
      if (r.body?.profile) {
        const f = formFromProfile(r.body.profile);
        setOriginal(f);
        setForm(f);
      }
      if (!r.ok) failure = r.message;
    }
    if (!failure && snoozeChanged && snooze !== null) {
      const r = await command((api) => api.snooze(snooze));
      if (!r.ok) failure = r.message;
      else setSnooze(null);
    }
    setSaving(false);
    if (failure) setMessage(failure);
    else router.back();
  };

  const back = () => {
    if (!dirty) return router.back();
    Alert.alert('Abandonner les modifications ?', 'Rien n’a été envoyé au réveil.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Abandonner', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const remove = () =>
    Alert.alert('Supprimer cette alarme ?', 'Elle disparaît de la liste et ne peut plus sonner. Ses réglages restent dans le réveil.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          const r = await command((api) => api.deleteAlarm(n));
          setSaving(false);
          if (r.ok) router.back();
          else setMessage(r.message);
        },
      },
    ]);

  const set = (patch: Partial<AlarmForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const canSave = dirty && !saving && link.canControl;

  return (
    <Screen>
      <Header
        title="Modifier l'alarme"
        onBack={back}
        right={
          <Pressable onPress={save} disabled={!canSave} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
            <T size={15} weight="semibold" color={canSave ? colors.accent : colors.textFaint}>{saving ? 'Envoi…' : 'Enregistrer'}</T>
          </Pressable>
        }
      />
      {!link.canControl ? <Notice style={{ marginHorizontal: 16, marginBottom: 12 }}>{link.controlReason ?? ''}</Notice> : null}
      {loadError ? (
        <View style={{ marginHorizontal: 16, gap: 12 }}>
          <Notice tone="error">{`Le profil n’a pas pu être relu sur le réveil : ${loadError}`}</Notice>
          <Button label="Relire" icon="refresh" onPress={load} />
        </View>
      ) : !form ? (
        <Loading label="Lecture du profil sur le réveil…" />
      ) : (
        <>
          <Pressable onPress={() => setPicker('time')} style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 16 }}>
            <T size={56} weight="extralight" style={{ letterSpacing: -2, lineHeight: 64 }}>{`${pad2(form.hour)}:${pad2(form.minute)}`}</T>
            <T size={12} color="rgba(255,255,255,0.42)">Touchez l’heure pour la régler</T>
          </Pressable>

          <Card style={{ marginHorizontal: 16, marginBottom: 14, overflow: 'hidden' }}>
            <Row label="Répéter" value={daysLabel(form.days)} onPress={() => setPicker('days')} />
            <Row label="Thème du soleil" value={themes.find((t) => t.ctype === form.ctype)?.name ?? `Thème ${form.ctype + 1}`} onPress={() => setPicker('theme')} />
            <Row label="Son" value={soundName(sounds, form.snddv, form.sndch)} onPress={() => setPicker('sound')} last />
          </Card>

          <T size={11.5} weight="semibold" color={colors.accent} style={{ paddingHorizontal: 22, paddingBottom: 8, letterSpacing: 0.7, textTransform: 'uppercase' }}>Au-delà de SleepMapper</T>
          <Card style={{ marginHorizontal: 16, marginBottom: 14, padding: 18, gap: 14 }}>
            <SliderRow label="Durée du lever de soleil" unit=" min" value={form.durat} {...BOUNDS.riseDuration} onChange={(durat) => set({ durat })} />
            <SliderRow label="Intensité du lever" value={form.curve} {...BOUNDS.riseIntensity} onChange={(curve) => set({ curve })} />
            <SliderRow label="Volume" value={form.sndlv} {...BOUNDS.volume} disabled={form.snddv === 'off'} hint={form.snddv === 'off' ? 'aucun son choisi' : undefined} onChange={(sndlv) => set({ sndlv })} />
          </Card>

          <Card style={{ marginHorizontal: 16, marginBottom: 14, padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="bolt" size={17} color={colors.accent} />
              <T size={14.5} weight="semibold" style={{ flex: 1 }}>PowerWake</T>
              <Toggle label="PowerWake" value={form.powerwakeOn} onPress={() => set({ powerwakeOn: !form.powerwakeOn })} />
            </View>
            {form.powerwakeOn ? (
              <View style={{ marginTop: 10 }}>
                {(() => {
                  const at = addMinutes(form.hour, form.minute, form.powerwakeDelta);
                  return <T size={13.5} color={colors.textSoft} style={{ marginBottom: 4 }}>{`Sonne à ${pad2(at.hour)}:${pad2(at.minute)}`}</T>;
                })()}
                <SliderRow label="Après l’alarme" unit=" min" value={form.powerwakeDelta} {...BOUNDS.powerwakeDelta} onChange={(powerwakeDelta) => set({ powerwakeDelta })} />
              </View>
            ) : null}
            <T size={12} color="rgba(255,255,255,0.42)" style={{ marginTop: 10 }}>Sonnerie de secours, déclenchée après l’heure de l’alarme.</T>
          </Card>

          <Card style={{ marginHorizontal: 16, marginBottom: 16, padding: 18 }}>
            {snoozeValue !== null ? (
              <SliderRow label="Durée du rappel" unit=" min" value={snoozeValue} {...BOUNDS.snooze} onChange={setSnooze} />
            ) : (
              <T size={13} color={colors.textMuted}>Durée du rappel pas encore relue.</T>
            )}
            <T size={12} color={colors.textSoft} style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.hairline }}>
              Ce réglage vaut pour toutes les alarmes — le réveil n’en tient qu’un seul.
            </T>
          </Card>

          {message ? <Notice tone="error" style={{ marginHorizontal: 16, marginBottom: 14 }}>{message}</Notice> : null}
          <Button label="Supprimer cette alarme" kind="danger" onPress={remove} disabled={!link.canControl || saving} style={{ marginHorizontal: 16 }} />
        </>
      )}

      {form ? (
        <>
          <TimeSheet
            visible={picker === 'time'}
            title="Heure de l'alarme"
            hour={form.hour}
            minute={form.minute}
            onCancel={() => setPicker(null)}
            onConfirm={(hour, minute) => {
              set({ hour, minute });
              setPicker(null);
            }}
          />
          <Sheet visible={picker === 'days'} onClose={() => setPicker(null)} title="Répéter le" subtitle="Quels jours voulez-vous répéter votre alarme ? Aucun jour coché : elle sonne une seule fois.">
            {maskToDays(form.days).map((on, i) => (
              <CheckRow key={DAY_NAMES[i]} label={DAY_NAMES[i]} checked={on} onPress={() => {
                const days = maskToDays(form.days);
                days[i] = !days[i];
                set({ days: daysToMask(days) });
              }} />
            ))}
            <Button label="Terminé" kind="primary" onPress={() => setPicker(null)} style={{ marginTop: 10 }} />
          </Sheet>
          <Sheet visible={picker === 'theme'} onClose={() => setPicker(null)} title="Thème du soleil">
            {themes.map((t) => (
              <CheckRow key={t.ctype} label={t.name} swatch={t.colors} checked={t.ctype === form.ctype} onPress={() => { set({ ctype: t.ctype }); setPicker(null); }} />
            ))}
          </Sheet>
          <Sheet visible={picker === 'sound'} onClose={() => setPicker(null)} title="Choisissez un son">
            {form.snddv === 'fmr' ? <CheckRow label={soundName(sounds, 'fmr', form.sndch)} checked onPress={() => setPicker(null)} /> : null}
            {[...sounds, NO_SOUND].map((s) => (
              <CheckRow key={`${s.snddv}-${s.sndch}`} label={s.name} checked={sameSound(s, form)} onPress={() => { set({ snddv: s.snddv, sndch: s.sndch }); setPicker(null); }} />
            ))}
          </Sheet>
        </>
      ) : null}
    </Screen>
  );
}

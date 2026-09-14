/** Feuille montante, et la roue de sélection d'une heure — celle d'une alarme, du coucher, du lever. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pad2 } from '../domain/format';
import { Button, Notice, T } from './kit';
import { colors } from './theme';

export function Sheet({ visible, onClose, title, subtitle, children }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={{ backgroundColor: colors.sheet, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18 + insets.bottom, maxHeight: '85%' }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 12 }} />
          <T size={16} weight="semibold">{title}</T>
          {subtitle ? <T size={12.5} color={colors.textMuted} style={{ marginTop: 4 }}>{subtitle}</T> : null}
          <View style={{ marginTop: 12 }}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const ROW = 42;

function Wheel({ count, value, onChange, label }: { count: number; value: number; onChange: (v: number) => void; label: string }) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollTo({ y: value * ROW, animated: false }), 0);
    return () => clearTimeout(id);
    // Positionnement initial seulement : ensuite, c'est le doigt qui décide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const v = Math.min(count - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ROW)));
    onChange(v);
  };
  return (
    <View style={{ height: ROW * 5, width: 92 }} accessibilityLabel={label}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ROW * 2 }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
      >
        {Array.from({ length: count }, (_, i) => {
          const d = Math.abs(i - value);
          return (
            <Pressable
              key={i}
              style={{ height: ROW, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => {
                ref.current?.scrollTo({ y: i * ROW, animated: true });
                onChange(i);
              }}
            >
              <T size={d === 0 ? 31 : d === 1 ? 21 : 16} weight={d === 0 ? 'medium' : 'regular'} color={d === 0 ? colors.text : d === 1 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)'}>
                {pad2(i)}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function TimeSheet({ visible, title, hour, minute, error, busy, onCancel, onConfirm }: {
  visible: boolean;
  title: string;
  hour: number;
  minute: number;
  error?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (hour: number, minute: number) => void;
}) {
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);
  useEffect(() => {
    if (visible) {
      setH(hour);
      setM(minute);
    }
  }, [visible, hour, minute]);
  return (
    <Sheet visible={visible} onClose={onCancel} title={title}>
      <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 30, right: 30, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
        {visible ? <Wheel count={24} value={h} onChange={setH} label="Heures" /> : null}
        <T size={26} weight="light" color="rgba(255,255,255,0.45)">:</T>
        {visible ? <Wheel count={60} value={m} onChange={setM} label="Minutes" /> : null}
      </View>
      <T size={11.5} color={colors.textFaint} center style={{ marginVertical: 10 }}>Faites glisser une colonne, ou touchez une valeur.</T>
      {error ? <Notice tone="error" style={{ marginBottom: 12 }}>{error}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Annuler" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Valider" kind="primary" loading={busy} onPress={() => onConfirm(h, m)} style={{ flex: 1.4 }} />
      </View>
    </Sheet>
  );
}

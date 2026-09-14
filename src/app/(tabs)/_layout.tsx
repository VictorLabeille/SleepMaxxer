/**
 * Deux onglets, comme SleepMapper — Mon Appareil (piloter) et Mon Sommeil (consulter). Les
 * onglets « Conseils » et « Plus » sont le bloat qu'on retire (cadrage §2).
 */
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../../ui/Icon';
import { T } from '../../ui/kit';
import { colors } from '../../ui/theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Mon Appareil', icon: 'device' },
  sleep: { label: 'Mon Sommeil', icon: 'bed' },
};

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', paddingTop: 8, paddingBottom: 8 + insets.bottom, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', backgroundColor: colors.bgBottom }}>
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const color = focused ? colors.accent : 'rgba(255,255,255,0.44)';
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              if (!focused) navigation.navigate(route.name, route.params);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 50 }}
          >
            <Icon name={tab.icon} size={23} color={color} strokeWidth={1.5} />
            <T size={11} weight={focused ? 'semibold' : 'medium'} color={color}>{tab.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Mon Appareil' }} />
      <Tabs.Screen name="sleep" options={{ title: 'Mon Sommeil' }} />
    </Tabs>
  );
}

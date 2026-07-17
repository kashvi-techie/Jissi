import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';

/**
 * Bottom navigation = a custom floating pill (History · orb · Profile). The route
 * structure is unchanged; only the tab bar's presentation is custom.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar state={props.state} navigation={props.navigation} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: 'Chat' }} />
      <Tabs.Screen name="life-graph" options={{ title: 'Life Graph' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

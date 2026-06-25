import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Home, Clock, User } from 'lucide-react-native';

// TEMP FALLBACK COLORS (Phase: routing).
// colors.ts is not restored yet, so the original `Colors.tab.*` tokens are
// inlined below. Swap these back to `Colors.tab.*` once constants/colors.ts exists.
const FALLBACK = {
  tabActive: '#A78BFA', // was Colors.tab.active
  tabInactive: '#64748B', // was Colors.tab.inactive
  tabBackground: '#0B0B1A', // was Colors.tab.background
  tabBorder: 'rgba(255,255,255,0.08)', // was Colors.tab.border
};

function TabBarIcon({
  icon: Icon,
  color,
  focused,
}: {
  icon: typeof Home;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.tabIconWrapper, focused && styles.tabIconActive]}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: FALLBACK.tabActive,
        tabBarInactiveTintColor: FALLBACK.tabInactive,
        tabBarStyle: {
          backgroundColor: FALLBACK.tabBackground,
          borderTopWidth: 1,
          borderTopColor: FALLBACK.tabBorder,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter_600SemiBold',
          letterSpacing: 0.3,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={Home} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={Clock} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={User} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconWrapper: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabIconActive: {
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
});

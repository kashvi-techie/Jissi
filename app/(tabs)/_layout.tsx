import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Home, Clock, User } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, Radius } from '@/constants/theme';

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
        tabBarActiveTintColor: Colors.tab.active,
        tabBarInactiveTintColor: Colors.tab.inactive,
        tabBarStyle: {
          backgroundColor: Colors.tab.background,
          borderTopWidth: 1,
          borderTopColor: Colors.tab.border,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? Spacing.xxl : Spacing.sm,
          paddingTop: Spacing.sm,
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
    borderRadius: Radius.sm,
  },
  tabIconActive: {
    backgroundColor: Colors.tab.activeChip,
  },
});

import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors, rounded, typography, spacing } from '../../../src/design/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.canvas,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          borderRadius: rounded.none,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: {
          ...typography.captionCap,
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="bank/index"
        options={{
          title: 'BANK',
          tabBarLabel: 'BANK',
          tabBarIcon: ({ color }) => (
            <View style={[styles.tabIndicator, { backgroundColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats/index"
        options={{
          title: 'CHATS',
          tabBarLabel: 'CHATS',
          tabBarIcon: ({ color }) => (
            <View style={[styles.tabIndicator, { backgroundColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects/index"
        options={{
          title: 'PROJECTS',
          tabBarLabel: 'PROJECTS',
          tabBarIcon: ({ color }) => (
            <View style={[styles.tabIndicator, { backgroundColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'SETTINGS',
          tabBarLabel: 'SETTINGS',
          tabBarIcon: ({ color }) => (
            <View style={[styles.tabIndicator, { backgroundColor: color }]} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIndicator: {
    width: 14,
    height: 3,
    borderRadius: rounded.none,
    marginBottom: 4,
  },
});

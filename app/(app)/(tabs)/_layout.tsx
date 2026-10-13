import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../../src/design/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function QuickMenuBar({ state, descriptors, navigation, insets }: any) {
  const { colors, isDark } = useTheme();
  const bottomInset = Math.max(insets?.bottom ?? 0, 8);

  const activeColor = isDark ? '#ffffff' : '#000000';
  const inactiveColor = isDark ? '#777777' : '#888888';
  const borderColor = isDark ? '#262626' : '#e5e5e5';

  return (
    <View
      style={[
        styles.barContainer,
        {
          backgroundColor: isDark ? '#000000' : '#ffffff',
          borderTopColor: borderColor,
          height: 52 + bottomInset,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
          >
            {isFocused ? (
              <View style={[styles.activeIndicator, { backgroundColor: activeColor }]} />
            ) : null}
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isFocused ? activeColor : inactiveColor,
                  fontWeight: isFocused ? '800' : '600',
                },
              ]}
            >
              {typeof label === 'string' ? label : route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <QuickMenuBar {...props} insets={insets} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="bank/index"
        options={{
          title: 'DUMP',
          tabBarLabel: 'DUMP',
        }}
      />
      <Tabs.Screen
        name="chats/index"
        options={{
          title: 'CHATS',
          tabBarLabel: 'CHATS',
        }}
      />
      <Tabs.Screen
        name="projects/index"
        options={{
          title: 'IDEAS',
          tabBarLabel: 'IDEAS',
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'SETTINGS',
          tabBarLabel: 'SETTINGS',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 2,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    includeFontPadding: false,
  },
});

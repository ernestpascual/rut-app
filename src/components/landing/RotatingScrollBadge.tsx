import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { colors, typography } from '../../design/tokens';

export const RotatingScrollBadge: React.FC = () => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    ).start();
  }, [rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.circle, { transform: [{ rotate: spin }] }]}>
        <View style={styles.textTrack}>
          <Text style={styles.badgeText}>SCROLL DOWN · EXPLORE THE BANK · </Text>
        </View>
      </Animated.View>
      <View style={styles.centerDot}>
        <Text style={styles.arrowIcon}>↓</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 104,
    height: 104,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  textTrack: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    ...typography.captionCap,
    fontSize: 7.5,
    letterSpacing: 2,
    color: colors.ink,
    textAlign: 'center',
    fontWeight: '600',
  },
  centerDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '400',
  },
});

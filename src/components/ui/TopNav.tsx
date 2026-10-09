import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, rounded, typography, spacing } from '../../design/tokens';

interface TopNavProps {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export const TopNav: React.FC<TopNavProps> = ({
  title = 'rut',
  subtitle,
  rightAction,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.wordmark}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 64,
    backgroundColor: colors.canvas, // Pure white
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline, // 1px hairline border
    borderRadius: rounded.none,
  },
  titleContainer: {
    flexDirection: 'column',
  },
  wordmark: {
    ...typography.displayMd, // 24px mono-grotesque
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.48,
  },
  subtitle: {
    ...typography.captionSm,
    color: colors.inkSoft,
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

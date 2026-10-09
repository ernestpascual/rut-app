import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, rounded, typography, spacing } from '../../design/tokens';

interface AnnouncementBarProps {
  pillText?: string;
  message: string;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  pillText = 'AI INDEXED',
  message,
}) => {
  return (
    <View style={styles.bar}>
      {pillText ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{pillText}</Text>
        </View>
      ) : null}
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: 32,
    backgroundColor: colors.surfaceOverlay, // #000000
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  pill: {
    backgroundColor: colors.canvas, // Pure white #ffffff
    borderRadius: rounded.pill, // 24px - the single rounded element in the system
    height: 20,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  pillText: {
    ...typography.captionCap,
    color: colors.ink,
    fontSize: 10,
    lineHeight: 14,
  },
  message: {
    ...typography.captionMd,
    color: colors.onInk, // White on black
  },
});

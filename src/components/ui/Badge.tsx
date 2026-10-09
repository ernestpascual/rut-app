import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, rounded, typography, spacing } from '../../design/tokens';

interface BadgeProps {
  label: string;
  variant?: 'outline' | 'grade' | 'inverse';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'grade',
  style,
}) => {
  return (
    <View
      style={[
        styles.badge,
        variant === 'outline' && styles.outline,
        variant === 'grade' && styles.grade,
        variant === 'inverse' && styles.inverse,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === 'inverse' ? styles.textInverse : styles.textDark,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: rounded.none, // Strictly 0px
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    alignSelf: 'flex-start',
    marginRight: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  outline: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  grade: {
    backgroundColor: colors.surfaceGrade, // #f4f4f4
    borderWidth: 1,
    borderColor: colors.hairlineSoft, // #cccccc
  },
  inverse: {
    backgroundColor: colors.ink, // #000000
  },
  text: {
    ...typography.captionCap,
    fontSize: 10,
    lineHeight: 14,
  },
  textDark: {
    color: colors.ink,
  },
  textInverse: {
    color: colors.onInk,
  },
});

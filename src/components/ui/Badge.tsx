import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { rounded, typography, spacing } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';

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
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.badge,
        variant === 'outline' && {
          backgroundColor: colors.canvas,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        variant === 'grade' && {
          backgroundColor: colors.surfaceGrade,
          borderWidth: 1,
          borderColor: colors.hairlineSoft,
        },
        variant === 'inverse' && {
          backgroundColor: colors.ink,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: variant === 'inverse' ? colors.onInk : colors.ink },
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
  text: {
    ...typography.captionCap,
    fontSize: 10,
    lineHeight: 14,
  },
});

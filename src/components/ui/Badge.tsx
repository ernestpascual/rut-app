import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { rounded, typography, spacing } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';
import { getPlatformBadgeStyle } from '../../design/platformColors';
import { SourcePlatform } from '../../types';

export interface BadgeProps {
  label: string;
  variant?: 'outline' | 'grade' | 'inverse';
  platform?: string | SourcePlatform | null;
  textColor?: string;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'grade',
  platform,
  textColor,
  style,
}) => {
  const { colors } = useTheme();
  const platformStyle = getPlatformBadgeStyle(platform || label);

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
        platformStyle && {
          backgroundColor: platformStyle.backgroundColor,
          borderWidth: 1,
          borderColor: platformStyle.borderColor,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: variant === 'inverse' ? colors.onInk : colors.ink },
          platformStyle && { color: textColor || platformStyle.textColor },
          textColor && !platformStyle ? { color: textColor } : null,
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

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { rounded, typography, spacing } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';

interface AnnouncementBarProps {
  pillText?: string;
  message: string;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  pillText = 'AI INDEXED',
  message,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: isDark ? colors.surfaceGrade : colors.surfaceOverlay,
          borderBottomWidth: isDark ? 1 : 0,
          borderBottomColor: colors.hairline,
        },
      ]}
    >
      {pillText ? (
        <View
          style={[
            styles.pill,
            { backgroundColor: isDark ? colors.ink : colors.canvas },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: isDark ? colors.onInk : colors.ink },
            ]}
          >
            {pillText}
          </Text>
        </View>
      ) : null}
      <Text
        style={[
          styles.message,
          { color: isDark ? colors.ink : colors.onInk },
        ]}
        numberOfLines={1}
      >
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  pill: {
    borderRadius: rounded.pill, // 24px - the single rounded element in the system
    height: 20,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  pillText: {
    ...typography.captionCap,
    fontSize: 10,
    lineHeight: 14,
  },
  message: {
    ...typography.captionMd,
  },
});

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { rounded, typography, spacing, ThemeColors } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';

interface TopNavProps {
  title?: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  onBack?: () => void;
  backTitle?: string;
  showThemeToggle?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  title = 'rut',
  subtitle,
  leftAction,
  rightAction,
  onBack,
  backTitle,
  showThemeToggle,
}) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.header}>
      <View style={styles.leftGroup}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={backTitle ? `Back to ${backTitle}` : 'Go back'}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backText}>
              {backTitle ? `← ${backTitle}` : '← BACK'}
            </Text>
          </Pressable>
        ) : leftAction}

        <View style={styles.titleContainer}>
          <Text style={styles.wordmark}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rightAction}>
        {rightAction}
        {showThemeToggle && !rightAction ? (
          <Pressable
            onPress={toggleTheme}
            style={({ pressed }) => [
              styles.themeToggleBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            <Text style={styles.themeToggleText}>
              {isDark ? '☀ LIGHT' : '☾ DARK'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.base,
      backgroundColor: colors.canvas,
      borderBottomWidth: 0,
      borderRadius: rounded.none,
    },
    leftGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: spacing.sm,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      paddingVertical: spacing.xxs,
      paddingHorizontal: spacing.sm,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.surfaceGrade,
      borderRadius: rounded.none,
      minHeight: 32,
    },
    backText: {
      ...typography.captionCap,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.ink,
    },
    titleContainer: {
      flexDirection: 'column',
      flex: 1,
    },
    wordmark: {
      ...typography.displayMd,
      fontWeight: '700',
      letterSpacing: -0.48,
      color: colors.ink,
    },
    subtitle: {
      ...typography.captionSm,
      color: colors.inkSoft,
    },
    rightAction: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    themeToggleBtn: {
      paddingVertical: spacing.xxs,
      paddingHorizontal: spacing.xs,
    },
    themeToggleText: {
      ...typography.captionCap,
      fontSize: 11,
      fontWeight: '700',
      color: colors.inkSoft,
    },
  });


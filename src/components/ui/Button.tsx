import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Pressable
} from 'react-native';
import { rounded, typography, spacing } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: colors.ink, borderWidth: 0 },
        variant === 'secondary' && {
          backgroundColor: colors.canvas,
          borderWidth: 1,
          borderColor: colors.ink,
        },
        variant === 'text' && styles.textButton,
        pressed && variant === 'primary' && { backgroundColor: colors.inkSoft },
        pressed && variant === 'secondary' && { backgroundColor: colors.surfaceGrade },
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.onInk : colors.ink}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.baseText,
            variant === 'primary' && { color: colors.onInk },
            variant === 'secondary' && { color: colors.ink },
            variant === 'text' && [styles.textButtonText, { color: colors.ink }],
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 46,
    borderRadius: rounded.none, // 0px corners strictly per DESIGN.md
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textButton: {
    backgroundColor: 'transparent',
    height: 'auto',
    paddingHorizontal: 0,
    paddingVertical: spacing.xs,
  },
  disabled: {
    opacity: 0.4,
  },
  baseText: {
    ...typography.bodyMd,
  },
  textButtonText: {
    textDecorationLine: 'underline',
  },
});

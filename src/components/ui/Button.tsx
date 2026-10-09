import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Pressable
} from 'react-native';
import { colors, rounded, typography, spacing } from '../../design/tokens';

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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'text' && styles.textButton,
        pressed && variant === 'primary' && styles.primaryActive,
        pressed && variant === 'secondary' && styles.secondaryActive,
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
            variant === 'primary' && styles.primaryText,
            variant === 'secondary' && styles.secondaryText,
            variant === 'text' && styles.textButtonText,
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
  primary: {
    backgroundColor: colors.ink, // Pure black #000000
    borderWidth: 0,
  },
  primaryActive: {
    backgroundColor: colors.inkSoft, // #767676 on press
  },
  secondary: {
    backgroundColor: colors.canvas, // Pure white #ffffff
    borderWidth: 1,
    borderColor: colors.ink,
  },
  secondaryActive: {
    backgroundColor: colors.surfaceGrade,
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
  primaryText: {
    color: colors.onInk, // Pure white
  },
  secondaryText: {
    color: colors.ink, // Pure black
  },
  textButtonText: {
    color: colors.ink,
    textDecorationLine: 'underline',
  },
});

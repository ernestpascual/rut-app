import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps
} from 'react-native';
import { colors, rounded, typography, spacing } from '../../design/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  ...rest
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : null,
          style,
        ]}
        placeholderTextColor={colors.inkSoft}
        selectionColor={colors.ink}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  label: {
    ...typography.captionCap, // Uppercase 12px
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  input: {
    height: 46,
    backgroundColor: colors.canvas, // Pure white #ffffff
    borderColor: colors.ink, // Pure black #000000
    borderWidth: 1,
    borderRadius: rounded.none, // 0px corners strictly per DESIGN.md
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    ...typography.inputMd,
    color: colors.ink,
  },
  inputError: {
    borderColor: colors.statusErrorBorder, // #db1215 validation escape hatch
    color: colors.statusErrorText,
  },
  errorText: {
    ...typography.captionSm,
    color: colors.statusErrorText, // #db1215
    marginTop: spacing.xxs,
  },
});

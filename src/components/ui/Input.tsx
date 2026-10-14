import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps
} from 'react-native';
import { rounded, typography, spacing } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';

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
  const { colors } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, { color: colors.ink }]}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          rest.multiline ? { height: undefined, minHeight: 44 } : null,
          {
            backgroundColor: colors.canvas,
            borderColor: colors.ink,
            color: colors.ink,
          },
          error ? { borderColor: colors.statusErrorBorder, color: colors.statusErrorText } : null,
          style,
        ]}
        placeholderTextColor={colors.inkSoft}
        selectionColor={colors.ink}
        {...rest}
      />
      {error ? (
        <Text style={[styles.errorText, { color: colors.statusErrorText }]}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  label: {
    ...typography.captionCap, // Uppercase 12px
    marginBottom: spacing.xxs,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: rounded.none, // 0px corners strictly per DESIGN.md
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    ...typography.inputMd,
  },
  errorText: {
    ...typography.captionSm,
    marginTop: spacing.xxs,
  },
});

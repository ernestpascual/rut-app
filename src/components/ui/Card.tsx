import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, StyleProp } from 'react-native';
import { rounded, spacing } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  bordered?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  bordered = true,
}) => {
  const { colors } = useTheme();

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.canvas },
          bordered && { borderWidth: 1, borderColor: colors.hairline },
          pressed && { backgroundColor: colors.surfaceGrade },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.canvas },
        bordered && { borderWidth: 1, borderColor: colors.hairline },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: rounded.none, // 0px corners
    padding: spacing.base,
    // 0px elevation / shadow flat design per DESIGN.md
  },
});

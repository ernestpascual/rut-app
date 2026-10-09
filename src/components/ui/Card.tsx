import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, StyleProp } from 'react-native';
import { colors, rounded, spacing } from '../../design/tokens';

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
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          bordered && styles.bordered,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, bordered && styles.bordered, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.canvas, // Pure white
    borderRadius: rounded.none, // 0px corners
    padding: spacing.base,
    // 0px elevation / shadow flat design per DESIGN.md
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.hairline, // 1px black hairline
  },
  pressed: {
    backgroundColor: colors.surfaceGrade, // #f4f4f4
  },
});

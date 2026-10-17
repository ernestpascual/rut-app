import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '../src/design/ThemeContext';
import { typography, spacing, ThemeColors } from '../src/design/tokens';
import { Button } from '../src/components/ui/Button';

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.subtitle}>PAGE NOT FOUND</Text>
        <Text style={styles.message}>
          The page you are looking for does not exist in this inspiration bank.
        </Text>
        <Button
          title="← GO TO INSPIRATION BANK"
          onPress={() => {
            router.replace('/(app)/(tabs)/bank');
          }}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    </>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.canvas,
    },
    title: {
      ...typography.displayXl,
      color: colors.ink,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.captionCap,
      color: colors.inkSoft,
      marginBottom: spacing.base,
    },
    message: {
      ...typography.bodyMd,
      textAlign: 'center',
      color: colors.inkSoft,
      maxWidth: 360,
    },
  });

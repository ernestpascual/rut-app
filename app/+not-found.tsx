import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { colors, typography, spacing } from '../src/design/tokens';
import { Button } from '../src/components/ui/Button';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.subtitle}>PAGE NOT FOUND</Text>
        <Text style={styles.message}>
          The page you are looking for does not exist in this inspiration bank.
        </Text>
        <Link href="/" asChild>
          <Button title="RETURN HOME" onPress={() => {}} style={{ marginTop: spacing.lg }} />
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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

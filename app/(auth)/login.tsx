import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/features/auth/AuthContext';
import { useTheme } from '../../src/design/ThemeContext';
import { TopNav } from '../../src/components/ui/TopNav';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { rounded, typography, spacing, ThemeColors } from '../../src/design/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInAsDummy, stagedShare, authError, clearAuthError } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSignIn = async () => {
    clearAuthError();
    setValidationError(null);

    if (!email.trim() || !password) {
      setValidationError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      if (stagedShare) {
        router.replace('/share-target');
      } else {
        router.replace('/(app)/(tabs)/bank');
      }
    } catch (e) {
      // Handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleDummySignIn = async () => {
    clearAuthError();
    setValidationError(null);
    setLoading(true);
    try {
      await signInAsDummy();
      if (stagedShare) {
        router.replace('/share-target');
      } else {
        router.replace('/(app)/(tabs)/bank');
      }
    } catch (e) {
      // Handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav title="rut" subtitle="Login" showThemeToggle />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Login</Text>
            <Text style={styles.heroSubhead}>
              Access your saved links, trains of thought, and indexed ideas.
            </Text>
          </View>

          {stagedShare ? (
            <Card style={styles.stagedBanner}>
              <Text style={styles.stagedTitle}>PENDING SHARE WAITING</Text>
              <Text style={styles.stagedText}>
                You have a staged link/note waiting to be saved to your bank once you log in.
              </Text>
            </Card>
          ) : null}

          {authError || validationError ? (
            <Card style={styles.errorCard}>
              <Text style={styles.errorText}>{authError || validationError}</Text>
            </Card>
          ) : null}

          <Input
            label="EMAIL ADDRESS"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (validationError) setValidationError(null);
            }}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="PASSWORD"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (validationError) setValidationError(null);
            }}
            placeholder="••••••••"
            secureTextEntry
          />

          <View style={styles.forgotRow}>
            <Button
              title="Forgot password?"
              variant="text"
              onPress={() => router.push('/(auth)/forgot-password')}
            />
          </View>

          <Button
            title={loading ? 'LOGGING IN...' : 'LOG IN'}
            onPress={handleSignIn}
            loading={loading}
            style={{ marginTop: spacing.base }}
          />

          <Button
            title="⚡ ENTER WITH DEMO ACCOUNT (TEST)"
            variant="secondary"
            onPress={handleDummySignIn}
            disabled={loading}
            style={{ marginTop: spacing.xs }}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Don&apos;t have an account? </Text>
            <Button
              title="Create Account"
              variant="text"
              onPress={() => router.push('/(auth)/sign-up')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.base,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing.xl,
  },
  heroSection: {
    marginBottom: spacing.xl,
  },
  heroTitle: {
    ...typography.displayXl,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  heroSubhead: {
    ...typography.bodyMd,
    color: colors.inkSoft,
  },
  stagedBanner: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.base,
  },
  stagedTitle: {
    ...typography.captionCap,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  stagedText: {
    ...typography.captionSm,
    color: colors.inkSoft,
  },
  errorCard: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.statusErrorBorder,
    marginBottom: spacing.base,
  },
  errorText: {
    ...typography.captionSm,
    color: colors.statusErrorText,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.base,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  switchText: {
    ...typography.bodyMd,
    color: colors.inkSoft,
  },
});

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

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, stagedShare, authError, clearAuthError } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSignUp = async () => {
    clearAuthError();
    setValidationError(null);

    if (!email.trim() || !password) {
      setValidationError('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
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
      <TopNav
        title="rut"
        subtitle="Sign Up"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(auth)/login');
          }
        }}
        backTitle="LOGIN"
        showThemeToggle
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSubhead}>
              Your material is private and searchable only by you.
            </Text>
          </View>

          {stagedShare ? (
            <Card style={styles.stagedBanner}>
              <Text style={styles.stagedTitle}>PENDING SHARE READY</Text>
              <Text style={styles.stagedText}>
                Your shared link will be indexed into your bank immediately upon registration.
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
            placeholder="Minimum 6 characters"
            secureTextEntry
          />

          <Input
            label="CONFIRM PASSWORD"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (validationError) setValidationError(null);
            }}
            placeholder="Repeat password"
            secureTextEntry
          />

          <Button
            title={loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            onPress={handleSignUp}
            loading={loading}
            style={{ marginTop: spacing.base }}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <Button
              title="Log In"
              variant="text"
              onPress={() => router.push('/(auth)/login')}
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

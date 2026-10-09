import React, { useState } from 'react';
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
import { AnnouncementBar } from '../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../src/components/ui/TopNav';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { colors, typography, spacing } from '../../src/design/tokens';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { sendReset, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleReset = async () => {
    clearAuthError();
    setValidationError(null);

    if (!email.trim()) {
      setValidationError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await sendReset(email);
      setSubmitted(true);
    } catch (e) {
      // Handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar pillText="RECOVERY" message="Reset your account password" />
      <TopNav title="rut" subtitle="Reset Password" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Forgot Password</Text>
            <Text style={styles.heroSubhead}>
              Enter your email address to receive password reset instructions.
            </Text>
          </View>

          {submitted ? (
            <Card style={styles.successCard}>
              <Text style={styles.successTitle}>RESET EMAIL SENT</Text>
              <Text style={styles.successBody}>
                If an account exists for {email}, a reset link has been dispatched. Please check your inbox.
              </Text>
              <Button
                title="BACK TO LOGIN"
                onPress={() => router.replace('/(auth)/login')}
                style={{ marginTop: spacing.base }}
              />
            </Card>
          ) : (
            <>
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
              />

              <Button
                title={loading ? 'SENDING LINK...' : 'SEND RESET LINK'}
                onPress={handleReset}
                loading={loading}
                style={{ marginTop: spacing.base }}
              />

              <View style={styles.switchRow}>
                <Button
                  title="← Return to Login"
                  variant="text"
                  onPress={() => router.push('/(auth)/login')}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  successCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  successTitle: {
    ...typography.captionCap,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  successBody: {
    ...typography.bodyMd,
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
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});

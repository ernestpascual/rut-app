import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/features/auth/AuthContext';
import { colors, rounded, spacing, typography, componentStyles } from '../src/design/tokens';
import { GradientWaveCanvas } from '../src/components/landing/GradientWaveCanvas';

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { height: windowHeight } = useWindowDimensions();

  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleQuickSignUp = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError('Please provide a valid email format.');
      return;
    }
    setEmailError(null);
    router.push('/(auth)/sign-up');
  };

  const handleEnterApp = () => {
    if (user) {
      router.push('/(app)/(tabs)/bank');
    } else {
      router.push('/(auth)/login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* PERSISTENT TOP NAVIGATION */}
      <View style={styles.topNav}>
        <View style={styles.navInner}>
          <TouchableOpacity
            onPress={() => router.push('/')}
            activeOpacity={0.7}
            style={styles.logoContainer}
          >
            <Text style={styles.logoWordmark}>rut</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEnterApp}
            activeOpacity={0.85}
            style={styles.navActionButton}
          >
            <Text style={styles.navActionButtonText}>
              {user ? 'ENTER BANK' : 'LOGIN'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =========================================================================
            SECTION 1: HERO (Full-Screen Liquid Blob Screen Animation)
            ========================================================================= */}
        <View style={[styles.heroSection, { minHeight: windowHeight }]}>
          {/* Full-screen gradient wave animation canvas with DESIGN.md shading */}
          <GradientWaveCanvas />

          <View style={styles.heroContent}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>GEMINI 3.5+ FLASH</Text>
              </View>
              <Text style={styles.heroBadgeCaption}>IOS · ANDROID · WEB PWA</Text>
            </View>

            {/* Display XL with -0.48px tracking from DESIGN.md */}
            <Text style={styles.heroTitle}>
              PRIVATE INSPIRATION BANK.{'\n'}AI-INDEXED IN SILENCE.
            </Text>

            <Text style={styles.heroSubhead}>
              Save links, snippets, raw thoughts, and social posts. Gemini Flash enriches your material
              with automated summaries, concept tags, and 768-dim vector embeddings.
            </Text>

            <View style={styles.heroCtaRow}>
              <TouchableOpacity
                onPress={() => router.push(user ? '/(app)/(tabs)/bank' : '/(auth)/sign-up')}
                activeOpacity={0.85}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {user ? 'OPEN YOUR BANK' : 'START YOUR BANK'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/(auth)/login')}
                activeOpacity={0.85}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>EXPLORE ARCHIVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* =========================================================================
            SECTION 2: THE THREE PILLARS (Minimal & Focused)
            ========================================================================= */}
        <View style={styles.pillarsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionCap}>01 / CAPABILITIES</Text>
            <View style={styles.hairlineSpacer} />
          </View>

          <Text style={styles.whisperQuote}>
            “Scattered creative sparks preserved in radical editorial stillness.”
          </Text>

          <View style={styles.pillarsGrid}>
            <View style={styles.pillarCol}>
              <Text style={styles.pillarNumber}>01</Text>
              <Text style={styles.pillarTitle}>UNIVERSAL CAPTURE</Text>
              <Text style={styles.pillarBody}>
                Native OS Share Target for iOS, Android, and PWA. Save social media posts, URLs,
                and raw thoughts with zero sorting friction.
              </Text>
            </View>

            <View style={styles.pillarCol}>
              <Text style={styles.pillarNumber}>02</Text>
              <Text style={styles.pillarTitle}>SEMANTIC MEMORY</Text>
              <Text style={styles.pillarBody}>
                Gemini Flash creates concise summaries, concept tags, and 768-dim vector embeddings.
                Search by abstract aesthetic, feeling, or intent.
              </Text>
            </View>

            <View style={styles.pillarCol}>
              <Text style={styles.pillarNumber}>03</Text>
              <Text style={styles.pillarTitle}>THOUGHT TRAINS</Text>
              <Text style={styles.pillarBody}>
                Isolated conversational workspaces. Brainstorm and explore hypotheses with AI
                grounded in your own canon, citing exact card IDs.
              </Text>
            </View>
          </View>
        </View>

        {/* =========================================================================
            SECTION 3: THE ENGINE & ACCESS (Minimal Callout)
            ========================================================================= */}
        <View style={styles.accessSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionCap}>02 / ACCESS</Text>
            <View style={styles.hairlineSpacer} />
          </View>

          <View style={styles.accessCard}>
            <Text style={styles.accessTitle}>BUILD YOUR PRIVATE ARCHIVE</Text>
            <Text style={styles.accessSubtitle}>
              User-isolated Firestore security. No social feeds. Real-time cost telemetry in integer micros.
            </Text>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  value={emailInput}
                  onChangeText={(text) => {
                    setEmailInput(text);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="ENTER YOUR EMAIL"
                  placeholderTextColor={colors.inkSoft}
                  style={[
                    styles.editorialInput,
                    emailError ? styles.editorialInputError : null,
                  ]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {emailError ? (
                  <Text style={styles.validationErrorText}>{emailError}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={handleQuickSignUp}
                activeOpacity={0.85}
                style={styles.submitButton}
              >
                <Text style={styles.submitButtonText}>CREATE ACCOUNT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* =========================================================================
            SECTION 4: FOOTER SECTION (Ultra-Minimal)
            ========================================================================= */}
        <View style={styles.footerSection}>
          <View style={styles.footerDivider} />

          <View style={styles.footerRow}>
            <View style={styles.footerBrand}>
              <Text style={styles.footerLogo}>rut</Text>
              <Text style={styles.footerTagline}>Private AI-Indexed Inspiration Bank</Text>
            </View>

            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.footerLinkText}>LOGIN</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')} style={{ marginLeft: 24 }}>
                <Text style={styles.footerLinkText}>SIGN UP</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={{ marginLeft: 24 }}>
                <Text style={styles.footerLinkText}>TERMS</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerBottom}>
            <Text style={styles.copyrightText}>
              © 2026 rut. All rights reserved.
            </Text>
            <Text style={styles.copyrightText}>
              Pure monochrome editorial specification.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas, // Pure #ffffff
  },
  scrollContent: {
    flexGrow: 1,
  },


  // Top Nav
  topNav: {
    height: 64,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    zIndex: 20,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
  },
  navInner: {
    maxWidth: 1078,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWordmark: {
    ...typography.displayMd,
    fontSize: 28,
    fontWeight: '700',
    color: colors.onInk,
    letterSpacing: -1,
  },
  navActionButton: {
    backgroundColor: colors.onInk,
    height: 38,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rounded.none,
  },
  navActionButtonText: {
    ...typography.captionCap,
    fontSize: 11,
    color: colors.ink,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // SECTION 1: HERO
  heroSection: {
    width: '100%',
    position: 'relative',
    backgroundColor: colors.ink, // Pure #000000
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroContent: {
    maxWidth: 1078,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing['4xl'],
    position: 'relative',
    zIndex: 2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  heroBadge: {
    backgroundColor: colors.statusError, // #db1215 accent
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: rounded.none,
    marginRight: spacing.sm,
  },
  heroBadgeText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
    color: colors.onInk,
    letterSpacing: 1,
  },
  heroBadgeCaption: {
    ...typography.captionCap,
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 1,
  },
  heroTitle: {
    ...typography.displayXl,
    fontSize: Platform.OS === 'web' ? 52 : 36,
    lineHeight: Platform.OS === 'web' ? 58 : 44,
    color: colors.onInk, // Pure #ffffff
    fontWeight: '400',
    letterSpacing: -0.48, // EXACT negative tracking from DESIGN.md
    marginBottom: spacing.base,
    maxWidth: 880,
  },
  heroSubhead: {
    ...typography.bodyLg,
    fontSize: 17,
    lineHeight: 26,
    color: 'rgba(255, 255, 255, 0.88)',
    maxWidth: 680,
    marginBottom: spacing.xl,
  },
  heroCtaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.statusError, // #db1215 accent
    height: 46,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rounded.none,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  primaryButtonText: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: colors.onInk,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    height: 46,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rounded.none,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    marginBottom: spacing.xs,
  },
  secondaryButtonText: {
    ...typography.bodyMd,
    fontWeight: '400',
    color: colors.onInk,
  },

  // SECTION 2: THE THREE PILLARS
  pillarsSection: {
    maxWidth: 1078,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing['4xl'],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  sectionCap: {
    ...typography.captionCap,
    fontSize: 12,
    color: colors.ink,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  hairlineSpacer: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairline,
    marginLeft: spacing.base,
  },
  whisperQuote: {
    fontSize: Platform.OS === 'web' ? 34 : 26,
    lineHeight: Platform.OS === 'web' ? 42 : 34,
    fontWeight: '300', // Whisper weight per editorial style
    color: colors.ink,
    marginBottom: spacing['3xl'],
    maxWidth: 820,
  },
  pillarsGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.hairlineGrade,
    paddingTop: spacing.xl,
  },
  pillarCol: {
    flex: 1,
    marginRight: Platform.OS === 'web' ? spacing.xl : 0,
    marginBottom: spacing.xl,
  },
  pillarNumber: {
    ...typography.captionCap,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  pillarTitle: {
    ...typography.bodyLg,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  pillarBody: {
    ...typography.bodyMd,
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkSoft,
  },

  // SECTION 3: ACCESS & THE ENGINE
  accessSection: {
    maxWidth: 1078,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['4xl'],
  },
  accessCard: {
    borderWidth: 1,
    borderColor: colors.ink,
    padding: spacing['2xl'],
    backgroundColor: colors.canvas,
    borderRadius: rounded.none,
  },
  accessTitle: {
    ...typography.displayMd,
    fontSize: 24,
    color: colors.ink,
    fontWeight: '700',
    marginBottom: spacing.xxs,
  },
  accessSubtitle: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    marginBottom: spacing.xl,
    maxWidth: 620,
  },
  inputContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  inputWrapper: {
    flex: 1,
    minWidth: 260,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  editorialInput: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: rounded.none,
    backgroundColor: colors.canvas,
    paddingTop: 14,
    paddingBottom: 6,
    paddingHorizontal: 8,
    ...typography.inputMd,
    fontSize: 12,
    color: colors.ink,
  },
  editorialInputError: {
    borderColor: colors.statusErrorBorder, // #db1215 validation escape hatch
    color: colors.statusErrorText,
  },
  validationErrorText: {
    ...typography.captionSm,
    color: colors.statusErrorText, // #db1215 strictly per DESIGN.md
    marginTop: spacing.xxs,
  },
  submitButton: {
    height: 46,
    backgroundColor: colors.ink,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rounded.none,
  },
  submitButtonText: {
    ...typography.captionCap,
    fontSize: 12,
    color: colors.onInk,
    fontWeight: '600',
    letterSpacing: 0.8,
  },

  // SECTION 4: FOOTER
  footerSection: {
    maxWidth: 1078,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  footerDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginBottom: spacing.xl,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  footerLogo: {
    ...typography.displayMd,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginRight: spacing.sm,
  },
  footerTagline: {
    ...typography.captionSm,
    color: colors.inkSoft,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLinkText: {
    ...typography.captionCap,
    fontSize: 11,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  footerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineGrade,
  },
  copyrightText: {
    ...typography.captionSm,
    fontSize: 11,
    color: colors.inkSoft,
  },
});

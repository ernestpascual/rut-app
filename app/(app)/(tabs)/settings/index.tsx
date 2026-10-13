import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase/client';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useTheme, ThemeMode } from '../../../../src/design/ThemeContext';
import { AnnouncementBar } from '../../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../../src/components/ui/TopNav';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { Input } from '../../../../src/components/ui/Input';
import { rounded, typography, spacing, ThemeColors } from '../../../../src/design/tokens';
import { UsageEvent, UsageSummary } from '../../../../src/types';

export default function SettingsScreen() {
  const { user, userProfile, signOut, deleteAccount } = useAuth();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [todaySummary, setTodaySummary] = useState<UsageSummary | null>(null);
  const [monthSummary, setMonthSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.6-flash');
  const [customModel, setCustomModel] = useState<string>('');
  const [modelError, setModelError] = useState<string | null>(null);
  const [savingModel, setSavingModel] = useState<boolean>(false);

  const ALLOWED_MODELS = [
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Default)' },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
    { id: 'gemini-4', label: 'Gemini 4' },
  ];

  useEffect(() => {
    if (!user) return;

    const fetchCostData = async () => {
      try {
        const eventsQuery = query(collection(db, 'users', user.uid, 'usageEvents'));
        const eventSnap = await getDocs(eventsQuery);
        const evts: UsageEvent[] = [];
        eventSnap.forEach((d) => evts.push({ id: d.id, ...(d.data() as any) }));
        setEvents(evts);

        // Fetch user preferred model
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data()?.preferredModel) {
          setSelectedModel(userDoc.data()?.preferredModel);
        }

        // Summaries
        const todayDoc = await getDoc(doc(db, 'users', user.uid, 'usageSummaries', 'today'));
        if (todayDoc.exists()) {
          setTodaySummary(todayDoc.data() as UsageSummary);
        }

        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthDoc = await getDoc(doc(db, 'users', user.uid, 'usageSummaries', monthKey));
        if (monthDoc.exists()) {
          setMonthSummary(monthDoc.data() as UsageSummary);
        }
      } catch (err) {
        console.warn('Cost audit data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCostData();
  }, [user]);

  // Aggregate operations from events if summary not yet populated
  const totalCostMicros = events.reduce((sum, e) => sum + (e.estimatedCostMicros || 0), 0);
  const totalCostUSD = (totalCostMicros / 1000000).toFixed(4);

  const costByOp: Record<string, number> = {};
  const costByModel: Record<string, number> = {};
  let totalIndexed = 0;
  let totalChats = 0;
  let totalSearches = 0;

  for (const e of events) {
    costByOp[e.operation] = (costByOp[e.operation] || 0) + (e.estimatedCostMicros || 0);
    costByModel[e.model || 'standard'] =
      (costByModel[e.model || 'standard'] || 0) + (e.estimatedCostMicros || 0);
    if (e.operation === 'indexing') totalIndexed++;
    if (e.operation === 'chat') totalChats++;
    if (e.operation === 'search') totalSearches++;
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account & Data',
      'This will permanently delete your account and all saved inspirations, chats, and projects recursively from Firestore. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete account.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveModel = async (modelName: string) => {
    setModelError(null);
    const clean = modelName.trim().toLowerCase();
    const normalized =
      clean === 'gemini-4' || clean === 'gemini 4' || clean === 'gemini-4.0' || clean === 'gemini 4.0' || clean === 'gemini-4-flash' || clean === 'gemini-4.0-flash'
        ? 'gemini-4'
        : clean === 'gemini-3.8-flash' || clean === 'gemini-3.8' || clean === 'gemini 3.8' || clean === 'gemini 3.8 flash'
        ? 'gemini-3.8-flash'
        : clean === 'gemini-3.6-flash' || clean === 'gemini-3.6' || clean === 'gemini 3.6' || clean === 'gemini 3.6 flash'
        ? 'gemini-3.6-flash'
        : null;

    if (!normalized) {
      setModelError('Only Gemini 4, Gemini 3.8 Flash, and Gemini 3.6 Flash are permitted.');
      return;
    }
    if (!user) return;
    setSavingModel(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { preferredModel: normalized }, { merge: true });
      setSelectedModel(normalized);
      setCustomModel('');
    } catch (err: any) {
      setModelError(err.message || 'Failed to update preferred model.');
    } finally {
      setSavingModel(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AnnouncementBar pillText="AUDIT" message="Runtime AI Usage & Settings" />
      <TopNav title="rut" subtitle="Settings & Ledger" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Account Info */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>ACCOUNT</Text>
          <Text style={styles.accountEmail}>{user?.email || 'Authenticated User'}</Text>
          <Text style={styles.accountUid}>UID: {user?.uid || '—'}</Text>
          <Text style={[styles.accountUid, { marginTop: spacing.xxs }]}>
            ROLE: {(userProfile?.role || 'user').toUpperCase()}
          </Text>

          <Button
            title="SIGN OUT"
            variant="secondary"
            onPress={signOut}
            style={{ marginTop: spacing.base }}
          />
        </Card>

        {/* Appearance / Theme Mode */}
        <Card style={styles.sectionCard}>
          <View style={styles.auditHeader}>
            <Text style={styles.sectionHeading}>APPEARANCE</Text>
            <Badge label={isDark ? 'DARK MODE' : 'LIGHT MODE'} variant="inverse" />
          </View>
          <Text style={styles.disclaimerText}>
            Select your preferred visual aesthetic. Both modes preserve rut's strict high-contrast editorial typography and zero-radius corners.
          </Text>

          <View style={styles.appearanceRow}>
            <Button
              title={themeMode === 'light' ? 'LIGHT ✓' : 'LIGHT'}
              variant={themeMode === 'light' ? 'primary' : 'secondary'}
              onPress={() => setThemeMode('light')}
              style={styles.appearanceBtn}
            />
            <Button
              title={themeMode === 'dark' ? 'DARK ✓' : 'DARK'}
              variant={themeMode === 'dark' ? 'primary' : 'secondary'}
              onPress={() => setThemeMode('dark')}
              style={styles.appearanceBtn}
            />
            <Button
              title={themeMode === 'system' ? 'SYSTEM ✓' : 'SYSTEM'}
              variant={themeMode === 'system' ? 'primary' : 'secondary'}
              onPress={() => setThemeMode('system')}
              style={styles.appearanceBtn}
            />
          </View>
          <Text style={[styles.disclaimerText, { marginTop: spacing.xs, marginBottom: 0 }]}>
            Active Theme: {isDark ? 'Dark (Inverted Editorial)' : 'Light (Editorial White)'}
            {themeMode === 'system' ? ' • Following Device System' : ' • Manual Preference'}
          </Text>
        </Card>

        {/* Gemini Model Selection */}
        <Card style={styles.sectionCard}>
          <View style={styles.auditHeader}>
            <Text style={styles.sectionHeading}>AI MODEL CONFIGURATION</Text>
            <Badge label="GEMINI 4 • 3.8 • 3.6" variant="inverse" />
          </View>
          <Text style={styles.disclaimerText}>
            Select the active Gemini model for AI indexing, trains of thought, and project matching.
            Only Gemini 4, Gemini 3.8 Flash, and Gemini 3.6 Flash are supported (Gemini 3.6 Flash is default).
          </Text>

          {modelError ? (
            <Text style={[styles.disclaimerText, { color: colors.statusErrorText, marginBottom: spacing.xs }]}>
              {modelError}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
            {ALLOWED_MODELS.map((m) => (
              <Button
                key={m.id}
                title={m.id === selectedModel ? `${m.label} ✓` : m.label}
                variant={m.id === selectedModel ? 'primary' : 'secondary'}
                onPress={() => handleSaveModel(m.id)}
                disabled={savingModel}
                style={{ marginRight: spacing.xs, marginBottom: spacing.xs, height: 38, paddingHorizontal: 14 }}
              />
            ))}
          </View>

          {/* Quick select custom input */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Input
              value={customModel}
              onChangeText={(text: string) => {
                setCustomModel(text);
                if (modelError) setModelError(null);
              }}
              placeholder="e.g. gemini-3.6-flash, gemini-3.8-flash, gemini-4"
              containerStyle={{ flex: 1, marginVertical: 0 }}
              onSubmitEditing={() => customModel && handleSaveModel(customModel)}
            />
            <Button
              title="SET"
              onPress={() => customModel && handleSaveModel(customModel)}
              disabled={!customModel.trim() || savingModel}
              style={{ marginLeft: spacing.xs, height: 46 }}
            />
          </View>
        </Card>

        {/* Runtime Cost Audit Ledger */}
        <Card style={styles.sectionCard}>
          <View style={styles.auditHeader}>
            <Text style={styles.sectionHeading}>RUNTIME AI COST AUDIT</Text>
            <Badge label="ESTIMATES ONLY" variant="grade" />
          </View>

          <Text style={styles.disclaimerText}>
            Estimated telemetry based on token counts and integer-micro server calculations. These figures are informational estimates and not a billing invoice.
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.ink} size="small" style={{ marginVertical: spacing.base }} />
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>ESTIMATED TODAY</Text>
                <Text style={styles.statValue}>
                  ${todaySummary ? (todaySummary.totalCostMicros / 1000000).toFixed(4) : '0.0000'}
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>ESTIMATED THIS MONTH</Text>
                <Text style={styles.statValue}>
                  ${monthSummary ? (monthSummary.totalCostMicros / 1000000).toFixed(4) : totalCostUSD}
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>INDEXED ITEMS</Text>
                <Text style={styles.statValue}>{todaySummary?.totalIndexed ?? totalIndexed}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>CHAT TURNS</Text>
                <Text style={styles.statValue}>{todaySummary?.totalChatRequests ?? totalChats}</Text>
              </View>
            </View>
          )}

          {/* Breakdown by Operation */}
          <Text style={[styles.subHeading, { marginTop: spacing.base }]}>
            COST BY OPERATION (USD)
          </Text>
          {Object.keys(costByOp).length === 0 ? (
            <Text style={styles.emptyMetricText}>No billable AI operations recorded yet.</Text>
          ) : (
            Object.entries(costByOp).map(([op, micros]) => (
              <View key={op} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{op.toUpperCase()}</Text>
                <Text style={styles.metricValue}>${(micros / 1000000).toFixed(6)}</Text>
              </View>
            ))
          )}

          {/* Breakdown by Model */}
          <Text style={[styles.subHeading, { marginTop: spacing.base }]}>
            COST BY MODEL (USD)
          </Text>
          {Object.keys(costByModel).length === 0 ? (
            <Text style={styles.emptyMetricText}>No model usage recorded yet.</Text>
          ) : (
            Object.entries(costByModel).map(([mod, micros]) => (
              <View key={mod} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{mod}</Text>
                <Text style={styles.metricValue}>${(micros / 1000000).toFixed(6)}</Text>
              </View>
            ))
          )}
        </Card>

        {/* Data & Privacy Explanation */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>DATA &amp; PRIVACY</Text>
          <Text style={styles.privacyBody}>
            • Your inspirations and trains of thought are private to your authenticated user account.
            {'\n'}• Vector embeddings are stored in server-only collections inaccessible to clients.
            {'\n'}• No personal files or images are stored in Firebase Storage.
            {'\n'}• Shared posts are indexed on server-side functions using safe scraping protections.
          </Text>
        </Card>

        {/* System Details & Dangerous Zone */}
        <Card style={styles.dangerCard}>
          <Text style={styles.dangerHeading}>DANGER ZONE</Text>
          <Text style={styles.dangerBody}>
            Permanently delete your account and all associated Firestore data.
          </Text>
          <Button
            title={deleting ? 'DELETING ACCOUNT...' : 'DELETE ACCOUNT & DATA'}
            variant="secondary"
            onPress={handleDeleteAccount}
            loading={deleting}
            style={{ borderColor: colors.statusErrorBorder }}
            textStyle={{ color: colors.statusErrorText }}
          />
        </Card>

        <View style={styles.versionFooter}>
          <Text style={styles.versionText}>rut v1.0.0 • Production Build</Text>
        </View>
      </ScrollView>
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
      maxWidth: 680,
      width: '100%',
      alignSelf: 'center',
    },
    sectionCard: {
      marginBottom: spacing.base,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    sectionHeading: {
      ...typography.captionCap,
      color: colors.ink,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    accountEmail: {
      ...typography.bodyLg,
      color: colors.ink,
      marginBottom: spacing.xxs,
    },
    accountUid: {
      ...typography.captionSm,
      color: colors.inkSoft,
    },
    auditHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xxs,
    },
    disclaimerText: {
      ...typography.captionSm,
      color: colors.inkSoft,
      lineHeight: 16,
      marginBottom: spacing.base,
    },
    appearanceRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    appearanceBtn: {
      flex: 1,
      height: 40,
      marginRight: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      borderLeftWidth: 1,
      borderLeftColor: colors.hairline,
    },
    statBox: {
      width: '50%',
      padding: spacing.sm,
      borderRightWidth: 1,
      borderRightColor: colors.hairline,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairline,
      backgroundColor: colors.surfaceGrade,
    },
    statLabel: {
      ...typography.captionCap,
      fontSize: 9,
      color: colors.inkSoft,
      marginBottom: spacing.xxs,
    },
    statValue: {
      ...typography.displayMd,
      fontSize: 20,
      color: colors.ink,
      fontWeight: '700',
    },
    subHeading: {
      ...typography.captionCap,
      fontSize: 10,
      color: colors.inkSoft,
      marginBottom: spacing.xs,
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xxs,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairlineGrade,
    },
    metricLabel: {
      ...typography.captionSm,
      color: colors.ink,
    },
    metricValue: {
      ...typography.captionSm,
      color: colors.ink,
      fontWeight: '600',
    },
    emptyMetricText: {
      ...typography.captionSm,
      color: colors.inkSoft,
      fontStyle: 'italic',
    },
    privacyBody: {
      ...typography.bodyMd,
      color: colors.inkSoft,
      lineHeight: 22,
      fontSize: 13,
    },
    dangerCard: {
      marginBottom: spacing.base,
      borderWidth: 1,
      borderColor: colors.statusErrorBorder,
      padding: spacing.base,
    },
    dangerHeading: {
      ...typography.captionCap,
      color: colors.statusErrorText,
      fontWeight: '700',
      marginBottom: spacing.xxs,
    },
    dangerBody: {
      ...typography.captionSm,
      color: colors.inkSoft,
      marginBottom: spacing.base,
    },
    versionFooter: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    versionText: {
      ...typography.captionSm,
      color: colors.inkSoft,
    },
  });

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/features/auth/AuthContext';
import { useTheme } from '../src/design/ThemeContext';
import { useShareCapture } from '../src/features/capture/useShareCapture';
import { TopNav } from '../src/components/ui/TopNav';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../src/design/tokens';
import { InspirationItem } from '../src/types';
import { enrichUrlMetadata, ExtractedUrlMetadata } from '../src/utils/urlMetadata';

export default function ShareTargetScreen() {
  const router = useRouter();
  const { user, signInAsDummy, stagedShare, clearStagedShare } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { processPayload, checkForDuplicate, saveShare, loading } = useShareCapture();
  const params = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();

  const rawTitle = (params.title || stagedShare?.title || '').toString();
  const rawText = (params.text || stagedShare?.text || '').toString();
  const rawUrl = (params.url || stagedShare?.url || '').toString();

  const [title, setTitle] = useState('');
  const [userNote, setUserNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [duplicate, setDuplicate] = useState<InspirationItem | null>(null);
  const [isBinaryOnly, setIsBinaryOnly] = useState(false);
  const [extractedMeta, setExtractedMeta] = useState<ExtractedUrlMetadata | null>(null);
  const [extractingMeta, setExtractingMeta] = useState(false);

  // Auto-login as dummy user if unauthenticated so mobile share is never blocked
  useEffect(() => {
    if (!user) {
      signInAsDummy().catch(() => {});
    }
  }, [user]);

  const payload = {
    title: rawTitle || null,
    text: rawText || null,
    url: rawUrl || null,
  };

  const processed = processPayload(payload);

  useEffect(() => {
    setTitle(processed.title);
    if (!processed.normalizedUrl && !processed.sharedText) {
      setIsBinaryOnly(true);
    }
    if (user && processed.contentHash) {
      checkForDuplicate(processed.contentHash).then((existing) => {
        if (existing) setDuplicate(existing);
      });
    }

    const targetUrl = processed.rawUrl || processed.normalizedUrl;
    if (targetUrl) {
      setExtractingMeta(true);
      enrichUrlMetadata(targetUrl, rawTitle, userNote)
        .then((meta) => {
          setExtractedMeta(meta);
          if (meta.title && (!rawTitle || rawTitle.trim() === '')) {
            setTitle(meta.title);
          }
          if (meta.autoTags && meta.autoTags.length > 0) {
            setTags((prev) => Array.from(new Set([...prev, ...meta.autoTags])));
          }
        })
        .finally(() => {
          setExtractingMeta(false);
        });
    }
  }, [rawTitle, rawText, rawUrl, user]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 30) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    try {
      await saveShare(payload, title, userNote, tags);
      if (stagedShare) {
        await clearStagedShare();
      }
      // Always direct straight to the Dump folder where everything starts
      router.replace('/(app)/(tabs)/bank');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save item.');
    }
  };

  const handleCancel = async () => {
    if (stagedShare) {
      await clearStagedShare();
    }
    router.replace('/(app)/(tabs)/bank');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav
        title="rut"
        subtitle="Share to Dump"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/bank');
          }
        }}
        backTitle="DUMP"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* DUMP FOLDER DESTINATION NOTICE */}
        <Card style={styles.destinationCard}>
          <View style={styles.destinationHeader}>
            <Text style={styles.destinationTitle}>DESTINATION: 📁 DUMP</Text>
            <Badge label="EVERYTHING STARTS HERE" variant="inverse" />
          </View>
          <Text style={styles.destinationBody}>
            Shared inspirations from your phone go directly into your Dump folder. From there you can sort items, explore them, and attach them as references to your ideas.
          </Text>
        </Card>

        {isBinaryOnly ? (
          <Card style={styles.warningCard}>
            <Text style={styles.warningTitle}>FILE CAPTURE UNSUPPORTED</Text>
            <Text style={styles.warningBody}>
              Images, videos, and binary uploads are not supported in this version. You can enter a text note or title below to remember this inspiration.
            </Text>
          </Card>
        ) : null}

        {duplicate ? (
          <Card style={styles.warningCard}>
            <Text style={styles.warningTitle}>DUPLICATE DETECTED</Text>
            <Text style={styles.warningBody}>
              You already saved this item: &ldquo;{duplicate.title}&rdquo;. You can still save it again or update your notes.
            </Text>
          </Card>
        ) : null}

        <Card style={styles.previewCard}>
          <View style={styles.row}>
            {extractedMeta?.platform || processed.platform ? (
              <Badge label={(extractedMeta?.platform || processed.platform || 'WEB').toUpperCase()} variant="inverse" />
            ) : null}
            {extractedMeta?.siteName ? (
              <Badge label={extractedMeta.siteName} variant="grade" />
            ) : processed.domain ? (
              <Badge label={processed.domain} variant="grade" />
            ) : null}
            {extractingMeta ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: spacing.xs }}>
                <ActivityIndicator size="small" color={colors.ink} />
                <Text style={[styles.extractingText, { color: colors.inkSoft }]}> Extracting...</Text>
              </View>
            ) : null}
          </View>

          {extractedMeta?.previewImageUrl ? (
            <Image
              source={{ uri: extractedMeta.previewImageUrl }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : null}

          {processed.rawUrl ? (
            <Text style={styles.urlText} numberOfLines={2}>
              {processed.rawUrl}
            </Text>
          ) : null}

          {extractedMeta?.editorialContext ? (
            <View style={[styles.contextBox, { backgroundColor: colors.surfaceGrade, borderColor: colors.hairlineGrade }]}>
              <Text style={[styles.contextText, { color: colors.ink }]}>{extractedMeta.editorialContext}</Text>
            </View>
          ) : null}

          {extractedMeta?.autoTags && extractedMeta.autoTags.length > 0 ? (
            <View style={styles.autoTagRow}>
              <Text style={[styles.autoTagLabel, { color: colors.inkSoft }]}>AUTO TAGS: </Text>
              {extractedMeta.autoTags.slice(0, 6).map((tag) => (
                <Badge key={tag} label={`#${tag}`} variant="grade" style={{ marginRight: 4, marginBottom: 4 }} />
              ))}
            </View>
          ) : null}

          {processed.sharedText && !processed.rawUrl ? (
            <Text style={styles.sharedTextSnippet} numberOfLines={3}>
              &ldquo;{processed.sharedText}&rdquo;
            </Text>
          ) : null}
        </Card>

        <Input
          label="INSPIRATION TITLE"
          value={title}
          onChangeText={setTitle}
          placeholder="Title or headline"
        />

        <Input
          label="QUICK THOUGHT / NOTE (OPTIONAL)"
          value={userNote}
          onChangeText={setUserNote}
          placeholder="Why did you save this? What idea does it spark?"
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: 'top' }}
        />

        <View style={styles.tagSection}>
          <Input
            label="ADD TAGS"
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="Type tag and press Add"
            onSubmitEditing={handleAddTag}
          />
          <Button
            title="+ ADD TAG"
            variant="secondary"
            onPress={handleAddTag}
            style={{ marginBottom: spacing.sm }}
          />

          <View style={styles.tagWrap}>
            {tags.map((tag) => (
              <Badge
                key={tag}
                label={`${tag} ✕`}
                variant="outline"
                style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
              />
            ))}
          </View>
        </View>

        <View style={styles.actionRow}>
          <Button
            title={loading ? 'ADDING TO DUMP...' : '⚡ ADD TO DUMP'}
            onPress={handleSave}
            loading={loading}
            style={{ flex: 2, marginRight: spacing.sm }}
          />
          <Button
            title="CANCEL"
            variant="secondary"
            onPress={handleCancel}
            style={{ flex: 1 }}
          />
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
  destinationCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.ink,
    marginBottom: spacing.base,
    padding: spacing.base,
  },
  destinationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  destinationTitle: {
    ...typography.captionCap,
    color: colors.ink,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  destinationBody: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
    marginTop: spacing.xxs,
  },
  previewCard: {
    marginBottom: spacing.base,
    backgroundColor: colors.surfaceGrade,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  previewImage: {
    width: '100%',
    height: 160,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceOverlay,
  },
  extractingText: {
    ...typography.captionSm,
    fontSize: 10,
  },
  contextBox: {
    padding: spacing.xs,
    borderWidth: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  contextText: {
    ...typography.captionSm,
    fontSize: 11,
    lineHeight: 16,
  },
  autoTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  autoTagLabel: {
    ...typography.captionCap,
    fontSize: 9,
    marginRight: spacing.xxs,
  },
  urlText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
  },
  sharedTextSnippet: {
    ...typography.bodyMd,
    color: colors.ink,
    fontStyle: 'italic',
  },
  warningCard: {
    backgroundColor: colors.surfaceGrade,
    borderColor: colors.hairline,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  warningTitle: {
    ...typography.captionCap,
    color: colors.ink,
    fontWeight: '700',
    marginBottom: spacing.xxs,
  },
  warningBody: {
    ...typography.captionSm,
    color: colors.inkSoft,
  },
  tagSection: {
    marginVertical: spacing.xs,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    alignItems: 'center',
  },
});

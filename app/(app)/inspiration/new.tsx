import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Pressable
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase/client';
import { useAuth, DUMMY_USER_UID } from '../../../src/features/auth/AuthContext';
import { useTheme } from '../../../src/design/ThemeContext';
import { AnnouncementBar } from '../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { Card } from '../../../src/components/ui/Card';
import { InspirationCreateSchema } from '../../../src/lib/validation/schemas';
import { normalizeUrl, detectPlatform, extractDomain, generateContentHash } from '../../../src/utils/url';
import { enrichUrlMetadata, extractUrlMetadataFromUrl, ExtractedUrlMetadata } from '../../../src/utils/urlMetadata';
import { rounded, typography, spacing, ThemeColors } from '../../../src/design/tokens';
import { InspirationItem } from '../../../src/types';
import { getDumpInspirations, setDumpInspirations } from '../../../src/features/dump/dumpService';

export default function NewInspirationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [kind, setKind] = useState<'link' | 'note'>('link');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [userNote, setUserNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Extracted URL metadata state
  const [urlMeta, setUrlMeta] = useState<ExtractedUrlMetadata | null>(null);

  // Detect and extract metadata whenever URL changes
  useEffect(() => {
    if (kind !== 'link' || !url.trim()) {
      setUrlMeta(null);
      return;
    }

    const normalized = normalizeUrl(url.trim());
    if (normalized) {
      const fastMeta = extractUrlMetadataFromUrl(normalized);
      setUrlMeta(fastMeta);

      // Async live fetch
      let isCurrent = true;
      enrichUrlMetadata(normalized, title, userNote).then((enriched) => {
        if (isCurrent) {
          setUrlMeta(enriched);
        }
      });

      return () => {
        isCurrent = false;
      };
    } else {
      setUrlMeta(null);
    }
  }, [url, kind]);

  const handleAddTag = (customTag?: string) => {
    const trimmed = (customTag !== undefined ? customTag : tagInput).trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 30) {
      setTags([...tags, trimmed]);
      if (customTag === undefined) setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    setValidationError(null);

    const normalized = url.trim() ? normalizeUrl(url.trim()) : null;
    const computedTitle =
      title.trim() ||
      urlMeta?.title ||
      (normalized ? `Saved link from ${extractDomain(normalized)}` : 'Personal Note');

    // Combine user tags with auto-tags
    const autoTags = urlMeta?.autoTags || [];
    const combinedTags = Array.from(new Set([...tags, ...autoTags]));

    const validation = InspirationCreateSchema.safeParse({
      title: computedTitle,
      url: normalized,
      userNote: userNote.trim() || null,
      kind,
      tags: combinedTags,
    });

    if (!validation.success) {
      setValidationError(validation.error.issues?.[0]?.message || 'Invalid input.');
      return;
    }

    setLoading(true);
    try {
      const platform = urlMeta?.platform || (normalized ? detectPlatform(normalized) : null);
      const domain = urlMeta?.domain || (normalized ? extractDomain(normalized) : null);
      const hash = generateContentHash(normalized || userNote.trim());
      const previewDesc = urlMeta?.description || computedTitle;
      const editorialContext = urlMeta?.editorialContext || (userNote.trim() ? `Note: ${userNote.trim()}` : null);
      const concepts = urlMeta?.concepts || combinedTags.slice(0, 4);

      const newItem: InspirationItem = {
        id: `dump-${Date.now()}`,
        ownerUid: user?.uid || DUMMY_USER_UID,
        kind,
        folder: 'dump',
        title: computedTitle,
        url: url.trim() || null,
        normalizedUrl: normalized,
        sharedText: kind === 'note' ? userNote.trim() : null,
        userNote: userNote.trim() || null,
        sourcePlatform: platform,
        sourceDomain: domain,
        sourceApp: urlMeta?.siteName || (platform ? platform.toUpperCase() : 'Manual'),
        siteName: urlMeta?.siteName || null,
        previewDescription: previewDesc,
        remotePreviewImageUrl: urlMeta?.previewImageUrl || null,
        editorialContext,
        tags: combinedTags,
        aiTags: autoTags.length > 0 ? autoTags : (platform ? [platform] : []),
        concepts,
        aiSummary: editorialContext || userNote.trim() || null,
        processingStatus: 'ready',
        processingErrorCode: null,
        duplicateOf: hash,
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        capturedAt: Date.now(),
      };

      if (!user || user.uid === DUMMY_USER_UID) {
        const existing = await getDumpInspirations();
        await setDumpInspirations([newItem, ...existing]);
        router.back();
        return;
      }

      await addDoc(collection(db, 'users', user.uid, 'inspirations'), newItem);
      const existing = await getDumpInspirations();
      await setDumpInspirations([newItem, ...existing]);
      router.back();
    } catch (err: any) {
      // Local fallback
      router.back();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar pillText="DUMP INSPIRATION" message="Raw link or note into your bank" />
      <TopNav
        title="rut"
        subtitle="New Dump Material"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/bank');
          }
        }}
        backTitle="BANK"
        rightAction={
          <Button
            title="✕ CLOSE"
            variant="text"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(app)/(tabs)/bank');
              }
            }}
          />
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.kindSelector}>
            <Button
              title="URL / LINK"
              variant={kind === 'link' ? 'primary' : 'secondary'}
              onPress={() => setKind('link')}
              style={{ flex: 1, marginRight: spacing.xs }}
            />
            <Button
              title="TEXT NOTE"
              variant={kind === 'note' ? 'primary' : 'secondary'}
              onPress={() => setKind('note')}
              style={{ flex: 1 }}
            />
          </View>

          {kind === 'link' ? (
            <View>
              <Input
                label="WEB URL"
                value={url}
                onChangeText={setUrl}
                placeholder="https://example.com/article"
                keyboardType="url"
                autoCapitalize="none"
                error={validationError && validationError.includes('URL') ? validationError : undefined}
              />

              {/* Rich Real-Time Metadata & Auto-Tags Preview */}
              {urlMeta ? (
                <Card style={styles.metaPreviewCard}>
                  <View style={styles.metaPreviewHeader}>
                    <Badge label={urlMeta.platform.toUpperCase()} variant="inverse" style={{ marginRight: 6 }} />
                    <Badge label={urlMeta.siteName || 'WEB'} variant="outline" />
                  </View>

                  {urlMeta.previewImageUrl ? (
                    <Image
                      source={{ uri: urlMeta.previewImageUrl }}
                      style={styles.previewThumb}
                      resizeMode="cover"
                    />
                  ) : null}

                  <Text style={styles.metaPreviewTitle} numberOfLines={2}>
                    {urlMeta.title}
                  </Text>

                  <Text style={styles.metaPreviewContext}>
                    {urlMeta.editorialContext}
                  </Text>

                  {urlMeta.autoTags.length > 0 ? (
                    <View style={styles.autoTagSection}>
                      <Text style={styles.autoTagHeader}>DETECTED AUTO-TAGS:</Text>
                      <View style={styles.autoTagRow}>
                        {urlMeta.autoTags.map((t) => (
                          <Badge
                            key={t}
                            label={`#${t}`}
                            variant="inverse"
                            style={{ marginRight: 6, marginBottom: 4 }}
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}
                </Card>
              ) : null}
            </View>
          ) : null}

          <Input
            label="TITLE"
            value={title}
            onChangeText={setTitle}
            placeholder={
              urlMeta?.title
                ? `Auto: ${urlMeta.title.slice(0, 45)}...`
                : kind === 'link'
                ? 'Optional title (auto-detected from URL)'
                : 'Note headline'
            }
            error={validationError && validationError.includes('Title') ? validationError : undefined}
          />

          <Input
            label={kind === 'link' ? 'PERSONAL NOTES / SPARKS (OPTIONAL)' : 'NOTE BODY'}
            value={userNote}
            onChangeText={setUserNote}
            placeholder="What does this spark? Key thoughts or concepts..."
            multiline
            numberOfLines={4}
            style={{ height: 100, textAlignVertical: 'top' }}
          />

          <View style={styles.tagSection}>
            <Input
              label="ADDITIONAL CUSTOM TAGS"
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add tag and press Enter"
              onSubmitEditing={() => handleAddTag()}
            />
            <Button
              title="+ ADD TAG"
              variant="secondary"
              onPress={() => handleAddTag()}
              style={{ marginBottom: spacing.xs }}
            />

            <View style={styles.tagWrap}>
              {tags.map((t) => (
                <Pressable key={t} onPress={() => handleRemoveTag(t)}>
                  <Badge
                    label={`${t} ✕`}
                    variant="outline"
                    style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <Button
            title={loading ? 'INDEXING & SAVING...' : 'SAVE TO INSPIRATION BANK'}
            onPress={handleSave}
            loading={loading}
            style={{ marginTop: spacing.xl }}
          />
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
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing['2xl'],
  },
  kindSelector: {
    flexDirection: 'row',
    marginBottom: spacing.base,
  },
  metaPreviewCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.ink,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  metaPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metaPreviewTitle: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  metaPreviewContext: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  previewThumb: {
    width: '100%',
    height: 120,
    backgroundColor: colors.canvas,
    marginBottom: spacing.xs,
  },
  autoTagSection: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineGrade,
  },
  autoTagHeader: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  autoTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagSection: {
    marginVertical: spacing.sm,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
});

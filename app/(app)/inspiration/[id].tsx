import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../../src/lib/firebase/client';
import { useAuth, DUMMY_USER_UID } from '../../../src/features/auth/AuthContext';
import { useTheme } from '../../../src/design/ThemeContext';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../../../src/design/tokens';
import { InspirationItem } from '../../../src/types';
import { isPlatformTag } from '../../../src/design/platformColors';
import { getDumpInspirations, setDumpInspirations, deleteInspiration } from '../../../src/features/dump/dumpService';
import { calculateDynamicInputHeight } from '../../../src/utils/inputHeight';
import { enrichUrlMetadata, PINTEREST_SVG } from '../../../src/utils/urlMetadata';
import { extractUrlFromText } from '../../../src/utils/url';
import { openExternalUrl } from '../../../src/utils/linking';

export default function InspirationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isDummy = !user || user.uid === DUMMY_USER_UID;

  const [item, setItem] = useState<InspirationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [showImage, setShowImage] = useState(true);
  const [refetchingMetadata, setRefetchingMetadata] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchDoc = async () => {
      if (user) {
        try {
          let snap = await getDoc(doc(db, 'users', user.uid, 'inspirations', id));
          if (!snap.exists()) {
            const q = query(
              collection(db, 'users', user.uid, 'inspirations'),
              where('id', '==', id),
              limit(1)
            );
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
              snap = querySnap.docs[0];
            }
          }
          if (snap.exists()) {
            const data = { ...(snap.data() as any), id: snap.id } as InspirationItem;
            setItem(data);
            setEditTitle(data.title);
            setEditNote(data.userNote || '');
            setEditTags(data.tags || []);
            setLoading(false);
            return;
          }
        } catch {}
      }

      // Check local dump
      const localItems = await getDumpInspirations();
      const found = localItems.find((i) => i.id === id);
      if (found) {
        setItem(found);
        setEditTitle(found.title);
        setEditNote(found.userNote || '');
        setEditTags(found.tags || []);
      } else {
        Alert.alert('Not Found', 'Inspiration item does not exist.');
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(app)/(tabs)/bank');
        }
      }
      setLoading(false);
    };
    fetchDoc();
  }, [user, id, isDummy]);

  const handleSaveEdits = async () => {
    if (!item) return;
    const rawTitle = editTitle.trim();
    const finalTitle = rawTitle.length > 300 ? rawTitle.slice(0, 100).trim() : rawTitle;
    const updated: InspirationItem = {
      ...item,
      title: finalTitle,
      userNote: editNote.trim() || null,
      tags: editTags,
      updatedAt: Date.now(),
    };

    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid, 'inspirations', item.id), {
          title: updated.title,
          userNote: updated.userNote,
          tags: updated.tags,
          updatedAt: Date.now(),
        });
      }
      const local = await getDumpInspirations();
      const updatedLocal = local.map((i) => (i.id === item.id ? updated : i));
      await setDumpInspirations(updatedLocal);
      setItem(updated);
      setEditing(false);
    } catch {
      const local = await getDumpInspirations();
      const updatedLocal = local.map((i) => (i.id === item.id ? updated : i));
      await setDumpInspirations(updatedLocal);
      setItem(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!item) return;
    const nextArchived = !item.archived;
    const updated: InspirationItem = { ...item, archived: nextArchived, updatedAt: Date.now() };

    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid, 'inspirations', item.id), {
          archived: nextArchived,
          updatedAt: Date.now(),
        });
      }
      const local = await getDumpInspirations();
      await setDumpInspirations(local.map((i) => (i.id === item.id ? updated : i)));
      setItem(updated);

      if (nextArchived) {
        const msg = 'Moved to Trash. You can restore or permanently delete this item in Settings.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Moved to Trash', msg);
        }
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(app)/(tabs)/bank');
        }
      } else {
        const msg = 'Restored back to your active Bank.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Restored', msg);
        }
      }
    } catch {
      const local = await getDumpInspirations();
      await setDumpInspirations(local.map((i) => (i.id === item.id ? updated : i)));
      setItem(updated);
    }
  };

  const handleDeleteAiInsight = () => {
    Alert.alert('Delete Insight', 'Are you sure you want to remove the AI summary and concepts?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!item) return;
          const updated: InspirationItem = {
            ...item,
            aiSummary: null,
            editorialContext: null,
            concepts: [],
            updatedAt: Date.now(),
          };
          try {
            if (user) {
              await updateDoc(doc(db, 'users', user.uid, 'inspirations', item.id), {
                aiSummary: null,
                editorialContext: null,
                concepts: [],
                updatedAt: Date.now(),
              });
            }
            const local = await getDumpInspirations();
            await setDumpInspirations(local.map((i) => (i.id === item.id ? updated : i)));
            setItem(updated);
          } catch {
            const local = await getDumpInspirations();
            await setDumpInspirations(local.map((i) => (i.id === item.id ? updated : i)));
            setItem(updated);
          }
        },
      },
    ]);
  };

  const handleOpenSource = async () => {
    if (!item?.url) return;
    const opened = await openExternalUrl(item.url);
    if (!opened) {
      const msg = 'Unable to open source link. Please check your browser or pop-up settings.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Notice', msg);
      }
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !editTags.includes(trimmed) && editTags.length < 30) {
      setEditTags([...editTags, trimmed]);
      setTagInput('');
    }
  };

  const handleRefetchMetadata = async () => {
    if (!item) return;
    const resolvedUrl = item.url || (item.sharedText ? extractUrlFromText(item.sharedText) : null);
    if (!resolvedUrl) {
      const msg = 'No source URL found on this item to refetch metadata from.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Notice', msg);
      }
      return;
    }

    setRefetchingMetadata(true);
    try {
      const meta = await enrichUrlMetadata(
        resolvedUrl,
        undefined,
        item.userNote || undefined,
        item.sharedText || undefined
      );

      const mergedTags = Array.from(
        new Set([...(item.tags || []), ...(meta.autoTags || [])])
      );
      const mergedConcepts = Array.from(
        new Set([...(item.concepts || []), ...(meta.concepts || [])])
      );

      let previewImg = meta.previewImageUrl || item.remotePreviewImageUrl;
      if (previewImg && /s\.pinimg\.com\/webapp\/logo|favicon/i.test(previewImg)) {
        previewImg = item.sourcePlatform === 'pinterest' ? PINTEREST_SVG : null;
      }

      const updated: InspirationItem = {
        ...item,
        url: resolvedUrl,
        title: meta.title || item.title,
        previewDescription: meta.description || item.previewDescription,
        remotePreviewImageUrl: previewImg,
        author: meta.author || item.author,
        caption: meta.caption || item.caption,
        siteName: meta.siteName || item.siteName,
        sourceDomain: meta.domain || item.sourceDomain,
        sourcePlatform: meta.platform || item.sourcePlatform,
        editorialContext: meta.editorialContext || item.editorialContext,
        tags: mergedTags,
        concepts: mergedConcepts,
        processingStatus: 'pending',
        updatedAt: Date.now(),
      };

      if (user) {
        await updateDoc(doc(db, 'users', user.uid, 'inspirations', item.id), {
          url: updated.url,
          title: updated.title,
          previewDescription: updated.previewDescription,
          remotePreviewImageUrl: updated.remotePreviewImageUrl,
          author: updated.author,
          caption: updated.caption,
          siteName: updated.siteName,
          sourceDomain: updated.sourceDomain,
          sourcePlatform: updated.sourcePlatform,
          editorialContext: updated.editorialContext,
          tags: updated.tags,
          concepts: updated.concepts,
          processingStatus: 'pending',
          updatedAt: updated.updatedAt,
        });
      }

      const local = await getDumpInspirations();
      await setDumpInspirations(local.map((i) => (i.id === item.id ? updated : i)));
      setItem(updated);
      setEditTitle(updated.title);
      setEditTags(updated.tags);

      const successMsg = '✓ Metadata refetched successfully and queued for AI indexing.';
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Refetched', successMsg);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to refetch metadata.';
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert('Error', errMsg);
      }
    } finally {
      setRefetchingMetadata(false);
    }
  };

  if (loading || !item) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav
          title="rut"
          subtitle="Loading..."
          onBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(app)/(tabs)/bank');
            }
          }}
          backTitle="DUMP"
        />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
        </View>
      </SafeAreaView>
    );
  }

  const targetUrl = item?.url || (item?.sharedText ? extractUrlFromText(item.sharedText) : null);

  return (
    <SafeAreaView style={styles.container}>
      <TopNav
        title="rut"
        subtitle="Inspiration Detail"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/bank');
          }
        }}
        backTitle="BACK"
        rightAction={
          <Button
            title={editing ? 'CANCEL' : 'EDIT'}
            variant="text"
            onPress={() => setEditing(!editing)}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {editing ? (
          <View>
            <Input
              label="TITLE"
              value={editTitle}
              onChangeText={setEditTitle}
            />

            <Input
              label="PERSONAL NOTES"
              value={editNote}
              onChangeText={setEditNote}
              multiline
              numberOfLines={1}
              style={{
                height: calculateDynamicInputHeight(editNote),
                maxHeight: 124,
                paddingTop: 10,
                paddingBottom: 10,
                textAlignVertical: 'top',
              }}
            />

            <View style={styles.tagSection}>
              <Input
                label="TAGS"
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add tag"
                onSubmitEditing={handleAddTag}
              />
              <Button
                title="+ ADD TAG"
                variant="secondary"
                onPress={handleAddTag}
                style={{ marginBottom: spacing.xs }}
              />
              <View style={styles.tagRow}>
                {Array.from(new Set(editTags)).map((t, idx) => (
                  <Badge
                    key={`edit-${t}-${idx}`}
                    label={`${t} ✕`}
                    variant="outline"
                    style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
                  />
                ))}
              </View>
            </View>

            <Button
              title={saving ? 'SAVING...' : 'SAVE CHANGES'}
              onPress={handleSaveEdits}
              loading={saving}
              style={{ marginTop: spacing.base }}
            />
          </View>
        ) : (
          <View>
            <View style={styles.metaRow}>
              <Badge label={item.kind.toUpperCase()} variant="inverse" />
              {item.sourcePlatform ? (
                <Badge label={item.sourcePlatform.toUpperCase()} variant="grade" />
              ) : null}
              {item.author ? (
                <Badge
                  label={item.author.startsWith('@') ? item.author : `@${item.author}`}
                  variant="outline"
                />
              ) : null}
              {item.sourceDomain ? (
                <Badge label={item.sourceDomain} variant="outline" />
              ) : null}
              <Badge
                label={`STATUS: ${item.processingStatus.toUpperCase()}`}
                variant={item.processingStatus === 'ready' ? 'outline' : 'grade'}
              />
              {item.archived ? (
                <Badge
                  label="IN TRASH"
                  variant="outline"
                  style={{ borderColor: colors.statusErrorBorder, marginLeft: 4 }}
                />
              ) : null}
            </View>

            {item.remotePreviewImageUrl ? (
              <View style={styles.imageCard}>
                <View style={styles.imageHeaderRow}>
                  <Text style={styles.imageHeaderLabel}>PREVIEW THUMBNAIL</Text>
                  <Pressable
                    onPress={() => setShowImage(!showImage)}
                    style={styles.imageToggleBtn}
                  >
                    <Text style={styles.imageToggleText}>
                      {showImage ? 'HIDE IMAGE' : 'SHOW IMAGE'}
                    </Text>
                  </Pressable>
                </View>
                {showImage ? (
                  <Pressable onPress={handleOpenSource} accessibilityRole="link" accessibilityLabel="Visit source website">
                    <Image
                      source={{
                        uri: item.remotePreviewImageUrl?.includes('s.pinimg.com/webapp/logo')
                          ? PINTEREST_SVG
                          : item.remotePreviewImageUrl,
                      }}
                      style={styles.detailImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.title}>{item.title}</Text>

            {item.caption ? (
              <Card style={styles.captionCard}>
                <Text style={styles.captionHeading}>ORIGINAL CAPTION</Text>
                <Text style={styles.captionText}>{item.caption}</Text>
              </Card>
            ) : null}

            {item.url ? (
              <View style={{ marginBottom: spacing.base }}>
                <Pressable
                  onPress={handleOpenSource}
                  style={[styles.linkContainer, { marginBottom: 0 }]}
                  accessibilityRole="link"
                >
                  <Text style={styles.linkText} numberOfLines={2}>
                    ↗ Visit Source: {item.url}
                  </Text>
                </Pressable>
                <View style={{ marginTop: 8 }}>
                  <Button
                    title="↗ VISIT SOURCE"
                    variant="secondary"
                    onPress={handleOpenSource}
                    style={{ height: 36 }}
                  />
                </View>
              </View>
            ) : null}

            {item.aiSummary ? (
              <Card style={styles.aiCard}>
                <View style={styles.aiHeaderRow}>
                  <Text style={styles.aiHeading}>AI INDEXED SUMMARY</Text>
                  <Button
                    title="DELETE INSIGHT"
                    variant="text"
                    onPress={handleDeleteAiInsight}
                  />
                </View>
                <Text style={styles.aiSummaryText}>{item.aiSummary}</Text>

                {item.concepts && item.concepts.length > 0 ? (
                  <View style={styles.conceptSection}>
                    <Text style={styles.conceptHeading}>EXTRACTED CONCEPTS:</Text>
                    <View style={styles.tagRow}>
                      {Array.from(new Set(item.concepts)).map((c, idx) => (
                        <Badge key={`concept-${c}-${idx}`} label={String(c)} variant="outline" />
                      ))}
                    </View>
                  </View>
                ) : null}
              </Card>
            ) : null}

            {item.userNote ? (
              <Card style={styles.noteCard}>
                <Text style={styles.noteHeading}>PERSONAL NOTES</Text>
                <Text style={styles.noteText}>{item.userNote}</Text>
              </Card>
            ) : null}

            {item.sharedText && item.sharedText !== item.url ? (
              <Card style={styles.noteCard}>
                <Text style={styles.noteHeading}>ORIGINAL CAPTURED TEXT</Text>
                <Text style={styles.noteText}>{item.sharedText}</Text>
              </Card>
            ) : null}

            {/* Tags */}
            <View style={styles.tagSection}>
              <Text style={styles.noteHeading}>TAGS</Text>
              <View style={styles.tagRow}>
                {Array.from(new Set([...(item.tags || []), ...(item.aiTags || [])]))
                  .filter((t) => !isPlatformTag(t, item.sourcePlatform))
                  .map((t, idx) => (
                    <Badge key={`tag-${t}-${idx}`} label={`#${t}`} variant="grade" />
                  ))}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionSection}>
              {targetUrl ? (
                <Button
                  title={refetchingMetadata ? 'REFETCHING METADATA...' : 'REFETCH METADATA'}
                  variant="secondary"
                  onPress={handleRefetchMetadata}
                  disabled={refetchingMetadata || saving}
                  loading={refetchingMetadata}
                  style={{ marginBottom: spacing.sm }}
                />
              ) : null}
              <Button
                title={item.archived ? 'RESTORE FROM TRASH' : 'MOVE TO TRASH'}
                variant="secondary"
                onPress={handleToggleArchive}
                style={{
                  marginBottom: spacing.sm,
                  backgroundColor: '#FFFFFF',
                  borderColor: '#FFFFFF',
                  borderWidth: 1,
                }}
                textStyle={{
                  color: '#000000',
                  fontWeight: '700',
                }}
              />
            </View>
          </View>
        )}
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
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.displayMd,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  linkContainer: {
    backgroundColor: colors.surfaceGrade,
    padding: spacing.xs,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  linkText: {
    ...typography.captionSm,
    color: colors.ink,
    textDecorationLine: 'underline',
  },
  aiCard: {
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.base,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  aiHeading: {
    ...typography.captionCap,
    color: colors.ink,
    fontWeight: '700',
  },
  aiSummaryText: {
    ...typography.bodyMd,
    color: colors.ink,
    lineHeight: 22,
  },
  conceptSection: {
    marginTop: spacing.sm,
  },
  conceptHeading: {
    ...typography.captionCap,
    fontSize: 10,
    color: colors.inkSoft,
    marginBottom: spacing.xxs,
  },
  noteCard: {
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  imageCard: {
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceGrade,
    overflow: 'hidden',
  },
  imageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  imageHeaderLabel: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  imageToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  imageToggleText: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.ink,
  },
  detailImage: {
    width: '100%',
    height: 240,
    backgroundColor: colors.canvas,
  },
  captionCard: {
    marginBottom: spacing.base,
    borderLeftWidth: 3,
    borderLeftColor: colors.ink,
    backgroundColor: colors.surfaceGrade,
  },
  captionHeading: {
    ...typography.captionCap,
    color: colors.inkSoft,
    marginBottom: spacing.xxs,
  },
  captionText: {
    ...typography.bodyMd,
    color: colors.ink,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  noteHeading: {
    ...typography.captionCap,
    color: colors.inkSoft,
    marginBottom: spacing.xxs,
  },
  noteText: {
    ...typography.bodyMd,
    color: colors.ink,
    lineHeight: 22,
  },
  tagSection: {
    marginVertical: spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xxs,
  },
  actionSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

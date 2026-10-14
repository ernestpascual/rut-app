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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc
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
import { getDumpInspirations, setDumpInspirations } from '../../../src/features/dump/dumpService';
import { calculateDynamicInputHeight } from '../../../src/utils/inputHeight';

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

  useEffect(() => {
    if (!id) return;
    const fetchDoc = async () => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'inspirations', id));
          if (snap.exists()) {
            const data = { id: snap.id, ...(snap.data() as any) } as InspirationItem;
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
        router.back();
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
    } catch {
      const local = await getDumpInspirations();
      await setDumpInspirations(local.map((i) => (i.id === item.id ? updated : i)));
      setItem(updated);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    Alert.alert(
      'Delete Inspiration',
      'Are you sure you want to permanently remove this inspiration from your bank?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (user) {
                await deleteDoc(doc(db, 'users', user.uid, 'inspirations', item.id)).catch(() => {});
              }
              const local = await getDumpInspirations();
              await setDumpInspirations(local.filter((i) => i.id !== item.id));
              router.back();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message);
            }
          },
        },
      ]
    );
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

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !editTags.includes(trimmed) && editTags.length < 30) {
      setEditTags([...editTags, trimmed]);
      setTagInput('');
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
                  <Image
                    source={{ uri: item.remotePreviewImageUrl }}
                    style={styles.detailImage}
                    resizeMode="cover"
                  />
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
              <Pressable
                onPress={() => Linking.openURL(item.url!)}
                style={styles.linkContainer}
              >
                <Text style={styles.linkText} numberOfLines={2}>
                  ↗ Visit Source: {item.url}
                </Text>
              </Pressable>
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
                        <Badge key={`concept-${c}-${idx}`} label={c} variant="outline" />
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
                {Array.from(new Set([...(item.tags || []), ...(item.aiTags || [])])).map((t, idx) => (
                  <Badge key={`tag-${t}-${idx}`} label={`#${t}`} variant="grade" />
                ))}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionSection}>
              <Button
                title={item.archived ? 'UNARCHIVE ITEM' : 'ARCHIVE ITEM'}
                variant="secondary"
                onPress={handleToggleArchive}
                style={{ marginBottom: spacing.sm }}
              />
              <Button
                title="DELETE FROM BANK"
                variant="secondary"
                onPress={handleDelete}
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

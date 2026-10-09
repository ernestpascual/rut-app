import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../../src/lib/firebase/client';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { AnnouncementBar } from '../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { colors, rounded, typography, spacing } from '../../../src/design/tokens';
import { InspirationItem } from '../../../src/types';

export default function InspirationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [item, setItem] = useState<InspirationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    const fetchDoc = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'inspirations', id));
        if (snap.exists()) {
          const data = { id: snap.id, ...(snap.data() as any) } as InspirationItem;
          setItem(data);
          setEditTitle(data.title);
          setEditNote(data.userNote || '');
          setEditTags(data.tags || []);
        } else {
          Alert.alert('Not Found', 'Inspiration item does not exist.');
          router.back();
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not load item.');
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [user, id]);

  const handleSaveEdits = async () => {
    if (!user || !item) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'inspirations', item.id), {
        title: editTitle.trim(),
        userNote: editNote.trim() || null,
        tags: editTags,
        updatedAt: Date.now(),
      });
      setItem({
        ...item,
        title: editTitle.trim(),
        userNote: editNote.trim() || null,
        tags: editTags,
      });
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not update item.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!user || !item) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'inspirations', item.id), {
        archived: !item.archived,
        updatedAt: Date.now(),
      });
      setItem({ ...item, archived: !item.archived });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update archive state.');
    }
  };

  const handleDelete = async () => {
    if (!user || !item) return;
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
              await deleteDoc(doc(db, 'users', user.uid, 'inspirations', item.id));
              router.back();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message);
            }
          },
        },
      ]
    );
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
        <TopNav title="rut" subtitle="Loading..." />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar
        pillText={item.kind.toUpperCase()}
        message={item.sourcePlatform ? `From ${item.sourcePlatform}` : 'Saved material'}
      />
      <TopNav
        title="rut"
        subtitle="Inspiration Detail"
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
              numberOfLines={4}
              style={{ height: 100, textAlignVertical: 'top' }}
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
                {editTags.map((t) => (
                  <Badge
                    key={t}
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
              {item.sourceDomain ? (
                <Badge label={item.sourceDomain} variant="outline" />
              ) : null}
              <Badge
                label={`STATUS: ${item.processingStatus.toUpperCase()}`}
                variant={item.processingStatus === 'ready' ? 'outline' : 'grade'}
              />
            </View>

            <Text style={styles.title}>{item.title}</Text>

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
                <Text style={styles.aiHeading}>AI INDEXED SUMMARY</Text>
                <Text style={styles.aiSummaryText}>{item.aiSummary}</Text>

                {item.concepts && item.concepts.length > 0 ? (
                  <View style={styles.conceptSection}>
                    <Text style={styles.conceptHeading}>EXTRACTED CONCEPTS:</Text>
                    <View style={styles.tagRow}>
                      {item.concepts.map((c) => (
                        <Badge key={c} label={c} variant="outline" />
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
                {[...(item.tags || []), ...(item.aiTags || [])].map((t) => (
                  <Badge key={t} label={`#${t}`} variant="grade" />
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

const styles = StyleSheet.create({
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
  aiHeading: {
    ...typography.captionCap,
    color: colors.ink,
    fontWeight: '700',
    marginBottom: spacing.xs,
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

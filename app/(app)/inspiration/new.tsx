import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase/client';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { AnnouncementBar } from '../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { InspirationCreateSchema } from '../../../src/lib/validation/schemas';
import { normalizeUrl, detectPlatform, extractDomain, generateContentHash } from '../../../src/utils/url';
import { colors, rounded, typography, spacing } from '../../../src/design/tokens';

export default function NewInspirationScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [kind, setKind] = useState<'link' | 'note'>('link');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [userNote, setUserNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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
    if (!user) return;
    setValidationError(null);

    const normalized = url.trim() ? normalizeUrl(url.trim()) : null;
    const computedTitle = title.trim() || (normalized ? `Saved link from ${extractDomain(normalized)}` : 'Personal Note');

    const validation = InspirationCreateSchema.safeParse({
      title: computedTitle,
      url: normalized,
      userNote: userNote.trim() || null,
      kind,
      tags,
    });

    if (!validation.success) {
      setValidationError(validation.error.issues?.[0]?.message || 'Invalid input.');
      return;
    }

    setLoading(true);
    try {
      const platform = normalized ? detectPlatform(normalized) : null;
      const domain = normalized ? extractDomain(normalized) : null;
      const hash = generateContentHash(normalized || userNote.trim());

      await addDoc(collection(db, 'users', user.uid, 'inspirations'), {
        ownerUid: user.uid,
        kind,
        title: computedTitle,
        url: url.trim() || null,
        normalizedUrl: normalized,
        sharedText: null,
        userNote: userNote.trim() || null,
        sourcePlatform: platform,
        sourceDomain: domain,
        sourceApp: null,
        previewDescription: null,
        remotePreviewImageUrl: null,
        tags,
        aiTags: [],
        concepts: [],
        aiSummary: null,
        processingStatus: 'pending',
        processingErrorCode: null,
        duplicateOf: hash,
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        capturedAt: Date.now(),
      });

      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save inspiration item.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar pillText="MANUAL" message="Add a link or idea note to your dump" />
      <TopNav
        title="rut"
        subtitle="New Inspiration"
        rightAction={<Button title="✕ CLOSE" variant="text" onPress={() => router.back()} />}
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
            <Input
              label="WEB URL"
              value={url}
              onChangeText={setUrl}
              placeholder="https://example.com/article"
              keyboardType="url"
              autoCapitalize="none"
              error={validationError && validationError.includes('URL') ? validationError : undefined}
            />
          ) : null}

          <Input
            label="TITLE"
            value={title}
            onChangeText={setTitle}
            placeholder={kind === 'link' ? 'Optional title (defaults to domain)' : 'Note headline'}
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
              label="TAGS"
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add tag and press Enter"
              onSubmitEditing={handleAddTag}
            />
            <Button
              title="+ ADD TAG"
              variant="secondary"
              onPress={handleAddTag}
              style={{ marginBottom: spacing.xs }}
            />

            <View style={styles.tagWrap}>
              {tags.map((t) => (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: spacing.base,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  kindSelector: {
    flexDirection: 'row',
    marginBottom: spacing.base,
  },
  tagSection: {
    marginTop: spacing.xs,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/features/auth/AuthContext';
import { useShareCapture } from '../src/features/capture/useShareCapture';
import { AnnouncementBar } from '../src/components/ui/AnnouncementBar';
import { TopNav } from '../src/components/ui/TopNav';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { colors, rounded, typography, spacing } from '../src/design/tokens';
import { InspirationItem } from '../src/types';

export default function ShareTargetScreen() {
  const router = useRouter();
  const { user, stagedShare, clearStagedShare } = useAuth();
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
      const res = await saveShare(payload, title, userNote, tags);
      if (stagedShare) {
        await clearStagedShare();
      }
      if (res.staged) {
        Alert.alert(
          'Saved Locally',
          'Your shared item has been saved to this device. Please log in to sync it to your bank.',
          [{ text: 'Log In', onPress: () => router.replace('/(auth)/login') }]
        );
      } else {
        router.replace('/(app)/(tabs)/bank');
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save item.');
    }
  };

  const handleCancel = async () => {
    if (stagedShare) {
      await clearStagedShare();
    }
    if (user) {
      router.replace('/(app)/(tabs)/bank');
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar pillText="CAPTURE" message="Save incoming inspiration to bank" />
      <TopNav title="rut" subtitle="Incoming Share" />

      <ScrollView contentContainerStyle={styles.content}>
        {!user ? (
          <Card style={styles.authNoticeCard}>
            <Text style={styles.authNoticeTitle}>YOU ARE SIGNED OUT</Text>
            <Text style={styles.authNoticeBody}>
              This item is staged locally on your device. Sign in or create an account to index and save it to your private bank.
            </Text>
            <Button
              title="LOG IN TO SAVE"
              onPress={() => router.push('/(auth)/login')}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        ) : null}

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
            {processed.platform ? (
              <Badge label={processed.platform.toUpperCase()} variant="inverse" />
            ) : null}
            {processed.domain ? (
              <Badge label={processed.domain} variant="grade" />
            ) : null}
          </View>

          {processed.rawUrl ? (
            <Text style={styles.urlText} numberOfLines={2}>
              {processed.rawUrl}
            </Text>
          ) : null}

          {processed.sharedText && !processed.rawUrl ? (
            <Text style={styles.sharedTextSnippet} numberOfLines={3}>
              &ldquo;{processed.sharedText}&rdquo;
            </Text>
          ) : null}
        </Card>

        <Input
          label="TITLE"
          value={title}
          onChangeText={setTitle}
          placeholder="Title or headline"
        />

        <Input
          label="PERSONAL NOTE (OPTIONAL)"
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
            title={loading ? 'SAVING...' : 'SAVE TO INSPIRATION BANK'}
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
  previewCard: {
    marginBottom: spacing.base,
    backgroundColor: colors.surfaceGrade,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
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
  authNoticeCard: {
    backgroundColor: colors.ink,
    marginBottom: spacing.base,
  },
  authNoticeTitle: {
    ...typography.captionCap,
    color: colors.onInk,
    fontWeight: '700',
    marginBottom: spacing.xxs,
  },
  authNoticeBody: {
    ...typography.bodyMd,
    color: colors.onInk,
    fontSize: 14,
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

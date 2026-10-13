import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase/client';
import { useAuth, DUMMY_USER_UID } from '../../../src/features/auth/AuthContext';
import { useTheme } from '../../../src/design/ThemeContext';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { ProjectCreateSchema } from '../../../src/lib/validation/schemas';
import { rounded, typography, spacing, ThemeColors } from '../../../src/design/tokens';
import { Project } from '../../../src/types';
import { saveProject } from '../../../src/features/dump/dumpService';

export default function NewProjectScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [autoLink, setAutoLink] = useState(true);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 30) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    setValidationError(null);

    const validation = ProjectCreateSchema.safeParse({
      title: title.trim(),
      brief: brief.trim() || null,
      notes: notes.trim(),
      tags,
      autoLinkEnabled: autoLink,
      autoLinkConfidenceThreshold: 0.75,
    });

    if (!validation.success) {
      setValidationError(validation.error.issues?.[0]?.message || 'Invalid input.');
      return;
    }

    setLoading(true);
    try {
      if (!user) {
        const newProj: Project = {
          id: `idea-${Date.now()}`,
          ownerUid: 'test',
          title: title.trim(),
          brief: brief.trim() || null,
          notes: notes.trim(),
          status: 'active',
          tags,
          autoLinkEnabled: autoLink,
          autoLinkConfidenceThreshold: 0.75,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveProject(newProj);
        router.replace(`/(app)/project/${newProj.id}`);
        return;
      }

      const docRef = await addDoc(collection(db, 'users', user.uid, 'projects'), {
        ownerUid: user.uid,
        title: title.trim(),
        brief: brief.trim() || null,
        notes: notes.trim(),
        status: 'active',
        tags,
        autoLinkEnabled: autoLink,
        autoLinkConfidenceThreshold: 0.75,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      router.replace(`/(app)/project/${docRef.id}`);
    } catch (err: any) {
      // Local fallback
      const fallbackProj: Project = {
        id: `idea-${Date.now()}`,
        ownerUid: user?.uid || DUMMY_USER_UID,
        title: title.trim(),
        brief: brief.trim() || null,
        notes: notes.trim(),
        status: 'active',
        tags,
        autoLinkEnabled: autoLink,
        autoLinkConfidenceThreshold: 0.75,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveProject(fallbackProj);
      router.replace(`/(app)/project/${fallbackProj.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav
        title="rut"
        subtitle="New Project"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/projects');
          }
        }}
        backTitle="IDEAS"
        rightAction={
          <Button
            title="✕ CLOSE"
            variant="text"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(app)/(tabs)/projects');
              }
            }}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Input
          label="PROJECT TITLE"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Autumn Brand Redesign"
          error={validationError && validationError.includes('title') ? validationError : undefined}
        />

        <Input
          label="BRIEF / OBJECTIVE"
          value={brief}
          onChangeText={setBrief}
          placeholder="What is this project aiming to solve or create?"
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: 'top' }}
        />

        <Input
          label="INITIAL NOTES &amp; CONCEPTS"
          value={notes}
          onChangeText={setNotes}
          placeholder="Draft thoughts, required components, references..."
          multiline
          numberOfLines={4}
          style={{ height: 100, textAlignVertical: 'top' }}
        />

        <View style={styles.tagSection}>
          <Input
            label="PROJECT TAGS"
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

        <View style={styles.toggleRow}>
          <Button
            title={autoLink ? 'AI AUTO-LINKING: ON' : 'AI AUTO-LINKING: OFF'}
            variant={autoLink ? 'primary' : 'secondary'}
            onPress={() => setAutoLink(!autoLink)}
            style={{ flex: 1 }}
          />
        </View>

        <Button
          title={loading ? 'CREATING PROJECT...' : 'CREATE PROJECT'}
          onPress={handleCreate}
          loading={loading}
          style={{ marginTop: spacing.xl }}
        />
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
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing.base,
  },
  tagSection: {
    marginTop: spacing.xs,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  toggleRow: {
    marginTop: spacing.base,
  },
});

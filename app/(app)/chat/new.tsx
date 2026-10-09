import React, { useState } from 'react';
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
import { useAuth } from '../../../src/features/auth/AuthContext';
import { AnnouncementBar } from '../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { colors, typography, spacing } from '../../../src/design/tokens';

export default function NewChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    const cleanTitle = title.trim() || 'New Train of Thought';

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
        ownerUid: user.uid,
        title: cleanTitle,
        pinnedInspirationIds: [],
        summary: null,
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      router.replace(`/(app)/chat/${docRef.id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not start chat session.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar pillText="NEW THOUGHT" message="Start an isolated exploration" />
      <TopNav
        title="rut"
        subtitle="New Train of Thought"
        rightAction={<Button title="✕ CLOSE" variant="text" onPress={() => router.back()} />}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.promptText}>
          Give your train of thought a focus or topic. Each chat has isolated memory and draws context from your inspiration bank.
        </Text>

        <Input
          label="THOUGHT TRAIN TITLE"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Minimalist Packaging Explorations"
          autoFocus
        />

        <Button
          title={loading ? 'STARTING...' : 'START TRAIN OF THOUGHT'}
          onPress={handleCreate}
          loading={loading}
          style={{ marginTop: spacing.base }}
        />
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
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing.xl,
  },
  promptText: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    marginBottom: spacing.xl,
  },
});

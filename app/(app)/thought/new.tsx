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
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useTheme } from '../../../src/design/ThemeContext';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { rounded, typography, spacing, ThemeColors } from '../../../src/design/tokens';
import { createChatSession } from '../../../src/features/chat/chatService';

export default function NewChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const cleanTitle = title.trim() || 'New Thought';
    setLoading(true);
    try {
      const session = await createChatSession(cleanTitle, {
        uid: user?.uid,
        seedGreeting: true,
      });

      router.replace(`/(app)/thought/${session.id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not start thought session.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav
        title="rut"
        subtitle="New Thought"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/thoughts');
          }
        }}
        backTitle="THOUGHTS"
        rightAction={
          <Button
            title="✕ CLOSE"
            variant="text"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(app)/(tabs)/thoughts');
              }
            }}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.promptText}>
          Give your thought a focus or topic. Each thought exploration has isolated memory and draws context from your inspiration bank.
        </Text>

        <Input
          label="THOUGHT TITLE"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Minimalist Packaging Explorations"
          autoFocus
        />

        <Button
          title={loading ? 'STARTING...' : 'START THOUGHT'}
          onPress={handleCreate}
          loading={loading}
          style={{ marginTop: spacing.base }}
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
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  promptText: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    marginBottom: spacing.base,
    lineHeight: 22,
  },
});

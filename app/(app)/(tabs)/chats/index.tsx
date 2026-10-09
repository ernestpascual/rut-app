import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase/client';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { AnnouncementBar } from '../../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../../src/components/ui/TopNav';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { colors, rounded, typography, spacing } from '../../../../src/design/tokens';
import { ChatSession } from '../../../../src/types';

export default function ChatsListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'chats'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: ChatSession[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setChats(fetched);
        setLoading(false);
      },
      (err) => {
        console.warn('Chats snapshot error:', err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar pillText="CHATS" message="Explore separate trains of thought with AI" />
      <TopNav
        title="rut"
        subtitle="Trains of Thought"
        rightAction={
          <Button
            title="+ NEW CHAT"
            onPress={() => router.push('/(app)/chat/new')}
            style={{ height: 36, paddingHorizontal: 16 }}
          />
        }
      />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>NO ACTIVE THOUGHT TRAINS</Text>
          <Text style={styles.emptySubtitle}>
            Each chat is an isolated exploration. Connect inspiration items, synthesize ideas, or brainstorm new concepts.
          </Text>
          <Button
            title="+ START A TRAIN OF THOUGHT"
            onPress={() => router.push('/(app)/chat/new')}
            style={{ marginTop: spacing.base }}
          />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card
              onPress={() => router.push(`/(app)/chat/${item.id}`)}
              style={styles.chatCard}
            >
              <View style={styles.chatHeader}>
                <Text style={styles.chatTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.pinnedInspirationIds && item.pinnedInspirationIds.length > 0 ? (
                  <Badge
                    label={`${item.pinnedInspirationIds.length} PINNED`}
                    variant="outline"
                  />
                ) : null}
              </View>

              {item.summary ? (
                <Text style={styles.summaryText} numberOfLines={2}>
                  {item.summary}
                </Text>
              ) : (
                <Text style={styles.emptySummaryText}>No recent messages</Text>
              )}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  listContent: {
    padding: spacing.base,
  },
  chatCard: {
    marginBottom: spacing.sm,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  chatTitle: {
    ...typography.bodyLg,
    color: colors.ink,
    flex: 1,
    marginRight: spacing.xs,
  },
  summaryText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  emptySummaryText: {
    ...typography.captionSm,
    color: colors.inkMid,
    fontStyle: 'italic',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.displayMd,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 340,
  },
});

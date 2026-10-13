import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase/client';
import { useAuth, DUMMY_USER_UID } from '../../../../src/features/auth/AuthContext';
import { useTheme } from '../../../../src/design/ThemeContext';
import { AnnouncementBar } from '../../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../../src/components/ui/TopNav';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../../../../src/design/tokens';
import { ChatSession } from '../../../../src/types';
import { getChatSessions, deleteChatSession } from '../../../../src/features/chat/chatService';

export default function ChatsListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Load local and remote sessions
    getChatSessions(user?.uid).then((list) => {
      if (isMounted) {
        setChats(list);
        setLoading(false);
      }
    });

    if (!user || user.uid === DUMMY_USER_UID) {
      return () => {
        isMounted = false;
      };
    }

    try {
      const q = query(
        collection(db, 'users', user.uid, 'chats'),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;
          const fetched: ChatSession[] = [];
          snapshot.forEach((docSnap) => {
            fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
          });
          if (fetched.length > 0) {
            setChats(fetched);
          }
          setLoading(false);
        },
        (err) => {
          console.warn('Chats snapshot error:', err);
          setLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch {
      return () => {
        isMounted = false;
      };
    }
  }, [user]);

  const handleDeleteChat = (chatId: string, title: string) => {
    Alert.alert('Delete Train of Thought', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteChatSession(chatId, user?.uid);
          setChats((prev) => prev.filter((c) => c.id !== chatId));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <Text style={styles.chatTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.projectId ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <Badge
                        label={`IDEA: ${item.projectTitle || 'LINKED'}`}
                        variant="inverse"
                      />
                    </View>
                  ) : null}
                </View>

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

              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>
                  {new Date(item.updatedAt).toLocaleDateString()}
                </Text>
                <Button
                  title="DELETE"
                  variant="text"
                  onPress={() => handleDeleteChat(item.id, item.title)}
                />
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 100,
  },
  chatCard: {
    marginBottom: spacing.sm,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  chatTitle: {
    ...typography.bodyLg,
    color: colors.ink,
  },
  summaryText: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  emptySummaryText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.hairlineGrade,
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
  },
  dateText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    fontSize: 10,
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
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.base,
    lineHeight: 22,
  },
});

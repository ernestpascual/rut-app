import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase/client';
import { useAuth, DUMMY_USER_UID } from '../../../../src/features/auth/AuthContext';
import { useTheme } from '../../../../src/design/ThemeContext';
import { TopNav } from '../../../../src/components/ui/TopNav';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../../../../src/design/tokens';
import { ChatSession } from '../../../../src/types';
import { getChatSessions, deleteChatSession } from '../../../../src/features/chat/chatService';

export default function ChatsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deleted?: string; title?: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === chats.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(chats.map((c) => c.id));
    }
  };

  const handleDeleteSelectedChats = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;

    const performDelete = async () => {
      setDeleting(true);
      try {
        for (const cid of selectedIds) {
          await deleteChatSession(cid, user?.uid);
        }
        setChats((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
        setToastMessage(`✓ ${count} ${count === 1 ? 'train of thought' : 'trains of thought'} permanently deleted.`);
        setSelectedIds([]);
        setSelectMode(false);
      } catch (err) {
        Alert.alert('Error', 'Failed to delete selected chats.');
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(
        `Delete Selected Chats?\n\nPermanently delete ${count} ${count === 1 ? 'train of thought' : 'trains of thought'}? This cannot be undone.`
      );
      if (confirmed) {
        await performDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Selected Chats',
      `Permanently delete ${count} ${count === 1 ? 'train of thought' : 'trains of thought'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDelete,
        },
      ]
    );
  };

  useEffect(() => {
    if (params.deleted === '1') {
      const chatTitle = params.title ? `"${params.title}"` : 'Train of thought';
      setToastMessage(`✓ ${chatTitle} permanently deleted.`);
    }
  }, [params.deleted, params.title]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

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
          setChats(fetched);
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

  const handleDeleteChat = async (chatId: string, title: string) => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(`Delete Train of Thought?\n\nAre you sure you want to permanently delete "${title}"? This cannot be undone.`);
      if (confirmed) {
        await deleteChatSession(chatId, user?.uid);
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        setToastMessage(`✓ "${title}" permanently deleted.`);
      }
      return;
    }

    Alert.alert('Delete Train of Thought', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteChatSession(chatId, user?.uid);
          setChats((prev) => prev.filter((c) => c.id !== chatId));
          setToastMessage(`✓ "${title}" permanently deleted.`);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopNav
        title="rut"
        subtitle={selectMode ? `${selectedIds.length} OF ${chats.length} SELECTED` : 'Trains of Thought'}
        leftAction={
          selectMode ? (
            <Button
              title="CANCEL"
              variant="text"
              onPress={() => {
                setSelectMode(false);
                setSelectedIds([]);
              }}
              style={{ height: 36, paddingHorizontal: 8 }}
            />
          ) : undefined
        }
        rightAction={
          selectMode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Button
                title={selectedIds.length === chats.length ? 'DESELECT' : 'SELECT ALL'}
                variant="secondary"
                onPress={handleToggleSelectAll}
                style={{ height: 36, paddingHorizontal: 10 }}
              />
              <Button
                title={deleting ? 'DELETING...' : `DELETE (${selectedIds.length})`}
                onPress={handleDeleteSelectedChats}
                disabled={selectedIds.length === 0 || deleting}
                style={{
                  height: 36,
                  paddingHorizontal: 12,
                  backgroundColor: colors.statusErrorText || '#E03131',
                  borderWidth: 0,
                }}
              />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              {chats.length > 0 && (
                <Button
                  title="SELECT"
                  variant="secondary"
                  onPress={() => setSelectMode(true)}
                  style={{ height: 36, paddingHorizontal: 12 }}
                />
              )}
              <Button
                title="+ NEW CHAT"
                onPress={() => router.push('/(app)/chat/new')}
                style={{ height: 36, paddingHorizontal: 16 }}
              />
            </View>
          )
        }
      />

      {toastMessage ? (
        <View style={styles.toastBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.xs }}>
            <Badge label="DELETED" variant="inverse" style={styles.toastBadge} />
            <Text style={styles.toastText} numberOfLines={2}>
              {toastMessage}
            </Text>
          </View>
          <Pressable
            onPress={() => setToastMessage(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
          >
            <Text style={styles.toastDismiss}>✕</Text>
          </Pressable>
        </View>
      ) : null}

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
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <Card
                onPress={() => {
                  if (selectMode) {
                    toggleSelect(item.id);
                  } else {
                    router.push(`/(app)/chat/${item.id}`);
                  }
                }}
                style={[styles.chatCard, selectMode && isSelected && styles.chatCardSelected]}
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

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    {item.pinnedInspirationIds && item.pinnedInspirationIds.length > 0 ? (
                      <Badge
                        label={`${item.pinnedInspirationIds.length} PINNED`}
                        variant="outline"
                      />
                    ) : null}

                    {selectMode && (
                      <View
                        style={[
                          styles.selectCheckbox,
                          isSelected && styles.selectCheckboxActive,
                        ]}
                      >
                        {isSelected && <Text style={styles.selectCheckboxCheck}>✓</Text>}
                      </View>
                    )}
                  </View>
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
                  {!selectMode && (
                    <Button
                      title="DELETE"
                      variant="text"
                      onPress={() => handleDeleteChat(item.id, item.title)}
                    />
                  )}
                </View>
              </Card>
            );
          }}
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
  chatCardSelected: {
    borderColor: colors.ink,
    backgroundColor: colors.surfaceGrade,
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
  selectCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 0,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  selectCheckboxActive: {
    backgroundColor: colors.ink,
  },
  selectCheckboxCheck: {
    color: colors.onInk,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
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
  toastBanner: {
    backgroundColor: '#E53935',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.2)',
  },
  toastBadge: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    marginRight: spacing.xs,
  },
  toastText: {
    ...typography.captionCap,
    color: '#FFFFFF',
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.5,
  },
  toastDismiss: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
});

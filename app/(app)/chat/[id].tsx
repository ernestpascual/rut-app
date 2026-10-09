import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Pressable
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../src/lib/firebase/client';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { AnnouncementBar } from '../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { SourceCard } from '../../../src/components/ui/SourceCard';
import { colors, rounded, typography, spacing } from '../../../src/design/tokens';
import { ChatMessage, ChatSession, InspirationItem } from '../../../src/types';

export default function ChatWorkspaceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Pinning modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [bankItems, setBankItems] = useState<InspirationItem[]>([]);
  const [pinnedMap, setPinnedMap] = useState<Record<string, InspirationItem>>({});

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user || !id) return;

    // Listen to session doc
    const sessionRef = doc(db, 'users', user.uid, 'chats', id);
    const unsubSession = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...(snap.data() as any) } as ChatSession;
        setSession(data);
      } else {
        router.replace('/(app)/(tabs)/chats');
      }
    });

    // Listen to messages subcollection
    const messagesQuery = query(
      collection(db, 'users', user.uid, 'chats', id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubMessages = onSnapshot(messagesQuery, (snap) => {
      const msgs: ChatMessage[] = [];
      snap.forEach((d) => msgs.push({ id: d.id, ...(d.data() as any) }));
      setMessages(msgs);
      setLoading(false);
    });

    return () => {
      unsubSession();
      unsubMessages();
    };
  }, [user, id]);

  // Load user inspirations to populate pinned details and picker
  useEffect(() => {
    if (!user) return;
    const fetchBank = async () => {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'inspirations'));
        const items: InspirationItem[] = [];
        const map: Record<string, InspirationItem> = {};
        snap.forEach((d) => {
          const item = { id: d.id, ...(d.data() as any) } as InspirationItem;
          items.push(item);
          map[item.id] = item;
        });
        setBankItems(items);
        setPinnedMap(map);
      } catch (err) {
        console.warn('Error fetching bank for chat:', err);
      }
    };
    fetchBank();
  }, [user]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user || !id || sending) return;
    const messageContent = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      // 1. Save user message locally
      await addDoc(
        collection(db, 'users', user.uid, 'chats', id, 'messages'),
        {
          role: 'user',
          content: messageContent,
          sourceInspirationIds: [],
          model: null,
          inputTokens: null,
          outputTokens: null,
          estimatedCostMicros: null,
          status: 'complete',
          createdAt: Date.now(),
        }
      );

      // 2. Call server function to generate assistant response with inspiration retrieval
      const chatFn = httpsCallable<
        { chatId: string; message: string },
        {
          response: string;
          sourceInspirationIds: string[];
          model: string;
          inputTokens: number;
          outputTokens: number;
          estimatedCostMicros: number;
        }
      >(functions, 'chatWithBank');

      const result = await chatFn({
        chatId: id,
        message: messageContent,
      });

      // 3. Save assistant message
      await addDoc(
        collection(db, 'users', user.uid, 'chats', id, 'messages'),
        {
          role: 'assistant',
          content: result.data.response,
          sourceInspirationIds: result.data.sourceInspirationIds || [],
          model: result.data.model || 'mock-model',
          inputTokens: result.data.inputTokens || 0,
          outputTokens: result.data.outputTokens || 0,
          estimatedCostMicros: result.data.estimatedCostMicros || 0,
          status: 'complete',
          createdAt: Date.now(),
        }
      );

      // 4. Update session updatedAt and rolling summary preview
      await updateDoc(doc(db, 'users', user.uid, 'chats', id), {
        summary: messageContent.slice(0, 100),
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      Alert.alert('AI Error', err.message || 'Could not generate AI response.');
      // Save failed notice message
      await addDoc(
        collection(db, 'users', user.uid, 'chats', id, 'messages'),
        {
          role: 'assistant',
          content: 'Unable to complete response. Please verify AI provider configuration.',
          sourceInspirationIds: [],
          model: null,
          inputTokens: null,
          outputTokens: null,
          estimatedCostMicros: null,
          status: 'failed',
          createdAt: Date.now(),
        }
      );
    } finally {
      setSending(false);
    }
  };

  const handleTogglePin = async (inspirationId: string) => {
    if (!user || !session) return;
    const existing = session.pinnedInspirationIds || [];
    const updated = existing.includes(inspirationId)
      ? existing.filter((pid) => pid !== inspirationId)
      : [...existing, inspirationId];

    try {
      await updateDoc(doc(db, 'users', user.uid, 'chats', session.id), {
        pinnedInspirationIds: updated,
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update pinned inspirations.');
    }
  };

  const handleCreateProjectFromMessage = async (content: string) => {
    if (!user) return;
    Alert.prompt
      ? Alert.prompt(
          'Create Project',
          'Enter a project title:',
          async (projectTitle) => {
            if (!projectTitle?.trim()) return;
            try {
              const projRef = await addDoc(collection(db, 'users', user.uid, 'projects'), {
                ownerUid: user.uid,
                title: projectTitle.trim(),
                brief: content.slice(0, 500),
                notes: content,
                status: 'active',
                tags: ['from-chat'],
                autoLinkEnabled: true,
                autoLinkConfidenceThreshold: 0.75,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              router.push(`/(app)/project/${projRef.id}`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        )
      : (async () => {
          // Fallback on web/Android
          try {
            const projRef = await addDoc(collection(db, 'users', user.uid, 'projects'), {
              ownerUid: user.uid,
              title: `Project: ${session?.title || 'Idea Exploration'}`,
              brief: content.slice(0, 500),
              notes: content,
              status: 'active',
              tags: ['from-chat'],
              autoLinkEnabled: true,
              autoLinkConfidenceThreshold: 0.75,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            router.push(`/(app)/project/${projRef.id}`);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        })();
  };

  if (loading || !session) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav title="rut" subtitle="Loading train of thought..." />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
        </View>
      </SafeAreaView>
    );
  }

  const pinnedItems = (session.pinnedInspirationIds || [])
    .map((pid) => pinnedMap[pid])
    .filter(Boolean);

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar
        pillText="TRAIN OF THOUGHT"
        message={session.title}
      />
      <TopNav
        title="rut"
        subtitle={session.title}
        rightAction={
          <Button
            title={`PIN (${(session.pinnedInspirationIds || []).length})`}
            variant="secondary"
            onPress={() => setPinModalOpen(true)}
            style={{ height: 36, paddingHorizontal: 12 }}
          />
        }
      />

      {/* Pinned inspirations banner if any */}
      {pinnedItems.length > 0 ? (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedLabel}>PINNED CONTEXT:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {pinnedItems.map((pi) => (
              <Badge
                key={pi.id}
                label={`${pi.title.slice(0, 20)}... ✕`}
                variant="inverse"
                style={{ marginRight: spacing.xs }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <View style={styles.bubbleHeader}>
                <Text
                  style={[
                    styles.roleLabel,
                    item.role === 'user' ? styles.userRoleLabel : styles.assistantRoleLabel,
                  ]}
                >
                  {item.role === 'user' ? 'YOU' : 'RUT ASSISTANT'}
                </Text>
                {item.estimatedCostMicros ? (
                  <Text style={styles.costBadge}>
                    ${(item.estimatedCostMicros / 1000000).toFixed(4)}
                  </Text>
                ) : null}
              </View>

              <Text
                style={[
                  styles.messageText,
                  item.role === 'user' ? styles.userText : styles.assistantText,
                ]}
              >
                {item.content}
              </Text>

              {/* Clickable Source Cards for Assistant citations */}
              {item.sourceInspirationIds && item.sourceInspirationIds.length > 0 ? (
                <View style={styles.sourcesContainer}>
                  <Text style={styles.sourcesHeader}>SOURCES RETRIEVED:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {item.sourceInspirationIds.map((sid: string) => {
                      const sourceItem = pinnedMap[sid];
                      if (!sourceItem) return null;
                      return (
                        <SourceCard
                          key={sid}
                          id={sid}
                          title={sourceItem.title}
                          domain={sourceItem.sourceDomain}
                          platform={sourceItem.sourcePlatform}
                          snippet={sourceItem.aiSummary || sourceItem.userNote}
                          onPress={() => router.push(`/(app)/inspiration/${sid}`)}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Action to convert useful response to Project */}
              {item.role === 'assistant' && item.status !== 'failed' ? (
                <View style={styles.messageActions}>
                  <Button
                    title="→ CREATE PROJECT FROM THIS"
                    variant="text"
                    onPress={() => handleCreateProjectFromMessage(item.content)}
                  />
                </View>
              ) : null}
            </View>
          )}
        />

        {sending ? (
          <View style={styles.generatingIndicator}>
            <ActivityIndicator size="small" color={colors.ink} />
            <Text style={styles.generatingText}>THINKING &amp; RETRIEVING FROM BANK...</Text>
          </View>
        ) : null}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <Input
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask AI to connect, compare, or expand your inspiration..."
            containerStyle={{ flex: 1, marginVertical: 0 }}
            onSubmitEditing={handleSendMessage}
          />
          <Button
            title="SEND"
            onPress={handleSendMessage}
            disabled={!inputText.trim() || sending}
            style={{ marginLeft: spacing.xs, height: 46 }}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Modal to Pin Inspirations to this Chat */}
      <Modal visible={pinModalOpen} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TopNav
              title="rut"
              subtitle="Pin Inspirations to Chat"
              rightAction={
                <Button
                  title="DONE"
                  variant="text"
                  onPress={() => setPinModalOpen(false)}
                />
              }
            />
            <ScrollView style={{ padding: spacing.base }}>
              <Text style={styles.modalSubhead}>
                Pinned inspirations are actively injected into the AI context for every prompt in this train of thought.
              </Text>
              {bankItems.map((bItem) => {
                const isPinned = (session.pinnedInspirationIds || []).includes(bItem.id);
                return (
                  <Card
                    key={bItem.id}
                    onPress={() => handleTogglePin(bItem.id)}
                    style={isPinned ? [styles.pinItemCard, styles.pinItemCardActive] : styles.pinItemCard}
                  >
                    <View style={styles.pinRow}>
                      <Text style={styles.pinItemTitle} numberOfLines={1}>
                        {bItem.title}
                      </Text>
                      <Badge
                        label={isPinned ? 'PINNED ✓' : '+ PIN'}
                        variant={isPinned ? 'inverse' : 'outline'}
                      />
                    </View>
                  </Card>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  pinnedBanner: {
    backgroundColor: colors.surfaceGrade,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinnedLabel: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.inkSoft,
    marginRight: spacing.xs,
  },
  messagesList: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  messageBubble: {
    marginBottom: spacing.base,
    padding: spacing.base,
    borderRadius: rounded.none,
  },
  userBubble: {
    backgroundColor: colors.ink,
    alignSelf: 'flex-end',
    maxWidth: '88%',
  },
  assistantBubble: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignSelf: 'flex-start',
    maxWidth: '94%',
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxs,
  },
  roleLabel: {
    ...typography.captionCap,
    fontSize: 9,
  },
  userRoleLabel: {
    color: colors.inkMid,
  },
  assistantRoleLabel: {
    color: colors.inkSoft,
  },
  costBadge: {
    ...typography.captionSm,
    color: colors.inkSoft,
    fontSize: 10,
  },
  messageText: {
    ...typography.bodyMd,
    lineHeight: 22,
  },
  userText: {
    color: colors.onInk,
  },
  assistantText: {
    color: colors.ink,
  },
  sourcesContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineGrade,
  },
  sourcesHeader: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.inkSoft,
    marginBottom: spacing.xxs,
  },
  messageActions: {
    marginTop: spacing.xs,
    alignItems: 'flex-start',
  },
  generatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  generatingText: {
    ...typography.captionCap,
    fontSize: 10,
    color: colors.inkSoft,
    marginLeft: spacing.xs,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  modalSubhead: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    marginBottom: spacing.base,
  },
  pinItemCard: {
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
  },
  pinItemCardActive: {
    borderColor: colors.ink,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinItemTitle: {
    ...typography.bodyMd,
    color: colors.ink,
    flex: 1,
    marginRight: spacing.xs,
  },
});

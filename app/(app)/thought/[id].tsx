import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Pressable,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../../src/lib/firebase/client';
import { useAuth, DUMMY_USER_UID } from '../../../src/features/auth/AuthContext';
import { useTheme } from '../../../src/design/ThemeContext';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { SourceCard } from '../../../src/components/ui/SourceCard';
import { MarkdownRenderer } from '../../../src/components/ui/MarkdownRenderer';
import { MacroPromptsDeck } from '../../../src/components/chat/MacroPromptsDeck';
import * as WebBrowser from 'expo-web-browser';
import { rounded, typography, spacing, ThemeColors } from '../../../src/design/tokens';
import { isPlatformTag } from '../../../src/design/platformColors';
import { ChatMessage, ChatSession, InspirationItem, Project } from '../../../src/types';
import {
  getChatSession,
  getChatMessages,
  sendChatMessage,
  saveChatSession,
  deleteChatSession,
  deleteChatMessage,
  getLocalChats,
  AVAILABLE_MODELS,
  DEFAULT_AI_MODEL,
  getUserPreferredModel,
  setUserPreferredModel,
  getWebAccessPreference,
  setWebAccessPreference,
  deduplicateMessages,
  getMessageDisplayText,
} from '../../../src/features/chat/chatService';
import { getDumpInspirations, saveProject } from '../../../src/features/dump/dumpService';
import { calculateDynamicInputHeight } from '../../../src/utils/inputHeight';

export default function ChatWorkspaceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_AI_MODEL);
  const [showModelModal, setShowModelModal] = useState(false);
  const [webAccessEnabled, setWebAccessEnabled] = useState(false);

  // Load web access preference
  useEffect(() => {
    getWebAccessPreference().then((pref) => {
      setWebAccessEnabled(pref);
    });
  }, []);

  const handleToggleWebAccess = async () => {
    const next = !webAccessEnabled;
    setWebAccessEnabled(next);
    await setWebAccessPreference(next);
  };

  // Pinning modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [bankItems, setBankItems] = useState<InspirationItem[]>([]);
  const [pinnedMap, setPinnedMap] = useState<Record<string, InspirationItem>>({});

  // Pull from Dump modal state
  const [pullDumpModalOpen, setPullDumpModalOpen] = useState(false);
  const [dumpSearchQuery, setDumpSearchQuery] = useState('');

  // Create Project Modal state (cross-platform alternative to Alert.prompt)
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [createProjectTitle, setCreateProjectTitle] = useState('');
  const [createProjectContent, setCreateProjectContent] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Hamburger menu and Delete confirmation modal states
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);

  // Collapsible citations state (keyed by message ID)
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});

  // Dynamic input height for auto-expanding textarea (max 5 lines)
  const [inputHeight, setInputHeight] = useState(44);

  const flatListRef = useRef<FlatList>(null);

  // Load session & messages with dual-mode fallback (local + Firestore)
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const loadLocalInitial = async () => {
      const pref = await getUserPreferredModel(user?.uid);
      const sess = await getChatSession(id, user?.uid);
      if (sess && isMounted) {
        setSession(sess);
        setSelectedModel(sess.model || pref || DEFAULT_AI_MODEL);
        const msgs = await getChatMessages(id, user?.uid);
        if (isMounted) {
          setMessages(msgs);
          setLoading(false);
        }
      } else {
        const localList = await getLocalChats();
        const found = localList.find((c) => c.id === id);
        if (found && isMounted) {
          setSession(found);
          setSelectedModel(found.model || pref || DEFAULT_AI_MODEL);
          const msgs = await getChatMessages(id, user?.uid);
          if (isMounted) {
            setMessages(msgs);
            setLoading(false);
          }
        } else if (isMounted) {
          if (pref) setSelectedModel(pref);
          setLoading(false);
        }
      }
    };

    loadLocalInitial();

    if (!user || user.uid === DUMMY_USER_UID) {
      return () => {
        isMounted = false;
      };
    }

    try {
      const sessionRef = doc(db, 'users', user.uid, 'chats', id);
      const unsubSession = onSnapshot(sessionRef, async (snap) => {
        if (!isMounted) return;
        if (snap.exists()) {
          const data = { id: snap.id, ...(snap.data() as any) } as ChatSession;
          setSession(data);
          if (data.model) {
            setSelectedModel(data.model);
          } else {
            const pref = await getUserPreferredModel(user?.uid);
            if (isMounted) {
              setSelectedModel(pref || DEFAULT_AI_MODEL);
            }
          }
        }
      });

      const messagesQuery = query(
        collection(db, 'users', user.uid, 'chats', id, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const unsubMessages = onSnapshot(
        messagesQuery,
        (snap) => {
          if (!isMounted) return;
          const remoteMsgs: ChatMessage[] = [];
          snap.forEach((d) => remoteMsgs.push({ id: d.id, ...(d.data() as any) }));
          if (remoteMsgs.length > 0) {
            setMessages((prev) => deduplicateMessages([...prev, ...remoteMsgs]));
          }
        },
        (err) => {
          console.warn('[thought] messages listener warning:', err);
        }
      );

      return () => {
        isMounted = false;
        unsubSession();
        unsubMessages();
      };
    } catch {
      // Local mode fallback
      return () => {
        isMounted = false;
      };
    }
  }, [user, id]);

  // Load bank items for references and pinning
  useEffect(() => {
    let isMounted = true;
    const fetchBank = async () => {
      let items: InspirationItem[] = [];
      if (user && user.uid !== DUMMY_USER_UID) {
        try {
          const snap = await getDocs(collection(db, 'users', user.uid, 'inspirations'));
          snap.forEach((d) => {
            items.push({ id: d.id, ...(d.data() as any) } as InspirationItem);
          });
        } catch {}
      }

      if (items.length === 0) {
        items = await getDumpInspirations();
      }

      if (!isMounted) return;
      setBankItems(items);
      const map: Record<string, InspirationItem> = {};
      items.forEach((item) => {
        map[item.id] = item;
      });
      setPinnedMap(map);
    };

    fetchBank();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSendMessage = async (
    customText?: string,
    options?: { webAccess?: boolean; displayText?: string }
  ) => {
    const textToSend = (customText !== undefined ? customText : inputText).trim();
    if (!textToSend || !id || sending) return;
    setInputText('');
    setInputHeight(44);
    setSending(true);

    const effectiveWebAccess =
      options?.webAccess !== undefined ? options.webAccess : webAccessEnabled;

    const userMessageId = `msg-user-${Date.now()}`;
    const optimisticUserMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: textToSend,
      displayContent: options?.displayText,
      sourceInspirationIds: [],
      model: null,
      inputTokens: null,
      outputTokens: null,
      estimatedCostMicros: null,
      status: 'complete',
      webAccess: effectiveWebAccess,
      createdAt: Date.now(),
    };

    setMessages((prev) => deduplicateMessages([...prev, optimisticUserMessage]));

    try {
      const pinnedItems = (session?.pinnedInspirationIds || [])
        .map((pid) => pinnedMap[pid])
        .filter(Boolean);

      const ideaContext = session?.projectId
        ? {
            title: session.projectTitle || session.title,
            brief: session.summary,
          }
        : null;

      const result = await sendChatMessage(id, textToSend, {
        userMessageId,
        uid: user?.uid,
        ideaContext,
        pinnedInspirations: pinnedItems,
        allInspirations: bankItems,
        model: selectedModel,
        webAccess: effectiveWebAccess,
        displayContent: options?.displayText,
      });

      // Update state immediately with final assistant message and confirmed user message
      setMessages((prev) =>
        deduplicateMessages([...prev, result.userMessage, result.assistantMessage])
      );

      // Update session summary and thesis statement in local state
      if (session) {
        setSession({
          ...session,
          thesisStatement: result.thesisStatement || session.thesisStatement,
          summary: (options?.displayText || textToSend).slice(0, 100),
          updatedAt: Date.now(),
        });
      }
    } catch (err: any) {
      Alert.alert('AI Notice', err.message || 'Could not complete thought train response.');
    } finally {
      setSending(false);
    }
  };

  const handleTogglePin = async (inspirationId: string) => {
    if (!session) return;
    const existing = session.pinnedInspirationIds || [];
    const updated = existing.includes(inspirationId)
      ? existing.filter((pid) => pid !== inspirationId)
      : [...existing, inspirationId];

    const updatedSession: ChatSession = {
      ...session,
      pinnedInspirationIds: updated,
      updatedAt: Date.now(),
    };

    setSession(updatedSession);
    await saveChatSession(updatedSession, user?.uid);
  };

  const openCreateProjectModal = (content: string) => {
    setCreateProjectContent(content);
    const suggestedTitle = session?.projectTitle
      ? `${session.projectTitle} — Extended Idea`
      : `Idea: ${session?.title || 'Thought Train'}`;
    setCreateProjectTitle(suggestedTitle);
    setCreateProjectModalOpen(true);
  };

  const handleConfirmCreateProject = async () => {
    if (!createProjectTitle.trim()) return;
    setCreatingProject(true);

    try {
      const newIdea: Project = {
        id: `idea-${Date.now()}`,
        ownerUid: user?.uid || DUMMY_USER_UID,
        title: createProjectTitle.trim(),
        brief: createProjectContent.slice(0, 300),
        notes: createProjectContent,
        status: 'active',
        tags: ['from-thought-train'],
        autoLinkEnabled: true,
        autoLinkConfidenceThreshold: 0.75,
        chatId: id,
        thoughtCount: messages.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveProject(newIdea);
      setCreateProjectModalOpen(false);
      router.push(`/(app)/project/${newIdea.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create idea.');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Are you sure you want to delete this message?')) {
        if (!id) return;
        deleteChatMessage(id, messageId, user?.uid);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      return;
    }
    Alert.alert('Delete Insight', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deleteChatMessage(id, messageId, user?.uid);
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        },
      },
    ]);
  };

  const handleDeleteChat = () => {
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!id) return;
    setDeletingChat(true);
    try {
      await deleteChatSession(id, user?.uid);
      setDeleteModalOpen(false);
      setMenuModalOpen(false);
      router.replace({
        pathname: '/(app)/(tabs)/thoughts',
        params: { deleted: '1', title: session?.title || 'Thought' },
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete thought.');
      setDeletingChat(false);
    }
  };

  if (loading && !session) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav
          title="rut"
          subtitle="Loading thought..."
          onBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(app)/(tabs)/thoughts');
            }
          }}
          backTitle="THOUGHTS"
        />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
        </View>
      </SafeAreaView>
    );
  }

  const activeTitle = session?.title || 'Thought';
  const pinnedItems = (session?.pinnedInspirationIds || [])
    .map((pid) => pinnedMap[pid])
    .filter(Boolean);

  return (
    <SafeAreaView style={styles.container}>
      <TopNav
        title="rut"
        subtitle={activeTitle}
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/thoughts');
          }
        }}
        backTitle="THOUGHTS"
        rightAction={
          <Pressable
            onPress={() => setMenuModalOpen(true)}
            style={styles.hamburgerBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Chat options menu"
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </Pressable>
        }
      />

      {/* Linked Idea Banner if connected to an Idea */}
      {session?.projectId ? (
        <Pressable
          style={styles.linkedIdeaBanner}
          onPress={() => router.push(`/(app)/project/${session.projectId}`)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Badge label="LINKED IDEA" variant="inverse" style={{ marginRight: spacing.xs }} />
            <Text style={styles.linkedIdeaTitle} numberOfLines={1}>
              {session.projectTitle || 'Idea Studio'}
            </Text>
          </View>
          <Text style={styles.linkedIdeaLink}>↗ VIEW IDEA</Text>
        </Pressable>
      ) : null}

      {/* Pinned inspirations banner if any */}
      {pinnedItems.length > 0 ? (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedLabel}>PINNED CONTEXT:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {pinnedItems.map((pi) => (
              <Badge
                key={pi.id}
                label={`${pi.title.slice(0, 24)}... ✕`}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>START A THOUGHT</Text>
              <Text style={styles.emptySubtitle}>
                Pose a creative query, hypothesize, or tap the ☰ menu to pull inspirations and toggle live web search.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <View style={styles.bubbleHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text
                    style={[
                      styles.roleLabel,
                      item.role === 'user' ? styles.userRoleLabel : styles.assistantRoleLabel,
                    ]}
                  >
                    {item.role === 'user' ? 'YOU' : 'RUT'}
                  </Text>
                  {item.webAccess ? (
                    <Badge label="🌐 LIVE WEB" variant="grade" style={{ marginLeft: 6 }} />
                  ) : null}
                </View>
                {item.estimatedCostMicros ? (
                  <Text style={styles.costBadge}>
                    ${(item.estimatedCostMicros / 1000000).toFixed(4)}
                  </Text>
                ) : null}
              </View>

              <MarkdownRenderer
                content={getMessageDisplayText(item)}
                isUser={item.role === 'user'}
              />

              {/* All sources used by answer (Collapsible) */}
              {item.role === 'assistant' && ((item.sourceInspirationIds?.length || 0) + (item.webSources?.length || 0)) > 0 ? (
                <View style={styles.sourcesContainer}>
                  <Pressable
                    onPress={() => {
                      setExpandedCitations((prev) => ({
                        ...prev,
                        [item.id]: !prev[item.id],
                      }));
                    }}
                    style={styles.sourcesCollapsibleHeader}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle Sources"
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Text style={styles.sourcesHeader}>
                        SOURCES ({(item.sourceInspirationIds?.length || 0) + (item.webSources?.length || 0)})
                      </Text>
                      <Text style={styles.sourcesToggleIndicator}>
                        {expandedCitations[item.id] ? '▲ COLLAPSE' : '▼ EXPAND'}
                      </Text>
                    </View>
                  </Pressable>

                  {expandedCitations[item.id] ? (
                    <View style={{ marginTop: spacing.xs }}>
                      {/* Bank Inspiration Sources */}
                      {item.sourceInspirationIds && item.sourceInspirationIds.length > 0 ? (
                        <View style={{ marginBottom: item.webSources && item.webSources.length > 0 ? spacing.xs : 0 }}>
                          {item.webSources && item.webSources.length > 0 ? (
                            <Text style={styles.sourceCategoryLabel}>BANK INSPIRATIONS ({item.sourceInspirationIds.length})</Text>
                          ) : null}
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
                            {item.sourceInspirationIds.map((sid: string) => {
                              const sourceItem = pinnedMap[sid] || bankItems.find((b) => b.id === sid);
                              return (
                                <SourceCard
                                  key={sid}
                                  id={sid}
                                  title={sourceItem?.title || `Inspiration [${sid.slice(-4)}]`}
                                  domain={sourceItem?.sourceDomain || null}
                                  platform={sourceItem?.sourcePlatform || 'BANK'}
                                  snippet={sourceItem?.aiSummary || sourceItem?.userNote || null}
                                  onPress={() => router.push(`/(app)/inspiration/${sid}`)}
                                />
                              );
                            })}
                          </ScrollView>
                        </View>
                      ) : null}

                      {/* Live Web Sources */}
                      {item.webSources && item.webSources.length > 0 ? (
                        <View style={{ marginTop: item.sourceInspirationIds && item.sourceInspirationIds.length > 0 ? spacing.xs : 0 }}>
                          {item.sourceInspirationIds && item.sourceInspirationIds.length > 0 ? (
                            <Text style={styles.sourceCategoryLabel}>WEB SOURCES ({item.webSources.length})</Text>
                          ) : null}
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
                            {item.webSources.map((ws: { title?: string; uri?: string }, wIdx: number) => {
                              const domain = ws.uri ? ws.uri.replace(/^https?:\/\//, '').split('/')[0] : '';
                              return (
                                <Pressable
                                  key={`web-${wIdx}`}
                                  style={styles.webSourceCard}
                                  onPress={() => {
                                    if (ws.uri) {
                                      WebBrowser.openBrowserAsync(ws.uri).catch(() => {});
                                    }
                                  }}
                                  accessibilityRole="link"
                                  accessibilityLabel={`Open web source: ${ws.title || ws.uri}`}
                                >
                                  <View style={styles.webSourceHeaderRow}>
                                    <View style={[styles.webPillTag, { backgroundColor: colors.ink }]}>
                                      <Text style={[styles.webPillText, { color: colors.onInk }]}>WEB</Text>
                                    </View>
                                    {domain ? (
                                      <Text style={[styles.webDomainText, { color: colors.inkSoft }]} numberOfLines={1}>
                                        {domain}
                                      </Text>
                                    ) : null}
                                  </View>
                                  <Text style={[styles.webTitleText, { color: colors.ink }]} numberOfLines={1}>
                                    {ws.title || ws.uri}
                                  </Text>
                                  <Text style={[styles.webLinkAction, { color: colors.inkSoft }]}>
                                    VISIT ↗
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}


              {/* Actions on Message */}
              <View style={styles.messageActions}>
                <Button
                  title="DELETE"
                  variant="text"
                  onPress={() => handleDeleteMessage(item.id)}
                  style={{ marginLeft: 'auto' }}
                />
              </View>
            </View>
          )}
        />

        {sending ? (
          <View style={styles.generatingIndicator}>
            <ActivityIndicator size="small" color={colors.ink} />
            <Text style={styles.generatingText}>
              {webAccessEnabled
                ? 'RESEARCHING LIVE WEB & DEVELOPING THOUGHT...'
                : 'DEVELOPING THOUGHT...'}
            </Text>
          </View>
        ) : null}

        {/* Macro Prompts & Ask a Friend Stream Deck */}
        <MacroPromptsDeck
          onSelectPrompt={(prompt, opts) => handleSendMessage(prompt, opts)}
          disabled={sending}
        />

        {/* Input Bar (Auto-expanding textarea up to 5 lines, default 1 line) */}
        <View style={styles.inputBar}>
          <Input
            value={inputText}
            onChangeText={(text) => {
              setInputText(text);
              setInputHeight(calculateDynamicInputHeight(text));
            }}
            multiline
            numberOfLines={1}
            onContentSizeChange={(e) => {
              const contentHeight = e.nativeEvent.contentSize.height;
              setInputHeight(calculateDynamicInputHeight(inputText, contentHeight));
            }}
            onKeyPress={(e: any) => {
              if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                e.preventDefault?.();
                handleSendMessage();
              }
            }}
            placeholder={
              webAccessEnabled
                ? 'Ask Gemini (Live Web Search active)...'
                : 'Pose a creative query, hypothesize, or explore...'
            }
            style={{
              height: inputHeight,
              maxHeight: 124,
              paddingTop: 10,
              paddingBottom: 10,
              textAlignVertical: 'top',
            }}
            containerStyle={{ flex: 1, marginVertical: 0 }}
          />
          <Button
            title="SEND →"
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || sending}
            style={{ marginLeft: spacing.xs, height: 44, paddingHorizontal: 14 }}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Model Selection Modal */}
      <Modal visible={showModelModal} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TopNav
              title="rut"
              subtitle="Select Gemini Model"
              rightAction={
                <Button
                  title="DONE"
                  variant="text"
                  onPress={() => setShowModelModal(false)}
                />
              }
            />
            <ScrollView style={{ padding: spacing.base }}>
              <Text style={styles.modalSubhead}>
                Select the model used for Thought synthesis and inspiration retrieval. Your choice is saved as your default model preference.
              </Text>
              {AVAILABLE_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <Card
                    key={m.id}
                    onPress={async () => {
                      setSelectedModel(m.id);
                      if (session) {
                        const updated = { ...session, model: m.id };
                        setSession(updated);
                        await saveChatSession(updated, user?.uid);
                      }
                      await setUserPreferredModel(m.id, user?.uid);
                      setShowModelModal(false);
                    }}
                    style={[
                      styles.pinItemCard,
                      isSelected ? styles.pinItemCardActive : null,
                      { padding: spacing.sm, marginBottom: spacing.sm },
                    ]}
                  >
                    <View style={styles.pinRow}>
                      <View style={{ flex: 1, marginRight: spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={[styles.pinItemTitle, { fontWeight: '700' }]}>{m.name}</Text>
                          <Badge
                            label={m.badge}
                            variant={isSelected ? 'inverse' : 'grade'}
                            style={{ marginLeft: spacing.xs }}
                          />
                        </View>
                        <Text style={{ color: colors.inkSoft, fontSize: 11, lineHeight: 16 }}>
                          {m.description}
                        </Text>
                      </View>
                      <Badge
                        label={isSelected ? 'ACTIVE ✓' : 'SELECT'}
                        variant={isSelected ? 'inverse' : 'outline'}
                      />
                    </View>
                  </Card>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

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
                Pinned inspirations are actively injected into the AI context for every prompt in this thought.
              </Text>
              {bankItems.length === 0 ? (
                <Text style={styles.emptySubtitle}>No inspirations saved in your Bank yet.</Text>
              ) : (
                bankItems.map((bItem) => {
                  const isPinned = (session?.pinnedInspirationIds || []).includes(bItem.id);
                  return (
                    <Card
                      key={bItem.id}
                      onPress={() => handleTogglePin(bItem.id)}
                      style={[
                        styles.pinItemCard,
                        isPinned ? styles.pinItemCardActive : null,
                      ]}
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
                })
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal to Create New Idea from Message (Cross-platform) */}
      <Modal visible={createProjectModalOpen} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TopNav
              title="rut"
              subtitle="Save to Ideas Studio"
              rightAction={
                <Button
                  title="✕"
                  variant="text"
                  onPress={() => setCreateProjectModalOpen(false)}
                />
              }
            />
            <ScrollView style={{ padding: spacing.base }}>
              <Text style={styles.modalSubhead}>
                Save this thought insight as a standalone Idea with matching inspiration references.
              </Text>
              <Input
                label="IDEA TITLE"
                value={createProjectTitle}
                onChangeText={setCreateProjectTitle}
                placeholder="Title for your new Idea"
              />
              <Card style={{ marginVertical: spacing.base, backgroundColor: colors.surfaceGrade }}>
                <Text style={styles.sourcesHeader}>INSIGHT EXCERPT:</Text>
                <Text style={styles.bodyText} numberOfLines={6}>
                  {createProjectContent}
                </Text>
              </Card>
              <Button
                title={creatingProject ? 'CREATING...' : 'CREATE IDEA & OPEN STUDIO'}
                onPress={handleConfirmCreateProject}
                loading={creatingProject}
                style={{ marginTop: spacing.sm }}
              />
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal to Pull and Check from Dump in the Chat */}
      <Modal visible={pullDumpModalOpen} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TopNav
              title="rut"
              subtitle="Pull & Check From Dump"
              rightAction={
                <Button
                  title="DONE"
                  variant="text"
                  onPress={() => setPullDumpModalOpen(false)}
                />
              }
            />
            <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.xs }}>
              <Input
                label="SEARCH DUMP INSPIRATIONS"
                value={dumpSearchQuery}
                onChangeText={setDumpSearchQuery}
                placeholder="Search by title, domain, or auto-tag (e.g. brutalist, concrete)..."
                containerStyle={{ marginVertical: 0 }}
              />
            </View>
            <ScrollView style={{ padding: spacing.base }}>
              <Text style={styles.modalSubhead}>
                Tap &ldquo;ASK AI ABOUT THIS&rdquo; to immediately inspect any dump item in this thought, or &ldquo;+ PIN CONTEXT&rdquo; to inject it into every prompt.
              </Text>
              {bankItems
                .filter((item) => {
                  if (!dumpSearchQuery.trim()) return true;
                  const q = dumpSearchQuery.toLowerCase();
                  return (
                    item.title.toLowerCase().includes(q) ||
                    (item.sourceDomain && item.sourceDomain.toLowerCase().includes(q)) ||
                    (item.siteName && item.siteName.toLowerCase().includes(q)) ||
                    (item.tags || []).some((t) => t.toLowerCase().includes(q)) ||
                    (item.editorialContext && item.editorialContext.toLowerCase().includes(q)) ||
                    (item.userNote && item.userNote.toLowerCase().includes(q))
                  );
                })
                .map((bItem) => {
                  const isPinned = (session?.pinnedInspirationIds || []).includes(bItem.id);
                  return (
                    <Card key={bItem.id} style={styles.dumpPullCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        {bItem.sourcePlatform && bItem.sourcePlatform !== 'web' ? (
                          <Badge
                            label={bItem.sourcePlatform.toUpperCase()}
                            platform={bItem.sourcePlatform}
                            style={{ marginRight: 6 }}
                          />
                        ) : bItem.siteName ? (
                          <Badge label={bItem.siteName.toUpperCase()} variant="outline" style={{ marginRight: 6 }} />
                        ) : bItem.sourceDomain ? (
                          <Badge label={bItem.sourceDomain.toUpperCase()} variant="outline" style={{ marginRight: 6 }} />
                        ) : null}
                        <Badge label={isPinned ? 'PINNED IN CONTEXT' : 'IN DUMP'} variant={isPinned ? 'inverse' : 'grade'} />
                      </View>

                      {bItem.remotePreviewImageUrl ? (
                        <Image
                          source={{ uri: bItem.remotePreviewImageUrl }}
                          style={styles.dumpPullThumb}
                          resizeMode="cover"
                        />
                      ) : null}

                      <Text style={styles.dumpPullTitle} numberOfLines={2}>
                        {bItem.title}
                      </Text>

                      {bItem.editorialContext ? (
                        <Text style={styles.dumpPullContext} numberOfLines={2}>
                          {bItem.editorialContext}
                        </Text>
                      ) : bItem.previewDescription ? (
                        <Text style={styles.dumpPullContext} numberOfLines={2}>
                          {bItem.previewDescription}
                        </Text>
                      ) : null}

                      {bItem.tags && bItem.tags.length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 4 }}>
                          {Array.from(new Set(bItem.tags))
                            .filter((t) => !isPlatformTag(t, bItem.sourcePlatform))
                            .slice(0, 5)
                            .map((t, idx) => (
                              <Badge key={`dump-tag-${t}-${idx}`} label={`#${t}`} variant="grade" style={{ marginRight: 4, marginBottom: 2 }} />
                            ))}
                        </View>
                      ) : null}

                      <View style={styles.dumpPullActionRow}>
                        <Button
                          title="💬 ASK AI ABOUT THIS"
                          variant="primary"
                          onPress={() => {
                            setPullDumpModalOpen(false);
                            handleSendMessage(
                              `Check and analyze this inspiration from my dump: "${bItem.title}" (${bItem.url || bItem.sourceDomain || 'saved item'}). Context: ${bItem.editorialContext || bItem.previewDescription || bItem.userNote || 'none'}. Auto-tags: ${(bItem.tags || []).join(', ')}. How can we apply its aesthetic and spatial principles to this thought train?`
                            );
                          }}
                          style={{ height: 34, paddingHorizontal: 12, marginRight: spacing.xs }}
                        />
                        <Button
                          title={isPinned ? 'UNPIN' : '+ PIN CONTEXT'}
                          variant="secondary"
                          onPress={() => handleTogglePin(bItem.id)}
                          style={{ height: 34, paddingHorizontal: 10 }}
                        />
                      </View>
                    </Card>
                  );
                })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Hamburger Options Menu Modal */}
      <Modal visible={menuModalOpen} animationType="slide" transparent>
        <SafeAreaView style={styles.menuModalBackdrop}>
          <View style={styles.menuModalSheet}>
            <View style={styles.menuModalHeader}>
              <View>
                <Text style={styles.menuModalBrand}>RUT // OPTIONS</Text>
                <Text style={styles.menuModalTitle}>Thought Menu</Text>
              </View>
              <Pressable
                onPress={() => setMenuModalOpen(false)}
                style={styles.menuCloseBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              >
                <Text style={styles.menuCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.menuBody} showsVerticalScrollIndicator={false}>
              {/* Option 1: Gemini Model */}
              <Pressable
                style={styles.menuItemCard}
                onPress={() => {
                  setMenuModalOpen(false);
                  setShowModelModal(true);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemSection}>AI INFERENCE MODEL</Text>
                  <Text style={styles.menuItemTitle}>
                    {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name || selectedModel}
                  </Text>
                  <Text style={styles.menuItemDesc}>
                    Tap to switch reasoning model & speed
                  </Text>
                </View>
                <Badge label="CHANGE →" variant="outline" />
              </Pressable>

              {/* Option 2: Pull from Dump */}
              <Pressable
                style={styles.menuItemCard}
                onPress={() => {
                  setMenuModalOpen(false);
                  setPullDumpModalOpen(true);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemSection}>KNOWLEDGE BASE</Text>
                  <Text style={styles.menuItemTitle}>Pull & Check From Dump</Text>
                  <Text style={styles.menuItemDesc}>
                    Browse saved inspirations, pin items into context, or ask AI directly
                  </Text>
                </View>
                <Badge label="BROWSE →" variant="outline" />
              </Pressable>

              {/* Option 3: Web Search Toggle */}
              <Pressable
                style={styles.menuItemCard}
                onPress={() => {
                  setWebAccessEnabled((prev) => !prev);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemSection}>LIVE WEB SEARCH</Text>
                  <Text style={styles.menuItemTitle}>
                    {webAccessEnabled ? '🌐 Live Web Search: ACTIVE' : '🌐 Live Web Search: OFF'}
                  </Text>
                  <Text style={styles.menuItemDesc}>
                    Ground responses with live Google web results and contemporary design trends
                  </Text>
                </View>
                <Badge
                  label={webAccessEnabled ? 'ENABLED ✓' : 'TURN ON'}
                  variant={webAccessEnabled ? 'inverse' : 'grade'}
                />
              </Pressable>

              {/* Option 4: Delete Session (Danger Zone) */}
              <Pressable
                style={[styles.menuItemCard, styles.menuItemDeleteCard]}
                onPress={() => {
                  setMenuModalOpen(false);
                  setDeleteModalOpen(true);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemSection, styles.dangerText]}>DANGER ZONE</Text>
                  <Text style={[styles.menuItemTitle, styles.dangerText]}>Delete Thought</Text>
                  <Text style={[styles.menuItemDesc, styles.dangerDesc]}>
                    Permanently delete this thought session and its full history
                  </Text>
                </View>
                <Badge label="DELETE" variant="inverse" style={styles.dangerBadge} />
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalOpen} animationType="fade" transparent>
        <View style={styles.confirmModalOverlay}>
          <View style={[styles.confirmModalCard, styles.confirmModalCardDanger]}>
            <Text style={[styles.confirmModalTitle, styles.dangerTitle]}>DELETE THOUGHT?</Text>
            <Text style={styles.confirmModalText}>
              Are you sure you want to delete this thought session? All messages and synthesized insights will be permanently erased. This cannot be undone.
            </Text>
            <View style={styles.confirmModalActions}>
              <Button
                title="CANCEL"
                variant="secondary"
                onPress={() => setDeleteModalOpen(false)}
                disabled={deletingChat}
                style={{ flex: 1, marginRight: spacing.xs }}
              />
              <Button
                title={deletingChat ? 'DELETING...' : 'DELETE FOREVER'}
                variant="primary"
                onPress={handleConfirmDelete}
                loading={deletingChat}
                style={{ flex: 1, marginLeft: spacing.xs, backgroundColor: '#E53935', borderColor: '#E53935' }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  linkedIdeaBanner: {
    backgroundColor: colors.surfaceGrade,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkedIdeaTitle: {
    ...typography.captionCap,
    color: colors.ink,
    fontWeight: '700',
    flex: 1,
  },
  linkedIdeaLink: {
    ...typography.captionCap,
    color: colors.ink,
    textDecorationLine: 'underline',
    fontWeight: '700',
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
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
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
  promptChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  promptChip: {
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.canvas,
  },
  promptChipText: {
    ...typography.captionCap,
    color: colors.ink,
    fontWeight: '600',
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
  bodyText: {
    ...typography.bodyMd,
    color: colors.ink,
    lineHeight: 20,
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
  brainstormSparksBar: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.surfaceGrade,
    paddingVertical: 6,
  },
  brainstormSparksContent: {
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brainstormSparkPill: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  brainstormSparkText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '600',
    color: colors.ink,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  sourcesCollapsibleHeader: {
    paddingVertical: 2,
  },
  sourcesToggleIndicator: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.6,
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
  dumpPullCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.base,
  },
  dumpPullThumb: {
    width: '100%',
    height: 120,
    backgroundColor: colors.canvas,
    marginVertical: spacing.xs,
  },
  dumpPullTitle: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  dumpPullContext: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  dumpPullActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  webToggleBtn: {
    height: 34,
    paddingHorizontal: 10,
    marginRight: spacing.xs,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webToggleBtnActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  webToggleBtnInactive: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
  },
  webToggleText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
  },
  webToggleTextActive: {
    color: colors.onInk,
  },
  webToggleTextInactive: {
    color: colors.inkSoft,
  },
  webAccessActiveBanner: {
    backgroundColor: colors.surfaceGrade,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    paddingHorizontal: spacing.base,
    paddingVertical: 6,
  },
  webAccessActiveText: {
    ...typography.captionCap,
    fontSize: 10,
    color: colors.ink,
    fontWeight: '700',
  },
  webSourcesContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineGrade,
  },
  webSourcePill: {
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceGrade,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  webSourcePillText: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.ink,
    fontWeight: '600',
  },
  sourceCategoryLabel: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  webSourceCard: {
    width: 220,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceGrade,
    padding: spacing.sm,
    marginRight: spacing.sm,
    justifyContent: 'space-between',
  },
  webSourceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  webPillTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rounded.none,
  },
  webPillText: {
    ...typography.captionCap,
    fontSize: 8,
    fontWeight: '700',
  },
  webDomainText: {
    ...typography.captionSm,
    fontSize: 10,
    flex: 1,
  },
  webTitleText: {
    ...typography.captionSm,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  webLinkAction: {
    ...typography.captionCap,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  promptChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  promptChipTextActive: {
    color: colors.onInk,
  },
  brainstormSparkPillWeb: {
    backgroundColor: colors.surfaceGrade,
    borderColor: colors.ink,
  },
  brainstormSparkTextWeb: {
    color: colors.ink,
    fontWeight: '700',
  },
  kbStatusBar: {
    backgroundColor: colors.surfaceGrade,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    paddingHorizontal: spacing.base,
    paddingVertical: 6,
  },
  kbStatusIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  kbStatusTitle: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  kbStatusBadgeDesc: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  kbStatusSubtitle: {
    ...typography.captionSm,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 2,
  },
  hamburgerBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerIcon: {
    fontSize: 22,
    color: colors.ink,
    lineHeight: 24,
  },
  menuModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  menuModalSheet: {
    backgroundColor: colors.canvas,
    borderTopWidth: 2,
    borderTopColor: colors.ink,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  menuModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    paddingBottom: spacing.sm,
  },
  menuModalBrand: {
    ...typography.captionCap,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  menuModalTitle: {
    ...typography.bodyLg,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  menuCloseBtn: {
    padding: spacing.xs,
  },
  menuCloseText: {
    fontSize: 18,
    color: colors.ink,
    fontWeight: '700',
  },
  menuBody: {
    paddingBottom: spacing.base,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    backgroundColor: colors.surfaceGrade,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  menuItemDeleteCard: {
    borderColor: '#E53935',
    borderWidth: 1.5,
    backgroundColor: 'rgba(229, 57, 53, 0.08)',
    marginTop: spacing.sm,
  },
  dangerText: {
    color: '#E53935',
    fontWeight: '700',
  },
  dangerDesc: {
    color: '#D32F2F',
  },
  dangerBadge: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },
  confirmModalCardDanger: {
    borderColor: '#E53935',
    borderWidth: 2,
  },
  dangerTitle: {
    color: '#E53935',
    fontWeight: '800',
  },
  dangerDeleteBtn: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },
  menuItemSection: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.inkSoft,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  menuItemTitle: {
    ...typography.bodyMd,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  menuItemDesc: {
    ...typography.captionSm,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
    paddingRight: spacing.sm,
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  confirmModalCard: {
    backgroundColor: colors.canvas,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  confirmModalTitle: {
    ...typography.bodyLg,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  confirmModalText: {
    ...typography.bodyMd,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkSoft,
    marginBottom: spacing.lg,
  },
  confirmModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

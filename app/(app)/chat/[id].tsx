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
import * as WebBrowser from 'expo-web-browser';
import { rounded, typography, spacing, ThemeColors } from '../../../src/design/tokens';
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
} from '../../../src/features/chat/chatService';
import { getDumpInspirations, saveProject } from '../../../src/features/dump/dumpService';

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

  // Load default model and web access preference
  useEffect(() => {
    getUserPreferredModel(user?.uid).then((pref) => {
      if (pref) setSelectedModel(pref);
    });
    getWebAccessPreference().then((pref) => {
      setWebAccessEnabled(pref);
    });
  }, [user?.uid]);

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

  const flatListRef = useRef<FlatList>(null);

  // Load session & messages with dual-mode fallback (local + Firestore)
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const loadLocalInitial = async () => {
      const sess = await getChatSession(id, user?.uid);
      if (sess && isMounted) {
        setSession(sess);
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
          const msgs = await getChatMessages(id, user?.uid);
          if (isMounted) {
            setMessages(msgs);
            setLoading(false);
          }
        } else if (isMounted) {
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
      const unsubSession = onSnapshot(sessionRef, (snap) => {
        if (!isMounted) return;
        if (snap.exists()) {
          const data = { id: snap.id, ...(snap.data() as any) } as ChatSession;
          setSession(data);
        }
      });

      const messagesQuery = query(
        collection(db, 'users', user.uid, 'chats', id, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const unsubMessages = onSnapshot(messagesQuery, (snap) => {
        if (!isMounted) return;
        if (!snap.empty) {
          const msgs: ChatMessage[] = [];
          snap.forEach((d) => msgs.push({ id: d.id, ...(d.data() as any) }));
          setMessages(msgs);
        }
      });

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

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : inputText).trim();
    if (!textToSend || !id || sending) return;
    setInputText('');
    setSending(true);

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
        uid: user?.uid,
        ideaContext,
        pinnedInspirations: pinnedItems,
        allInspirations: bankItems,
        model: selectedModel,
        webAccess: webAccessEnabled,
      });

      // Update state immediately
      setMessages((prev) => {
        const withoutDups = prev.filter(
          (m) => m.id !== result.userMessage.id && m.id !== result.assistantMessage.id
        );
        return [...withoutDups, result.userMessage, result.assistantMessage];
      });

      // Update session summary in local state
      if (session) {
        setSession({
          ...session,
          summary: textToSend.slice(0, 100),
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
    Alert.alert('Delete Train of Thought', 'Are you sure you want to delete this entire chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deleteChatSession(id, user?.uid);
          router.replace('/(app)/(tabs)/chats');
        },
      },
    ]);
  };

  if (loading && !session) {
    return (
      <SafeAreaView style={styles.container}>
        <TopNav
          title="rut"
          subtitle="Loading train of thought..."
          onBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(app)/(tabs)/chats');
            }
          }}
          backTitle="CHATS"
        />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
        </View>
      </SafeAreaView>
    );
  }

  const activeTitle = session?.title || 'Train of Thought';
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
            router.replace('/(app)/(tabs)/chats');
          }
        }}
        backTitle="CHATS"
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Button
              title="DELETE"
              variant="text"
              onPress={handleDeleteChat}
              style={{ marginRight: spacing.xs }}
            />
            <Pressable
              onPress={handleToggleWebAccess}
              style={[
                styles.webToggleBtn,
                webAccessEnabled ? styles.webToggleBtnActive : styles.webToggleBtnInactive,
              ]}
            >
              <Text
                style={[
                  styles.webToggleText,
                  webAccessEnabled ? styles.webToggleTextActive : styles.webToggleTextInactive,
                ]}
              >
                {webAccessEnabled ? '🌐 WEB: ON' : '🌐 WEB: OFF'}
              </Text>
            </Pressable>
            <Button
              title="📥 PULL DUMP"
              variant="secondary"
              onPress={() => setPullDumpModalOpen(true)}
              style={{ height: 34, paddingHorizontal: 10, marginRight: spacing.xs }}
            />
            <Button
              title={`PIN (${(session?.pinnedInspirationIds || []).length})`}
              variant="secondary"
              onPress={() => setPinModalOpen(true)}
              style={{ height: 34, paddingHorizontal: 10, marginRight: spacing.xs }}
            />
            <Button
              title={`⚡ ${selectedModel.replace('gemini-', '').toUpperCase()}`}
              variant="secondary"
              onPress={() => setShowModelModal(true)}
              style={{ height: 34, paddingHorizontal: 10 }}
            />
          </View>
        }
      />

      {/* Knowledge Base Grounding Bar */}
      <View style={styles.kbStatusBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={styles.kbStatusIcon}>📚</Text>
          <Text style={styles.kbStatusTitle}>KNOWLEDGE BASE: DUMP</Text>
          <Badge
            label={`${bankItems.length} SAVES`}
            variant="inverse"
            style={{ marginLeft: 6, marginRight: 6 }}
          />
          <Badge label="ON-DEMAND RAG" variant="grade" />
        </View>
        <Text style={styles.kbStatusSubtitle} numberOfLines={1}>
          Chat freely with Gemini — rut Agent draws from your Dump saves when relevant or requested.
        </Text>
      </View>

      {/* Live Web Grounding Banner */}
      {webAccessEnabled ? (
        <View style={styles.webAccessActiveBanner}>
          <Text style={styles.webAccessActiveText}>
            🌐 LIVE INTERNET GROUNDING ACTIVE — Synthesizing real-time design movements & web precedents
          </Text>
        </View>
      ) : null}

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
              <Text style={styles.emptyTitle}>RUT CONVERSATIONAL AGENT</Text>
              <Text style={styles.emptySubtitle}>
                Chat freely with Gemini, search live web movements, or draw on-demand from your Dump archive.
              </Text>
              <View style={styles.promptChipsContainer}>
                <Pressable
                  style={styles.promptChip}
                  onPress={() =>
                    handleSendMessage('Brainstorm 3 bold, unexpected concept angles for an experimental design project')
                  }
                >
                  <Text style={styles.promptChipText}>💬 Brainstorm From Scratch</Text>
                </Pressable>
                <Pressable
                  style={[styles.promptChip, { borderColor: colors.ink, backgroundColor: colors.surfaceGrade }]}
                  onPress={() =>
                    handleSendMessage(
                      'Search my dump knowledge base: What are the main recurring aesthetic themes, concepts, and materials across my saved inspirations?'
                    )
                  }
                >
                  <Text style={[styles.promptChipText, { fontWeight: '700' }]}>
                    📚 Ask Dump Knowledge Base
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.promptChip, webAccessEnabled && styles.promptChipActive]}
                  onPress={() => {
                    if (!webAccessEnabled) setWebAccessEnabled(true);
                    handleSendMessage('Scan the live web for contemporary design precedents, spatial installations, and brand movements in 2026');
                  }}
                >
                  <Text style={[styles.promptChipText, webAccessEnabled && styles.promptChipTextActive]}>
                    🌐 Live Web Trends
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.promptChip}
                  onPress={() => handleSendMessage('Suggest tactile materiality, textures, and an editorial color palette')}
                >
                  <Text style={styles.promptChipText}>🎨 Material & Palette</Text>
                </Pressable>
                <Pressable
                  style={styles.promptChip}
                  onPress={() => handleSendMessage('Critique and pressure-test this design concept to find the killer tension')}
                >
                  <Text style={styles.promptChipText}>🔍 Critique & Polish</Text>
                </Pressable>
              </View>
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
                    {item.role === 'user' ? 'YOU' : `RUT AGENT (${item.model || selectedModel})`}
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
                  <Text style={styles.sourcesHeader}>
                    📚 DUMP KNOWLEDGE BASE CITATIONS ({item.sourceInspirationIds.length}):
                  </Text>
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

              {/* Web Sources & Links */}
              {item.webSources && item.webSources.length > 0 ? (
                <View style={styles.webSourcesContainer}>
                  <Text style={styles.sourcesHeader}>LIVE WEB GROUNDING & PRECEDENTS:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {item.webSources.map((ws: { title?: string; uri?: string }, wIdx: number) => (
                      <Pressable
                        key={`ws-${wIdx}`}
                        style={styles.webSourcePill}
                        onPress={() => {
                          if (ws.uri) {
                            if (Platform.OS === 'web') {
                              window.open(ws.uri, '_blank');
                            } else {
                              WebBrowser.openBrowserAsync(ws.uri);
                            }
                          }
                        }}
                      >
                        <Text style={styles.webSourcePillText} numberOfLines={1}>
                          🌐 {ws.title || ws.uri} ↗
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Actions on Message */}
              <View style={styles.messageActions}>
                {item.role === 'assistant' && item.status !== 'failed' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs }}>
                    <Button
                      title="💬 DIVE DEEPER"
                      variant="text"
                      onPress={() => handleSendMessage(`Let's unpack and expand on this specific angle further: "${item.content.slice(0, 80)}..."`)}
                    />
                    <Button
                      title="→ SAVE AS NEW IDEA"
                      variant="text"
                      onPress={() => openCreateProjectModal(item.content)}
                    />
                  </View>
                ) : null}
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
                ? 'RESEARCHING LIVE WEB & DEVELOPING THOUGHT TRAIN...'
                : 'DEVELOPING TRAIN OF THOUGHT...'}
            </Text>
          </View>
        ) : null}

        {/* Quick Brainstorm Action Bar */}
        <View style={styles.brainstormSparksBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.brainstormSparksContent}
          >
            <Pressable
              style={[
                styles.brainstormSparkPill,
                webAccessEnabled && styles.brainstormSparkPillWeb,
              ]}
              onPress={() => {
                if (!webAccessEnabled) setWebAccessEnabled(true);
                handleSendMessage('Search the web for cutting-edge contemporary design trends, spatial installations, and brand movements relevant to this concept');
              }}
            >
              <Text style={[styles.brainstormSparkText, webAccessEnabled && styles.brainstormSparkTextWeb]}>
                🌐 Live Web Trends
              </Text>
            </Pressable>
            <Pressable
              style={styles.brainstormSparkPill}
              onPress={() => handleSendMessage('Give me 3 wild, counter-intuitive conceptual angles for this idea')}
            >
              <Text style={styles.brainstormSparkText}>⚡ Wild Angle</Text>
            </Pressable>
            <Pressable
              style={styles.brainstormSparkPill}
              onPress={() => handleSendMessage('Suggest sensory materials, tactile textures, and a color palette')}
            >
              <Text style={styles.brainstormSparkText}>🎨 Materials & Palette</Text>
            </Pressable>
            <Pressable
              style={styles.brainstormSparkPill}
              onPress={() => handleSendMessage('Critique this concept: what feels clichéd, and what is the killer hallmark detail?')}
            >
              <Text style={styles.brainstormSparkText}>🔍 Pressure Test</Text>
            </Pressable>
            <Pressable
              style={[styles.brainstormSparkPill, { borderColor: colors.ink }]}
              onPress={() => handleSendMessage('Search my dump knowledge base for the most relevant inspirations and synthesize their core ideas')}
            >
              <Text style={[styles.brainstormSparkText, { fontWeight: '700' }]}>📚 Query Dump KB</Text>
            </Pressable>
            <Pressable
              style={styles.brainstormSparkPill}
              onPress={() => handleSendMessage('What is the single most compelling tangible experiment or prototype to build next?')}
            >
              <Text style={styles.brainstormSparkText}>🚀 Next Move</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <Button
            title="📥 DUMP"
            variant="secondary"
            onPress={() => setPullDumpModalOpen(true)}
            style={{ marginRight: spacing.xs, height: 46, paddingHorizontal: 12 }}
          />
          <Input
            value={inputText}
            onChangeText={setInputText}
            placeholder="Chat freely with Gemini, search web, or ask about dump..."
            containerStyle={{ flex: 1, marginVertical: 0 }}
            onSubmitEditing={() => handleSendMessage()}
          />
          <Button
            title="SEND →"
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || sending}
            style={{ marginLeft: spacing.xs, height: 46, paddingHorizontal: 14 }}
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
                Select the model used for Train of Thought synthesis and inspiration retrieval. Your choice is saved as your default model preference.
              </Text>
              {AVAILABLE_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <Card
                    key={m.id}
                    onPress={() => {
                      setSelectedModel(m.id);
                      setUserPreferredModel(m.id, user?.uid);
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
                Pinned inspirations are actively injected into the AI context for every prompt in this train of thought.
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
                Save this train of thought insight as a standalone Idea with matching inspiration references.
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
                Tap &ldquo;ASK AI ABOUT THIS&rdquo; to immediately inspect any dump item in this train of thought, or &ldquo;+ PIN CONTEXT&rdquo; to inject it into every prompt.
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
                        {bItem.sourcePlatform ? (
                          <Badge label={bItem.sourcePlatform.toUpperCase()} variant="inverse" style={{ marginRight: 6 }} />
                        ) : null}
                        {bItem.siteName ? (
                          <Badge label={bItem.siteName} variant="outline" style={{ marginRight: 6 }} />
                        ) : bItem.sourceDomain ? (
                          <Badge label={bItem.sourceDomain} variant="outline" style={{ marginRight: 6 }} />
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
                          {Array.from(new Set(bItem.tags)).slice(0, 5).map((t, idx) => (
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
});
